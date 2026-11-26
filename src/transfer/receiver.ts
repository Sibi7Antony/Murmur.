/* ===================================================================
 * Receiver State Machine.
 * Listens via AudioWorklet, detects preamble chirps, demodulates packets,
 * decodes fountain code, decrypts if required, and verifies SHA-256.
 * =================================================================== */

import {
  PresetName,
  PRESETS,
  ReceiveProgress,
  ReceiveSession,
  ReceiveResult,
} from '../engine/types';
import { FountainDecoder } from '../codec/fountain';
import { parseFrame, deserializeMetadata, MetadataPayload } from '../codec/framing';
import { decryptBytes, computeSha256Hex } from '../codec/crypto';
import { detectPreamble } from '../modem/sync';
import { MurmurAudioEngine } from '../audio/engine';

export class RealReceiveSession implements ReceiveSession {
  progress: ReceiveProgress;
  private _subs: Array<(p: ReceiveProgress) => void> = [];
  private _specSubs: Array<(bins: Float32Array) => void> = [];
  private _result: ReceiveResult | null = null;
  private _stopped = false;
  private _decoder: FountainDecoder | null = null;
  private _metadata: MetadataPayload | null = null;
  private _audioEngine: MurmurAudioEngine;
  private _passphraseResolve: ((p: string) => void) | null = null;
  private _rollingBuffer: Float32Array;
  private _bufferPos = 0;

  constructor(
    private readonly _presetName: PresetName,
    private readonly _passphrase: string | undefined,
    audioEngine: MurmurAudioEngine,
  ) {
    this._audioEngine = audioEngine;
    this._rollingBuffer = new Float32Array(48000 * 2); // 2 second circular buffer
    this.progress = {
      state: 'preparing',
      blocksReceived: 0,
      totalBlocks: 0,
      packetsDecoded: 0,
      packetsFailed: 0,
      snrEstimate: null,
      elapsedMs: 0,
      needsPassphrase: false,
    };

    this._startListening();
  }

  subscribe(cb: (p: ReceiveProgress) => void): () => void {
    this._subs.push(cb);
    return () => {
      this._subs = this._subs.filter((s) => s !== cb);
    };
  }

  onSpectrogram(cb: (bins: Float32Array) => void): () => void {
    this._specSubs.push(cb);
    return () => {
      this._specSubs = this._specSubs.filter((s) => s !== cb);
    };
  }

  supplyPassphrase(passphrase: string): void {
    if (this._passphraseResolve) {
      this._passphraseResolve(passphrase);
      this._passphraseResolve = null;
    }
  }

  getResult(): ReceiveResult | null {
    return this._result;
  }

  stop(): void {
    this._stopped = true;
    this.progress = { ...this.progress, state: 'cancelled' };
    this._notify();
  }

  private _notify(): void {
    this._subs.forEach((cb) => cb(this.progress));
  }

  private async _startListening(): Promise<void> {
    try {
      const preset = PRESETS[this._presetName];
      const startTime = Date.now();

      await this._audioEngine.startListening((pcmChunk) => {
        if (this._stopped) return;

        // Emit spectrogram bins for live UI canvas
        const binCount = 64;
        const bins = new Float32Array(binCount);
        const step = Math.floor(pcmChunk.length / binCount);
        for (let i = 0; i < binCount; i++) {
          let sum = 0;
          for (let j = 0; j < step; j++) {
            sum += Math.abs(pcmChunk[i * step + j]);
          }
          bins[i] = Math.min(1.0, (sum / step) * 4);
        }
        this._specSubs.forEach((cb) => cb(bins));

        // Append to rolling buffer
        for (let i = 0; i < pcmChunk.length; i++) {
          this._rollingBuffer[this._bufferPos] = pcmChunk[i];
          this._bufferPos = (this._bufferPos + 1) % this._rollingBuffer.length;
        }

        // Preamble detection
        const syncRes = detectPreamble(pcmChunk, preset, this._audioEngine.sampleRate);
        if (syncRes.detected) {
          this.progress = {
            ...this.progress,
            state: 'receiving',
            snrEstimate: syncRes.snrEstimate,
            elapsedMs: Date.now() - startTime,
          };
          this._notify();
        }
      });

      this.progress = { ...this.progress, state: 'active' };
      this._notify();
    } catch {
      this.progress = { ...this.progress, state: 'error' };
      this._notify();
    }
  }

  /**
   * Process a decoded raw frame from the demodulator.
   */
  async processFrame(frameBytes: Uint8Array): Promise<void> {
    const parsed = parseFrame(frameBytes);
    if (!parsed) {
      this.progress = {
        ...this.progress,
        packetsFailed: this.progress.packetsFailed + 1,
      };
      this._notify();
      return;
    }

    const { header, payload } = parsed;

    // Check if metadata packet
    if (header.packetIndex === 0xffff) {
      const meta = deserializeMetadata(payload);
      if (meta && !this._metadata) {
        this._metadata = meta;
        this._decoder = new FountainDecoder(meta.blockCount, meta.blockSize);
        this.progress = {
          ...this.progress,
          totalBlocks: meta.blockCount,
          needsPassphrase: meta.encrypted && !this._passphrase,
        };
        this._notify();
      }
      return;
    }

    // Source packet
    if (this._decoder && !this._decoder.isComplete) {
      this._decoder.addPacket(header.packetIndex, payload);
      this.progress = {
        ...this.progress,
        blocksReceived: this._decoder.recoveredCount,
        packetsDecoded: this.progress.packetsDecoded + 1,
      };
      this._notify();

      if (this._decoder.isComplete && this._metadata) {
        await this._finalizeTransfer();
      }
    }
  }

  private async _finalizeTransfer(): Promise<void> {
    if (!this._decoder || !this._metadata) return;

    let finalBytes = this._decoder.reconstruct(this._metadata.size);

    // Decrypt if encrypted
    if (this._metadata.encrypted) {
      let keyPhrase = this._passphrase;
      if (!keyPhrase) {
        this.progress = { ...this.progress, needsPassphrase: true };
        this._notify();
        keyPhrase = await new Promise<string>((resolve) => {
          this._passphraseResolve = resolve;
        });
      }

      const salt = new Uint8Array(
        this._metadata.saltHex!.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
      );
      const iv = new Uint8Array(
        this._metadata.ivHex!.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
      );

      finalBytes = await decryptBytes(
        { salt, iv, ciphertext: finalBytes },
        keyPhrase,
      );
    }

    // Verify SHA-256
    const calculatedHash = await computeSha256Hex(finalBytes);
    const verified = calculatedHash === this._metadata.sha256;

    const file = new File([finalBytes as any], this._metadata.filename, {
      type: this._metadata.mimeType,
    });

    this._result = {
      file,
      filename: this._metadata.filename,
      size: this._metadata.size,
      mimeType: this._metadata.mimeType,
      sha256: calculatedHash,
      verified,
      encrypted: this._metadata.encrypted,
      elapsedMs: this.progress.elapsedMs,
      packetsDecoded: this.progress.packetsDecoded,
      packetsFailed: this.progress.packetsFailed,
    };

    this.progress = { ...this.progress, state: 'completed' };
    this._notify();
  }
}
