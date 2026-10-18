/**
 * Adversarial Stress & Property Test Suite for Milestone 2 (UI Style System & Design Tokens)
 * Agent: challenger_m2_1_g5
 * Execution: node tests/adversarial-m2.mjs
 */

import assert from 'node:assert/strict';
import fc from 'fast-check';
import * as ui from '../packages/ui/dist/index.js';

console.log('================================================================');
console.log('  CHALLENGER M2: Adversarial Stress & Verification Harness');
console.log('================================================================\n');

let totalAssertions = 0;
function check(condition, message) {
  totalAssertions++;
  assert(condition, message);
}

// ----------------------------------------------------------------------------
// 1. Boundary & Stress Tests for Luminance and Contrast
// ----------------------------------------------------------------------------
console.log('▶ [Suite 1] Relative Luminance & WCAG Contrast Invariants');

// Pure black and white
check(ui.relativeLuminance(0, 0, 0) === 0, 'Pure black relative luminance must be 0');
check(Math.abs(ui.relativeLuminance(255, 255, 255) - 1.0) < 1e-5, 'Pure white relative luminance must be 1.0');

// Mathematical boundaries
const blackWhiteRatio = ui.calculateContrastRatio('#000000', '#ffffff');
check(Math.abs(blackWhiteRatio - 21.0) < 0.05, `Black/white ratio must be 21:1, got ${blackWhiteRatio}`);

const whiteBlackRatio = ui.calculateContrastRatio('#ffffff', '#000000');
check(Math.abs(whiteBlackRatio - 21.0) < 0.05, `White/black ratio must be 21:1, got ${whiteBlackRatio}`);

// Identical colors
for (const color of ['#000000', '#ffffff', '#12141c', '#7c8cff', '#e8eaf2']) {
  const selfRatio = ui.calculateContrastRatio(color, color);
  check(Math.abs(selfRatio - 1.0) < 1e-4, `Identical color ratio for ${color} must be 1.0, got ${selfRatio}`);
}

// 3-char shorthand hex normalization
check(ui.normalizeHex('#000').toUpperCase() === '#000000', '#000 normalizes to #000000');
check(ui.normalizeHex('#FFF').toUpperCase() === '#FFFFFF', '#FFF normalizes to #FFFFFF');
check(ui.normalizeHex('#abc').toUpperCase() === '#AABBCC', '#abc normalizes to #AABBCC');
check(ui.normalizeHex('#123').toUpperCase() === '#112233', '#123 normalizes to #112233');

// HexToRgb invalid string rejection
const invalidHexList = [
  '',
  '#',
  '#1',
  '#12',
  '#1234',
  '#12345',
  '#1234567',
  '#gggggg',
  'rgb(0,0,0)',
  'transparent',
  '#zzzzzz',
  'not-a-color',
];

for (const badHex of invalidHexList) {
  let threw = false;
  try {
    ui.hexToRgb(badHex);
  } catch (err) {
    threw = true;
    check(err.message.includes('Invalid hex'), `Error message must indicate invalid hex for "${badHex}"`);
  }
  check(threw, `hexToRgb must throw on malformed hex: "${badHex}"`);
}

// Fast-check property: relative luminance is strictly within [0, 1] for all valid RGB
fc.assert(
  fc.property(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), (r, g, b) => {
    const l = ui.relativeLuminance(r, g, b);
    return l >= 0 && l <= 1.0;
  }),
  { numRuns: 1000 }
);
console.log('  ✔ Passed fast-check (1,000 runs): relativeLuminance in [0.0, 1.0]');

// Fast-check property: contrast ratio is symmetric and in [1.0, 21.0] for random valid hex colors
const hexArbitrary = fc.hexaString({ minLength: 6, maxLength: 6 }).map((h) => `#${h}`);
fc.assert(
  fc.property(hexArbitrary, hexArbitrary, (hexA, hexB) => {
    const rAB = ui.calculateContrastRatio(hexA, hexB);
    const rBA = ui.calculateContrastRatio(hexB, hexA);
    const symmetric = Math.abs(rAB - rBA) < 1e-4;
    const bounded = rAB >= 1.0 && rAB <= 21.0;
    return symmetric && bounded;
  }),
  { numRuns: 1000 }
);
console.log('  ✔ Passed fast-check (1,000 runs): calculateContrastRatio symmetric & bounded [1.0, 21.0]');

