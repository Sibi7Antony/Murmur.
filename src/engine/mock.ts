/* ===================================================================
 * Mock engine -- simulates the MurmurEngine interface for UI dev.
 * Activated with ?mock=1 or when no real engine is registered.
 * Always shows "Demo Mode" status.
 * =================================================================== */

import type {
  MurmurEngine,
  EngineStatus,
  AudioSettings,
  SendSession,
  ReceiveSession,
  TestSession,
  SendProgress,
  ReceiveProgress,
  ReceiveResult,
  SessionState,
  PresetName,
  LevelCallback,
  StatusCallback,
  ChannelTestResult,
  LoopbackTestResult,
} from './types';
import {
  ENGINE_STATUSES,
  PRESETS,
} from './types';

class MockSendSession implements SendSession {
  progress: SendProgress;
  private _subs: Array<(p: SendProgress) => void> = [];
  private _timer: ReturnType<typeof setInterval> | null = null;

  constructor(totalPackets: number) {
    this.progress = {
      state: 'preparing',
      packetsSent: 0,
      totalPackets,
      elapsedMs: 0,
      estimatedTotalMs: totalPackets * 200,
      loopCount: 0,
    };

    setTimeout(() => {
      this.progress = { ...this.progress, state: 'active' };
      this._notify();
      this._timer = setInterval(() => this._tick(), 200);
    }, 500);
  }

  private _tick() {
    if (this.progress.state !== 'active') return;
    const sent = this.progress.packetsSent + 1;
    const loopCount = Math.floor(sent / this.progress.totalPackets);
    this.progress = {
      ...this.progress,
      packetsSent: sent,
      elapsedMs: this.progress.elapsedMs + 200,
      loopCount,
    };
    this._notify();
  }

  subscribe(cb: (p: SendProgress) => void) {
    this._subs.push(cb);
    return () => {
      this._subs = this._subs.filter(s => s !== cb);
    };
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this.progress = { ...this.progress, state: 'cancelled' };
    this._notify();
  }

  private _notify() {
    this._subs.forEach(cb => cb(this.progress));
  }
}

class MockReceiveSession implements ReceiveSession {
  progress: ReceiveProgress;
  private _subs: Array<(p: ReceiveProgress) => void> = [];
  private _specSubs: Array<(bins: Float32Array) => void> = [];
  private _result: ReceiveResult | null = null;
  private _timer: ReturnType<typeof setInterval> | null = null;

  constructor(private _totalBlocks: number) {
    this.progress = {
      state: 'preparing',
      blocksReceived: 0,
      totalBlocks: _totalBlocks,
      packetsDecoded: 0,
      packetsFailed: 0,
      snrEstimate: null,
      elapsedMs: 0,
      needsPassphrase: false,
    };

    setTimeout(() => {
      this.progress = { ...this.progress, state: 'active', snrEstimate: 18.5 };
      this._notify();
      this._timer = setInterval(() => this._tick(), 300);
    }, 1000);
  }

  private _tick() {
    if (this.progress.state !== 'active') return;
    const received = this.progress.blocksReceived + 1;
    // Emit mock spectrogram data
    const bins = new Float32Array(128);
    for (let i = 0; i < 128; i++) bins[i] = Math.random() * 0.5;
    this._specSubs.forEach(cb => cb(bins));

    if (received >= this._totalBlocks) {
      this.progress = { ...this.progress, blocksReceived: received, state: 'completed', elapsedMs: this.progress.elapsedMs + 300 };
      this._result = {
        file: new File([new ArrayBuffer(1024)], 'mock-file.txt', { type: 'text/plain' }),
        filename: 'mock-file.txt',
        size: 1024,
        mimeType: 'text/plain',
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        verified: true,
        encrypted: false,
        elapsedMs: this.progress.elapsedMs + 300,
        packetsDecoded: received,
        packetsFailed: 0,
      };
      if (this._timer) clearInterval(this._timer);
      this._notify();
      return;
    }

    this.progress = {
      ...this.progress,
      blocksReceived: received,
      packetsDecoded: this.progress.packetsDecoded + 1,
      elapsedMs: this.progress.elapsedMs + 300,
    };
    this._notify();
  }

