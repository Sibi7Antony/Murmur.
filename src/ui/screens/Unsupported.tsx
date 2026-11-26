/* Unsupported browser screen. */

export function Unsupported() {
  return (
    <main className="screen-stub" id="main-content">
      <h1>Unsupported Browser</h1>
      <p>
        Murmur requires a modern browser with support for AudioContext, AudioWorklet,
        WebCrypto, and getUserMedia. Please update your browser or try Chrome, Firefox, or Safari.
      </p>
    </main>
  );
}
