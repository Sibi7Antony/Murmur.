import { describe, it, expect } from 'vitest';
import { fft, ifft, crossCorrelate } from '../../src/dsp/fft';
import { goertzel } from '../../src/dsp/goertzel';
import { getStandardSyncChirp } from '../../src/dsp/chirp';

describe('FFT vs Naive DFT', () => {
  function naiveDft(real: Float32Array): { re: Float32Array; im: Float32Array } {
    const n = real.length;
    const re = new Float32Array(n);
    const im = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      for (let t = 0; t < n; t++) {
        const angle = (-2 * Math.PI * k * t) / n;
        re[k] += real[t] * Math.cos(angle);
        im[k] += real[t] * Math.sin(angle);
      }
    }
    return { re, im };
  }

  it('matches naive DFT output on 64-sample test vector', () => {
    const n = 64;
    const input = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      input[i] = Math.sin((2 * Math.PI * 4 * i) / n) + 0.5 * Math.cos((2 * Math.PI * 10 * i) / n);
    }

    const expected = naiveDft(input);

    const re = new Float32Array(input);
    const im = new Float32Array(n);
    fft(re, im);

    for (let i = 0; i < n; i++) {
      expect(re[i]).toBeCloseTo(expected.re[i], 1);
      expect(im[i]).toBeCloseTo(expected.im[i], 1);
    }
  });

  it('IFFT(FFT(x)) reconstructs original signal exactly', () => {
    const n = 128;
    const original = new Float32Array(n);
    for (let i = 0; i < n; i++) original[i] = Math.sin(i * 0.3) * 0.8;

    const re = new Float32Array(original);
    const im = new Float32Array(n);
    fft(re, im);
    ifft(re, im);

    for (let i = 0; i < n; i++) {
      expect(re[i]).toBeCloseTo(original[i], 3);
    }
  });

  it('cross-correlate finds chirp offset', () => {
    const needle = new Float32Array(32);
    needle[10] = 1.0;
    needle[11] = 0.8;

    const haystack = new Float32Array(128);
    const targetOffset = 40;
    haystack.set(needle, targetOffset);

    const corr = crossCorrelate(haystack, needle);
    let maxIdx = 0;
    let maxVal = -1;
    for (let i = 0; i < corr.length; i++) {
      if (corr[i] > maxVal) {
        maxVal = corr[i];
        maxIdx = i;
      }
    }
    expect(maxIdx).toBe(targetOffset);
  });
});

describe('Goertzel Algorithm', () => {
  it('detects a pure 1000 Hz tone among frequencies', () => {
    const sampleRate = 48000;
    const n = 1024;
    const targetFreq = 1000;
    const samples = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      samples[i] = Math.sin((2 * Math.PI * targetFreq * i) / sampleRate);
    }

    const targetRes = goertzel(samples, targetFreq, sampleRate);
    const otherRes = goertzel(samples, 1500, sampleRate);

    expect(targetRes.magnitude).toBeGreaterThan(100);
    expect(targetRes.power).toBeGreaterThan(otherRes.power * 20);
  });
});

describe('Chirp Generator', () => {
  it('generates standard sync chirp with correct duration and bounds', () => {
    const sampleRate = 48000;
    const chirp = getStandardSyncChirp(sampleRate);
    expect(chirp.length).toBe(Math.round(0.2 * sampleRate)); // 200 ms
    for (let i = 0; i < chirp.length; i++) {
      expect(Math.abs(chirp[i])).toBeLessThanOrEqual(1.01);
    }
  });
});
