import { describe, it, expect } from 'vitest';
import { PRESETS } from '../../src/engine/types';
import { bytesToSymbols, symbolsToBytes, modulateMFSK, demodulateMFSK } from '../../src/modem/mfsk';
import { buildFrame, parseFrame, PacketHeader, SYNC_WORD } from '../../src/codec/framing';
import { getPacketSyncChirp } from '../../src/dsp/chirp';
import { crossCorrelate } from '../../src/dsp/fft';

describe('MFSK Modulation and Demodulation End-to-End', () => {
  it('modulates and demodulates a frame with 100% bit accuracy', () => {
    const preset = PRESETS.robust;
    const sampleRate = 48000;

    const header: PacketHeader = {
      version: 1,
      sessionId: 1234,
      packetIndex: 0,
      sourceBlockCount: 10,
      payloadLen: 32,
    };
    const payload = new Uint8Array(32);
    for (let i = 0; i < 32; i++) payload[i] = (i * 17 + 5) & 0xff;

    const frameBytes = buildFrame(header, payload);
    const symbols = bytesToSymbols(frameBytes, preset.bitsPerSymbol);

    const audio = modulateMFSK(symbols, preset, sampleRate);
    const demodSymbols = demodulateMFSK(audio, symbols.length, preset, sampleRate);

    expect(demodSymbols).toEqual(symbols);

    const recoveredBytes = symbolsToBytes(demodSymbols, preset.bitsPerSymbol, frameBytes.length);
    expect(Array.from(recoveredBytes)).toEqual(Array.from(frameBytes));

    const parsed = parseFrame(recoveredBytes);
    expect(parsed).not.toBeNull();
    expect(parsed!.header.sessionId).toBe(1234);
    expect(parsed!.header.packetIndex).toBe(0);
    expect(Array.from(parsed!.payload)).toEqual(Array.from(payload));
  });

  it('detects packet sync chirp and sync word timing in audio stream', () => {
    const preset = PRESETS.robust;
    const sampleRate = 48000;
    const chirp = getPacketSyncChirp(sampleRate);
    const syncWordAudio = modulateMFSK(SYNC_WORD, preset, sampleRate);

    // Create a buffer with some silence, then the packet sync, then data
    const silence = new Float32Array(2400); // 50ms silence
    const dataAudio = modulateMFSK([1, 2, 3, 4], preset, sampleRate);

    const stream = new Float32Array(silence.length + chirp.length + syncWordAudio.length + dataAudio.length);
    stream.set(silence, 0);
    stream.set(chirp, silence.length);
    stream.set(syncWordAudio, silence.length + chirp.length);
    stream.set(dataAudio, silence.length + chirp.length + syncWordAudio.length);

    // Cross-correlate stream with chirp
    const corr = crossCorrelate(stream, chirp);
    let maxVal = 0;
    let peakIdx = 0;
    for (let i = 0; i < corr.length; i++) {
      if (Math.abs(corr[i]) > maxVal) {
        maxVal = Math.abs(corr[i]);
        peakIdx = i;
      }
    }

    // The peak should be exactly at silence.length!
    expect(Math.abs(peakIdx - silence.length)).toBeLessThanOrEqual(5);

    // Demodulate sync word right after chirp
    const syncWordStart = peakIdx + chirp.length;
    const syncSlice = stream.subarray(syncWordStart, syncWordStart + syncWordAudio.length);
    const demodSync = demodulateMFSK(syncSlice, SYNC_WORD.length, preset, sampleRate);

    expect(demodSync).toEqual(SYNC_WORD);
  });
});
