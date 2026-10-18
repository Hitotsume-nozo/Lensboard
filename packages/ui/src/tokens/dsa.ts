/**
 * @lensboard/ui - Dual-Channel DSA Visual Coding
 * Authoritative Source: SPEC.md §13, PROJECT.md Feature 8
 * 6 Canonical States: Base case, Computed, Active, To compute, Mismatch (Verify), Final answer
 * Dual-channel visual cues: Color fill + Geometric shape indicators (never color alone)
 */

import { type ThemeName } from './themes.js';

export type DSACellState =
  | 'base-case'
  | 'computed'
  | 'active'
  | 'to-compute'
  | 'mismatch'
  | 'final-answer';

export type DSAShapeCue =
  | 'triangle'
  | 'none'
  | 'thick-outline'
  | 'dashed-outline'
  | 'hatch'
  | 'star-badge';

export interface DSACodingDefinition {
  state: DSACellState;
  colorName: string;
  shapeCue: DSAShapeCue;
  description: string;
}

export const DSA_STATE_DEFINITIONS: Record<DSACellState, DSACodingDefinition> = Object.freeze({
  'base-case': Object.freeze({
    state: 'base-case',
    colorName: 'teal',
    shapeCue: 'triangle',
    description: 'Base case cell: teal fill with small top-left corner triangle indicator',
  }),
  computed: Object.freeze({
    state: 'computed',
    colorName: 'indigo',
    shapeCue: 'none',
    description: 'Computed cell: subtle indigo tint with clean border',
  }),
  active: Object.freeze({
    state: 'active',
    colorName: 'amber',
    shapeCue: 'thick-outline',
    description: 'Active computation cell: amber fill with prominent thick outline indicator',
  }),
  'to-compute': Object.freeze({
    state: 'to-compute',
    colorName: 'transparent',
    shapeCue: 'dashed-outline',
    description: 'Pending cell: no fill/transparent with dashed outline indicator',
  }),
  mismatch: Object.freeze({
    state: 'mismatch',
    colorName: 'vermillion',
    shapeCue: 'hatch',
    description: 'Verification mismatch: vermillion color with 45-degree diagonal hatch pattern',
  }),
  'final-answer': Object.freeze({
    state: 'final-answer',
    colorName: 'gold',
    shapeCue: 'star-badge',
    description: 'Final answer cell: gold fill with star badge indicator',
  }),
});

/**
 * Resolves a DSA state string to its canonical definition, safely defaulting to 'to-compute'.
 */
export function resolveDSACellState(state: string): DSACodingDefinition {
  return (
    (DSA_STATE_DEFINITIONS as Record<string, DSACodingDefinition>)[state] ??
    DSA_STATE_DEFINITIONS['to-compute']
  );
}

export interface DSAGeometryCue {
  shapeCue: DSAShapeCue;
  strokeWidth: number;
  strokeDashArray?: number[];
  hatchAngle?: number;
  trianglePoints?: [number, number][];
  starBadgePosition?: { x: number; y: number; size: number };
}

/**
 * Computes geometric cues for rendering a DSA cell in canvas or SVG.
 * Handles zero or negative dimensions safely by returning null.
 */
export function getDSACellGeometry(
  state: DSACellState | string,
  cellWidth: number,
  cellHeight: number,
  theme: ThemeName = 'midnight'
): DSAGeometryCue | null {
  if (cellWidth <= 0 || cellHeight <= 0) {
    return null;
  }

  const def = resolveDSACellState(state);
  const isHighContrast = theme === 'high-contrast';
  const baseOutlineWidth = isHighContrast ? 3 : 1.5;
  const thickOutlineWidth = isHighContrast ? 4 : 3;

  switch (def.shapeCue) {
    case 'triangle': {
      const size = Math.min(10, Math.min(cellWidth, cellHeight) * 0.35);
      return {
        shapeCue: 'triangle',
        strokeWidth: baseOutlineWidth,
        trianglePoints: [
          [0, 0],
          [size, 0],
          [0, size],
        ],
      };
    }

    case 'thick-outline':
      return {
        shapeCue: 'thick-outline',
        strokeWidth: thickOutlineWidth,
      };

    case 'dashed-outline':
      return {
        shapeCue: 'dashed-outline',
        strokeWidth: baseOutlineWidth,
        strokeDashArray: isHighContrast ? [6, 4] : [4, 4],
      };

    case 'hatch':
      return {
        shapeCue: 'hatch',
        strokeWidth: isHighContrast ? 2 : 1,
        hatchAngle: 45,
      };

    case 'star-badge': {
      const size = Math.min(12, Math.min(cellWidth, cellHeight) * 0.3);
      return {
        shapeCue: 'star-badge',
        strokeWidth: baseOutlineWidth,
        starBadgePosition: {
          x: cellWidth - size - 2,
          y: 2,
          size,
        },
      };
    }

    case 'none':
    default:
      return {
        shapeCue: 'none',
        strokeWidth: baseOutlineWidth,
      };
  }
}
