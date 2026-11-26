/* ===================================================================
 * Sender State Machine.
 * Prepares file, applies compression/encryption, encodes via Fountain Code,
 * generates audio packets with preamble and transmits in continuous loop.
 * =================================================================== */

import { PresetName, PRESETS, SendProgress, SendSession } from '../engine/types';
import { FountainEncoder } from '../codec/fountain';
import { buildFrame, PacketHeader, serializeMetadata } from '../codec/framing';
import { encryptBytes, computeSha256Hex } from '../codec/crypto';
import { bytesToSymbols, modulateMFSK } from '../modem/mfsk';
import { generatePreamble, generatePacketHeaderSync } from '../modem/sync';
import { MurmurAudioEngine } from '../audio/engine';

export class RealSendSession implements SendSession {
  progress: SendProgress;
  private _subs: Array<(p: SendProgress) => void> = [];
  private _stopped = false;
  private _audioEngine: MurmurAudioEngine;

  constructor(
    private readonly _file: File,
    private readonly _presetName: PresetName,
    private readonly _passphrase: string | undefined,
    audioEngine: MurmurAudioEngine,
  ) {
    this._audioEngine = audioEngine;
    this.progress = {
      state: 'preparing',
      packetsSent: 0,
      totalPackets: 0,
      elapsedMs: 0,
      estimatedTotalMs: 0,
      loopCount: 0,
    };

    this._startSending();
  }

  subscribe(cb: (p: SendProgress) => void): () => void {
    this._subs.push(cb);
    return () => {
      this._subs = this._subs.filter((s) => s !== cb);
    };
  }

  stop(): void {
    this._stopped = true;
    this.progress = { ...this.progress, state: 'cancelled' };
    this._notify();
  }

  private _notify(): void {
    this._subs.forEach((cb) => cb(this.progress));
  }

  private async _startSending(): Promise<void> {
    try {
      const preset = PRESETS[this._presetName];
      const fileBytes = new Uint8Array(await this._file.arrayBuffer()) as any;
      const sha256 = await computeSha256Hex(fileBytes);

      let payloadBytes = fileBytes;
      let isEncrypted = false;
      let saltHex: string | undefined;
      let ivHex: string | undefined;

      // Optional passphrase encryption
      if (this._passphrase && this._passphrase.length > 0) {
        const enc = await encryptBytes(fileBytes, this._passphrase);
        payloadBytes = enc.ciphertext;
        isEncrypted = true;
        saltHex = Array.from(enc.salt).map(b => b.toString(16).padStart(2, '0')).join('');
        ivHex = Array.from(enc.iv).map(b => b.toString(16).padStart(2, '0')).join('');
      }

      // Fountain encoding
      const blockSize = 32; // 32-byte chunks per packet
      const encoder = new FountainEncoder(payloadBytes, blockSize);
      const totalBlocks = encoder.k;
      const sessionId = Math.floor(Math.random() * 65535);

      const metadataBytes = serializeMetadata({
        filename: this._file.name,
        size: this._file.size,
        mimeType: this._file.type || 'application/octet-stream',
        blockSize,
        blockCount: totalBlocks,
        encrypted: isEncrypted,
        saltHex,
        ivHex,
        sha256,
      });

      const sampleRate = this._audioEngine.sampleRate;
      this.progress = {
        state: 'active',
        packetsSent: 0,
        totalPackets: totalBlocks,
        elapsedMs: 0,
        estimatedTotalMs: totalBlocks * (preset.symbolDurationMs * (blockSize * 2) + 200),
        loopCount: 0,
      };
      this._notify();

      // Transmit preamble
      const preambleAudio = generatePreamble(preset, sampleRate);
      await this._audioEngine.playSamples(preambleAudio);

      const startTime = Date.now();
      let packetIdx = 0;

      // Loop packets until stopped
      while (!this._stopped) {
        // Send metadata packet every 4th packet
        let frameData: Uint8Array;
        let isMeta = false;

        if (packetIdx % 4 === 0) {
          isMeta = true;
          const header: PacketHeader = {
            version: 1,
            sessionId,
            packetIndex: 0xffff, // Reserved for metadata
            sourceBlockCount: totalBlocks,
            payloadLen: metadataBytes.length,
          };
          frameData = buildFrame(header, metadataBytes);
        } else {
          const encResult = encoder.encode(packetIdx);
          const header: PacketHeader = {
            version: 1,
            sessionId,
            packetIndex: packetIdx,
            sourceBlockCount: totalBlocks,
            payloadLen: encResult.data.length,
          };
          frameData = buildFrame(header, encResult.data);
        }

        // Convert frame to audio
        const symbols = bytesToSymbols(frameData, preset.bitsPerSymbol);
        const packetSyncAudio = generatePacketHeaderSync(preset, sampleRate);
        const dataAudio = modulateMFSK(symbols, preset, sampleRate);

        const packetAudio = new Float32Array(packetSyncAudio.length + dataAudio.length);
        packetAudio.set(packetSyncAudio, 0);
        packetAudio.set(dataAudio, packetSyncAudio.length);

        await this._audioEngine.playSamples(packetAudio);

        if (!isMeta) {
          packetIdx++;
        }

        this.progress = {
          ...this.progress,
          packetsSent: packetIdx,
          elapsedMs: Date.now() - startTime,
          loopCount: Math.floor(packetIdx / totalBlocks),
        };
        this._notify();
      }
    } catch (err) {
      this.progress = { ...this.progress, state: 'error' };
      this._notify();
    }
  }
}
