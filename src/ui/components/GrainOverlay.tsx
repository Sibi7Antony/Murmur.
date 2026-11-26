/* GrainOverlay -- film grain effect using a tiled noise texture.
 * Uses an SVG feTurbulence data URI for the noise, blended with soft-light. */

import './GrainOverlay.css';

export function GrainOverlay() {
  return (
    <div className="grain-overlay" aria-hidden="true" />
  );
}
