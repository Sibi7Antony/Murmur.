/* Footer -- matches the reference: left brand line, right sparkle line. */

import { COPY } from '../../copy';
import './Footer.css';

export function Footer() {
  return (
    <footer className="footer" aria-label="Footer">
      <div className="footer-left">
        <span className="footer-line" aria-hidden="true" />
        <span className="footer-text">{COPY.footer}</span>
      </div>
      <div className="footer-right" aria-hidden="true">
        <span className="footer-hline" />
      </div>
    </footer>
  );
}