// ----------------------------------------------------------------------------
// 2. Theme Switching & CSS Variables Verification
// ----------------------------------------------------------------------------
console.log('\n▶ [Suite 2] Theme Switching, CSS Variables & WCAG AA Verification');

const themes = ['midnight', 'paper', 'blueprint', 'blackboard', 'high-contrast'];
const requiredVars = [
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

for (const themeName of themes) {
  const theme = ui.THEMES[themeName];
  check(theme !== undefined, `Theme ${themeName} must exist`);
  check(theme.name === themeName, `Theme name must match ${themeName}`);

  // Check CSS variables generation
  const vars = ui.generateThemeCssVariables(theme);
  for (const v of requiredVars) {
    check(vars[v] !== undefined, `Theme ${themeName} must generate variable ${v}`);
    check(typeof vars[v] === 'string' && vars[v].startsWith('#'), `Variable ${v} must be valid hex`);
  }

  // Check CSS string serialization
  const cssStr = ui.themeToCssString(theme);
  for (const v of requiredVars) {
    check(cssStr.includes(`${v}: ${vars[v]};`), `CSS string must contain ${v} for theme ${themeName}`);
  }

  // Text on surface contrast >= 4.5:1
  const textSurfaceRatio = ui.calculateContrastRatio(theme.text, theme.surface);
  check(
    textSurfaceRatio >= 4.5,
    `Theme ${themeName} text on surface contrast must be >= 4.5:1, got ${textSurfaceRatio.toFixed(2)}`
  );

  // Text on canvas contrast >= 4.5:1
  const textCanvasRatio = ui.calculateContrastRatio(theme.text, theme.canvas);
  check(
    textCanvasRatio >= 4.5,
    `Theme ${themeName} text on canvas contrast must be >= 4.5:1, got ${textCanvasRatio.toFixed(2)}`
  );

  // Muted text on surfaceRaised >= 3.0:1
  const mutedRaisedRatio = ui.calculateContrastRatio(theme.textMuted, theme.surfaceRaised);
  check(
    mutedRaisedRatio >= 3.0,
    `Theme ${themeName} muted text on surfaceRaised contrast must be >= 3.0:1, got ${mutedRaisedRatio.toFixed(2)}`
  );

  // verifyWcagAA evaluation
  const standardWcag = ui.verifyWcagAA(theme.text, theme.surface, false);
  check(standardWcag.pass === true, `verifyWcagAA must pass for ${themeName} standard text`);

  const graphicWcag = ui.verifyWcagAA(theme.textMuted, theme.surfaceRaised, true);
  check(graphicWcag.pass === true, `verifyWcagAA must pass for ${themeName} secondary text`);
}

// High-contrast specific check: text contrast must exceed WCAG AAA (>= 7.0:1)
const hcRatio = ui.calculateContrastRatio(ui.THEMES['high-contrast'].text, ui.THEMES['high-contrast'].canvas);
check(hcRatio >= 7.0, `High-contrast theme must exceed 7.0:1 AAA contrast, got ${hcRatio}`);

// Safe fallback for getThemeTokens
check(ui.getThemeTokens('paper').name === 'paper', 'getThemeTokens(paper) must return paper');
check(ui.getThemeTokens('non_existent').name === 'midnight', 'getThemeTokens fallback must be midnight');
check(ui.getThemeTokens('').name === 'midnight', 'getThemeTokens empty string must fallback to midnight');

// isDarkTheme checks
check(ui.isDarkTheme('paper') === false, 'isDarkTheme(paper) must be false');
check(ui.isDarkTheme('midnight') === true, 'isDarkTheme(midnight) must be true');
check(ui.isDarkTheme('blueprint') === true, 'isDarkTheme(blueprint) must be true');
check(ui.isDarkTheme('blackboard') === true, 'isDarkTheme(blackboard) must be true');
check(ui.isDarkTheme('high-contrast') === true, 'isDarkTheme(high-contrast) must be true');

console.log('  ✔ Passed all 5 theme token matrix and contrast verifications');

// ----------------------------------------------------------------------------
// 3. Pen Palette and Okabe-Ito Hardening
// ----------------------------------------------------------------------------
console.log('\n▶ [Suite 3] Pen Palette & Okabe-Ito Adjustments');

// 10 slots
check(ui.PEN_SLOTS.length === 10, 'PEN_SLOTS must have exactly 10 slots');
const expectedSlots = [
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
for (const s of expectedSlots) {
  check(ui.PEN_SLOTS.includes(s), `PEN_SLOTS must include ${s}`);
}

// Okabe-Ito exact standard colors
check(ui.OKABE_ITO_PALETTE.orange.toUpperCase() === '#E69F00', 'Okabe-Ito orange match');
check(ui.OKABE_ITO_PALETTE.sky.toUpperCase() === '#56B4E9', 'Okabe-Ito sky match');
check(ui.OKABE_ITO_PALETTE.green.toUpperCase() === '#009E73', 'Okabe-Ito green match');
check(ui.OKABE_ITO_PALETTE.yellow.toUpperCase() === '#F0E442', 'Okabe-Ito yellow match');
check(ui.OKABE_ITO_PALETTE.blue.toUpperCase() === '#0072B2', 'Okabe-Ito blue match');
check(ui.OKABE_ITO_PALETTE.vermillion.toUpperCase() === '#D55E00', 'Okabe-Ito vermillion match');
check(ui.OKABE_ITO_PALETTE.purple.toUpperCase() === '#CC79A7', 'Okabe-Ito purple match');

// Dark themes lightened blue and vermillion adjustment
const darkThemes = ['midnight', 'blueprint', 'blackboard', 'high-contrast'];
for (const dt of darkThemes) {
  const blue = ui.getPenColor('blue', dt);
  const vermillion = ui.getPenColor('vermillion', dt);
  check(
    blue.toUpperCase() === ui.OKABE_ITO_DARK_THEME_ADJUSTMENTS.blueLightened.toUpperCase(),
    `${dt} blue must be lightened to #409CFF`
  );
  check(
    vermillion.toUpperCase() === ui.OKABE_ITO_DARK_THEME_ADJUSTMENTS.vermillionLightened.toUpperCase(),
    `${dt} vermillion must be lightened to #FF7B33`
  );

  const canvasColor = ui.THEMES[dt].canvas;
  const blueContrast = ui.calculateContrastRatio(blue, canvasColor);
  const vermContrast = ui.calculateContrastRatio(vermillion, canvasColor);
  check(blueContrast >= 3.0, `${dt} blue contrast against canvas must be >= 3.0:1, got ${blueContrast.toFixed(2)}`);
  check(vermContrast >= 3.0, `${dt} vermillion contrast against canvas must be >= 3.0:1, got ${vermContrast.toFixed(2)}`);
}

// Light theme (paper) standard blue and vermillion
const paperBlue = ui.getPenColor('blue', 'paper');
const paperVerm = ui.getPenColor('vermillion', 'paper');
check(paperBlue.toUpperCase() === ui.OKABE_ITO_PALETTE.blue.toUpperCase(), 'Paper blue must be standard Okabe-Ito');
check(paperVerm.toUpperCase() === ui.OKABE_ITO_PALETTE.vermillion.toUpperCase(), 'Paper vermillion must be standard Okabe-Ito');
const paperCanvas = ui.THEMES.paper.canvas;
check(ui.calculateContrastRatio(paperBlue, paperCanvas) >= 3.0, 'Paper blue contrast >= 3.0');
check(ui.calculateContrastRatio(paperVerm, paperCanvas) >= 3.0, 'Paper vermillion contrast >= 3.0');

// Ink slot theme dynamism
check(ui.getPenColor('ink', 'midnight') === ui.THEMES.midnight.text, 'Midnight ink resolves to midnight text');
check(ui.getPenColor('ink', 'paper') === ui.THEMES.paper.text, 'Paper ink resolves to paper text');

// Custom slot handling
check(ui.getPenColor('custom', 'midnight', '#123456') === '#123456', 'Custom slot accepts 6-char hex');
check(ui.getPenColor('custom', 'midnight', '#ABC').toUpperCase() === '#AABBCC', 'Custom slot expands 3-char hex');
check(ui.getPenColor('custom', 'midnight', 'invalid') === ui.THEMES.midnight.text, 'Custom slot invalid hex falls back to text');
check(ui.getPenColor('custom', 'midnight', '') === ui.THEMES.midnight.text, 'Custom slot empty string falls back to text');
check(ui.getPenColor('custom', 'midnight') === ui.THEMES.midnight.text, 'Custom slot missing arg falls back to text');

// Unknown slot fallback
check(ui.getPenColor('neon-glow', 'midnight') === ui.THEMES.midnight.text, 'Unknown slot falls back to ink');
check(ui.getPenColor('', 'midnight') === ui.THEMES.midnight.text, 'Empty slot falls back to ink');

// Stroke width clamping [1, 24]
check(ui.clampStrokeWidth(0) === 1, '0 clamps to 1');
check(ui.clampStrokeWidth(-10) === 1, '-10 clamps to 1');
check(ui.clampStrokeWidth(1) === 1, '1 remains 1');
check(ui.clampStrokeWidth(1.2) === 1, '1.2 rounds to 1');
check(ui.clampStrokeWidth(1.8) === 2, '1.8 rounds to 2');
check(ui.clampStrokeWidth(24) === 24, '24 remains 24');
check(ui.clampStrokeWidth(24.4) === 24, '24.4 rounds to 24');
check(ui.clampStrokeWidth(25) === 24, '25 clamps to 24');
check(ui.clampStrokeWidth(100) === 24, '100 clamps to 24');

// Fast-check property: clampStrokeWidth is strictly integer within [1, 24] for all numbers
fc.assert(
  fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), (width) => {
    const clamped = ui.clampStrokeWidth(width);
    return clamped >= 1 && clamped <= 24 && Number.isInteger(clamped);
  }),
  { numRuns: 1000 }
);
console.log('  ✔ Passed fast-check (1,000 runs): clampStrokeWidth integer in [1, 24]');

