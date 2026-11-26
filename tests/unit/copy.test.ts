/* Unit tests for copy.ts -- ensures all strings are present and consistent. */

import { describe, it, expect } from 'vitest';
import { COPY } from '../../src/copy';

describe('COPY', () => {
  it('brand is Murmur', () => {
    expect(COPY.brand).toBe('Murmur');
  });

  it('has tagline with Beyond', () => {
    expect(COPY.tagline).toContain('Beyond');
    expect(COPY.tagline).toContain('Network');
  });

  it('has four features', () => {
    expect(COPY.features).toHaveLength(4);
    for (const f of COPY.features) {
      expect(f.label).toBeTruthy();
      expect(f.sub).toBeTruthy();
    }
  });

  it('nav has all items', () => {
    expect(COPY.nav.home).toBe('Home');
    expect(COPY.nav.send).toBe('Send');
    expect(COPY.nav.receive).toBe('Receive');
    expect(COPY.nav.test).toBe('Test');
    expect(COPY.nav.settings).toBe('Settings');
  });

  it('footer contains Murmur', () => {
    expect(COPY.footer).toContain('Murmur');
  });
});
