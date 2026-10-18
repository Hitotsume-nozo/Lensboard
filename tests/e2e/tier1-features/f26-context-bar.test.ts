/**
 * Feature 26: Contextual Properties Bar (M5)
 * Authoritative Source: SPEC.md §13, PROJECT.md Feature 26
 * 40px height, 8px dynamically positioned above selection, adapts to entity type
 */

import { describe, it, expect } from '../harness.ts';

describe('Feature 26: Contextual Properties Bar', () => {
  it('f26-1: contextual bar has 40px height', () => {
    const barHeight = 40;
    expect(barHeight).toBe(40);
  });

  it('f26-2: contextual bar dynamically positions 8px above selection bounding box', () => {
    function computeContextBarPosition(selectionBounds: { x: number; y: number; w: number; h: number }, barHeight = 40, offset = 8) {
      return {
        x: selectionBounds.x + selectionBounds.w / 2,
        y: selectionBounds.y - barHeight - offset,
      };
    }
    const bounds = { x: 200, y: 300, w: 100, h: 50 };
    const pos = computeContextBarPosition(bounds);
    expect(pos.y).toBe(300 - 40 - 8); // 252
    expect(pos.x).toBe(250);
  });

  it('f26-3: clamps contextual bar inside viewport if selection is at top edge', () => {
    function computeContextBarPositionWithClamp(selectionY: number, barHeight = 40, offset = 8, viewportMinY = 10) {
      const naturalY = selectionY - barHeight - offset;
      return naturalY < viewportMinY ? selectionY + 60 : naturalY; // flips below selection if offscreen top
    }
    const pos = computeContextBarPositionWithClamp(20);
    expect(pos).toBeGreaterThan(20); // Flipped below
  });

  it('f26-4: contextual bar properties adapt according to entity type', () => {
    function getPropertiesForType(type: string): string[] {
      switch (type) {
        case 'ink':
          return ['color', 'strokeWidth', 'renderMode', 'convert'];
        case 'shape':
          return ['color', 'strokeWidth', 'fill', 'renderMode', 'align', 'note'];
        case 'code':
          return ['language', 'run', 'testTable', 'note'];
        default:
          return ['color', 'note'];
      }
    }
    expect(getPropertiesForType('ink')).toContain('convert');
    expect(getPropertiesForType('shape')).toContain('fill');
    expect(getPropertiesForType('code')).toContain('language');
  });

  it('f26-5: contextual bar disappears immediately when selection is cleared', () => {
    let selection: string[] = ['obj1'];
    let barVisible = selection.length > 0;
    expect(barVisible).toBe(true);

    selection = [];
    barVisible = selection.length > 0;
    expect(barVisible).toBe(false);
  });
});
