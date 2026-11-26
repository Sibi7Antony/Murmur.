/* ===================================================================
 * Fast Fourier Transform (Cooley-Tukey radix-2) and windowing functions.
 * Pure TypeScript, zero external dependencies.
 * =================================================================== */

export function nextPow2(n: number): number {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

/**
 * Apply Hann window in-place or return a new array.
 */
export function applyHannWindow(signal: Float32Array): Float32Array {
  const n = signal.length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
    out[i] = signal[i] * w;
  }
  return out;
}

/**
 * In-place radix-2 Decimation-In-Time (DIT) FFT.
 * real and imag must have length equal to a power of 2.
 */
export function fft(real: Float32Array, imag: Float32Array): void {
  const n = real.length;
  if (n <= 1) return;
  if ((n & (n - 1)) !== 0) {
    throw new Error(`FFT length must be a power of 2, got ${n}`);
  }

  // Bit reversal permutation
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      const tr = real[i];
      const ti = imag[i];
      real[i] = real[j];
      imag[i] = imag[j];
      real[j] = tr;
      imag[j] = ti;
    }
    let k = n >> 1;
    while (k <= j) {
      j -= k;
      k >>= 1;
    }
    j += k;
  }

  // Cooley-Tukey butterflies
  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1;
    const angleStep = (-2 * Math.PI) / len;
    const wStepReal = Math.cos(angleStep);
    const wStepImag = Math.sin(angleStep);

    for (let i = 0; i < n; i += len) {
      let wReal = 1.0;
      let wImag = 0.0;

      for (let k = 0; k < halfLen; k++) {
        const posEven = i + k;
        const posOdd = i + k + halfLen;

        const uReal = real[posEven];
        const uImag = imag[posEven];

        const vReal = real[posOdd] * wReal - imag[posOdd] * wImag;
        const vImag = real[posOdd] * wImag + imag[posOdd] * wReal;

        real[posEven] = uReal + vReal;
        imag[posEven] = uImag + vImag;

        real[posOdd] = uReal - vReal;
        imag[posOdd] = uImag - vImag;

        const nextWReal = wReal * wStepReal - wImag * wStepImag;
        const nextWImag = wReal * wStepImag + wImag * wStepReal;
        wReal = nextWReal;
        wImag = nextWImag;
      }
    }
  }
}

/**
 * Inverse FFT.
 */
export function ifft(real: Float32Array, imag: Float32Array): void {
  const n = real.length;
  // Conjugate input
  for (let i = 0; i < n; i++) {
    imag[i] = -imag[i];
  }
  fft(real, imag);
  // Conjugate output and scale by 1/n
  const invN = 1 / n;
  for (let i = 0; i < n; i++) {
    real[i] *= invN;
    imag[i] = -imag[i] * invN;
  }
}

/**
 * Compute power spectrum (squared magnitude) for first N/2 + 1 bins.
 */
export function powerSpectrum(real: Float32Array, imag: Float32Array): Float32Array {
  const half = (real.length >> 1) + 1;
  const p = new Float32Array(half);
  for (let i = 0; i < half; i++) {
    p[i] = real[i] * real[i] + imag[i] * imag[i];
  }
  return p;
}

/**
 * Frequency-domain cross-correlation via FFT.
 * Finds signal 'needle' inside 'haystack'.
 * Returns correlation score array where index k is the correlation when needle starts at haystack[k].
 */
export function crossCorrelate(haystack: Float32Array, needle: Float32Array): Float32Array {
  const convLen = nextPow2(haystack.length + needle.length);
  const hR = new Float32Array(convLen);
  const hI = new Float32Array(convLen);
  const nR = new Float32Array(convLen);
  const nI = new Float32Array(convLen);

  hR.set(haystack);
  // Time-reverse needle for cross-correlation
  for (let i = 0; i < needle.length; i++) {
    nR[i] = needle[needle.length - 1 - i];
  }

  fft(hR, hI);
  fft(nR, nI);

  // Multiply in frequency domain
  for (let i = 0; i < convLen; i++) {
    const r = hR[i] * nR[i] - hI[i] * nI[i];
    const im = hR[i] * nI[i] + hI[i] * nR[i];
    hR[i] = r;
    hI[i] = im;
  }

  ifft(hR, hI);

  // The convolution of haystack with time-reversed needle has peak at (offset + needle.length - 1).
  // Shift by (needle.length - 1) so index k corresponds to needle starting at haystack[k].
  const shift = needle.length - 1;
  const out = new Float32Array(haystack.length);
  for (let i = 0; i < haystack.length; i++) {
    if (i + shift < convLen) {
      out[i] = hR[i + shift];
    }
  }
  return out;
}
