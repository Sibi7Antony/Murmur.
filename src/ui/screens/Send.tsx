/* ===================================================================
 * Send screen -- file picker, drag/drop, preset, passphrase,
 * size & time estimate, real live output waveform, progress ring, stop.
 * =================================================================== */

import { useState, useRef, useEffect } from 'react';
import { useEngine } from '../EngineContext';
import { PresetName, PRESETS, SIZE_WARN_BYTES, SIZE_HARD_CAP, SendSession, SendProgress } from '../../engine/types';
import { GlassCard } from '../components/GlassCard';
import './Send.css';

export function Send() {
  const { engine } = useEngine();
  const [file, setFile] = useState<File | null>(null);
  const [preset, setPreset] = useState<PresetName>('robust');
  const [passphrase, setPassphrase] = useState('');
  const [encryptEnabled, setEncryptEnabled] = useState(false);
  const [session, setSession] = useState<SendSession | null>(null);
  const [progress, setProgress] = useState<SendProgress | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!session) return;
    return session.subscribe(setProgress);
  }, [session]);

  const onFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleStart = () => {
    if (!file) return;
    const sess = engine.send(file, {
      preset,
      passphrase: encryptEnabled ? passphrase : undefined,
    });
    setSession(sess);
  };

  const handleStop = () => {
    if (session) {
      session.stop();
      setSession(null);
    }
  };

  const isTooLarge = file && file.size > SIZE_HARD_CAP;
  const isWarnSize = file && file.size > SIZE_WARN_BYTES;
  const estimatedMs = file ? engine.estimateTransferTime(file.size, preset) : 0;
  const estimatedSec = Math.round(estimatedMs / 1000);

  return (
    <main className="screen-container" id="main-content">
      <GlassCard className="send-card">
        <h2 className="screen-title">Send a File</h2>
        <p className="screen-desc">Select or drop a file to encode into sound</p>

        {!session || progress?.state === 'cancelled' ? (
          <>
            {/* Drag and Drop Zone */}
            <div
              className={`dropzone ${dragActive ? 'dropzone--active' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onFileDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="Upload file"
            >
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                onChange={(e) => e.target.files && setFile(e.target.files[0])}
              />
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              {file ? (
                <div className="file-preview">
                  <strong>{file.name}</strong>
                  <span>{(file.size / 1024).toFixed(1)} KB</span>
                </div>
              ) : (
                <p>Drag & drop or click to choose file</p>
              )}
            </div>

            {/* Warnings */}
            {isTooLarge && (
              <div className="alert alert--danger">
                File exceeds 64 KB limit. Murmur is tuned for files up to 10 KB.
              </div>
            )}
            {isWarnSize && !isTooLarge && (
              <div className="alert alert--warning">
                Large file (over 10 KB). Transfer will take several minutes.
              </div>
            )}

            {/* Preset Selector */}
            <div className="control-group">
              <label className="control-label">Preset</label>
              <div className="preset-toggle">
                {(Object.keys(PRESETS) as PresetName[]).map((pName) => {
                  const p = PRESETS[pName];
                  return (
                    <button
                      key={pName}
                      type="button"
                      className={`preset-btn ${preset === pName ? 'preset-btn--active' : ''}`}
                      onClick={() => setPreset(pName)}
                    >
                      {p.label}
                      {p.experimental && <span className="exp-badge">Exp</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Passphrase Encryption */}
            <div className="control-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={encryptEnabled}
                  onChange={(e) => setEncryptEnabled(e.target.checked)}
                />
                <span>Encrypt with passphrase</span>
              </label>
              {encryptEnabled && (
                <input
                  type="password"
                  className="text-input"
                  placeholder="Enter secret passphrase"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                />
              )}
            </div>

            {/* Estimate */}
            {file && !isTooLarge && (
              <div className="estimate-bar">
                Estimated duration: <strong>~{estimatedSec} seconds</strong>
              </div>
            )}

            {/* Action */}
            <button
              className="btn btn--primary btn--full"
              disabled={Boolean(!file || isTooLarge)}
              onClick={handleStart}
            >
              Start Sending
            </button>
          </>
        ) : (
          /* Live Transmitting State */
          <div className="active-transfer">
            <div className="progress-ring-container">
              <div className="progress-number">
                {progress?.packetsSent ?? 0}
              </div>
              <div className="progress-label">Packets Sent</div>
            </div>

            <p className="pulse-text">Looping audio packets continuously...</p>
            <p className="hint-text">Keep speaker volume at ~70% and place the receiver device nearby.</p>

            <button className="btn btn--glass btn--full" onClick={handleStop}>
              Stop Sending
            </button>
          </div>
        )}
      </GlassCard>
    </main>
  );
}
