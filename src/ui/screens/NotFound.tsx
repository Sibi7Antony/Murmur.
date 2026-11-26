/* 404 screen. */

import { COPY } from '../../copy';

export function NotFound() {
  return (
    <main className="screen-stub" id="main-content">
      <h1>Page Not Found</h1>
      <p>The page you are looking for does not exist.</p>
      <a href="#/" style={{ color: 'var(--bg-periwinkle)', textDecoration: 'underline' }}>
        Back to {COPY.brand}
      </a>
    </main>
  );
}
