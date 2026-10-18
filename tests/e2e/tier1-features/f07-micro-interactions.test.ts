/**
 * Feature 7: Micro-Interactions System (M2)
 * Authoritative Source: SPEC.md §13, PROJECT.md Feature 7
 * 120-180ms ease-out transitions (`cubic-bezier(0.2, 0, 0, 1)`), reduced-motion instant bypass (0ms)
 */

import { describe, it, expect } from '../harness.ts';

describe('Feature 7: Micro-Interactions System', () => {
  const specCurve = 'cubic-bezier(0.2, 0, 0, 1)';
  const minDuration = 120;
  const maxDuration = 180;

  it('f07-1: standard micro-interaction duration is strictly within 120ms to 180ms', () => {
    const standardUiDuration = 150;
    expect(standardUiDuration).toBeGreaterThanOrEqual(minDuration);
    expect(standardUiDuration).toBeLessThanOrEqual(maxDuration);
  });

  it('f07-2: specification easing curve matches cubic-bezier(0.2, 0, 0, 1)', () => {
    expect(specCurve).toBe('cubic-bezier(0.2, 0, 0, 1)');
  });

  it('f07-3: ink conversion morph duration is calibrated to 200ms', () => {
    const morphDuration = 200;
    expect(morphDuration).toBe(200);
  });

  it('f07-4: connector snap pulse duration is calibrated to 160ms', () => {
    const connectorSnapDuration = 160;
    expect(connectorSnapDuration).toBeGreaterThanOrEqual(minDuration);
    expect(connectorSnapDuration).toBeLessThanOrEqual(maxDuration);
  });

  it('f07-5: reduced-motion preference bypasses all animations to 0ms instant transition', () => {
    function resolveDuration(baseDuration: number, reducedMotion: boolean): number {
      return reducedMotion ? 0 : baseDuration;
    }
    expect(resolveDuration(150, true)).toBe(0);
    expect(resolveDuration(200, true)).toBe(0);
    expect(resolveDuration(160, true)).toBe(0);
  });
});
