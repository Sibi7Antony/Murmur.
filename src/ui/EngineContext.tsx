/* ===================================================================
 * Engine context -- provides the engine to all UI components.
 * =================================================================== */

import { createContext, useContext, useState, useEffect } from 'react';
import type { MurmurEngine, EngineStatus } from '../engine/types';
import { getEngine } from '../engine/index';

interface EngineContextValue {
  engine: MurmurEngine;
  status: EngineStatus;
  isMock: boolean;
}

const EngineCtx = createContext<EngineContextValue | null>(null);

export function useEngine(): EngineContextValue {
  const ctx = useContext(EngineCtx);
  if (!ctx) throw new Error('useEngine must be used within EngineProvider');
  return ctx;
}

export function useAudioLevel(): number {
  const { engine } = useEngine();
  const [level, setLevel] = useState(0);

  useEffect(() => {
    return engine.onLevel(setLevel);
  }, [engine]);

  return level;
}

export function EngineProvider({ children }: { children: React.ReactNode }) {
  const [engine] = useState(() => getEngine());
  const [status, setStatus] = useState(() => engine.getStatus());

  useEffect(() => {
    return engine.subscribe(setStatus);
  }, [engine]);

  const isMock = status.name === 'demo';

  return (
    <EngineCtx.Provider value={{ engine, status, isMock }}>
      {children}
    </EngineCtx.Provider>
  );
}
