/**
 * Empirical Adversarial Stress Harness for Milestone 2 (UI Style System & Design Tokens)
 * Tests packages/ui directly under adversarial inputs, boundary conditions, and invariant stress.
 */

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
} from '../packages/ui/dist/index.js';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

const results: TestResult[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    results.push({ name, passed: true });
    console.log(`  ✔ [PASS] ${name}`);
  } catch (err) {
    results.push({ name, passed: false, error: (err as Error).message });
    console.error(`  ✖ [FAIL] ${name}: ${(err as Error).message}`);
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

function assertClose(actual: number, expected: number, delta = 0.01, msg = '') {
  if (Math.abs(actual - expected) > delta) {
    throw new Error(`${msg} - expected ~${expected}, got ${actual} (diff: ${Math.abs(actual - expected)})`);
  }
}

console.log('================================================================');
console.log('  Milestone 2 Adversarial Stress Harness Execution  ');
console.log('================================================================\n');

// ----------------------------------------------------------------------------
// Section 1: CSS Variable Generator Resilience & Malformed Inputs
// ----------------------------------------------------------------------------
console.log('▶ Section 1: CSS Variable Generator Resilience & Malformed Inputs');

test('s1-1: CSS variable generator produces all 10 required custom properties for every theme', () => {
  const expectedKeys = [
    '--lb-canvas',
    '--lb-surface',
    '--lb-surface-raised',
    '--lb-border',
    '--lb-text',
    '--lb-text-muted',
    '--lb-accent',
    '--lb-accent-2',
    '--lb-warning',
    '--lb-danger',
  ];

  for (const themeName of Object.keys(THEMES) as ThemeName[]) {
    const tokens = THEMES[themeName];
    const cssVars = generateThemeCssVariables(tokens);
    for (const key of expectedKeys) {
      assert(Boolean(cssVars[key]), `Theme ${themeName} missing CSS variable ${key}`);
      assert(cssVars[key].startsWith('#') || cssVars[key].startsWith('rgb'), `Variable ${key} has non-color value: ${cssVars[key]}`);
    }
    const cssStr = themeToCssString(tokens);
    for (const key of expectedKeys) {
      assert(cssStr.includes(`${key}: ${cssVars[key]};`), `Serialized CSS string missing ${key}`);
    }
  }
});

test('s1-2: themeToCssString produces syntactically valid CSS declarations without trailing syntax errors', () => {
  for (const themeName of Object.keys(THEMES) as ThemeName[]) {
    const tokens = THEMES[themeName];
    const cssStr = themeToCssString(tokens);
    const declarations = cssStr.split(';').map(s => s.trim()).filter(Boolean);
    assert(declarations.length === 10, `Expected 10 CSS declarations, got ${declarations.length}`);
    for (const decl of declarations) {
      const parts = decl.split(':').map(s => s.trim());
      assert(parts.length === 2, `Malformed declaration: ${decl}`);
      assert(parts[0].startsWith('--lb-'), `Variable name does not start with --lb-: ${parts[0]}`);
      assert(parts[1].length > 0, `Value is empty in declaration: ${decl}`);
    }
  }
});

test('s1-3: getThemeTokens gracefully handles invalid, empty, or undefined theme names', () => {
  const fallbackMidnight = getThemeTokens('midnight');
  assert(getThemeTokens(undefined as any) === fallbackMidnight, 'undefined theme did not fallback to midnight');
  assert(getThemeTokens(null as any) === fallbackMidnight, 'null theme did not fallback to midnight');
  assert(getThemeTokens('') === fallbackMidnight, 'empty string theme did not fallback to midnight');
  assert(getThemeTokens('cyberpunk') === fallbackMidnight, 'non-existent theme did not fallback to midnight');
  assert(getThemeTokens('MIDNIGHT') === fallbackMidnight, 'case-mismatched theme did not fallback to midnight');
});

test('s1-4: generateThemeCssVariables handles tokens with custom hex strings safely', () => {
  const customTokens: ThemeTokens = {
    name: 'custom' as any,
    canvas: '#000000',
    surface: '#111111',
    surfaceRaised: '#222222',
    border: '#333333',
    text: '#ffffff',
    textMuted: '#aaaaaa',
    accent: '#ff00ff',
    accent2: '#00ffff',
    warning: '#ffff00',
    danger: '#ff0000',
  };
  const cssVars = generateThemeCssVariables(customTokens);
  assert(cssVars['--lb-accent'] === '#ff00ff', 'Custom accent not preserved');
  const cssStr = themeToCssString(customTokens);
  assert(cssStr.includes('--lb-accent: #ff00ff;'), 'Custom token not serialized properly');
});

// ----------------------------------------------------------------------------
// Section 2: All 5 Themes Completeness, Color Validity & WCAG AA Contrast
// ----------------------------------------------------------------------------
console.log('\n▶ Section 2: All 5 Themes Completeness & WCAG AA Contrast');

test('s2-1: exactly 5 specification themes exist and are frozen', () => {
  const themeKeys = Object.keys(THEMES);
  assert(themeKeys.length === 5, `Expected 5 themes, got ${themeKeys.length}`);
  const required: ThemeName[] = ['midnight', 'paper', 'blueprint', 'blackboard', 'high-contrast'];
  for (const r of required) {
    assert(themeKeys.includes(r), `Missing required theme: ${r}`);
  }
  assert(Object.isFrozen(THEMES), 'THEMES object is not frozen');
  for (const r of required) {
    assert(Object.isFrozen(THEMES[r]), `Theme ${r} is not frozen`);
  }
});

test('s2-2: every color token in all 5 themes is a strictly valid 6-digit hex color', () => {
  const hex6Regex = /^#[0-9A-Fa-f]{6}$/;
  for (const themeName of Object.keys(THEMES) as ThemeName[]) {
    const t = THEMES[themeName];
    const colorFields: (keyof ThemeTokens)[] = [
      'canvas',
      'surface',
      'surfaceRaised',
      'border',
      'text',
      'textMuted',
      'accent',
      'accent2',
      'warning',
      'danger',
    ];
    for (const f of colorFields) {
      const val = t[f];
      assert(typeof val === 'string', `${themeName}.${f} is not a string`);
      assert(hex6Regex.test(val), `${themeName}.${f} ("${val}") is not a valid #RRGGBB hex`);
    }
  }
});

test('s2-3: primary text contrast satisfies WCAG AA (>= 4.5:1) against surface and canvas across all 5 themes', () => {
  for (const themeName of Object.keys(THEMES) as ThemeName[]) {
    const t = THEMES[themeName];
    const surfaceRatio = calculateContrastRatio(t.text, t.surface);
    const canvasRatio = calculateContrastRatio(t.text, t.canvas);

    assert(
      surfaceRatio >= 4.5,
      `Theme ${themeName} text-on-surface contrast ${surfaceRatio.toFixed(2)} is below WCAG AA 4.5:1`
    );
    assert(
      canvasRatio >= 4.5,
      `Theme ${themeName} text-on-canvas contrast ${canvasRatio.toFixed(2)} is below WCAG AA 4.5:1`
    );
  }
});

test('s2-4: secondary/muted text contrast satisfies minimum 3.0:1 threshold on raised surfaces across all 5 themes', () => {
  for (const themeName of Object.keys(THEMES) as ThemeName[]) {
    const t = THEMES[themeName];
    const raisedRatio = calculateContrastRatio(t.textMuted, t.surfaceRaised);
    const surfaceRatio = calculateContrastRatio(t.textMuted, t.surface);

    assert(
      raisedRatio >= 3.0,
      `Theme ${themeName} textMuted-on-surfaceRaised ${raisedRatio.toFixed(2)} is below 3.0:1`
    );
    assert(
      surfaceRatio >= 3.0,
      `Theme ${themeName} textMuted-on-surface ${surfaceRatio.toFixed(2)} is below 3.0:1`
    );
  }
});

test('s2-5: high-contrast theme satisfies WCAG AAA (>= 7.0:1) text contrast', () => {
  const hc = THEMES['high-contrast'];
  const ratio = calculateContrastRatio(hc.text, hc.canvas);
  assert(ratio >= 7.0, `High contrast theme text-on-canvas ${ratio.toFixed(2)} is below WCAG AAA 7.0:1`);
  assert(ratio === 21.0, `Expected pure black on pure white ratio to be 21.0, got ${ratio}`);
});

test('s2-6: relative luminance formula adheres strictly to WCAG 2.1 sRGB piece-wise definition', () => {
  // Test black (0, 0, 0)
  assert(relativeLuminance(0, 0, 0) === 0, 'Black luminance must be 0');
  // Test white (255, 255, 255)
  assertClose(relativeLuminance(255, 255, 255), 1.0, 0.0001, 'White luminance must be 1.0');
  // Test threshold boundary around sRGB <= 0.03928
  const lowVal = 10; // 10/255 = 0.039215... which is <= 0.03928
  const lowL = relativeLuminance(lowVal, lowVal, lowVal);
  assert(lowL > 0 && lowL < 0.01, 'Low value luminance in linear range');
  // Contrast ratio symmetry: contrast(A, B) === contrast(B, A)
  const c1 = calculateContrastRatio('#12141C', '#E8EAF2');
  const c2 = calculateContrastRatio('#E8EAF2', '#12141C');
  assertClose(c1, c2, 0.0001, 'Contrast ratio must be symmetric');
});

// ----------------------------------------------------------------------------
// Section 3: Pen Palette Resolution Across All 5 Themes
// ----------------------------------------------------------------------------
console.log('\n▶ Section 3: Pen Palette Resolution Across All 5 Themes');

test('s3-1: PEN_SLOTS defines all 10 semantic pen slots', () => {
  assert(PEN_SLOTS.length === 10, `Expected 10 pen slots, got ${PEN_SLOTS.length}`);
  const expected: PenColorSlot[] = [
    'ink', 'gray', 'orange', 'sky', 'green', 'yellow', 'blue', 'vermillion', 'purple', 'custom'
  ];
  for (const s of expected) {
    assert(PEN_SLOTS.includes(s), `Missing pen slot: ${s}`);
  }
});

test('s3-2: dark themes resolve blue and vermillion to lightened high-readability variants', () => {
  const darkThemes: ThemeName[] = ['midnight', 'blueprint', 'blackboard', 'high-contrast'];
  for (const theme of darkThemes) {
    assert(isDarkTheme(theme), `${theme} must be identified as dark`);
    const blue = getPenColor('blue', theme);
    const vermillion = getPenColor('vermillion', theme);

    assert(
      blue.toUpperCase() === OKABE_ITO_DARK_THEME_ADJUSTMENTS.blueLightened.toUpperCase(),
      `Theme ${theme} blue should resolve to lightened ${OKABE_ITO_DARK_THEME_ADJUSTMENTS.blueLightened}, got ${blue}`
    );
    assert(
      vermillion.toUpperCase() === OKABE_ITO_DARK_THEME_ADJUSTMENTS.vermillionLightened.toUpperCase(),
      `Theme ${theme} vermillion should resolve to lightened ${OKABE_ITO_DARK_THEME_ADJUSTMENTS.vermillionLightened}, got ${vermillion}`
    );

    // Verify graphical contrast >= 3.0:1 against canvas
    const canvas = THEMES[theme].canvas;
    const blueRatio = calculateContrastRatio(blue, canvas);
    const vermillionRatio = calculateContrastRatio(vermillion, canvas);

    assert(
      blueRatio >= 3.0,
      `Theme ${theme} lightened blue contrast ${blueRatio.toFixed(2)} is below 3.0:1 on canvas ${canvas}`
    );
    assert(
      vermillionRatio >= 3.0,
      `Theme ${theme} lightened vermillion contrast ${vermillionRatio.toFixed(2)} is below 3.0:1 on canvas ${canvas}`
    );
  }
});

test('s3-3: paper light theme resolves blue and vermillion to standard Okabe-Ito values', () => {
  assert(!isDarkTheme('paper'), 'paper must not be a dark theme');
  const blue = getPenColor('blue', 'paper');
  const vermillion = getPenColor('vermillion', 'paper');

  assert(
    blue.toUpperCase() === OKABE_ITO_PALETTE.blue.toUpperCase(),
    `Paper blue should resolve to standard Okabe-Ito ${OKABE_ITO_PALETTE.blue}, got ${blue}`
  );
  assert(
    vermillion.toUpperCase() === OKABE_ITO_PALETTE.vermillion.toUpperCase(),
    `Paper vermillion should resolve to standard Okabe-Ito ${OKABE_ITO_PALETTE.vermillion}, got ${vermillion}`
  );

  const canvas = THEMES.paper.canvas;
  const blueRatio = calculateContrastRatio(blue, canvas);
  const vermillionRatio = calculateContrastRatio(vermillion, canvas);

  assert(blueRatio >= 3.0, `Paper blue contrast ${blueRatio.toFixed(2)} is below 3.0:1 on canvas`);
  assert(vermillionRatio >= 3.0, `Paper vermillion contrast ${vermillionRatio.toFixed(2)} is below 3.0:1 on canvas`);
});

test('s3-4: ink slot dynamically resolves to theme text color on all 5 themes', () => {
  for (const themeName of Object.keys(THEMES) as ThemeName[]) {
    const ink = getPenColor('ink', themeName);
    assert(ink === THEMES[themeName].text, `Theme ${themeName} ink does not match text color`);
    const ratio = calculateContrastRatio(ink, THEMES[themeName].canvas);
    assert(ratio >= 4.5, `Theme ${themeName} ink contrast ${ratio.toFixed(2)} is below 4.5:1 on canvas`);
  }
});

test('s3-5: gray slot resolves to theme-appropriate high-readability gray', () => {
  const darkGray = getPenColor('gray', 'midnight');
  const lightGray = getPenColor('gray', 'paper');

  assert(darkGray.toUpperCase() === '#A3A9BD', `Dark gray mismatch: ${darkGray}`);
  assert(lightGray.toUpperCase() === '#5B6070', `Light gray mismatch: ${lightGray}`);

  assert(calculateContrastRatio(darkGray, THEMES.midnight.canvas) >= 3.0, 'Dark gray contrast < 3.0 on midnight');
  assert(calculateContrastRatio(lightGray, THEMES.paper.canvas) >= 3.0, 'Light gray contrast < 3.0 on paper');
});

test('s3-6: custom slot handles 3-digit shorthand, 6-digit hex, and malformed inputs', () => {
  const midnightText = THEMES.midnight.text;
  // 3-digit hex shorthand expansion
  assert(getPenColor('custom', 'midnight', '#fff').toUpperCase() === '#FFFFFF', '3-digit #fff not expanded to #FFFFFF');
  assert(getPenColor('custom', 'midnight', '#123').toUpperCase() === '#112233', '3-digit #123 not expanded to #112233');
  // 6-digit hex
  assert(getPenColor('custom', 'midnight', '#ABCDEF').toUpperCase() === '#ABCDEF', '6-digit #ABCDEF not preserved');
  assert(getPenColor('custom', 'midnight', '  #abcdef  ').toUpperCase() === '#ABCDEF', 'whitespace not trimmed');
  // Malformed inputs fallback to theme text
  assert(getPenColor('custom', 'midnight', 'invalid') === midnightText, 'invalid string did not fallback to ink');
  assert(getPenColor('custom', 'midnight', '#12') === midnightText, 'short hex did not fallback to ink');
  assert(getPenColor('custom', 'midnight', '#12345') === midnightText, '5-digit hex did not fallback to ink');
  assert(getPenColor('custom', 'midnight', '#1234567') === midnightText, '7-digit hex did not fallback to ink');
  assert(getPenColor('custom', 'midnight', '#GGGGGG') === midnightText, 'non-hex chars did not fallback to ink');
  assert(getPenColor('custom', 'midnight', undefined) === midnightText, 'undefined customHex did not fallback to ink');
  assert(getPenColor('custom', 'midnight', '') === midnightText, 'empty string customHex did not fallback to ink');
});

test('s3-7: unknown slot IDs fall back cleanly to theme ink', () => {
  assert(getPenColor('neon-pink', 'midnight') === THEMES.midnight.text, 'neon-pink did not fallback');
  assert(getPenColor('', 'paper') === THEMES.paper.text, 'empty string slot did not fallback');
  assert(getPenColor(null as any, 'blueprint') === THEMES.blueprint.text, 'null slot did not fallback');
});

test('s3-8: clampStrokeWidth clamps strictly within [1, 24] px and rounds values', () => {
  assert(clampStrokeWidth(0) === 1, 'stroke width 0 should clamp to 1');
  assert(clampStrokeWidth(-100) === 1, 'negative stroke width should clamp to 1');
  assert(clampStrokeWidth(1) === 1, 'stroke width 1 should remain 1');
  assert(clampStrokeWidth(24) === 24, 'stroke width 24 should remain 24');
  assert(clampStrokeWidth(25) === 24, 'stroke width 25 should clamp to 24');
  assert(clampStrokeWidth(1000) === 24, 'large stroke width should clamp to 24');
  assert(clampStrokeWidth(3.4) === 3, 'stroke width 3.4 should round to 3');
  assert(clampStrokeWidth(3.6) === 4, 'stroke width 3.6 should round to 4');
});

// ----------------------------------------------------------------------------
// Section 4: Micro-Interactions System & Easing Parsing
// ----------------------------------------------------------------------------
console.log('\n▶ Section 4: Micro-Interactions System & Easing Parsing');

test('s4-1: MOTION_CURVE matches exact specification cubic-bezier(0.2, 0, 0, 1)', () => {
  assert(MOTION_CURVE === 'cubic-bezier(0.2, 0, 0, 1)', `Unexpected curve: ${MOTION_CURVE}`);
});

test('s4-2: MOTION_DURATIONS contains all required calibrated animation timings', () => {
  assert(MOTION_DURATIONS.min === 120, 'min duration != 120');
  assert(MOTION_DURATIONS.standard === 150, 'standard duration != 150');
  assert(MOTION_DURATIONS.max === 180, 'max duration != 180');
  assert(MOTION_DURATIONS.morph === 200, 'morph duration != 200');
  assert(MOTION_DURATIONS.connectorSnap === 160, 'connectorSnap duration != 160');
  assert(MOTION_DURATIONS.drawer === 160, 'drawer duration != 160');
  assert(MOTION_DURATIONS.toolbarCollapse === 150, 'toolbarCollapse duration != 150');
});

test('s4-3: resolveMotionDuration bypasses all animations to 0ms when reducedMotion is true', () => {
  assert(resolveMotionDuration(150, true) === 0, '150ms not bypassed to 0');
  assert(resolveMotionDuration(200, true) === 0, '200ms not bypassed to 0');
  assert(resolveMotionDuration(1000, true) === 0, '1000ms not bypassed to 0');
  assert(resolveMotionDuration(0, true) === 0, '0ms not 0');
  // When reducedMotion is false
  assert(resolveMotionDuration(150, false) === 150, '150ms altered');
  assert(resolveMotionDuration(200, false) === 200, '200ms altered');
  assert(resolveMotionDuration(-10, false) === 0, 'negative duration not clamped to 0');
});

test('s4-4: clampTransitionDuration enforces [min, max] range constraints', () => {
  assert(clampTransitionDuration(50) === 120, 'Under min not clamped to 120');
  assert(clampTransitionDuration(120) === 120, 'Min bound altered');
  assert(clampTransitionDuration(150) === 150, 'Standard duration altered');
  assert(clampTransitionDuration(180) === 180, 'Max bound altered');
  assert(clampTransitionDuration(300) === 180, 'Over max not clamped to 180');
  // Custom bounds
  assert(clampTransitionDuration(50, 60, 100) === 60, 'Custom min not respected');
  assert(clampTransitionDuration(150, 60, 100) === 100, 'Custom max not respected');
});

test('s4-5: resolveEasing parses valid cubic-bezier strings and falls back safely on malformed inputs', () => {
  // Valid curve
  assert(
    resolveEasing('cubic-bezier(0.25, 0.1, 0.25, 1)') === 'cubic-bezier(0.25, 0.1, 0.25, 1)',
    'Valid curve rejected'
  );
  // Trimming
  assert(
    resolveEasing('   cubic-bezier(0, 0, 1, 1)   ') === 'cubic-bezier(0, 0, 1, 1)',
    'Untrimmed curve not handled'
  );
  // Fallbacks
  assert(resolveEasing('linear') === MOTION_CURVE, 'linear did not fallback');
  assert(resolveEasing('ease-in-out') === MOTION_CURVE, 'ease-in-out did not fallback');
  assert(resolveEasing('') === MOTION_CURVE, 'empty string did not fallback');
  assert(resolveEasing('random-junk') === MOTION_CURVE, 'junk string did not fallback');
  assert(resolveEasing(undefined as any) === MOTION_CURVE, 'undefined did not fallback');
  assert(resolveEasing(null as any) === MOTION_CURVE, 'null did not fallback');
  assert(resolveEasing(42 as any) === MOTION_CURVE, 'number did not fallback');
});

// ----------------------------------------------------------------------------
// Section 5: DSA Cell Geometry Across All State Definitions
// ----------------------------------------------------------------------------
console.log('\n▶ Section 5: DSA Cell Geometry Across All State Definitions');

test('s5-1: DSA_STATE_DEFINITIONS contains all 6 canonical states with dual-channel coding', () => {
  const states: DSACellState[] = [
    'base-case',
    'computed',
    'active',
    'to-compute',
    'mismatch',
    'final-answer',
  ];
  assert(Object.keys(DSA_STATE_DEFINITIONS).length === 6, 'State count != 6');
  for (const s of states) {
    const def = DSA_STATE_DEFINITIONS[s];
    assert(def.state === s, `State mismatch for ${s}`);
    assert(typeof def.colorName === 'string', `Missing colorName for ${s}`);
    assert(typeof def.shapeCue === 'string', `Missing shapeCue for ${s}`);
    assert(typeof def.description === 'string', `Missing description for ${s}`);
  }
});

test('s5-2: resolveDSACellState maps valid states correctly and falls back to to-compute', () => {
  assert(resolveDSACellState('base-case').state === 'base-case', 'base-case not resolved');
  assert(resolveDSACellState('computed').state === 'computed', 'computed not resolved');
  assert(resolveDSACellState('active').state === 'active', 'active not resolved');
  assert(resolveDSACellState('to-compute').state === 'to-compute', 'to-compute not resolved');
  assert(resolveDSACellState('mismatch').state === 'mismatch', 'mismatch not resolved');
  assert(resolveDSACellState('final-answer').state === 'final-answer', 'final-answer not resolved');
  // Fallbacks
  assert(resolveDSACellState('unknown-state').state === 'to-compute', 'unknown state did not fallback');
  assert(resolveDSACellState('').state === 'to-compute', 'empty string did not fallback');
  assert(resolveDSACellState(null as any).state === 'to-compute', 'null did not fallback');
});

test('s5-3: getDSACellGeometry generates complete geometric indicators for each canonical state', () => {
  const w = 60;
  const h = 40;

  // 1. base-case: triangle cue
  const baseGeom = getDSACellGeometry('base-case', w, h, 'midnight');
  assert(baseGeom !== null, 'base-case geometry is null');
  assert(baseGeom!.shapeCue === 'triangle', 'base-case shape cue != triangle');
  assert(Array.isArray(baseGeom!.trianglePoints), 'trianglePoints missing');
  assert(baseGeom!.trianglePoints!.length === 3, 'triangle points count != 3');
  // First point should be [0, 0]
  assert(baseGeom!.trianglePoints![0][0] === 0 && baseGeom!.trianglePoints![0][1] === 0, 'Origin point != [0,0]');

  // 2. computed: none cue
  const compGeom = getDSACellGeometry('computed', w, h, 'midnight');
  assert(compGeom !== null, 'computed geometry is null');
  assert(compGeom!.shapeCue === 'none', 'computed shape cue != none');

  // 3. active: thick outline
  const activeGeom = getDSACellGeometry('active', w, h, 'midnight');
  assert(activeGeom !== null, 'active geometry is null');
  assert(activeGeom!.shapeCue === 'thick-outline', 'active shape cue != thick-outline');
  assert(activeGeom!.strokeWidth === 3, `active strokeWidth != 3, got ${activeGeom!.strokeWidth}`);

  // 4. to-compute: dashed outline
  const toCompGeom = getDSACellGeometry('to-compute', w, h, 'midnight');
  assert(toCompGeom !== null, 'to-compute geometry is null');
  assert(toCompGeom!.shapeCue === 'dashed-outline', 'to-compute shape cue != dashed-outline');
  assert(Array.isArray(toCompGeom!.strokeDashArray), 'to-compute strokeDashArray missing');
  assert(toCompGeom!.strokeDashArray!.length === 2, 'strokeDashArray length != 2');

  // 5. mismatch: hatch pattern
  const misGeom = getDSACellGeometry('mismatch', w, h, 'midnight');
  assert(misGeom !== null, 'mismatch geometry is null');
  assert(misGeom!.shapeCue === 'hatch', 'mismatch shape cue != hatch');
  assert(misGeom!.hatchAngle === 45, `hatchAngle != 45, got ${misGeom!.hatchAngle}`);

  // 6. final-answer: star badge
  const finalGeom = getDSACellGeometry('final-answer', w, h, 'midnight');
  assert(finalGeom !== null, 'final-answer geometry is null');
  assert(finalGeom!.shapeCue === 'star-badge', 'final-answer shape cue != star-badge');
  assert(finalGeom!.starBadgePosition !== undefined, 'starBadgePosition missing');
  const badge = finalGeom!.starBadgePosition!;
  assert(badge.x > 0 && badge.x < w, `badge x (${badge.x}) out of bounds [0, ${w}]`);
  assert(badge.y >= 0 && badge.y < h, `badge y (${badge.y}) out of bounds [0, ${h}]`);
  assert(badge.size > 0, 'badge size <= 0');
});

test('s5-4: high-contrast theme scales up DSA geometry stroke widths and dashes', () => {
  const normalActive = getDSACellGeometry('active', 50, 50, 'midnight');
  const hcActive = getDSACellGeometry('active', 50, 50, 'high-contrast');
  assert(hcActive!.strokeWidth > normalActive!.strokeWidth, 'HC active strokeWidth not larger');
  assert(hcActive!.strokeWidth === 4, `Expected HC strokeWidth 4, got ${hcActive!.strokeWidth}`);

  const normalDashed = getDSACellGeometry('to-compute', 50, 50, 'midnight');
  const hcDashed = getDSACellGeometry('to-compute', 50, 50, 'high-contrast');
  assert(hcDashed!.strokeWidth > normalDashed!.strokeWidth, 'HC dashed strokeWidth not larger');
  assert(hcDashed!.strokeDashArray![0] === 6, 'HC dashed dash segment != 6');

  const normalHatch = getDSACellGeometry('mismatch', 50, 50, 'midnight');
  const hcHatch = getDSACellGeometry('mismatch', 50, 50, 'high-contrast');
  assert(hcHatch!.strokeWidth > normalHatch!.strokeWidth, 'HC hatch strokeWidth not larger');
});

test('s5-5: getDSACellGeometry returns null safely for degenerate bounds', () => {
  assert(getDSACellGeometry('base-case', 0, 50) === null, 'width 0 did not return null');
  assert(getDSACellGeometry('base-case', 50, 0) === null, 'height 0 did not return null');
  assert(getDSACellGeometry('base-case', 0, 0) === null, '0x0 did not return null');
  assert(getDSACellGeometry('base-case', -10, 50) === null, 'negative width did not return null');
  assert(getDSACellGeometry('base-case', 50, -10) === null, 'negative height did not return null');
});

test('s5-6: getDSACellGeometry scales proportional indicators on tiny and huge cells', () => {
  // Tiny cell: 4x4
  const tiny = getDSACellGeometry('base-case', 4, 4);
  assert(tiny !== null, 'tiny cell returned null');
  assert(tiny!.trianglePoints![1][0] <= 4, 'triangle point exceeded tiny width');

  // Huge cell: 10000x10000
  const huge = getDSACellGeometry('final-answer', 10000, 10000);
  assert(huge !== null, 'huge cell returned null');
  assert(huge!.starBadgePosition!.size === 12, 'star badge size not capped at 12px');
});

// ----------------------------------------------------------------------------
// Summary
// ----------------------------------------------------------------------------
console.log('\n================================================================');
const passedCount = results.filter(r => r.passed).length;
const failedCount = results.filter(r => !r.passed).length;
console.log(`Results: ${passedCount} passed, ${failedCount} failed (${results.length} total)`);
console.log('================================================================');

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
