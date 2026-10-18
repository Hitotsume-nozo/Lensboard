/**
 * @lensboard/ui - Pen Palette Hardening
 * Authoritative Source: SPEC.md §13, PROJECT.md Feature 6
 * 10 semantic pen slots stored as semantic IDs (never raw hex)
 * Okabe-Ito 7 color-blind safe palette + dark theme lightened variants (>= 3:1 contrast against canvas)
 */

import { type ThemeName, THEMES, isDarkTheme } from './themes.js';

export type PenColorSlot =
  | 'ink'
  | 'gray'
  | 'orange'
  | 'sky'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'vermillion'
  | 'purple'
  | 'custom';

export const PEN_SLOTS: readonly PenColorSlot[] = Object.freeze([
  'ink',
  'gray',
  'orange',
  'sky',
  'green',
  'yellow',
  'blue',
  'vermillion',
  'purple',
  'custom',
] as const);

/**
 * Standard Okabe-Ito Color-Blind Safe Palette
 */
export const OKABE_ITO_PALETTE = Object.freeze({
  orange: '#E69F00',
  sky: '#56B4E9',
  green: '#009E73',
  yellow: '#F0E442',
  blue: '#0072B2',
  vermillion: '#D55E00',
  purple: '#CC79A7',
});

/**
 * Dark theme lightened variants guaranteeing >= 3:1 contrast against dark canvas
 */
export const OKABE_ITO_DARK_THEME_ADJUSTMENTS = Object.freeze({
  blueLightened: '#409CFF', // standard #0072B2 lightened
  vermillionLightened: '#FF7B33', // standard #D55E00 lightened
});

/**
 * Resolves semantic pen color slot to hex code.
 * - 'ink' dynamically resolves to theme text color so old boards stay readable.
 * - 'blue' and 'vermillion' resolve to lightened variants on dark themes.
 * - 'custom' validates hex or falls back to 'ink'.
 * - Unknown slots safely fall back to 'ink'.
 */
export function getPenColor(
  slot: PenColorSlot | string,
  theme: ThemeName = 'midnight',
  customHex?: string
): string {
  const currentTheme = THEMES[theme] ?? THEMES.midnight;
  const dark = isDarkTheme(theme);

  switch (slot) {
    case 'ink':
      return currentTheme.text;

    case 'gray':
      return dark ? '#A3A9BD' : '#5B6070';

    case 'orange':
      return OKABE_ITO_PALETTE.orange;

    case 'sky':
      return OKABE_ITO_PALETTE.sky;

    case 'green':
      return OKABE_ITO_PALETTE.green;

    case 'yellow':
      return OKABE_ITO_PALETTE.yellow;

    case 'blue':
      return dark
        ? OKABE_ITO_DARK_THEME_ADJUSTMENTS.blueLightened
        : OKABE_ITO_PALETTE.blue;

    case 'vermillion':
      return dark
        ? OKABE_ITO_DARK_THEME_ADJUSTMENTS.vermillionLightened
        : OKABE_ITO_PALETTE.vermillion;

    case 'purple':
      return OKABE_ITO_PALETTE.purple;

    case 'custom':
      if (customHex && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(customHex.trim())) {
        const clean = customHex.trim().toUpperCase();
        if (clean.length === 4) {
          return '#' + clean[1] + clean[1] + clean[2] + clean[2] + clean[3] + clean[3];
        }
        return clean;
      }
      return currentTheme.text;

    default:
      // Unknown slot graceful fallback to ink
      return currentTheme.text;
  }
}

/**
 * Clamps stroke width strictly to [1, 24] px.
 */
export function clampStrokeWidth(width: number): number {
  return Math.max(1, Math.min(24, Math.round(width)));
}