// ----------------------------------------------------------------------------
// 4. Motion Duration & Micro-Interactions System
// ----------------------------------------------------------------------------
console.log('\n▶ [Suite 4] Motion Duration & Micro-Interactions');

// Constants
check(ui.MOTION_CURVE === 'cubic-bezier(0.2, 0, 0, 1)', 'MOTION_CURVE match');
check(ui.MOTION_DURATIONS.min === 120, 'min duration 120');
check(ui.MOTION_DURATIONS.standard === 150, 'standard duration 150');
check(ui.MOTION_DURATIONS.max === 180, 'max duration 180');
check(ui.MOTION_DURATIONS.morph === 200, 'morph duration 200');
check(ui.MOTION_DURATIONS.connectorSnap === 160, 'snap duration 160');
check(ui.MOTION_DURATIONS.drawer === 160, 'drawer duration 160');
check(ui.MOTION_DURATIONS.toolbarCollapse === 150, 'collapse duration 150');

// Reduced motion instant bypass
check(ui.resolveMotionDuration(150, true) === 0, '150ms reduced motion returns 0ms');
check(ui.resolveMotionDuration(200, true) === 0, '200ms reduced motion returns 0ms');
check(ui.resolveMotionDuration(0, true) === 0, '0ms reduced motion returns 0ms');
check(ui.resolveMotionDuration(1000, true) === 0, '1000ms reduced motion returns 0ms');
check(ui.resolveMotionDuration(-50, true) === 0, '-50ms reduced motion returns 0ms');

