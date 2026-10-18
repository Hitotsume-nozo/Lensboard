/**
 * @lensboard/ui - Typography System
 * Authoritative Source: SPEC.md §4, §13
 * Type scale: 12, 13, 14, 16, 20, 28 px
 * Line height: 1.4
 * Fonts: Inter (default UI/sans), Source Serif 4 (book/serif), Caveat (sketch), JetBrains Mono (code)
 */

export const TYPOGRAPHY = Object.freeze({
  fontFamilies: Object.freeze({
    sans: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    serif: '"Source Serif 4", Georgia, Cambria, "Times New Roman", serif',
    sketch: 'Caveat, "Comic Sans MS", cursive',
    mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  }),
  fontSizes: Object.freeze({
    xs: 12,
    sm: 13,
    base: 14,
    md: 16,
    lg: 20,
    xl: 28,
  }),
  lineHeight: 1.4,
});

export type FontFamilyKey = keyof typeof TYPOGRAPHY.fontFamilies;
export type FontSizeKey = keyof typeof TYPOGRAPHY.fontSizes;
