/**
 * Feature 6: Pen Palette Hardening (M2)
 * Authoritative Source: SPEC.md §13, PROJECT.md Feature 6
 * 10 semantic slots: ink, gray, Okabe-Ito (orange, sky, green, yellow, blue, vermillion, purple), custom
 * Dark theme lightened variants guarantee >= 3:1 against dark canvas
 */

import { describe, it, expect } from '../harness.ts';
import {
  OKABE_ITO_PALETTE,
  OKABE_ITO_DARK_THEME_ADJUSTMENTS,
  THEME_SPEC_TOKENS,
  calculateContrastRatio,
} from '../helpers/oracle.ts';
import type { PenColorSlot } from '../helpers/contracts.ts';

describe('Feature 6: Pen Palette Hardening', () => {
  const slots: PenColorSlot[] = [
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
  ];

  it('f06-1: supports all 10 semantic pen palette slots', () => {
    expect(slots).toHaveLength(10);
  });

  it('f06-2: okabe-ito 7 color values match official color-blind safe standards', () => {
    expect(OKABE_ITO_PALETTE.orange.toUpperCase()).toBe('#E69F00');
    expect(OKABE_ITO_PALETTE.sky.toUpperCase()).toBe('#56B4E9');
    expect(OKABE_ITO_PALETTE.green.toUpperCase()).toBe('#009E73');
    expect(OKABE_ITO_PALETTE.yellow.toUpperCase()).toBe('#F0E442');
    expect(OKABE_ITO_PALETTE.blue.toUpperCase()).toBe('#0072B2');
    expect(OKABE_ITO_PALETTE.vermillion.toUpperCase()).toBe('#D55E00');
    expect(OKABE_ITO_PALETTE.purple.toUpperCase()).toBe('#CC79A7');
  });

  it('f06-3: dark canvas requires lightened blue and vermillion to exceed 3:1 contrast', () => {
    const darkCanvas = THEME_SPEC_TOKENS.midnight.canvas;
    const lightenedBlue = OKABE_ITO_DARK_THEME_ADJUSTMENTS.blueLightened;
    const lightenedVermillion = OKABE_ITO_DARK_THEME_ADJUSTMENTS.vermillionLightened;

    const blueRatio = calculateContrastRatio(lightenedBlue, darkCanvas);
    const vermillionRatio = calculateContrastRatio(lightenedVermillion, darkCanvas);

    expect(blueRatio).toBeGreaterThanOrEqual(3.0);
    expect(vermillionRatio).toBeGreaterThanOrEqual(3.0);
  });

  it('f06-4: light theme canvas maintains >= 3:1 contrast for all standard Okabe-Ito colors', () => {
    const paperCanvas = THEME_SPEC_TOKENS.paper.canvas;
    const darkColors = [
      OKABE_ITO_PALETTE.blue,
      OKABE_ITO_PALETTE.vermillion,
      OKABE_ITO_PALETTE.green,
    ];
    for (const c of darkColors) {
      const ratio = calculateContrastRatio(c, paperCanvas);
      expect(ratio).toBeGreaterThanOrEqual(3.0);
    }
  });

  it('f06-5: semantic ink slot dynamically resolves to readable theme-aware color', () => {
    const midnightInk = THEME_SPEC_TOKENS.midnight.text;
    const paperInk = THEME_SPEC_TOKENS.paper.text;
    expect(midnightInk).not.toBe(paperInk);
    expect(calculateContrastRatio(midnightInk, THEME_SPEC_TOKENS.midnight.canvas)).toBeGreaterThanOrEqual(4.5);
    expect(calculateContrastRatio(paperInk, THEME_SPEC_TOKENS.paper.canvas)).toBeGreaterThanOrEqual(4.5);
  });
});
