/* StatusPill -- top-right glass pill showing engine status and signal bars. */

import { useEngine } from '../EngineContext';
import './StatusPill.css';

function SignalBars() {
  return (
    <svg
      className="signal-bars"
      width="18"
      height="14"
      viewBox="0 0 18 14"
      fill="none"
      aria-hidden="true"
    >
      <rect x="0" y="10" width="3" height="4" rx="1" fill="currentColor" opacity="0.9" />
      <rect x="5" y="7" width="3" height="7" rx="1" fill="currentColor" opacity="0.7" />
      <rect x="10" y="4" width="3" height="10" rx="1" fill="currentColor" opacity="0.5" />
      <rect x="15" y="0" width="3" height="14" rx="1" fill="currentColor" opacity="0.35" />
    </svg>
  );
}

export function StatusPill() {
  const { status } = useEngine();
  const pulsing = status.name === 'listening';

  return (
    <div className="status-pill-wrapper" role="status" aria-live="polite">
      <div className="status-pill">
        <span
          className={`status-dot ${pulsing ? 'status-dot--pulse' : ''}`}
          style={{ backgroundColor: status.color }}
          aria-hidden="true"
        />
        <span className="status-label">{status.label}</span>
      </div>
      <div className="status-signal">
        <SignalBars />
      </div>
    </div>
  );
}