  subscribe(cb: (p: ReceiveProgress) => void) {
    this._subs.push(cb);
    return () => { this._subs = this._subs.filter(s => s !== cb); };
  }

  onSpectrogram(cb: (bins: Float32Array) => void) {
    this._specSubs.push(cb);
    return () => { this._specSubs = this._specSubs.filter(s => s !== cb); };
  }

  supplyPassphrase(_passphrase: string) {
    this.progress = { ...this.progress, needsPassphrase: false };
    this._notify();
  }

  getResult() { return this._result; }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this.progress = { ...this.progress, state: 'cancelled' };
    this._notify();
  }

  private _notify() { this._subs.forEach(cb => cb(this.progress)); }
}

class MockTestSession implements TestSession {
  private _state: SessionState = 'preparing';
  private _subs: Array<(s: SessionState) => void> = [];
  private _result: ChannelTestResult | LoopbackTestResult | null = null;

  constructor(type: 'channel' | 'loopback') {
    setTimeout(() => {
      this._state = 'active';
      this._notify();
      setTimeout(() => {
        this._state = 'completed';
        if (type === 'channel') {
          this._result = { ber: 0.001, snr: 22.5, recommendedPreset: 'robust' } satisfies ChannelTestResult;
        } else {
          this._result = {
            passed: true,
            detectedFrequency: 1000,
            audioSettings: {
              sampleRate: 48000,
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
              warnings: [],
            },
          } satisfies LoopbackTestResult;
        }
        this._notify();
      }, 2000);
    }, 500);
  }

  subscribe(cb: (s: SessionState) => void) {
    this._subs.push(cb);
    return () => { this._subs = this._subs.filter(s => s !== cb); };
  }

  getResult() { return this._result; }

  stop() {
    this._state = 'cancelled';
    this._notify();
  }

  private _notify() { this._subs.forEach(cb => cb(this._state)); }
}

export class MockEngine implements MurmurEngine {
  private _statusSubs: StatusCallback[] = [];
  private _levelSubs: LevelCallback[] = [];
  private _levelTimer: ReturnType<typeof setInterval>;

  constructor() {
    // Emit gentle ambient level for idle waveform animation
    this._levelTimer = setInterval(() => {
      const level = 0.05 + Math.random() * 0.1;
      this._levelSubs.forEach(cb => cb(level));
    }, 50);
  }

  /** Stop the ambient level emitter */
  destroy(): void {
    clearInterval(this._levelTimer);
  }

  getStatus(): EngineStatus {
    return ENGINE_STATUSES['demo'];
  }

  subscribe(cb: StatusCallback) {
    this._statusSubs.push(cb);
    return () => { this._statusSubs = this._statusSubs.filter(s => s !== cb); };
  }

  onLevel(cb: LevelCallback) {
    this._levelSubs.push(cb);
    return () => { this._levelSubs = this._levelSubs.filter(s => s !== cb); };
  }

  send(file: File, _opts: { preset: PresetName; passphrase?: string }): SendSession {
    const packetSize = 64;
    const totalPackets = Math.ceil(file.size / packetSize);
    return new MockSendSession(totalPackets);
  }

  receive(_opts: { preset: PresetName; passphrase?: string }): ReceiveSession {
    return new MockReceiveSession(16);
  }

  runChannelTest(): TestSession {
    return new MockTestSession('channel');
  }

  runLoopbackTest(): TestSession {
    return new MockTestSession('loopback');
  }

  getAudioSettings(): AudioSettings {
    return {
      sampleRate: 48000,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      warnings: ['Mock engine -- no real audio'],
    };
  }

  estimateTransferTime(sizeBytes: number, preset: PresetName): number {
    const p = PRESETS[preset];
    const bitsPerSecond = (p.bitsPerSymbol * 1000) / p.symbolDurationMs;
    // Rough estimate: 50% overhead for framing, FEC, sync
    const effectiveBps = bitsPerSecond * 0.5;
    return (sizeBytes * 8 / effectiveBps) * 1000;
  }
}

export function isMockMode(): boolean {
  if (typeof window === 'undefined') return true;
  const params = new URLSearchParams(window.location.search);
  return params.get('mock') === '1';
}
