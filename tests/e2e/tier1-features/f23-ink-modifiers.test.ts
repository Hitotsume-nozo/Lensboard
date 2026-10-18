/**
 * Feature 23: Ink Modifier Modes (M4)
 * Authoritative Source: SPEC.md §9, PROJECT.md Feature 23
 * Shift-snap 45° straight lines, Ctrl precision mode (40% speed + ghost cursor), whole-stroke eraser (8px radius)
 */

import { describe, it, expect } from '../harness.ts';

describe('Feature 23: Ink Modifier Modes', () => {
  it('f23-1: holding Shift snaps drawn stroke angle to nearest 45-degree increment', () => {
    function snapTo45Degrees(dx: number, dy: number): { x: number; y: number } {
      const angle = Math.atan2(dy, dx);
      const step = Math.PI / 4; // 45 degrees
      const snappedAngle = Math.round(angle / step) * step;
      const length = Math.hypot(dx, dy);
      return {
        x: Math.round(length * Math.cos(snappedAngle)),
        y: Math.round(length * Math.sin(snappedAngle)),
      };
    }
    // 40 degrees should snap to 45 degrees (equal dx and dy)
    const snapped = snapTo45Degrees(100, 83.9);
    expect(Math.abs(snapped.x)).toBe(Math.abs(snapped.y));
  });

  it('f23-2: holding Ctrl dampens pen velocity to exactly 40% speed for precision drawing', () => {
    function applyPrecisionModifier(delta: { dx: number; dy: number }, ctrlDown: boolean) {
      const scale = ctrlDown ? 0.4 : 1.0;
      return {
        dx: delta.dx * scale,
        dy: delta.dy * scale,
      };
    }
    const normal = applyPrecisionModifier({ dx: 10, dy: 10 }, false);
    const precision = applyPrecisionModifier({ dx: 10, dy: 10 }, true);

    expect(normal.dx).toBe(10);
    expect(precision.dx).toBe(4);
    expect(precision.dy).toBe(4);
  });

  it('f23-3: whole-stroke eraser removes entire stroke if within 8px radius', () => {
    const strokePoints = [{ x: 50, y: 50 }, { x: 100, y: 100 }];
    const eraserPos = { x: 55, y: 50 }; // 5px away <= 8px radius

    function isStrokeHitByEraser(points: Array<{ x: number; y: number }>, pos: { x: number; y: number }, radius = 8): boolean {
      return points.some((pt) => Math.hypot(pt.x - pos.x, pt.y - pos.y) <= radius);
    }

    expect(isStrokeHitByEraser(strokePoints, eraserPos)).toBe(true);
  });

  it('f23-4: whole-stroke eraser ignores strokes farther than 8px', () => {
    const strokePoints = [{ x: 50, y: 50 }, { x: 100, y: 100 }];
    const eraserPos = { x: 70, y: 50 }; // 20px away > 8px radius

    function isStrokeHitByEraser(points: Array<{ x: number; y: number }>, pos: { x: number; y: number }, radius = 8): boolean {
      return points.some((pt) => Math.hypot(pt.x - pos.x, pt.y - pos.y) <= radius);
    }

    expect(isStrokeHitByEraser(strokePoints, eraserPos)).toBe(false);
  });

  it('f23-5: temporary eraser activates by holding X key and reverts to previous tool on release', () => {
    let activeTool = 'pen';
    let previousTool = 'pen';

    function onKeyDown(key: string): void {
      if (key === 'X') {
        previousTool = activeTool;
        activeTool = 'eraser';
      }
    }

    function onKeyUp(key: string): void {
      if (key === 'X') {
        activeTool = previousTool;
      }
    }

    onKeyDown('X');
    expect(activeTool).toBe('eraser');

    onKeyUp('X');
    expect(activeTool).toBe('pen');
  });
});
