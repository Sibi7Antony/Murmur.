/* ===================================================================
 * AudioWorklet Processor for high-performance audio capture.
 * Transmits raw Float32 audio chunks to main thread without blocking UI.
 * =================================================================== */

export const WORKLET_CODE = `
class MurmurRecorderProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];
      if (channelData && channelData.length > 0) {
        // Send a copy of the PCM buffer to the main thread
        this.port.postMessage(channelData);
      }
    }
    return true;
  }
}
registerProcessor('murmur-recorder', MurmurRecorderProcessor);
`;
