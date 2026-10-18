/**
 * @lensboard/ui - WCAG AA Contrast Verification
 * Authoritative Source: SPEC.md §13, PROJECT.md Feature 5
 * Relative Luminance: L = 0.2126 * R + 0.7152 * G + 0.0722 * B
 * Contrast Ratio = (L1 + 0.05) / (L2 + 0.05)
 */

/**
 * Normalizes 3-character hex shorthand (#FFF) into 6-character hex (#FFFFFF).
 */
export function normalizeHex(hex: string): string {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    return '#' + clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }
  return hex.startsWith('#') ? hex : `#${hex}`;
}

/**
 * Converts a hex color code to sRGB channels [r, g, b] (0..255).
 * Throws an Error if the hex string is malformed.
 */
export function hexToRgb(hex: string): [number, number, number] {
  const cleanHex = hex.replace('#', '').trim();
  if (!/^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/.test(cleanHex)) {
    throw new Error(`Invalid hex color string: "${hex}"`);
  }

  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    return [r, g, b];
  }

  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return [r, g, b];
}

/**
 * Calculates WCAG 2.1 relative luminance for given RGB components (0..255).
 */
export function relativeLuminance(r: number, g: number, b: number): number {
  const sRGB = [r / 255, g / 255, b / 255];
  const linear = sRGB.map((c) => {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/**
 * Computes contrast ratio between two hex colors.
 * Returns a value in [1.0, 21.0].
 */
export function calculateContrastRatio(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  const l1 = relativeLuminance(rgb1[0], rgb1[1], rgb1[2]);
  const l2 = relativeLuminance(rgb2[0], rgb2[1], rgb2[2]);
  const brighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (brighter + 0.05) / (darker + 0.05);
}

/**
 * Verifies whether foreground and background meet WCAG AA requirements.
 * - Standard body text: >= 4.5:1
 * - Large text or graphical elements (pen strokes, UI borders): >= 3.0:1
 */
export function verifyWcagAA(
  foregroundHex: string,
  backgroundHex: string,
  isLargeOrGraphic = false
): { ratio: number; pass: boolean } {
  const ratio = calculateContrastRatio(foregroundHex, backgroundHex);
  const threshold = isLargeOrGraphic ? 3.0 : 4.5;
  return {
    ratio,
    pass: ratio >= threshold,
  };
}
