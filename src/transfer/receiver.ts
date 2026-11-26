/* ===================================================================
 * Receiver State Machine.
 * Listens via AudioWorklet, detects packet sync chirps, demodulates
 * MFSK symbols, decodes fountain code, decrypts if required, and verifies SHA-256.
 * =================================================================== */

import {
  PresetName,
  PRESETS,
  ReceiveProgress,
  ReceiveSession,
  ReceiveResult,
} from '../engine/types';
import { FountainDecoder } from '../codec/fountain';
import {
  parseFrame,
  deserializeMetadata,
  decodeHeader,
  MetadataPayload,
  PacketHeader,
  PROTOCOL_VERSION,
  SYNC_WORD,
} from '../codec/framing';
import { decryptBytes, computeSha256Hex } from '../codec/crypto';
import { detectPacketSync, verifySyncWord } from '../modem/sync';
import { demodulateMFSK, symbolsToBytes } from '../modem/mfsk';
import { getPacketSyncChirp } from '../dsp/chirp';
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
  private _streamBuffer: Float32Array = new Float32Array(0);
  private _pendingPackets: Array<{ header: PacketHeader; payload: Uint8Array }> = [];
  private _isProcessing = false;
  private _startTime = 0;

  constructor(
    private readonly _presetName: PresetName,
    private readonly _passphrase: string | undefined,
    audioEngine: MurmurAudioEngine,
  ) {
    this._audioEngine = audioEngine;
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
    this._audioEngine.stop();
  }

  private _notify(): void {
    this._subs.forEach((cb) => cb(this.progress));
  }

  private async _startListening(): Promise<void> {
    try {
      this._startTime = Date.now();

      await this._audioEngine.startListening((pcmChunk) => {
        if (this._stopped) return;

        // Emit spectrogram bins for live UI canvas
        const binCount = 64;
        const bins = new Float32Array(binCount);
        const step = Math.floor(pcmChunk.length / binCount);
        if (step > 0) {
          for (let i = 0; i < binCount; i++) {
            let sum = 0;
            for (let j = 0; j < step; j++) {
              sum += Math.abs(pcmChunk[i * step + j]);
            }
            bins[i] = Math.min(1.0, (sum / step) * 4);
          }
        }
        this._specSubs.forEach((cb) => cb(bins));

        // Append to stream buffer
        const newBuf = new Float32Array(this._streamBuffer.length + pcmChunk.length);
        newBuf.set(this._streamBuffer, 0);
        newBuf.set(pcmChunk, this._streamBuffer.length);
        this._streamBuffer = newBuf;

        // Trigger asynchronous stream processing
        this._processStream().catch(() => {});
      });

      this.progress = { ...this.progress, state: 'active' };
      this._notify();
    } catch {
      this.progress = { ...this.progress, state: 'error' };
      this._notify();
    }
  }

  /**
   * Scan incoming stream buffer for packet sync chirps, decode headers and demodulate frames.
   */
  private async _processStream(): Promise<void> {
    if (this._isProcessing || this._stopped) return;
    this._isProcessing = true;

    try {
      const preset = PRESETS[this._presetName];
      const sampleRate = this._audioEngine.sampleRate;
      const chirp = getPacketSyncChirp(sampleRate);
      const samplesPerSymbol = Math.round((preset.symbolDurationMs / 1000) * sampleRate);

      const headerSymbolCount = Math.ceil((8 * 8) / preset.bitsPerSymbol);
      const minPacketSamples = chirp.length + (SYNC_WORD.length + headerSymbolCount) * samplesPerSymbol;

      while (!this._stopped && this._streamBuffer.length >= minPacketSamples) {
        // Search window: up to 32768 samples (~0.68s at 48kHz)
        const searchLen = Math.min(this._streamBuffer.length, 32768);
        const searchWindow = this._streamBuffer.subarray(0, searchLen);

        const syncRes = detectPacketSync(searchWindow, sampleRate, 3.5);

        if (!syncRes.detected) {
          // No sync chirp detected: slide window forward, keeping safe chirp overlap
          const discard = Math.max(0, searchLen - chirp.length * 2);
          if (discard > 0) {
            this._sliceStreamBuffer(discard);
          }
          break; // Need more incoming samples
        }

        const peakIdx = syncRes.sampleIndex;
        const syncWordStart = peakIdx + chirp.length;
        const syncWordEnd = syncWordStart + SYNC_WORD.length * samplesPerSymbol;

        if (this._streamBuffer.length < syncWordEnd) {
          // Wait for more samples to arrive for sync word
          break;
        }

        // Check sync word
        const syncSlice = this._streamBuffer.subarray(syncWordStart, syncWordEnd);
        const syncSymbols = demodulateMFSK(syncSlice, SYNC_WORD.length, preset, sampleRate);

        if (!verifySyncWord(syncSymbols, SYNC_WORD, 4)) {
          // False trigger or corrupt sync word: advance past this chirp and continue
          this._sliceStreamBuffer(peakIdx + chirp.length);
          continue;
        }

        // Lock onto packet! Update UI SNR estimate
        this.progress = {
          ...this.progress,
          state: 'receiving',
          snrEstimate: syncRes.snrEstimate,
          elapsedMs: Date.now() - this._startTime,
        };
        this._notify();

        // Demodulate header
        const headerStart = syncWordEnd;
        const headerEnd = headerStart + headerSymbolCount * samplesPerSymbol;

        if (this._streamBuffer.length < headerEnd) {
          // Wait for header samples
          break;
        }

        const headerSlice = this._streamBuffer.subarray(headerStart, headerEnd);
        const headerSymbols = demodulateMFSK(headerSlice, headerSymbolCount, preset, sampleRate);
        const headerBytes = symbolsToBytes(headerSymbols, preset.bitsPerSymbol, 8);

        let header: PacketHeader;
        try {
          header = decodeHeader(headerBytes);
        } catch {
          this._sliceStreamBuffer(headerStart);
          continue;
        }

        if (header.version !== PROTOCOL_VERSION || header.payloadLen > 1024) {
          this._sliceStreamBuffer(headerStart);
          continue;
        }

        // Calculate full frame length: 8 (header) + payloadLen + 2 (CRC-16)
        const totalFrameBytes = 8 + header.payloadLen + 2;
        const totalFrameSymbols = Math.ceil((totalFrameBytes * 8) / preset.bitsPerSymbol);
        const totalFrameSamples = totalFrameSymbols * samplesPerSymbol;
        const packetEnd = headerStart + totalFrameSamples;

        if (this._streamBuffer.length < packetEnd) {
          // Wait for all payload & CRC samples to arrive
          break;
        }

        // Demodulate entire frame
        const frameSlice = this._streamBuffer.subarray(headerStart, packetEnd);
        const frameSymbols = demodulateMFSK(frameSlice, totalFrameSymbols, preset, sampleRate);
        const frameBytes = symbolsToBytes(frameSymbols, preset.bitsPerSymbol, totalFrameBytes);

        // Process frame
        await this.processFrame(frameBytes);

        // Advance buffer past this packet
        this._sliceStreamBuffer(packetEnd);
      }
    } finally {
      this._isProcessing = false;
    }
  }

  private _sliceStreamBuffer(offset: number): void {
    if (offset >= this._streamBuffer.length) {
      this._streamBuffer = new Float32Array(0);
    } else {
      // Allocate fresh buffer if offset has accumulated to prevent memory retention
      this._streamBuffer = this._streamBuffer.slice(offset);
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
        elapsedMs: Date.now() - this._startTime,
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
          state: 'receiving',
          totalBlocks: meta.blockCount,
          packetsDecoded: this.progress.packetsDecoded + 1,
          needsPassphrase: meta.encrypted && !this._passphrase,
          elapsedMs: Date.now() - this._startTime,
        };
        this._notify();

        // Drain any pending data packets received before metadata arrived
        for (const pending of this._pendingPackets) {
          if (!this._decoder.isComplete) {
            this._decoder.addPacket(pending.header.packetIndex, pending.payload);
            this.progress = {
              ...this.progress,
              blocksReceived: this._decoder.recoveredCount,
            };
          }
        }
        this._pendingPackets = [];
        this._notify();

        if (this._decoder.isComplete) {
          await this._finalizeTransfer();
        }
      }
      return;
    }

    // Data packet
    if (!this._decoder) {
      // Buffer packet until metadata arrives
      this._pendingPackets.push({ header, payload });
      this.progress = {
        ...this.progress,
        state: 'receiving',
        packetsDecoded: this.progress.packetsDecoded + 1,
        elapsedMs: Date.now() - this._startTime,
      };
      this._notify();
      return;
    }

    if (!this._decoder.isComplete) {
      this._decoder.addPacket(header.packetIndex, payload);
      this.progress = {
        ...this.progress,
        state: 'receiving',
        blocksReceived: this._decoder.recoveredCount,
        packetsDecoded: this.progress.packetsDecoded + 1,
        elapsedMs: Date.now() - this._startTime,
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
      elapsedMs: Date.now() - this._startTime,
      packetsDecoded: this.progress.packetsDecoded,
      packetsFailed: this.progress.packetsFailed,
    };

    this.progress = { ...this.progress, state: 'completed' };
    this._notify();
    this._audioEngine.stop();
  }
}
