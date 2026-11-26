/* Background -- fluted vertical glass texture with ambient glow. */

import './Background.css';

export function Background() {
  return (
    <div className="bg" aria-hidden="true">
      <div className="bg-image" />
      <div className="bg-overlay" />
    </div>
  );
}
