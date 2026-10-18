import { describe, it, expect } from 'vitest';
import {
  THEMES,
  getThemeTokens,
  isDarkTheme,
  generateThemeCssVariables,
  themeToCssString,
  type ThemeName,
  type ThemeTokens,
  normalizeHex,
  hexToRgb,
  relativeLuminance,
  calculateContrastRatio,
  verifyWcagAA,
  PEN_SLOTS,
  OKABE_ITO_PALETTE,
  OKABE_ITO_DARK_THEME_ADJUSTMENTS,
  getPenColor,
  clampStrokeWidth,
  type PenColorSlot,
  MOTION_CURVE,
  MOTION_DURATIONS,
  resolveMotionDuration,
  clampTransitionDuration,
  resolveEasing,
  DSA_STATE_DEFINITIONS,
  resolveDSACellState,
  getDSACellGeometry,
  type DSACellState,
  TYPOGRAPHY,
  SURFACES,
} from './index.js';

describe('@lensboard/ui — Milestone 2 UI Style System & Design Tokens', () => {
  // --------------------------------------------------------------------------
  // Feature 4: Token Matrix & 5 Themes
  // --------------------------------------------------------------------------
  describe('Feature 4: Token Matrix & 5 Themes', () => {
    const expectedThemes: ThemeName[] = [
      'midnight',
      'paper',
      'blueprint',
      'blackboard',
      'high-contrast',
    ];

    it('defines all 5 specification themes with complete tokens', () => {
      expect(Object.keys(THEMES)).toHaveLength(5);
      for (const themeName of expectedThemes) {
        const tokens: ThemeTokens = THEMES[themeName];
        expect(tokens).toBeDefined();
        expect(tokens.name).toBe(themeName);
        expect(tokens.canvas).toBeDefined();
        expect(tokens.surface).toBeDefined();
        expect(tokens.surfaceRaised).toBeDefined();
        expect(tokens.border).toBeDefined();
        expect(tokens.text).toBeDefined();
        expect(tokens.textMuted).toBeDefined();
        expect(tokens.accent).toBeDefined();
        expect(tokens.accent2).toBeDefined();
        expect(tokens.warning).toBeDefined();
        expect(tokens.danger).toBeDefined();
      }
    });

    it('midnight theme defines exact specification color tokens', () => {
      const midnight = THEMES.midnight;
      expect(midnight.canvas.toLowerCase()).toBe('#12141c');
      expect(midnight.surface.toLowerCase()).toBe('#1a1d28');
      expect(midnight.surfaceRaised.toLowerCase()).toBe('#232736');
      expect(midnight.border.toLowerCase()).toBe('#2e3347');
      expect(midnight.text.toLowerCase()).toBe('#e8eaf2');
      expect(midnight.textMuted.toLowerCase()).toBe('#a3a9bd');
      expect(midnight.accent.toLowerCase()).toBe('#7c8cff');
      expect(midnight.accent2.toLowerCase()).toBe('#3dd6c6');
      expect(midnight.warning.toLowerCase()).toBe('#ffc857');
      expect(midnight.danger.toLowerCase()).toBe('#ff6b7a');
    });

    it('paper theme defines exact specification color tokens', () => {
      const paper = THEMES.paper;
      expect(paper.canvas.toLowerCase()).toBe('#fbfaf7');
      expect(paper.surface.toLowerCase()).toBe('#ffffff');
      expect(paper.surfaceRaised.toLowerCase()).toBe('#f3f1ea');
      expect(paper.border.toLowerCase()).toBe('#e4e1d8');
      expect(paper.text.toLowerCase()).toBe('#1c1e26');
      expect(paper.textMuted.toLowerCase()).toBe('#5b6070');
      expect(paper.accent.toLowerCase()).toBe('#4f5bd5');
      expect(paper.accent2.toLowerCase()).toBe('#0e9f92');
      expect(paper.warning.toLowerCase()).toBe('#9a6700');
      expect(paper.danger.toLowerCase()).toBe('#d6455a');
    });

    it('blueprint and blackboard themes override all required tokens', () => {
      const bp = THEMES.blueprint;
      const bb = THEMES.blackboard;
      expect(bp.canvas.toLowerCase()).toBe('#0b2a4a');
      expect(bp.text.toLowerCase()).toBe('#e6f0ff');
      expect(bp.accent.toLowerCase()).toBe('#5cc8ff');

      expect(bb.canvas.toLowerCase()).toBe('#1e2a25');
      expect(bb.text.toLowerCase()).toBe('#f2f0e6');
      expect(bb.accent.toLowerCase()).toBe('#f5d76e');
    });

    it('high-contrast theme maintains pure black canvas and pure white text', () => {
      const hc = THEMES['high-contrast'];
      expect(hc.canvas.toLowerCase()).toBe('#000000');
      expect(hc.text.toLowerCase()).toBe('#ffffff');
      expect(hc.border.toLowerCase()).toBe('#ffffff');
    });

    it('retrieves tokens via getThemeTokens with safe fallback to midnight', () => {
      const paper = getThemeTokens('paper');
      expect(paper.name).toBe('paper');
      expect(paper.text.toLowerCase()).toBe('#1c1e26');

      const fallback = getThemeTokens('non_existent_theme');
      expect(fallback.name).toBe('midnight');
    });

    it('generates CSS variables dictionary and CSS string', () => {
      const midnight = THEMES.midnight;
      const cssVars = generateThemeCssVariables(midnight);
      expect(cssVars['--lb-canvas']).toBe('#12141C');
      expect(cssVars['--lb-surface']).toBe('#1A1D28');
      expect(cssVars['--lb-accent']).toBe('#7C8CFF');

      const cssStr = themeToCssString(midnight);
      expect(cssStr).toContain('--lb-canvas: #12141C;');
      expect(cssStr).toContain('--lb-text: #E8EAF2;');
    });

    it('theme objects are frozen and immutable at runtime', () => {
      expect(Object.isFrozen(THEMES)).toBe(true);
      expect(Object.isFrozen(THEMES.midnight)).toBe(true);
      expect(Object.isFrozen(THEMES.paper)).toBe(true);
    });

    it('isDarkTheme identifies dark themes correctly', () => {
      expect(isDarkTheme('midnight')).toBe(true);
      expect(isDarkTheme('paper')).toBe(false);
      expect(isDarkTheme('blueprint')).toBe(true);
      expect(isDarkTheme('blackboard')).toBe(true);
      expect(isDarkTheme('high-contrast')).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 5: WCAG AA Contrast Compliance
  // --------------------------------------------------------------------------
  describe('Feature 5: WCAG AA Contrast Compliance', () => {
    it('midnight theme text-on-surface satisfies WCAG AA (>= 4.5:1)', () => {
      const ratio = calculateContrastRatio(THEMES.midnight.text, THEMES.midnight.surface);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('paper theme text-on-surface satisfies WCAG AA (>= 4.5:1)', () => {
      const ratio = calculateContrastRatio(THEMES.paper.text, THEMES.paper.surface);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('blueprint and blackboard theme text-on-canvas meets WCAG AA (>= 4.5:1)', () => {
      const bpRatio = calculateContrastRatio(THEMES.blueprint.text, THEMES.blueprint.canvas);
      const bbRatio = calculateContrastRatio(THEMES.blackboard.text, THEMES.blackboard.canvas);
      expect(bpRatio).toBeGreaterThanOrEqual(4.5);
      expect(bbRatio).toBeGreaterThanOrEqual(4.5);
    });

    it('high-contrast theme exceeds WCAG AAA (>= 7:1) text contrast', () => {
      const ratio = calculateContrastRatio(THEMES['high-contrast'].text, THEMES['high-contrast'].canvas);
      expect(ratio).toBeGreaterThanOrEqual(7.0);
    });

    it('muted text on raised surface satisfies minimum secondary text threshold (>= 3.0:1)', () => {
      const mRatio = calculateContrastRatio(THEMES.midnight.textMuted, THEMES.midnight.surfaceRaised);
      const pRatio = calculateContrastRatio(THEMES.paper.textMuted, THEMES.paper.surfaceRaised);
      expect(mRatio).toBeGreaterThanOrEqual(3.0);
      expect(pRatio).toBeGreaterThanOrEqual(3.0);
    });

    it('handles identical colors with contrast ratio 1.0', () => {
      const ratio = calculateContrastRatio('#12141C', '#12141C');
      expect(ratio).toBeCloseTo(1.0, 2);
    });

    it('pure black vs pure white contrast ratio is exactly 21.0:1', () => {
      const ratio = calculateContrastRatio('#000000', '#FFFFFF');
      expect(ratio).toBeCloseTo(21.0, 1);
    });

    it('calculates relative luminance correctly', () => {
      expect(relativeLuminance(0, 0, 0)).toBe(0);
      expect(relativeLuminance(255, 255, 255)).toBeCloseTo(1.0, 4);
    });

    it('normalizes 3-digit hex shorthand correctly', () => {
      expect(normalizeHex('#FFF').toUpperCase()).toBe('#FFFFFF');
      expect(normalizeHex('#123').toUpperCase()).toBe('#112233');
    });

    it('throws on malformed hex input', () => {
      expect(() => hexToRgb('invalid-hex')).toThrow('Invalid hex');
      expect(() => hexToRgb('#12')).toThrow('Invalid hex');
    });

    it('verifyWcagAA evaluates standard and graphical thresholds', () => {
      const resText = verifyWcagAA(THEMES.midnight.text, THEMES.midnight.surface, false);
      expect(resText.pass).toBe(true);

      const resGraphic = verifyWcagAA(THEMES.midnight.textMuted, THEMES.midnight.surfaceRaised, true);
      expect(resGraphic.pass).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 6: Pen Palette Hardening
  // --------------------------------------------------------------------------
  describe('Feature 6: Pen Palette Hardening', () => {
    it('supports all 10 semantic pen slots', () => {
      expect(PEN_SLOTS).toHaveLength(10);
      const expectedSlots: PenColorSlot[] = [
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
      for (const slot of expectedSlots) {
        expect(PEN_SLOTS).toContain(slot);
      }
    });

    it('okabe-ito 7 color values match official color-blind safe standards', () => {
      expect(OKABE_ITO_PALETTE.orange.toUpperCase()).toBe('#E69F00');
      expect(OKABE_ITO_PALETTE.sky.toUpperCase()).toBe('#56B4E9');
      expect(OKABE_ITO_PALETTE.green.toUpperCase()).toBe('#009E73');
      expect(OKABE_ITO_PALETTE.yellow.toUpperCase()).toBe('#F0E442');
      expect(OKABE_ITO_PALETTE.blue.toUpperCase()).toBe('#0072B2');
      expect(OKABE_ITO_PALETTE.vermillion.toUpperCase()).toBe('#D55E00');
      expect(OKABE_ITO_PALETTE.purple.toUpperCase()).toBe('#CC79A7');
    });

    it('dark canvas requires lightened blue and vermillion to exceed 3:1 contrast', () => {
      const darkCanvas = THEMES.midnight.canvas;
      const blue = getPenColor('blue', 'midnight');
      const vermillion = getPenColor('vermillion', 'midnight');

      expect(blue.toUpperCase()).toBe(OKABE_ITO_DARK_THEME_ADJUSTMENTS.blueLightened.toUpperCase());
      expect(vermillion.toUpperCase()).toBe(OKABE_ITO_DARK_THEME_ADJUSTMENTS.vermillionLightened.toUpperCase());

      expect(calculateContrastRatio(blue, darkCanvas)).toBeGreaterThanOrEqual(3.0);
      expect(calculateContrastRatio(vermillion, darkCanvas)).toBeGreaterThanOrEqual(3.0);
    });

    it('light theme uses standard Okabe-Ito blue and vermillion', () => {
      const blue = getPenColor('blue', 'paper');
      const vermillion = getPenColor('vermillion', 'paper');
      expect(blue.toUpperCase()).toBe(OKABE_ITO_PALETTE.blue.toUpperCase());
      expect(vermillion.toUpperCase()).toBe(OKABE_ITO_PALETTE.vermillion.toUpperCase());
      expect(calculateContrastRatio(blue, THEMES.paper.canvas)).toBeGreaterThanOrEqual(3.0);
    });

    it('semantic ink slot resolves dynamically to theme text color', () => {
      const midnightInk = getPenColor('ink', 'midnight');
      const paperInk = getPenColor('ink', 'paper');
      expect(midnightInk).toBe(THEMES.midnight.text);
      expect(paperInk).toBe(THEMES.paper.text);
      expect(midnightInk).not.toBe(paperInk);
    });

    it('custom slot with invalid hex falls back safely to default ink', () => {
      expect(getPenColor('custom', 'midnight', 'not-a-hex')).toBe(THEMES.midnight.text);
      expect(getPenColor('custom', 'midnight', '#123456')).toBe('#123456');
    });

    it('unknown slot id falls back safely to default ink', () => {
      expect(getPenColor('neon-pink', 'midnight')).toBe(THEMES.midnight.text);
    });

    it('clamps stroke width strictly to [1, 24] px', () => {
      expect(clampStrokeWidth(0)).toBe(1);
      expect(clampStrokeWidth(-5)).toBe(1);
      expect(clampStrokeWidth(12.4)).toBe(12);
      expect(clampStrokeWidth(24)).toBe(24);
      expect(clampStrokeWidth(50)).toBe(24);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 7: Micro-Interactions System
  // --------------------------------------------------------------------------
  describe('Feature 7: Micro-Interactions System', () => {
    it('specification easing curve matches cubic-bezier(0.2, 0, 0, 1)', () => {
      expect(MOTION_CURVE).toBe('cubic-bezier(0.2, 0, 0, 1)');
      expect(resolveEasing('custom-bad')).toBe(MOTION_CURVE);
      expect(resolveEasing('cubic-bezier(0.4, 0, 0.2, 1)')).toBe('cubic-bezier(0.4, 0, 0.2, 1)');
    });

    it('standard durations match calibrated spec requirements', () => {
      expect(MOTION_DURATIONS.standard).toBe(150);
      expect(MOTION_DURATIONS.standard).toBeGreaterThanOrEqual(120);
      expect(MOTION_DURATIONS.standard).toBeLessThanOrEqual(180);

      expect(MOTION_DURATIONS.morph).toBe(200);
      expect(MOTION_DURATIONS.connectorSnap).toBe(160);
      expect(MOTION_DURATIONS.drawer).toBe(160);
      expect(MOTION_DURATIONS.toolbarCollapse).toBe(150);
    });

    it('reduced-motion preference instantly bypasses animations to 0ms', () => {
      expect(resolveMotionDuration(150, true)).toBe(0);
      expect(resolveMotionDuration(200, true)).toBe(0);
      expect(resolveMotionDuration(160, true)).toBe(0);
      expect(resolveMotionDuration(150, false)).toBe(150);
    });

    it('clamps transition duration within [120, 180]', () => {
      expect(clampTransitionDuration(50)).toBe(120);
      expect(clampTransitionDuration(150)).toBe(150);
      expect(clampTransitionDuration(300)).toBe(180);
    });
  });

  // --------------------------------------------------------------------------
  // Feature 8: Dual-Channel DSA Visual Coding
  // --------------------------------------------------------------------------
  describe('Feature 8: Dual-Channel DSA Visual Coding', () => {
    const states: DSACellState[] = [
      'base-case',
      'computed',
      'active',
      'to-compute',
      'mismatch',
      'final-answer',
    ];

    it('supports all 6 canonical DSA cell states', () => {
      expect(Object.keys(DSA_STATE_DEFINITIONS)).toHaveLength(6);
      for (const s of states) {
        expect(DSA_STATE_DEFINITIONS[s]).toBeDefined();
        expect(DSA_STATE_DEFINITIONS[s].state).toBe(s);
      }
    });

    it('base case renders teal fill with triangle cue', () => {
      const def = DSA_STATE_DEFINITIONS['base-case'];
      expect(def.colorName).toBe('teal');
      expect(def.shapeCue).toBe('triangle');
    });

    it('computed renders indigo tint with no additional shape cue', () => {
      const def = DSA_STATE_DEFINITIONS.computed;
      expect(def.colorName).toBe('indigo');
      expect(def.shapeCue).toBe('none');
    });

    it('active cell renders amber fill with thick outline cue', () => {
      const def = DSA_STATE_DEFINITIONS.active;
      expect(def.colorName).toBe('amber');
      expect(def.shapeCue).toBe('thick-outline');
    });

    it('to-compute cell renders transparent fill with dashed outline cue', () => {
      const def = DSA_STATE_DEFINITIONS['to-compute'];
      expect(def.colorName).toBe('transparent');
      expect(def.shapeCue).toBe('dashed-outline');
    });

    it('mismatch renders vermillion with 45-degree hatch cue', () => {
      const def = DSA_STATE_DEFINITIONS.mismatch;
      expect(def.colorName).toBe('vermillion');
      expect(def.shapeCue).toBe('hatch');
    });

    it('final-answer renders gold fill with star badge cue', () => {
      const def = DSA_STATE_DEFINITIONS['final-answer'];
      expect(def.colorName).toBe('gold');
      expect(def.shapeCue).toBe('star-badge');
    });

    it('resolveDSACellState falls back safely to to-compute', () => {
      const def = resolveDSACellState('invalid_state');
      expect(def.state).toBe('to-compute');
      expect(def.shapeCue).toBe('dashed-outline');
    });

    it('getDSACellGeometry handles zero or negative bounds safely', () => {
      expect(getDSACellGeometry('base-case', 0, 0)).toBeNull();
      expect(getDSACellGeometry('base-case', -10, 50)).toBeNull();

      const geom = getDSACellGeometry('base-case', 50, 50);
      expect(geom).not.toBeNull();
      expect(geom?.shapeCue).toBe('triangle');
      expect(geom?.trianglePoints).toBeDefined();
    });

    it('high-contrast theme renders shape cues with thicker stroke widths', () => {
      const normal = getDSACellGeometry('active', 50, 50, 'midnight');
      const hc = getDSACellGeometry('active', 50, 50, 'high-contrast');
      expect(hc!.strokeWidth).toBeGreaterThan(normal!.strokeWidth);
    });
  });

  // --------------------------------------------------------------------------
  // Typography and Surfaces
  // --------------------------------------------------------------------------
  describe('Typography and Surfaces', () => {
    it('defines standard type scale and line height', () => {
      expect(TYPOGRAPHY.lineHeight).toBe(1.4);
      expect(TYPOGRAPHY.fontSizes.xs).toBe(12);
      expect(TYPOGRAPHY.fontSizes.sm).toBe(13);
      expect(TYPOGRAPHY.fontSizes.base).toBe(14);
      expect(TYPOGRAPHY.fontSizes.md).toBe(16);
      expect(TYPOGRAPHY.fontSizes.lg).toBe(20);
      expect(TYPOGRAPHY.fontSizes.xl).toBe(28);
    });

    it('defines standard surface radii and grid dimensions', () => {
      expect(SURFACES.spacingUnit).toBe(4);
      expect(SURFACES.gridStep).toBe(8);
      expect(SURFACES.radii.control).toBe(8);
      expect(SURFACES.radii.panel).toBe(12);
      expect(SURFACES.radii.frame).toBe(12);
      expect(SURFACES.borderWidth).toBe(1);
      expect(SURFACES.frameTint).toBe(0.06);
      expect(SURFACES.dotGrid.spacing).toBe(24);
      expect(SURFACES.dotGrid.dotSize).toBe(1.5);
    });
  });
});
