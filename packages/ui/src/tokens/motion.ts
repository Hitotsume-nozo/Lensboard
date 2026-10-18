/**
 * @lensboard/ui - Micro-Interactions System
 * Authoritative Source: SPEC.md §13, PROJECT.md Feature 7
 * Transitions: 120-180ms ease-out (cubic-bezier(0.2, 0, 0, 1))
 * Specific timings: 150ms standard UI, 200ms morph, 160ms connector snap, 160ms drawer
 * Reduced-motion preference instantly bypasses animations to 0ms
 */

export const MOTION_CURVE = 'cubic-bezier(0.2, 0, 0, 1)';

export const MOTION_DURATIONS = Object.freeze({
  min: 120,
  standard: 150,
  max: 180,
  morph: 200,
  connectorSnap: 160,
  drawer: 160,
  toolbarCollapse: 150,
});

/**
 * Resolves animation duration in milliseconds.
 * In reduced-motion mode, all animations are immediately bypassed to 0ms.
 */
export function resolveMotionDuration(
  baseDurationMs: number,
  reducedMotion: boolean
): number {
  if (reducedMotion) return 0;
  return Math.max(0, baseDurationMs);
}

/**
 * Clamps a UI transition duration strictly within standard [min, max] bounds.
 */
export function clampTransitionDuration(
  ms: number,
  min = MOTION_DURATIONS.min,
  max = MOTION_DURATIONS.max
): number {
  return Math.max(min, Math.min(max, ms));
}

/**
 * Resolves easing curve, falling back to canonical spec curve if invalid.
 */
export function resolveEasing(curve: string): string {
  if (typeof curve === 'string' && curve.trim().startsWith('cubic-bezier')) {
    return curve.trim();
  }
  return MOTION_CURVE;
}