check(ui.resolveMotionDuration(150, false) === 150, '150ms normal motion returns 150ms');
check(ui.resolveMotionDuration(-50, false) === 0, 'negative duration normal motion clamped to 0ms');

// Fast-check property: resolveMotionDuration with reducedMotion=true is ALWAYS 0
fc.assert(
  fc.property(fc.double({ noNaN: true, noDefaultInfinity: true }), (duration) => {
    return ui.resolveMotionDuration(duration, true) === 0;
  }),
  { numRuns: 1000 }
);
console.log('  ✔ Passed fast-check (1,000 runs): resolveMotionDuration with reducedMotion is identically 0');

// Clamping [120, 180]
check(ui.clampTransitionDuration(50) === 120, '50 clamps to 120');
check(ui.clampTransitionDuration(0) === 120, '0 clamps to 120');
check(ui.clampTransitionDuration(-100) === 120, '-100 clamps to 120');
check(ui.clampTransitionDuration(120) === 120, '120 remains 120');
check(ui.clampTransitionDuration(150) === 150, '150 remains 150');
check(ui.clampTransitionDuration(180) === 180, '180 remains 180');
check(ui.clampTransitionDuration(250) === 180, '250 clamps to 180');

// Fast-check property: clampTransitionDuration in [120, 180]
fc.assert(
  fc.property(fc.double({ min: -10000, max: 10000, noNaN: true }), (ms) => {
    const clamped = ui.clampTransitionDuration(ms);
    return clamped >= 120 && clamped <= 180;
  }),
  { numRuns: 1000 }
);
console.log('  ✔ Passed fast-check (1,000 runs): clampTransitionDuration in [120, 180]');

