/* ===================================================================
 * Engine facade -- automatically boots RealEngine in browser,
 * or MockEngine if ?mock=1 is explicitly requested.
 * =================================================================== */

import type { MurmurEngine } from './types';
import { MockEngine, isMockMode } from './mock';
import { RealEngine } from './real';

let _engine: MurmurEngine | null = null;

export function getEngine(): MurmurEngine {
  if (!_engine) {
    if (isMockMode()) {
      _engine = new MockEngine();
    } else {
      _engine = new RealEngine();
    }
  }
  return _engine;
}

export function registerEngine(engine: MurmurEngine): void {
  _engine = engine;
}

export { isMockMode };
export type { MurmurEngine };
