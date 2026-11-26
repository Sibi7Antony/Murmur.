/* ===================================================================
 * Linear Chirp (swept sine) generator and matched filter matched pulse.
 * Used for preamble detection and frame synchronization.
 * =================================================================== */

export interface ChirpConfig {
  startFreqHz: number;
  endFreqHz: number;
  durationSec: number;
  sampleRate: number;
}

/**
 * Generate a linear frequency modulated (LFM) chirp.
 * Phase formula: phi(t) = 2*pi * (f0*t + ((f1 - f0)/(2*T)) * t^2)
 */
export function generateChirp(config: ChirpConfig): Float32Array {
  const { startFreqHz, endFreqHz, durationSec, sampleRate } = config;
  const numSamples = Math.round(durationSec * sampleRate);
  const samples = new Float32Array(numSamples);
  const k = (endFreqHz - startFreqHz) / durationSec;

  // Windowed edges with 5% raised cosine ramp to eliminate spectral splatter
  const rampSamples = Math.min(Math.round(numSamples * 0.05), Math.round(0.005 * sampleRate));

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const phase = 2 * Math.PI * (startFreqHz * t + 0.5 * k * t * t);
    let sample = Math.sin(phase);

    // Apply envelope at edges
    if (i < rampSamples) {
      const w = 0.5 * (1 - Math.cos((Math.PI * i) / rampSamples));
      sample *= w;
    } else if (i >= numSamples - rampSamples) {
      const idx = numSamples - 1 - i;
      const w = 0.5 * (1 - Math.cos((Math.PI * idx) / rampSamples));
      sample *= w;
    }

    samples[i] = sample;
  }

  return samples;
}

/**
 * Standard Murmur sync chirp: 1000 Hz to 4000 Hz over 0.2s.
 */
export function getStandardSyncChirp(sampleRate: number): Float32Array {
  return generateChirp({
    startFreqHz: 1000,
    endFreqHz: 4000,
    durationSec: 0.2,
    sampleRate,
  });
}

/**
 * Short packet re-sync chirp: 2000 Hz to 4000 Hz over 0.03s (30ms).
 */
export function getPacketSyncChirp(sampleRate: number): Float32Array {
  return generateChirp({
    startFreqHz: 2000,
    endFreqHz: 4000,
    durationSec: 0.03,
    sampleRate,
  });
}
