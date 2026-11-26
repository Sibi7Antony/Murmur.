/* ===================================================================
 * Home screen -- reproduces reference/home.png pixel-faithfully.
 * "Murmur" display serif wordmark, tilted ink orbit ellipse, top-left sparkle,
 * classical statues with headphones & glowing eye halo, DPR-aware oscilloscope
 * waveform, dark and glass buttons, 4-column feature strip.
 * =================================================================== */

import { COPY } from '../../copy';
import { HeroWaveform } from '../canvas/HeroWaveform';
import './Home.css';

export function Home() {
  return (
    <main className="home" id="main-content">
      <HeroWaveform />

      <div className="home-hero-center">
        {/* Wordmark with Attractive Square Full Stop */}
        <div className="wordmark-container">
          <h1 className="home-wordmark">
            {COPY.brand}
            <span className="attractive-square-dot" aria-hidden="true" />
          </h1>
        </div>

        {/* Tagline */}
        <p className="home-tagline">
          Transfer <em>Beyond</em> the Network.
        </p>

        {/* Centered Body */}
        <p className="home-body">
          {COPY.heroBody[0]}
          <br />
          {COPY.heroBody[1]}
        </p>

        {/* Primary Action Buttons */}
        <div className="home-buttons">
          <a href="#/send" className="btn btn--primary">
            <svg
              className="btn-wave-icon"
              width="20"
              height="16"
              viewBox="0 0 20 16"
              fill="none"
              aria-hidden="true"
            >
              <rect x="0" y="6" width="2" height="4" rx="1" fill="currentColor" />
              <rect x="3.5" y="4" width="2" height="8" rx="1" fill="currentColor" />
              <rect x="7" y="1" width="2" height="14" rx="1" fill="currentColor" />
              <rect x="10.5" y="3" width="2" height="10" rx="1" fill="currentColor" />
              <rect x="14" y="5" width="2" height="6" rx="1" fill="currentColor" />
              <rect x="17.5" y="7" width="2" height="2" rx="1" fill="currentColor" />
            </svg>
            <span>{COPY.btnSend}</span>
            <svg
              className="btn-arrow-icon"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M6 3L11 8L6 13"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>

          <a href="#/receive" className="btn btn--glass">
            <svg
              className="btn-mic-icon"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
            <span>{COPY.btnReceive}</span>
          </a>
        </div>
      </div>

      {/* Feature Strip moved to bottom of home page */}
      <div className="home-bottom-strip">
        <div className="home-features">
          {COPY.features.map((f, i) => (
            <div key={i} className="feature-col">
              <div className="feature-icon" aria-hidden="true">
                <FeatureIcon index={i} />
              </div>
              <span className="feature-label">{f.label}</span>
              <span className="feature-sub">{f.sub}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function FeatureIcon({ index }: { index: number }) {
  switch (index) {
    case 0:
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M2 12h2l3-8 4 16 4-12 3 6h4" />
        </svg>
      );
    case 1:
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L3 7v5c0 5 3.5 9.74 9 11 5.5-1.26 9-6 9-11V7L12 2z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case 2:
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case 3:
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" strokeWidth="2.5" />
        </svg>
      );
    default:
      return null;
  }
}
