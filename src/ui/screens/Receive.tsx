/* ===================================================================
 * Receive screen -- microphone permission handling, live spectrogram,
 * signal quality SNR gauge, packet decoding, passphrase unlock, and download.
 * =================================================================== */

import { useState, useRef, useEffect } from 'react';
import { useEngine } from '../EngineContext';
import { PresetName, PRESETS, ReceiveSession, ReceiveProgress, ReceiveResult } from '../../engine/types';
import { SpectrogramRenderer } from '../../audio/spectrogram';
import { GlassCard } from '../components/GlassCard';
import './Receive.css';

export function Receive() {
  const { engine } = useEngine();
  const [preset, setPreset] = useState<PresetName>('robust');
  const [passphrase, setPassphrase] = useState('');
  const [session, setSession] = useState<ReceiveSession | null>(null);
  const [progress, setProgress] = useState<ReceiveProgress | null>(null);
  const [result, setResult] = useState<ReceiveResult | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const specRendererRef = useRef<SpectrogramRenderer | null>(null);

  useEffect(() => {
    if (!session) return;
    const unsubProgress = session.subscribe((p) => {
      setProgress(p);
      if (p.state === 'completed') {
        setResult(session.getResult());
      }
    });

    const unsubSpec = session.onSpectrogram((bins) => {
      if (!specRendererRef.current && canvasRef.current) {
        specRendererRef.current = new SpectrogramRenderer(canvasRef.current);
      }
      if (specRendererRef.current) {
        specRendererRef.current.pushBins(bins);
      }
    });

    return () => {
      unsubProgress();
      unsubSpec();
      specRendererRef.current = null;
    };
  }, [session]);

  const handleStart = () => {
    const sess = engine.receive({ preset, passphrase: passphrase || undefined });
    setSession(sess);
  };

  const handleStop = () => {
    if (session) {
      session.stop();
      setSession(null);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const url = URL.createObjectURL(result.file);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="screen-container" id="main-content">
      <GlassCard className="receive-card">
        <h2 className="screen-title">Receive a File</h2>
        <p className="screen-desc">Listens for audio packets and reconstructs the original file</p>

        {!session ? (
          <>
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

            <div className="control-group">
              <label className="control-label">Passphrase (if encrypted by sender)</label>
              <input
                type="password"
                className="text-input"
                placeholder="Optional passphrase"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
              />
            </div>

            <button className="btn btn--primary btn--full" onClick={handleStart}>
              Start Listening
            </button>
          </>
        ) : result ? (
          /* Transfer Successful Card */
          <div className="success-card">
            <div className="success-badge">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>SHA-256 Verified</span>
            </div>

            <div className="file-summary">
              <h3>{result.filename}</h3>
              <p>{(result.size / 1024).toFixed(2)} KB &bull; {result.mimeType}</p>
              <code className="sha-text">{result.sha256.slice(0, 16)}...</code>
            </div>

            <button className="btn btn--primary btn--full" onClick={handleDownload}>
              Download File
            </button>
            <button className="btn btn--glass btn--full" onClick={handleStop}>
              Done
            </button>
          </div>
        ) : progress?.state === 'error' ? (
          <div className="active-receive">
            <div className="alert alert--danger">
              Microphone access blocked or unavailable. Ensure microphone permissions are granted in your browser settings.
            </div>
            <button className="btn btn--primary btn--full" onClick={handleStart}>
              Retry Listening
            </button>
            <button className="btn btn--glass btn--full" onClick={handleStop}>
              Cancel
            </button>
          </div>
        ) : (
          /* Listening / Reconstructing */
          <div className="active-receive">
            {/* Live Spectrogram Canvas */}
            <div className="spectrogram-container">
              <canvas
                ref={canvasRef}
                className="spectrogram-canvas"
                width={360}
                height={120}
              />
            </div>

            {/* Status indicators */}
            <div className="receive-metrics">
              <div className="metric-box">
                <span className="metric-label">Status</span>
                <span className="metric-val">{progress?.state}</span>
              </div>
              <div className="metric-box">
                <span className="metric-label">Recovered</span>
                <span className="metric-val">
                  {progress?.blocksReceived ?? 0} / {progress?.totalBlocks || '?'}
                </span>
              </div>
              <div className="metric-box">
                <span className="metric-label">SNR</span>
                <span className="metric-val">
                  {progress?.snrEstimate ? `${progress.snrEstimate} dB` : '--'}
                </span>
              </div>
            </div>

            {progress?.needsPassphrase && (
              <div className="passphrase-prompt">
                <p>Sender encrypted this file. Please enter passphrase:</p>
                <input
                  type="password"
                  className="text-input"
                  placeholder="Passphrase"
                  onChange={(e) => setPassphrase(e.target.value)}
                />
                <button
                  className="btn btn--primary"
                  onClick={() => session.supplyPassphrase(passphrase)}
                >
                  Unlock
                </button>
              </div>
            )}

            <button className="btn btn--glass btn--full" onClick={handleStop}>
              Stop Listening
            </button>
          </div>
        )}
      </GlassCard>
    </main>
  );
}
