/* ===================================================================
 * Audio Core: WebAudio Context, mic stream capture, and playback engine.
 * Request mic with echoCancellation, noiseSuppression, autoGainControl false.
 * Reads back track.getSettings() and produces warnings if browser ignored them.
 * =================================================================== */

import { AudioSettings } from '../engine/types';
import { WORKLET_CODE } from './recorder-worklet';

export class MurmurAudioEngine {
  private _ctx: AudioContext | null = null;
  private _stream: MediaStream | null = null;
  private _workletNode: AudioWorkletNode | null = null;
  private _analyser: AnalyserNode | null = null;
  private _audioSettings: AudioSettings | null = null;
  private _onPcmData: ((data: Float32Array) => void) | null = null;
  private _onLevel: ((level: number) => void) | null = null;
  private _levelAnimFrame: number | null = null;
  private _workletLoaded = false;
  private _activeSources: AudioBufferSourceNode[] = [];

  get isRunning(): boolean {
    return this._ctx !== null && this._ctx.state === 'running';
  }

  get sampleRate(): number {
    return this._ctx ? this._ctx.sampleRate : 48000;
  }

  get settings(): AudioSettings | null {
    return this._audioSettings;
  }

  async initContext(): Promise<AudioContext> {
    if (!this._ctx || this._ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this._ctx = new AudioCtx();
      this._workletLoaded = false;
    }
    if (this._ctx.state === 'suspended') {
      await this._ctx.resume();
    }
    return this._ctx;
  }

  async startListening(onPcmData: (data: Float32Array) => void): Promise<AudioSettings> {
    const ctx = await this.initContext();
    this._onPcmData = onPcmData;

    // Load worklet via Blob URL safely only once per AudioContext
    if (!this._workletLoaded) {
      const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      try {
        await ctx.audioWorklet.addModule(workletUrl);
        this._workletLoaded = true;
      } catch (err) {
        // If already added, mark as loaded
        this._workletLoaded = true;
      }
      setTimeout(() => {
        try {
          URL.revokeObjectURL(workletUrl);
        } catch {}
      }, 5000);
    }

    // Request raw audio without processing
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    this._stream = stream;

    // Check applied settings
    const track = stream.getAudioTracks()[0];
    const applied = track.getSettings();
    const warnings: string[] = [];

    if (applied.echoCancellation === true) {
      warnings.push('Browser could not disable Echo Cancellation');
    }
    if (applied.noiseSuppression === true) {
      warnings.push('Browser could not disable Noise Suppression');
    }
    if (applied.autoGainControl === true) {
      warnings.push('Browser could not disable Auto Gain Control');
    }

    this._audioSettings = {
      sampleRate: ctx.sampleRate,
      echoCancellation: applied.echoCancellation ?? false,
      noiseSuppression: applied.noiseSuppression ?? false,
      autoGainControl: applied.autoGainControl ?? false,
      warnings,
    };

    // Build audio routing graph
    const source = ctx.createMediaStreamSource(stream);
    this._analyser = ctx.createAnalyser();
    this._analyser.fftSize = 256;

    this._workletNode = new AudioWorkletNode(ctx, 'murmur-recorder');
    this._workletNode.port.onmessage = (e: MessageEvent<Float32Array>) => {
      if (this._onPcmData) {
        this._onPcmData(e.data);
      }
    };

    source.connect(this._analyser);
    source.connect(this._workletNode);

    this._startLevelMonitoring();
    return this._audioSettings;
  }

  onLevel(cb: (level: number) => void): () => void {
    this._onLevel = cb;
    return () => {
      if (this._onLevel === cb) this._onLevel = null;
    };
  }

  private _startLevelMonitoring(): void {
    if (!this._analyser) return;
    const buf = new Uint8Array(this._analyser.frequencyBinCount);

    const check = () => {
      if (!this._analyser) return;
      this._analyser.getByteTimeDomainData(buf);

      let peak = 0;
      for (let i = 0; i < buf.length; i++) {
        const val = Math.abs((buf[i] - 128) / 128);
        if (val > peak) peak = val;
      }

      if (this._onLevel) {
        this._onLevel(peak);
      }
      this._levelAnimFrame = requestAnimationFrame(check);
    };
    this._levelAnimFrame = requestAnimationFrame(check);
  }

  /**
   * Play audio buffer through speakers.
   */
  async playSamples(samples: Float32Array): Promise<void> {
    const ctx = await this.initContext();
    const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    buffer.copyToChannel(samples as any, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.value = 1.0;

    source.connect(gain);
    gain.connect(ctx.destination);

    this._activeSources.push(source);

    return new Promise((resolve) => {
      source.onended = () => {
        this._activeSources = this._activeSources.filter((s) => s !== source);
        resolve();
      };
      try {
        source.start();
      } catch {
        resolve();
      }
    });
  }

  stop(): void {
    if (this._levelAnimFrame) {
      cancelAnimationFrame(this._levelAnimFrame);
      this._levelAnimFrame = null;
    }
    // Stop any in-flight playback sources
    this._activeSources.forEach((s) => {
      try {
        s.stop();
      } catch {}
    });
    this._activeSources = [];

    if (this._stream) {
      this._stream.getTracks().forEach((t) => t.stop());
      this._stream = null;
    }
    if (this._workletNode) {
      this._workletNode.disconnect();
      this._workletNode = null;
    }
  }
}
