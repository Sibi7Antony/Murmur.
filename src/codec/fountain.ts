/* ===================================================================
 * Luby Transform (LT) Fountain Code.
 * Allows late-joining receivers and arbitrary packet drop tolerance.
 * Seeded PRNG ensures deterministic neighbor set generation.
 * =================================================================== */

// Simple 32-bit xorshift PRNG
export function createPrng(seed: number) {
  let s = (seed === 0 ? 0x12345678 : seed) >>> 0;
  return {
    nextUint32(): number {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return (s >>> 0);
    },
    nextFloat(): number {
      return (this.nextUint32() >>> 0) / 4294967296;
    },
  };
}

/**
 * Robust Soliton Distribution degree sampler.
 */
export function sampleDegree(k: number, prng: ReturnType<typeof createPrng>): number {
  if (k <= 1) return 1;

  // Parameters for Robust Soliton
  const c = 0.1;
  const delta = 0.5;
  const R = c * Math.log(k / delta) * Math.sqrt(k);

  const probs = new Float64Array(k + 1);
  let sum = 0.0;

  // Ideal soliton part
  probs[1] = 1 / k;
  for (let i = 2; i <= k; i++) {
    probs[i] = 1 / (i * (i - 1));
  }

  // Robust addition
  const kOverR = Math.round(k / R);
  for (let i = 1; i < kOverR && i <= k; i++) {
    probs[i] += R / (i * k);
  }
  if (kOverR <= k) {
    probs[kOverR] += (R * Math.log(R / delta)) / k;
  }

  for (let i = 1; i <= k; i++) sum += probs[i];
  for (let i = 1; i <= k; i++) probs[i] /= sum;

  const r = prng.nextFloat();
  let cumulative = 0.0;
  for (let d = 1; d <= k; d++) {
    cumulative += probs[d];
    if (r <= cumulative) return d;
  }
  return 1;
}

/**
 * Deterministically get neighbor block indices for a given packet index and block count K.
 */
export function getNeighbors(packetIndex: number, k: number): number[] {
  if (k <= 1) return [0];

  const prng = createPrng(packetIndex * 1337 + 42);
  const degree = sampleDegree(k, prng);

  const chosen = new Set<number>();
  while (chosen.size < degree && chosen.size < k) {
    const idx = prng.nextUint32() % k;
    chosen.add(idx);
  }
  return Array.from(chosen).sort((a, b) => a - b);
}

/**
 * Fountain encoder: splits source data into K blocks and generates encoded packets.
 */
export class FountainEncoder {
  readonly k: number;
  readonly blockSize: number;
  private readonly _blocks: Uint8Array[];

  constructor(data: Uint8Array, blockSize = 48) {
    this.blockSize = blockSize;
    this.k = Math.max(1, Math.ceil(data.length / blockSize));
    this._blocks = [];

    for (let i = 0; i < this.k; i++) {
      const block = new Uint8Array(blockSize);
      const start = i * blockSize;
      const slice = data.subarray(start, Math.min(data.length, start + blockSize));
      block.set(slice);
      this._blocks.push(block);
    }
  }

  /**
   * Produce payload for packet index.
   */
  encode(packetIndex: number): { neighbors: number[]; data: Uint8Array } {
    const neighbors = getNeighbors(packetIndex, this.k);
    const data = new Uint8Array(this.blockSize);

    for (const n of neighbors) {
      const b = this._blocks[n];
      for (let i = 0; i < this.blockSize; i++) {
        data[i] ^= b[i];
      }
    }
    return { neighbors, data };
  }
}

/**
 * Fountain decoder (Belief Propagation / Peeling decoder).
 */
export class FountainDecoder {
  readonly k: number;
  readonly blockSize: number;
  private readonly _sourceBlocks: Array<Uint8Array | null>;
  private _decodedCount = 0;
  private readonly _packetGraph: Array<{ neighbors: Set<number>; data: Uint8Array }> = [];

  constructor(k: number, blockSize = 48) {
    this.k = k;
    this.blockSize = blockSize;
    this._sourceBlocks = new Array(k).fill(null);
  }

  get isComplete(): boolean {
    return this._decodedCount >= this.k;
  }

  get recoveredCount(): number {
    return this._decodedCount;
  }

  /**
   * Add a received packet. Returns true if new blocks were recovered.
   */
  addPacket(packetIndex: number, data: Uint8Array): boolean {
    if (this.isComplete) return false;

    const neighbors = new Set(getNeighbors(packetIndex, this.k));
    const packetData = new Uint8Array(data);

    // Cancel out already decoded blocks
    for (const n of neighbors) {
      const b = this._sourceBlocks[n];
      if (b !== null) {
        for (let i = 0; i < this.blockSize; i++) {
          packetData[i] ^= b[i];
        }
        neighbors.delete(n);
      }
    }

    if (neighbors.size === 0) return false;

    this._packetGraph.push({ neighbors, data: packetData });
    return this._peel();
  }

  private _peel(): boolean {
    let progress = false;
    let found = true;

    while (found) {
      found = false;
      for (let i = 0; i < this._packetGraph.length; i++) {
        const item = this._packetGraph[i];
        if (item.neighbors.size === 1) {
          const blockIdx = item.neighbors.values().next().value as number;
          if (this._sourceBlocks[blockIdx] === null) {
            const recoveredBlock = new Uint8Array(item.data);
            this._sourceBlocks[blockIdx] = recoveredBlock;
            this._decodedCount++;
            progress = true;
            found = true;

            // Reduce all other packets containing this block
            for (let j = 0; j < this._packetGraph.length; j++) {
              if (j === i) continue;
              const other = this._packetGraph[j];
              if (other.neighbors.has(blockIdx)) {
                for (let b = 0; b < this.blockSize; b++) {
                  other.data[b] ^= recoveredBlock[b];
                }
                other.neighbors.delete(blockIdx);
              }
            }
            item.neighbors.clear();
            break;
          }
        }
      }
    }
    return progress;
  }

  /**
   * Assemble original data (trimmed to targetLength if provided).
   */
  reconstruct(targetLength?: number): Uint8Array {
    if (!this.isComplete) throw new Error('Cannot reconstruct: not all blocks decoded');
    const total = this.k * this.blockSize;
    const out = new Uint8Array(total);
    for (let i = 0; i < this.k; i++) {
      out.set(this._sourceBlocks[i]!, i * this.blockSize);
    }
    return targetLength !== undefined ? out.subarray(0, targetLength) : out;
  }
}
