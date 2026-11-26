/* ===================================================================
 * MFSK Modulator & Demodulator with Gray coding and Hann symbol shaping.
 * Supports Robust, Fast, and Quiet presets.
 * =================================================================== */

import { ModemPreset } from '../engine/types';
import { goertzel } from '../dsp/goertzel';

/**
 * Binary to Gray code: g = b ^ (b >> 1)
 */
export function binaryToGray(val: number): number {
  return val ^ (val >> 1);
}

/**
 * Gray code to binary
 */
export function grayToBinary(gray: number): number {
  let bin = gray;
  while (gray >>= 1) {
    bin ^= gray;
  }
  return bin;
}

/**
 * Convert byte array into array of M-ary symbol indices.
 */
export function bytesToSymbols(bytes: Uint8Array, bitsPerSymbol: number): number[] {
  const symbols: number[] = [];
  let bitBuf = 0;
  let bitCount = 0;
  const mask = (1 << bitsPerSymbol) - 1;

  for (let i = 0; i < bytes.length; i++) {
    bitBuf = (bitBuf << 8) | bytes[i];
    bitCount += 8;

    while (bitCount >= bitsPerSymbol) {
      const shift = bitCount - bitsPerSymbol;
      const val = (bitBuf >> shift) & mask;
      symbols.push(binaryToGray(val));
      bitCount -= bitsPerSymbol;
    }
  }

  // Pad remaining bits
  if (bitCount > 0) {
    const val = (bitBuf << (bitsPerSymbol - bitCount)) & mask;
    symbols.push(binaryToGray(val));
  }

  return symbols;
}

/**
 * Convert array of M-ary symbol indices back to bytes.
 */
export function symbolsToBytes(symbols: number[], bitsPerSymbol: number, expectedBytes?: number): Uint8Array {
  const result: number[] = [];
  let bitBuf = 0;
  let bitCount = 0;

  for (const sym of symbols) {
    const val = grayToBinary(sym);
    bitBuf = (bitBuf << bitsPerSymbol) | val;
    bitCount += bitsPerSymbol;

    while (bitCount >= 8) {
      const shift = bitCount - 8;
      const byte = (bitBuf >> shift) & 0xff;
      result.push(byte);
      bitCount -= 8;
      if (expectedBytes && result.length >= expectedBytes) {
        return new Uint8Array(result);
      }
    }
  }

  return new Uint8Array(result);
}

/**
 * Modulate an array of symbols into continuous audio samples.
 * Uses 2-5ms Hann edge shaping per symbol to suppress clicks/sidebands.
 */
export function modulateMFSK(
  symbols: number[],
  preset: ModemPreset,
  sampleRate: number,
): Float32Array {
  const samplesPerSymbol = Math.round((preset.symbolDurationMs / 1000) * sampleRate);
  const rampSamples = Math.min(Math.round(0.003 * sampleRate), Math.floor(samplesPerSymbol * 0.2));
  const totalSamples = symbols.length * samplesPerSymbol;
  const out = new Float32Array(totalSamples);

  let phase = 0.0;

  for (let sIdx = 0; sIdx < symbols.length; sIdx++) {
    const sym = symbols[sIdx];
    const freq = preset.baseFreqHz + sym * preset.toneSpacingHz;
    const phaseInc = (2 * Math.PI * freq) / sampleRate;
    const offset = sIdx * samplesPerSymbol;

    for (let i = 0; i < samplesPerSymbol; i++) {
      let amp = 0.8;

      // Hann ramp on symbol edges
      if (i < rampSamples) {
        amp *= 0.5 * (1 - Math.cos((Math.PI * i) / rampSamples));
      } else if (i >= samplesPerSymbol - rampSamples) {
        const remaining = samplesPerSymbol - 1 - i;
        amp *= 0.5 * (1 - Math.cos((Math.PI * remaining) / rampSamples));
      }

      out[offset + i] = amp * Math.sin(phase);
      phase += phaseInc;
      if (phase > 2 * Math.PI) phase -= 2 * Math.PI;
    }
  }

  return out;
}

/**
 * Demodulate audio samples back into symbols using Goertzel.
 */
export function demodulateMFSK(
  samples: Float32Array,
  symbolCount: number,
  preset: ModemPreset,
  sampleRate: number,
): number[] {
  const samplesPerSymbol = Math.round((preset.symbolDurationMs / 1000) * sampleRate);
  const symbols: number[] = [];

  for (let sIdx = 0; sIdx < symbolCount; sIdx++) {
    const start = sIdx * samplesPerSymbol;
    if (start + samplesPerSymbol > samples.length) break;

    const slice = samples.subarray(start, start + samplesPerSymbol);
    let maxPower = -1;
    let bestSym = 0;

    for (let tone = 0; tone < preset.toneCount; tone++) {
      const freq = preset.baseFreqHz + tone * preset.toneSpacingHz;
      const g = goertzel(slice, freq, sampleRate);
      if (g.power > maxPower) {
        maxPower = g.power;
        bestSym = tone;
      }
    }

    symbols.push(bestSym);
  }

  return symbols;
}
