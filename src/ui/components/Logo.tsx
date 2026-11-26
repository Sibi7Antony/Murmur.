/* Logo -- waveform bars + "Murmur" in lighter serif weight. */

import { COPY } from '../../copy';
import './Logo.css';

export function Logo() {
  return (
    <a href="#/" className="logo" aria-label={`${COPY.brand} home`}>
      <img
        src="/icon.png"
        className="logo-icon"
        alt=""
        width="28"
        height="28"
      />
      <span className="logo-text">{COPY.brand}</span>
    </a>
  );
}
