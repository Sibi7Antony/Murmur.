/* Unit tests for engine types and mock engine. */

import { describe, it, expect } from 'vitest';
import { PRESETS, ENGINE_STATUSES, SIZE_WARN_BYTES, SIZE_HARD_CAP } from '../../src/engine/types';
import { MockEngine } from '../../src/engine/mock';

describe('PRESETS', () => {
  it('has three presets: robust, fast, quiet', () => {
    expect(Object.keys(PRESETS)).toEqual(['robust', 'fast', 'quiet']);
  });

  it('robust has 16 tones, 4 bits/symbol, 40ms symbols', () => {
    const r = PRESETS.robust;
    expect(r.toneCount).toBe(16);
    expect(r.bitsPerSymbol).toBe(4);
    expect(r.symbolDurationMs).toBe(40);
    expect(r.experimental).toBe(false);
  });

  it('fast has 32 tones, 5 bits/symbol, 25ms symbols', () => {
    const f = PRESETS.fast;
    expect(f.toneCount).toBe(32);
    expect(f.bitsPerSymbol).toBe(5);
    expect(f.symbolDurationMs).toBe(25);
  });

  it('quiet is experimental with near-ultrasonic base freq', () => {
    const q = PRESETS.quiet;
    expect(q.baseFreqHz).toBeGreaterThanOrEqual(17000);
    expect(q.experimental).toBe(true);
  });

  it('bits per symbol matches log2(toneCount)', () => {
    for (const p of Object.values(PRESETS)) {
      expect(p.bitsPerSymbol).toBe(Math.log2(p.toneCount));
    }
  });
});

describe('ENGINE_STATUSES', () => {
  it('has all required status names', () => {
    const expected = [
      'ready', 'requesting-mic', 'listening', 'locked',
      'receiving', 'sending', 'mic-blocked', 'unsupported', 'demo',
    ];
    expect(Object.keys(ENGINE_STATUSES).sort()).toEqual(expected.sort());
  });
});

describe('Size limits', () => {
  it('warn is 10 KB', () => {
    expect(SIZE_WARN_BYTES).toBe(10240);
  });

  it('hard cap is 64 KB', () => {
    expect(SIZE_HARD_CAP).toBe(65536);
  });
});

describe('MockEngine', () => {
  it('reports demo status', () => {
    const engine = new MockEngine();
    expect(engine.getStatus().name).toBe('demo');
    expect(engine.getStatus().label).toBe('Demo Mode');
  });

  it('provides audio settings', () => {
    const engine = new MockEngine();
    const settings = engine.getAudioSettings();
    expect(settings).not.toBeNull();
    expect(settings!.sampleRate).toBe(48000);
    expect(settings!.echoCancellation).toBe(false);
  });

  it('estimates transfer time for robust preset', () => {
    const engine = new MockEngine();
    const time = engine.estimateTransferTime(1024, 'robust');
    // 1024 bytes = 8192 bits. Robust: 4 bits / 40ms = 100 bps raw, 50 bps effective.
    // Expected: (8192 / 50) * 1000 = ~163840ms. Allow wide tolerance for the estimate.
    expect(time).toBeGreaterThan(50000);
    expect(time).toBeLessThan(500000);
  });

  it('emits level values via onLevel', async () => {
    const engine = new MockEngine();
    const levels: number[] = [];
    const unsub = engine.onLevel((l) => levels.push(l));

    await new Promise(r => setTimeout(r, 200));
    unsub();

    expect(levels.length).toBeGreaterThan(0);
    for (const l of levels) {
      expect(l).toBeGreaterThanOrEqual(0);
      expect(l).toBeLessThanOrEqual(1);
    }
  });

  it('creates a send session that progresses', async () => {
    const engine = new MockEngine();
    const file = new File([new Uint8Array(256)], 'test.bin');
    const session = engine.send(file, { preset: 'robust' });

    const states: string[] = [];
    session.subscribe((p) => states.push(p.state));

    await new Promise(r => setTimeout(r, 1200));
    session.stop();

    expect(states).toContain('active');
    expect(states[states.length - 1]).toBe('cancelled');
  });

  it('creates a loopback test session', async () => {
    const engine = new MockEngine();
    const session = engine.runLoopbackTest();

    const states: string[] = [];
    session.subscribe(s => states.push(s));

    await new Promise(r => setTimeout(r, 3500));

    expect(states).toContain('completed');
    const result = session.getResult();
    expect(result).not.toBeNull();
    expect((result as { passed: boolean }).passed).toBe(true);
  });
});
