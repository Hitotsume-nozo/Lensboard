import { describe, it, expect } from 'vitest';
import {
  CONTEXT_BAR_HEIGHT,
  CONTEXT_BAR_OFFSET,
  computeContextBarPosition,
  computeBarX,
  clampToScreen,
  computeContextBarPositionWithClamp,
  computeFullContextBarPlacement,
  computeUnionBounds,
  getPropertiesForType,
} from './index.js';

describe('Feature 26: Contextual Properties Bar Unit Tests', () => {
  describe('Dimensions & Positioning Kinematics', () => {
    it('contextual bar has 40px height and 8px default offset', () => {
      expect(CONTEXT_BAR_HEIGHT).toBe(40);
      expect(CONTEXT_BAR_OFFSET).toBe(8);
    });

    it('dynamically positions 8px above selection bounding box', () => {
      const bounds = { x: 200, y: 300, w: 100, h: 50 };
      const pos = computeContextBarPosition(bounds);
      expect(pos.x).toBe(250);
      expect(pos.y).toBe(300 - 40 - 8); // 252
    });

    it('centers contextual bar horizontally and clamps to viewport bounds (f26-b1)', () => {
      // Full screen width selection
      const fullWidthX = computeBarX(0, 1920, 1920);
      expect(fullWidthX).toBe(960);

      // Selection near left screen margin
      const leftMarginX = computeBarX(10, 50, 1920);
      expect(leftMarginX).toBe(100); // clamped to min 100

      // Selection near right screen margin
      const rightMarginX = computeBarX(1890, 50, 1920);
      expect(rightMarginX).toBe(1820); // clamped to 1920 - 100
    });

    it('clamps contextual bar for offscreen selections to screen edge (f26-b2)', () => {
      expect(clampToScreen(-500, 1080)).toBe(60);
      expect(clampToScreen(2000, 1080)).toBe(1020); // 1080 - 60
      expect(clampToScreen(400, 1080)).toBe(400);
    });

    it('flips below selection if selection is near top screen edge (f26-3)', () => {
      const flipped = computeContextBarPositionWithClamp(20, 40, 8, 10);
      expect(flipped).toBe(80); // 20 + 60
      expect(flipped).toBeGreaterThan(20);

      const nonFlipped = computeContextBarPositionWithClamp(200, 40, 8, 10);
      expect(nonFlipped).toBe(200 - 40 - 8); // 152
    });

    it('computes full placement integrating horizontal clamping and vertical flipping', () => {
      const boundsAtTop = { x: 500, y: 30, w: 120, h: 60 };
      const placement = computeFullContextBarPlacement(boundsAtTop, 1920, 1080);
      expect(placement.x).toBe(560);
      expect(placement.y).toBe(30 + 60 + 8); // flipped below
    });
  });

  describe('Multi-Selection Union Bounds', () => {
    it('computes union bounding box enclosing all selected objects', () => {
      const b1 = { x: 100, y: 100, w: 50, h: 50 };
      const b2 = { x: 300, y: 200, w: 100, h: 80 };
      const union = computeUnionBounds([b1, b2]);

      expect(union.x).toBe(100);
      expect(union.y).toBe(100);
      expect(union.w).toBe(300); // from x=100 to x=400
      expect(union.h).toBe(180); // from y=100 to y=280
    });

    it('returns zero bounds for empty list', () => {
      expect(computeUnionBounds([])).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    });
  });

  describe('Entity-Type Property Adaptation', () => {
    it('adapts properties for ink strokes', () => {
      const props = getPropertiesForType('ink');
      expect(props).toContain('color');
      expect(props).toContain('strokeWidth');
      expect(props).toContain('renderMode');
      expect(props).toContain('convert');
    });

    it('adapts properties for geometric shapes', () => {
      const props = getPropertiesForType('shape');
      expect(props).toContain('color');
      expect(props).toContain('strokeWidth');
      expect(props).toContain('fill');
      expect(props).toContain('renderMode');
      expect(props).toContain('align');
    });

    it('adapts properties for code blocks', () => {
      const props = getPropertiesForType('code');
      expect(props).toContain('language');
      expect(props).toContain('run');
      expect(props).toContain('testTable');
    });

    it('adapts properties for text blocks', () => {
      const props = getPropertiesForType('text');
      expect(props).toContain('color');
      expect(props).toContain('font');
      expect(props).toContain('align');
      expect(props).toContain('delete');
    });

    it('heterogeneous multi-selection displays common properties and excludes fill (f26-b3)', () => {
      const common = getPropertiesForType(['shape', 'text']);
      expect(common).toContain('color');
      expect(common).toContain('align');
      expect(common).toContain('delete');
      expect(common).not.toContain('fill');
    });
  });
});
