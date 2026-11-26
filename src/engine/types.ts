/* ===================================================================
 * Engine types -- the contract between the UI and the engine.
 * The UI imports only from this file, never from audio/dsp/modem/codec.
 * =================================================================== */

/* --- Presets -------------------------------------------------------- */

export type PresetName = 'robust' | 'fast' | 'quiet';

export interface ModemPreset {
  readonly name: PresetName;
  readonly label: string;
  readonly toneCount: number;
  readonly bitsPerSymbol: number;
  readonly toneSpacingHz: number;
  readonly baseFreqHz: number;
  readonly symbolDurationMs: number;
  readonly experimental: boolean;
}

export const PRESETS: Record<PresetName, ModemPreset> = {
  robust: {
    name: 'robust',
    label: 'Robust',
    toneCount: 16,
    bitsPerSymbol: 4,
    toneSpacingHz: 100,
    baseFreqHz: 1500,
    symbolDurationMs: 40,
    experimental: false,
  },
  fast: {
    name: 'fast',
    label: 'Fast',
    toneCount: 32,
    bitsPerSymbol: 5,
    toneSpacingHz: 100,
    baseFreqHz: 1500,
    symbolDurationMs: 25,
    experimental: false,
  },
  quiet: {
    name: 'quiet',
    label: 'Quiet',
    toneCount: 16,
    bitsPerSymbol: 4,
    toneSpacingHz: 150,
    baseFreqHz: 17000,
    symbolDurationMs: 40,
    experimental: true,
  },
} as const;

/* --- Size limits ---------------------------------------------------- */

export const SIZE_WARN_BYTES = 10 * 1024;   // soft warning above 10 KB
export const SIZE_HARD_CAP = 64 * 1024;     // hard cap 64 KB

/* --- Status --------------------------------------------------------- */

export type EngineStatusName =
  | 'ready'
  | 'requesting-mic'
  | 'listening'
  | 'locked'
  | 'receiving'
  | 'sending'
  | 'mic-blocked'
  | 'unsupported'
  | 'demo';

export interface EngineStatus {
  readonly name: EngineStatusName;
  readonly label: string;
  readonly color: string;
}

export const ENGINE_STATUSES: Record<EngineStatusName, EngineStatus> = {
  'ready':          { name: 'ready',          label: 'Ready to Connect',  color: 'var(--status-green)' },
  'requesting-mic': { name: 'requesting-mic', label: 'Requesting Mic',    color: 'var(--status-amber)' },
  'listening':      { name: 'listening',      label: 'Listening',         color: 'var(--status-blue)' },
  'locked':         { name: 'locked',         label: 'Locked',            color: 'var(--status-teal)' },
  'receiving':      { name: 'receiving',      label: 'Receiving',         color: 'var(--status-blue)' },
  'sending':        { name: 'sending',        label: 'Sending',           color: 'var(--status-amber)' },
  'mic-blocked':    { name: 'mic-blocked',    label: 'Mic Blocked',       color: 'var(--status-red)' },
  'unsupported':    { name: 'unsupported',    label: 'Unsupported Browser', color: 'var(--status-red)' },
  'demo':           { name: 'demo',           label: 'Demo Mode',         color: 'var(--status-violet)' },
};

/* --- Audio settings readback ---------------------------------------- */

export interface AudioSettings {
  readonly sampleRate: number;
  readonly echoCancellation: boolean;
  readonly noiseSuppression: boolean;
  readonly autoGainControl: boolean;
  /** Warnings about constraints the browser ignored */
  readonly warnings: string[];
}

/* --- Sessions ------------------------------------------------------- */

export type SessionState =
  | 'idle'
  | 'preparing'
  | 'active'
  | 'receiving'
  | 'paused'
  | 'completed'
  | 'error'
  | 'cancelled';

export interface SendProgress {
  readonly state: SessionState;
  readonly packetsSent: number;
  readonly totalPackets: number;
  readonly elapsedMs: number;
  readonly estimatedTotalMs: number;
  readonly loopCount: number;
}

export interface ReceiveProgress {
  readonly state: SessionState;
  readonly blocksReceived: number;
  readonly totalBlocks: number;
  readonly packetsDecoded: number;
  readonly packetsFailed: number;
  readonly snrEstimate: number | null;
  readonly elapsedMs: number;
  readonly needsPassphrase: boolean;
}

export interface SendSession {
  readonly progress: SendProgress;
  subscribe(cb: (progress: SendProgress) => void): () => void;
  stop(): void;
}

export interface ReceiveSession {
  readonly progress: ReceiveProgress;
  subscribe(cb: (progress: ReceiveProgress) => void): () => void;
  /** Subscribe to spectrogram frequency bins for the canvas */
  onSpectrogram(cb: (bins: Float32Array) => void): () => void;
  /** Supply a passphrase if the file is encrypted */
  supplyPassphrase(passphrase: string): void;
  /** The decoded file, available when state === 'completed' */
  getResult(): ReceiveResult | null;
  stop(): void;
}

export interface ReceiveResult {
  readonly file: File;
  readonly filename: string;
  readonly size: number;
  readonly mimeType: string;
  readonly sha256: string;
  readonly verified: boolean;
  readonly encrypted: boolean;
  readonly elapsedMs: number;
  readonly packetsDecoded: number;
  readonly packetsFailed: number;
}

/* --- Test sessions -------------------------------------------------- */

export interface ChannelTestResult {
  readonly ber: number;
  readonly snr: number;
  readonly recommendedPreset: PresetName;
}

export interface LoopbackTestResult {
  readonly passed: boolean;
  readonly detectedFrequency: number;
  readonly audioSettings: AudioSettings;
}

export interface TestSession {
  subscribe(cb: (state: SessionState) => void): () => void;
  getResult(): ChannelTestResult | LoopbackTestResult | null;
  stop(): void;
}

/* --- Engine interface ----------------------------------------------- */

export type LevelCallback = (level: number) => void;
export type StatusCallback = (status: EngineStatus) => void;

export interface MurmurEngine {
  getStatus(): EngineStatus;
  subscribe(cb: StatusCallback): () => void;
  onLevel(cb: LevelCallback): () => void;

  send(file: File, opts: { preset: PresetName; passphrase?: string }): SendSession;
  receive(opts: { preset: PresetName; passphrase?: string }): ReceiveSession;

  runChannelTest(): TestSession;
  runLoopbackTest(): TestSession;

  getAudioSettings(): AudioSettings | null;

  /** Estimate transfer time in ms for a given file size and preset */
  estimateTransferTime(sizeBytes: number, preset: PresetName): number;
}
