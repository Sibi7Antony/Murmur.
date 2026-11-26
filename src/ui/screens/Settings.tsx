/* ===================================================================
 * Settings screen -- default preset, hardware constraint readback,
 * film grain toggle, reduce-motion toggle, how it works, and privacy.
 * =================================================================== */

import { useState } from 'react';
import { useEngine } from '../EngineContext';
import { PresetName, PRESETS } from '../../engine/types';
import { COPY } from '../../copy';
import { GlassCard } from '../components/GlassCard';
import './Settings.css';

export function Settings() {
  const { engine } = useEngine();
  const [defaultPreset, setDefaultPreset] = useState<PresetName>('robust');
  const [grainEnabled, setGrainEnabled] = useState(true);
  const audioSettings = engine.getAudioSettings();

  return (
    <main className="screen-container" id="main-content">
      <GlassCard className="settings-card">
        <h2 className="screen-title">Settings</h2>

        {/* Default Preset */}
        <div className="settings-section">
          <h3>Default Modem Preset</h3>
          <div className="preset-toggle">
            {(Object.keys(PRESETS) as PresetName[]).map((pName) => (
              <button
                key={pName}
                type="button"
                className={`preset-btn ${defaultPreset === pName ? 'preset-btn--active' : ''}`}
                onClick={() => setDefaultPreset(pName)}
              >
                {PRESETS[pName].label}
              </button>
            ))}
          </div>
        </div>

        {/* Hardware Constraint Status */}
        <div className="settings-section">
          <h3>Applied Audio Constraints</h3>
          <p className="section-subtitle">
            Murmur requests pure, unmodified audio from the browser to detect tones accurately.
          </p>
          <div className="constraint-table">
            <div className="constraint-row">
              <span>Sample Rate</span>
              <strong>{audioSettings?.sampleRate ?? '48000 (detected on start)'} Hz</strong>
            </div>
            <div className="constraint-row">
              <span>Echo Cancellation</span>
              <strong className={audioSettings?.echoCancellation ? 'warn' : 'ok'}>
                {audioSettings ? (audioSettings.echoCancellation ? 'Active (Degrades signal)' : 'Disabled') : 'Disabled'}
              </strong>
            </div>
            <div className="constraint-row">
              <span>Noise Suppression</span>
              <strong className={audioSettings?.noiseSuppression ? 'warn' : 'ok'}>
                {audioSettings ? (audioSettings.noiseSuppression ? 'Active (Degrades signal)' : 'Disabled') : 'Disabled'}
              </strong>
            </div>
            <div className="constraint-row">
              <span>Auto Gain Control</span>
              <strong className={audioSettings?.autoGainControl ? 'warn' : 'ok'}>
                {audioSettings ? (audioSettings.autoGainControl ? 'Active (Degrades signal)' : 'Disabled') : 'Disabled'}
              </strong>
            </div>
          </div>
        </div>

        {/* Visual Settings */}
        <div className="settings-section">
          <h3>Visuals</h3>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={grainEnabled}
              onChange={(e) => {
                setGrainEnabled(e.target.checked);
                document.documentElement.style.setProperty(
                  '--grain-opacity',
                  e.target.checked ? '0.09' : '0',
                );
              }}
            />
            <span>Enable analog film grain</span>
          </label>
        </div>

        {/* How It Works */}
        <div className="settings-section">
          <h3>How Murmur Works</h3>
          <ol className="how-it-works-list">
            <li><strong>Modulation:</strong> Files are sliced into blocks and mapped to MFSK acoustic tone frequencies.</li>
            <li><strong>Fountain Coding:</strong> Luby Transform packets allow receivers to join at any moment and tolerate noise.</li>
            <li><strong>Zero Network:</strong> Data travels purely through the air via speaker to microphone.</li>
          </ol>
        </div>

        {/* Privacy Note */}
        <div className="privacy-badge">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>{COPY.privacyNote}</span>
        </div>
      </GlassCard>
    </main>
  );
}
