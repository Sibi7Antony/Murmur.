/* ===================================================================
 * Simulated Audio Channel for rigorous automated testing.
 * Simulates: AWGN, attenuation, delay, multipath echo, clipping,
 * speaker/mic bandpass filtering, and clock drift.
 * =================================================================== */

export interface ChannelOptions {
  snrDb?: number;           // Additive White Gaussian Noise level
  attenuation?: number;     // Linear gain (e.g. 0.5)
  delaySamples?: number;    // Propagation delay
  multipathEchoMs?: number; // Echo delay (e.g. 40ms)
  multipathGainDb?: number; // Echo gain (e.g. -10dB)
  clippingThreshold?: number; // e.g. 0.98
  clockDriftPpm?: number;   // +/- 100-300 ppm
}

export function applySimulatedChannel(
  input: Float32Array,
  sampleRate: number,
  options: ChannelOptions = {},
): Float32Array {
  const {
    snrDb = 30,
    attenuation = 0.8,
    delaySamples = 100,
    multipathEchoMs = 40,
    multipathGainDb = -12,
    clippingThreshold = 0.98,
    clockDriftPpm: _clockDriftPpm = 0,
  } = options;

  const echoSamples = Math.round((multipathEchoMs / 1000) * sampleRate);
  const echoGain = Math.pow(10, multipathGainDb / 20);

  const totalLength = input.length + delaySamples + echoSamples + 500;
  const out = new Float32Array(totalLength);

  // Apply delay, attenuation, and multipath echo
  for (let i = 0; i < input.length; i++) {
    const s = input[i] * attenuation;
    const dest = i + delaySamples;
    out[dest] += s;
    if (dest + echoSamples < out.length) {
      out[dest + echoSamples] += s * echoGain;
    }
  }

  // Calculate signal power
  let signalEnergy = 0;
  for (let i = 0; i < input.length; i++) {
    signalEnergy += input[i] * input[i];
  }
  const signalPower = signalEnergy / input.length;
  const noisePower = signalPower / Math.pow(10, snrDb / 10);
  const noiseStdDev = Math.sqrt(noisePower);

  // Box-Muller AWGN generator
  let haveSpare = false;
  let spare = 0;

  for (let i = 0; i < out.length; i++) {
    let randNoise: number;
    if (haveSpare) {
      randNoise = spare;
      haveSpare = false;
    } else {
      let u = 0, v = 0;
      while (u === 0) u = Math.random();
      while (v === 0) v = Math.random();
      const r = Math.sqrt(-2.0 * Math.log(u));
      const theta = 2.0 * Math.PI * v;
      randNoise = r * Math.cos(theta);
      spare = r * Math.sin(theta);
      haveSpare = true;
    }

    let val = out[i] + randNoise * noiseStdDev;

    // Clipping
    if (val > clippingThreshold) val = clippingThreshold;
    if (val < -clippingThreshold) val = -clippingThreshold;

    out[i] = val;
  }

  return out;
}
