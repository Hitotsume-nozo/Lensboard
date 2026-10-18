/**
 * Feature 21: Ink Stabilization Pipeline (M4)
 * Authoritative Source: SPEC.md §9, PROJECT.md Feature 21
 * Lazy-String stabilizer (r = percent * 0.4px) + One-Euro low-pass filter (minCutoff 1.0, beta 0.007, dCutoff 1.0)
 */

import { describe, it, expect } from '../harness.ts';
import {
  calculateStabilizerRadius,
  applyLazyStringStabilizer,
  OneEuroFilterOracle,
} from '../helpers/oracle.ts';

describe('Feature 21: Ink Stabilization Pipeline', () => {
  it('f21-1: lazy-string radius formula scales percent by 0.4px (0..100 maps to 0..40px)', () => {
    expect(calculateStabilizerRadius(0)).toBe(0);
    expect(calculateStabilizerRadius(50)).toBe(20);
    expect(calculateStabilizerRadius(100)).toBe(40);
  });

  it('f21-2: pen point remains static when cursor movement is within stabilizer radius', () => {
    const pen = { x: 100, y: 100 };
    const cursorInside = { x: 105, y: 100 }; // 5px distance
    const radius = 10;

    const stabilized = applyLazyStringStabilizer(cursorInside, pen, radius);
    expect(stabilized.x).toBe(100);
    expect(stabilized.y).toBe(100);
  });

  it('f21-3: pen point trails cursor along displacement vector when cursor exceeds radius', () => {
    const pen = { x: 100, y: 100 };
    const cursorOutside = { x: 120, y: 100 }; // 20px distance
    const radius = 10;

    const stabilized = applyLazyStringStabilizer(cursorOutside, pen, radius);
    expect(stabilized.x).toBe(110); // 120 - 10px radius
    expect(stabilized.y).toBe(100);
  });

  it('f21-4: One-Euro filter smooths high-frequency jitter at low speeds', () => {
    const filter = new OneEuroFilterOracle(1.0, 0.007, 1.0);
    const t0 = 1000;
    filter.filter(100, t0);

    // Minor jitter +2px
    const filteredJitter = filter.filter(102, t0 + 16);
    expect(filteredJitter).toBeLessThan(102);
    expect(filteredJitter).toBeGreaterThan(100);
  });

  it('f21-5: One-Euro filter increases cutoff adaptively at high speed to eliminate lag', () => {
    const filter = new OneEuroFilterOracle(1.0, 0.007, 1.0);
    let t = 1000;
    let pos = 0;
    filter.filter(pos, t);

    // Sustained rapid movement: +50px per frame over multiple frames
    let fastFiltered = 0;
    for (let i = 0; i < 3; i++) {
      t += 16;
      pos += 50;
      fastFiltered = filter.filter(pos, t);
    }
    // At high speed, filter responds rapidly and tracks input
    expect(fastFiltered).toBeGreaterThan(50);
  });
});
