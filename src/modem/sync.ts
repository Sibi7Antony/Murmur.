/* ===================================================================
 * Synchronization & Preamble Detection.
 * Matched filter cross-correlation with linear chirps and sync words.
 * =================================================================== */

import { crossCorrelate } from '../dsp/fft';
import { getStandardSyncChirp, getPacketSyncChirp } from '../dsp/chirp';
import { ModemPreset } from '../engine/types';
import { SYNC_WORD } from '../codec/framing';
import { modulateMFSK } from './mfsk';

export interface SyncDetectionResult {
  detected: boolean;
  sampleIndex: number;
  snrEstimate: number;
}

/**
 * Generate full preamble: [chirp][chirp][sync word symbols]
 */
export function generatePreamble(preset: ModemPreset, sampleRate: number): Float32Array {
  const chirp1 = getStandardSyncChirp(sampleRate);
  const chirp2 = getStandardSyncChirp(sampleRate);
  const syncWordAudio = modulateMFSK(SYNC_WORD, preset, sampleRate);

  const total = chirp1.length + chirp2.length + syncWordAudio.length;
  const out = new Float32Array(total);
  out.set(chirp1, 0);
  out.set(chirp2, chirp1.length);
  out.set(syncWordAudio, chirp1.length + chirp2.length);
  return out;
}

/**
 * Generate per-packet short re-sync header: [short chirp][sync word]
 */
export function generatePacketHeaderSync(preset: ModemPreset, sampleRate: number): Float32Array {
  const chirp = getPacketSyncChirp(sampleRate);
  const syncWordAudio = modulateMFSK(SYNC_WORD, preset, sampleRate);
  const out = new Float32Array(chirp.length + syncWordAudio.length);
  out.set(chirp, 0);
  out.set(syncWordAudio, chirp.length);
  return out;
}

/**
 * Detect sync preamble in incoming rolling buffer.
 */
export function detectPreamble(
  buffer: Float32Array,
  _preset: ModemPreset,
  sampleRate: number,
  threshold = 8.0, // Peak-to-average ratio threshold
): SyncDetectionResult {
  const chirp = getStandardSyncChirp(sampleRate);
  if (buffer.length < chirp.length * 2) {
    return { detected: false, sampleIndex: -1, snrEstimate: 0 };
  }

  const corr = crossCorrelate(buffer, chirp);

  let maxVal = 0;
  let maxIdx = 0;
  let sum = 0;

  for (let i = 0; i < corr.length; i++) {
    const val = Math.abs(corr[i]);
    sum += val;
    if (val > maxVal) {
      maxVal = val;
      maxIdx = i;
    }
  }

  const avg = sum / corr.length;
  const peakToAvg = avg > 0 ? maxVal / avg : 0;
  const snrEst = peakToAvg > 1 ? 20 * Math.log10(peakToAvg) : 0;

  if (peakToAvg >= threshold) {
    return {
      detected: true,
      sampleIndex: maxIdx,
      snrEstimate: Math.round(snrEst * 10) / 10,
    };
  }

  return { detected: false, sampleIndex: -1, snrEstimate: Math.round(snrEst * 10) / 10 };
}
