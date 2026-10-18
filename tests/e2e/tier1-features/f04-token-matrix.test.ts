/**
 * Feature 4: Token Matrix & 5 Themes (M2)
 * Authoritative Source: SPEC.md §13, PROJECT.md Feature 4
 */

import { describe, it, expect } from '../harness.ts';
import { THEME_SPEC_TOKENS } from '../helpers/oracle.ts';
import type { ThemeName } from '../helpers/contracts.ts';

describe('Feature 4: Token Matrix & 5 Themes', () => {
  const themes: ThemeName[] = ['midnight', 'paper', 'blueprint', 'blackboard', 'high-contrast'];
  const requiredTokens = [
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

  it('f04-1: supports all 5 required theme names in spec', () => {
    expect(Object.keys(THEME_SPEC_TOKENS)).toHaveLength(5);
    for (const theme of themes) {
      expect(THEME_SPEC_TOKENS[theme]).toBeDefined();
    }
  });

  it('f04-2: midnight theme defines exact specification color tokens', () => {
    const midnight = THEME_SPEC_TOKENS.midnight;
    expect(midnight.canvas.toLowerCase()).toBe('#12141c');
    expect(midnight.surface.toLowerCase()).toBe('#1a1d28');
    expect(midnight.surfaceRaised.toLowerCase()).toBe('#232736');
    expect(midnight.border.toLowerCase()).toBe('#2e3347');
    expect(midnight.text.toLowerCase()).toBe('#e8eaf2');
    expect(midnight.accent.toLowerCase()).toBe('#7c8cff');
  });

  it('f04-3: paper theme defines exact specification color tokens', () => {
    const paper = THEME_SPEC_TOKENS.paper;
    expect(paper.canvas.toLowerCase()).toBe('#fbfaf7');
    expect(paper.surface.toLowerCase()).toBe('#ffffff');
    expect(paper.text.toLowerCase()).toBe('#1c1e26');
    expect(paper.accent.toLowerCase()).toBe('#4f5bd5');
  });

  it('f04-4: blueprint and blackboard themes override all required semantic tokens', () => {
    const bp = THEME_SPEC_TOKENS.blueprint;
    const bb = THEME_SPEC_TOKENS.blackboard;
    expect(bp.canvas.toLowerCase()).toBe('#0b2a4a');
    expect(bb.canvas.toLowerCase()).toBe('#1e2a25');
    for (const key of requiredTokens) {
      expect((bp as Record<string, string>)[key]).toBeDefined();
      expect((bb as Record<string, string>)[key]).toBeDefined();
    }
  });

  it('f04-5: high-contrast theme maintains maximum pure black canvas and pure white text', () => {
    const hc = THEME_SPEC_TOKENS['high-contrast'];
    expect(hc.canvas.toLowerCase()).toBe('#000000');
    expect(hc.text.toLowerCase()).toBe('#ffffff');
    expect(hc.border.toLowerCase()).toBe('#ffffff');
  });
});
