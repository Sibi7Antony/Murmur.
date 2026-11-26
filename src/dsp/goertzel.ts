/* ===================================================================
 * Goertzel Algorithm for efficient single-frequency tone detection.
 * Complexity: O(N) multiplications, far lighter than full FFT for MFSK.
 * =================================================================== */

export interface GoertzelResult {
  readonly freqHz: number;
  readonly magnitude: number;
  readonly power: number;
}

/**
 * Computes Goertzel filter response for a specific target frequency.
 */
export function goertzel(
  samples: Float32Array,
  targetFreqHz: number,
  sampleRate: number,
): GoertzelResult {
  const n = samples.length;
  if (n === 0) return { freqHz: targetFreqHz, magnitude: 0, power: 0 };

  const omega = (2 * Math.PI * targetFreqHz) / sampleRate;
  const coeff = 2 * Math.cos(omega);

  let q0 = 0.0;
  let q1 = 0.0;
  let q2 = 0.0;

  for (let i = 0; i < n; i++) {
    q0 = coeff * q1 - q2 + samples[i];
    q2 = q1;
    q1 = q0;
  }

  const real = q1 - q2 * Math.cos(omega);
  const imag = q2 * Math.sin(omega);
  const power = real * real + imag * imag;
  const magnitude = Math.sqrt(power);

  return {
    freqHz: targetFreqHz,
    magnitude,
    power,
  };
}

/**
 * Detects tone energies across an array of frequencies using Goertzel.
 */
export function detectToneEnergies(
  samples: Float32Array,
  frequenciesHz: number[],
  sampleRate: number,
): Float32Array {
  const powers = new Float32Array(frequenciesHz.length);
  for (let i = 0; i < frequenciesHz.length; i++) {
    powers[i] = goertzel(samples, frequenciesHz[i], sampleRate).power;
  }
  return powers;
}
