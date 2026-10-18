/**
 * @lensboard/ui - Surfaces, Spacing & Grid System
 * Authoritative Source: SPEC.md §13
 * 4px spacing unit on an 8px grid
 * Control radius: 8px, panel and frame radius: 12px, border: 1px
 * Shadows only on floating UI (e.g. 0 8px 24px at 28% black on dark themes)
 * Background dot grid: 24 world units apart, 1.5px dots
 */

export const SURFACES = Object.freeze({
  spacingUnit: 4,
  gridStep: 8,
  radii: Object.freeze({
    sm: 4,
    control: 8,
    panel: 12,
    frame: 12,
    pill: 9999,
  }),
  borderWidth: 1,
  frameTint: 0.06, // 6% tint of frame colour
  shadows: Object.freeze({
    floatingDark: '0 8px 24px rgba(0, 0, 0, 0.28)',
    floatingLight: '0 8px 24px rgba(0, 0, 0, 0.08)',
    contextual: '0 4px 16px rgba(0, 0, 0, 0.20)',
  }),
  dotGrid: Object.freeze({
    spacing: 24,
    dotSize: 1.5,
  }),
});
