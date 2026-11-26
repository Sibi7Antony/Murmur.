/* ===================================================================
 * Test screen -- Channel Test (BER/SNR gauges) & Loopback Self-Test.
 * =================================================================== */

import { useState } from 'react';
import { useEngine } from '../EngineContext';
import { GlassCard } from '../components/GlassCard';
import { ChannelTestResult, LoopbackTestResult } from '../../engine/types';
import './Test.css';

export function Test() {
  const { engine } = useEngine();
  const [tab, setTab] = useState<'channel' | 'loopback'>('channel');
  const [running, setRunning] = useState(false);
  const [channelRes, setChannelRes] = useState<ChannelTestResult | null>(null);
  const [loopbackRes, setLoopbackRes] = useState<LoopbackTestResult | null>(null);

  const startTest = () => {
    setRunning(true);
    if (tab === 'channel') {
      const sess = engine.runChannelTest();
      sess.subscribe((st) => {
        if (st === 'completed') {
          setChannelRes(sess.getResult() as ChannelTestResult);
          setRunning(false);
        } else if (st === 'error' || st === 'cancelled') {
          setRunning(false);
        }
      });
    } else {
      const sess = engine.runLoopbackTest();
      sess.subscribe((st) => {
        if (st === 'completed') {
          setLoopbackRes(sess.getResult() as LoopbackTestResult);
          setRunning(false);
        } else if (st === 'error' || st === 'cancelled') {
          setRunning(false);
        }
      });
    }
  };

  return (
    <main className="screen-container" id="main-content">
      <GlassCard className="test-card">
        <h2 className="screen-title">Diagnostics & Calibration</h2>

        <div className="tab-bar">
          <button
            className={`tab-btn ${tab === 'channel' ? 'tab-btn--active' : ''}`}
            onClick={() => setTab('channel')}
          >
            Channel Test
          </button>
          <button
            className={`tab-btn ${tab === 'loopback' ? 'tab-btn--active' : ''}`}
            onClick={() => setTab('loopback')}
          >
            Loopback Self-Test
          </button>
        </div>

        {tab === 'channel' ? (
          <div className="test-content">
            <p className="screen-desc">
              Plays a pseudo-random training sequence to measure Signal-to-Noise Ratio (SNR) and Bit Error Rate (BER).
            </p>

            {channelRes && (
              <div className="gauge-grid">
                <div className="gauge-card">
                  <div className="gauge-val">{channelRes.snr.toFixed(1)} dB</div>
                  <div className="gauge-lbl">SNR Estimate</div>
                </div>
                <div className="gauge-card">
                  <div className="gauge-val">{(channelRes.ber * 100).toFixed(2)}%</div>
                  <div className="gauge-lbl">Bit Error Rate</div>
                </div>
                <div className="gauge-card">
                  <div className="gauge-val">{channelRes.recommendedPreset.toUpperCase()}</div>
                  <div className="gauge-lbl">Recommended Preset</div>
                </div>
              </div>
            )}

            <button className="btn btn--primary btn--full" disabled={running} onClick={startTest}>
              {running ? 'Testing Channel...' : 'Run Channel Test'}
            </button>
          </div>
        ) : (
          <div className="test-content">
            <p className="screen-desc">
              Verifies microphone hardware capture, checks for 1 kHz test tones, and audits browser audio processing constraints.
            </p>

            {loopbackRes && (
              <div className="loopback-results">
                <div className={`status-badge ${loopbackRes.passed ? 'status-badge--ok' : 'status-badge--err'}`}>
                  {loopbackRes.passed ? 'Tone Detected (1000 Hz)' : 'Loopback Failed'}
                </div>

                <div className="settings-audit">
                  <h4>Mic Hardware Audit</h4>
                  <ul>
                    <li>Sample Rate: {loopbackRes.audioSettings?.sampleRate ?? 48000} Hz</li>
                    <li>Echo Cancellation Disabled: {!loopbackRes.audioSettings?.echoCancellation ? 'Yes' : 'No (Warning)'}</li>
                    <li>Noise Suppression Disabled: {!loopbackRes.audioSettings?.noiseSuppression ? 'Yes' : 'No (Warning)'}</li>
                    <li>Auto Gain Disabled: {!loopbackRes.audioSettings?.autoGainControl ? 'Yes' : 'No (Warning)'}</li>
                  </ul>
                </div>
              </div>
            )}

            <button className="btn btn--primary btn--full" disabled={running} onClick={startTest}>
              {running ? 'Running Self-Test...' : 'Start Loopback Test'}
            </button>
          </div>
        )}
      </GlassCard>
    </main>
  );
}