// Easing resolver
check(ui.resolveEasing('cubic-bezier(0.4, 0, 0.2, 1)') === 'cubic-bezier(0.4, 0, 0.2, 1)', 'Valid curve preserved');
check(ui.resolveEasing('linear') === ui.MOTION_CURVE, 'Invalid linear falls back to MOTION_CURVE');
check(ui.resolveEasing('ease-in-out') === ui.MOTION_CURVE, 'Invalid ease-in-out falls back to MOTION_CURVE');
check(ui.resolveEasing('') === ui.MOTION_CURVE, 'Empty string falls back to MOTION_CURVE');

// ----------------------------------------------------------------------------
// 5. Dual-Channel DSA Visual Coding
// ----------------------------------------------------------------------------
console.log('\n▶ [Suite 5] Dual-Channel DSA State Coding & Geometry Generator');

// Canonical 6 states
const canonicalStates = [
  'base-case',
  'computed',
  'active',
  'to-compute',
  'mismatch',
  'final-answer',
];

for (const state of canonicalStates) {
  const def = ui.DSA_STATE_DEFINITIONS[state];
  check(def !== undefined, `State ${state} definition must exist`);
  check(def.state === state, `State name must match ${state}`);
  check(typeof def.colorName === 'string', `Color name must be defined for ${state}`);
  check(typeof def.shapeCue === 'string', `Shape cue must be defined for ${state}`);
}

check(ui.DSA_STATE_DEFINITIONS['base-case'].shapeCue === 'triangle', 'base-case has triangle cue');
check(ui.DSA_STATE_DEFINITIONS['base-case'].colorName === 'teal', 'base-case has teal color');

check(ui.DSA_STATE_DEFINITIONS.computed.shapeCue === 'none', 'computed has none cue');
check(ui.DSA_STATE_DEFINITIONS.computed.colorName === 'indigo', 'computed has indigo color');

check(ui.DSA_STATE_DEFINITIONS.active.shapeCue === 'thick-outline', 'active has thick-outline cue');
check(ui.DSA_STATE_DEFINITIONS.active.colorName === 'amber', 'active has amber color');

check(ui.DSA_STATE_DEFINITIONS['to-compute'].shapeCue === 'dashed-outline', 'to-compute has dashed-outline cue');
check(ui.DSA_STATE_DEFINITIONS['to-compute'].colorName === 'transparent', 'to-compute has transparent color');

check(ui.DSA_STATE_DEFINITIONS.mismatch.shapeCue === 'hatch', 'mismatch has hatch cue');
check(ui.DSA_STATE_DEFINITIONS.mismatch.colorName === 'vermillion', 'mismatch has vermillion color');

check(ui.DSA_STATE_DEFINITIONS['final-answer'].shapeCue === 'star-badge', 'final-answer has star-badge cue');
check(ui.DSA_STATE_DEFINITIONS['final-answer'].colorName === 'gold', 'final-answer has gold color');

// Test states from dispatch: default, active, completed, error, queued, locked
const dispatchStates = ['default', 'active', 'completed', 'error', 'queued', 'locked'];
for (const s of dispatchStates) {
  const resolved = ui.resolveDSACellState(s);
  check(resolved !== undefined, `resolveDSACellState must safely return a definition for "${s}"`);
  if (s === 'active') {
    check(resolved.state === 'active', 'active resolves to active');
    check(resolved.shapeCue === 'thick-outline', 'active has thick outline');
  } else {
    // Non-canonical states safely fall back to 'to-compute'
    check(resolved.state === 'to-compute', `Unknown state "${s}" falls back to "to-compute"`);
    check(resolved.shapeCue === 'dashed-outline', `Unknown state "${s}" has dashed outline cue`);
  }
}

