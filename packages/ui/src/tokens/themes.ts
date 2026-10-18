/**
 * @lensboard/ui - Theme Token Matrix
 * Authoritative Source: SPEC.md §13, PROJECT.md Feature 4
 * Canonical 5 themes: Midnight (default), Paper, Blueprint, Blackboard, High-Contrast
 */

export type ThemeName =
  | 'midnight'
  | 'paper'
  | 'blueprint'
  | 'blackboard'
  | 'high-contrast';

export interface ThemeTokens {
  name: ThemeName;
  canvas: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accent2: string;
  warning: string;
  danger: string;
}

export const THEMES: Record<ThemeName, ThemeTokens> = Object.freeze({
  midnight: Object.freeze({
    name: 'midnight',
    canvas: '#12141C',
    surface: '#1A1D28',
    surfaceRaised: '#232736',
    border: '#2E3347',
    text: '#E8EAF2',
    textMuted: '#A3A9BD',
    accent: '#7C8CFF',
    accent2: '#3DD6C6',
    warning: '#FFC857',
    danger: '#FF6B7A',
  }),
  paper: Object.freeze({
    name: 'paper',
    canvas: '#FBFAF7',
    surface: '#FFFFFF',
    surfaceRaised: '#F3F1EA',
    border: '#E4E1D8',
    text: '#1C1E26',
    textMuted: '#5B6070',
    accent: '#4F5BD5',
    accent2: '#0E9F92',
    warning: '#9A6700',
    danger: '#D6455A',
  }),
  blueprint: Object.freeze({
    name: 'blueprint',
    canvas: '#0B2A4A',
    surface: '#0F3760',
    surfaceRaised: '#14467A',
    border: '#2462A0',
    text: '#E6F0FF',
    textMuted: '#9BBCE0',
    accent: '#5CC8FF',
    accent2: '#40E0D0',
    warning: '#FFD700',
    danger: '#FF6E7F',
  }),
  blackboard: Object.freeze({
    name: 'blackboard',
    canvas: '#1E2A25',
    surface: '#273832',
    surfaceRaised: '#31473F',
    border: '#3F5950',
    text: '#F2F0E6',
    textMuted: '#9FAFA6',
    accent: '#F5D76E',
    accent2: '#7CD1B8',
    warning: '#F5A623',
    danger: '#E06D53',
  }),
  'high-contrast': Object.freeze({
    name: 'high-contrast',
    canvas: '#000000',
    surface: '#111111',
    surfaceRaised: '#222222',
    border: '#FFFFFF',
    text: '#FFFFFF',
    textMuted: '#CCCCCC',
    accent: '#FFFF00',
    accent2: '#00FFFF',
    warning: '#FFA500',
    danger: '#FF0000',
  }),
});

/**
 * Retrieves theme tokens for a given theme name, falling back to midnight.
 */
export function getThemeTokens(name: ThemeName | string): ThemeTokens {
  return (THEMES as Record<string, ThemeTokens>)[name] ?? THEMES.midnight;
}

/**
 * Checks whether a theme is dark-based.
 */
export function isDarkTheme(name: ThemeName | string): boolean {
  return name !== 'paper';
}

/**
 * Generates CSS custom properties dictionary from ThemeTokens.
 */
export function generateThemeCssVariables(tokens: ThemeTokens): Record<string, string> {
  return {
    '--lb-canvas': tokens.canvas,
    '--lb-surface': tokens.surface,
    '--lb-surface-raised': tokens.surfaceRaised,
    '--lb-border': tokens.border,
    '--lb-text': tokens.text,
    '--lb-text-muted': tokens.textMuted,
    '--lb-accent': tokens.accent,
    '--lb-accent-2': tokens.accent2,
    '--lb-warning': tokens.warning,
    '--lb-danger': tokens.danger,
  };
}

/**
 * Serializes ThemeTokens into a CSS string suitable for inline style or style sheets.
 */
export function themeToCssString(tokens: ThemeTokens): string {
  const vars = generateThemeCssVariables(tokens);
  return Object.entries(vars)
    .map(([key, value]) => `${key}: ${value};`)
    .join(' ');
}