// Geometry calculations: zero or negative bounds return null
check(ui.getDSACellGeometry('base-case', 0, 0) === null, '0x0 cell returns null');
check(ui.getDSACellGeometry('base-case', -10, 50) === null, 'Negative width returns null');
check(ui.getDSACellGeometry('base-case', 50, -10) === null, 'Negative height returns null');
check(ui.getDSACellGeometry('base-case', 0, 50) === null, 'Zero width returns null');
check(ui.getDSACellGeometry('base-case', 50, 0) === null, 'Zero height returns null');

// Triangle coordinates assertion
const triGeom = ui.getDSACellGeometry('base-case', 60, 40);
check(triGeom !== null, 'base-case geometry exists');
check(triGeom.shapeCue === 'triangle', 'base-case shape cue is triangle');
check(Array.isArray(triGeom.trianglePoints) && triGeom.trianglePoints.length === 3, 'triangle points has 3 vertices');
check(triGeom.trianglePoints[0][0] === 0 && triGeom.trianglePoints[0][1] === 0, 'Vertex 0 at [0, 0]');
// size = min(10, min(60, 40) * 0.35) = min(10, 14) = 10
check(triGeom.trianglePoints[1][0] === 10 && triGeom.trianglePoints[1][1] === 0, 'Vertex 1 at [10, 0]');
check(triGeom.trianglePoints[2][0] === 0 && triGeom.trianglePoints[2][1] === 10, 'Vertex 2 at [0, 10]');

// Small cell triangle scaling
const smallTri = ui.getDSACellGeometry('base-case', 20, 20);
// size = min(10, 20 * 0.35) = min(10, 7) = 7
check(smallTri.trianglePoints[1][0] === 7, 'Small cell triangle points scale correctly to 7');

// Hatch angle assertion
const hatchGeom = ui.getDSACellGeometry('mismatch', 50, 50);
check(hatchGeom !== null, 'mismatch geometry exists');
check(hatchGeom.shapeCue === 'hatch', 'mismatch shape cue is hatch');
check(hatchGeom.hatchAngle === 45, 'mismatch hatch angle is exactly 45 degrees');

// Star badge position assertion
const starGeom = ui.getDSACellGeometry('final-answer', 80, 50);
check(starGeom !== null, 'final-answer geometry exists');
check(starGeom.shapeCue === 'star-badge', 'final-answer shape cue is star-badge');
// size = min(12, min(80, 50) * 0.3) = min(12, 15) = 12
check(starGeom.starBadgePosition.size === 12, 'Star badge size is 12');
check(starGeom.starBadgePosition.x === 80 - 12 - 2, 'Star badge x = cellWidth - size - 2');
check(starGeom.starBadgePosition.y === 2, 'Star badge y = 2');

// High-contrast theme stroke scaling
const normalOutline = ui.getDSACellGeometry('active', 50, 50, 'midnight');
const hcOutline = ui.getDSACellGeometry('active', 50, 50, 'high-contrast');
check(hcOutline.strokeWidth === 4, 'High-contrast active stroke width is 4');
check(normalOutline.strokeWidth === 3, 'Standard active stroke width is 3');

const normalDashed = ui.getDSACellGeometry('to-compute', 50, 50, 'midnight');
const hcDashed = ui.getDSACellGeometry('to-compute', 50, 50, 'high-contrast');
check(JSON.stringify(normalDashed.strokeDashArray) === JSON.stringify([4, 4]), 'Normal dash array [4, 4]');
check(JSON.stringify(hcDashed.strokeDashArray) === JSON.stringify([6, 4]), 'High-contrast dash array [6, 4]');

console.log('  ✔ Passed all DSA dual-channel visual coding & geometry generator assertions');

// ----------------------------------------------------------------------------
// Summary
// ----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`  ALL CHALLENGER ASSERTIONS PASSED! Total assertions checked: ${totalAssertions}`);
console.log('  Fast-check property runs: 4,000 executions without failure');
console.log('================================================================\n');
