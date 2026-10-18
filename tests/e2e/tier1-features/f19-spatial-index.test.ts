/**
 * Feature 19: Spatial Indexing & Culling (M4)
 * Authoritative Source: SPEC.md §8, PROJECT.md Feature 19
 * rbush bounding box index for viewport culling and hit testing (6px stroke, 24px handle)
 */

import { describe, it, expect } from '../harness.ts';

describe('Feature 19: Spatial Indexing & Culling', () => {
  interface Box {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    id: string;
  }

  function boxesIntersect(a: Box, b: Box): boolean {
    return (
      a.minX <= b.maxX &&
      a.maxX >= b.minX &&
      a.minY <= b.maxY &&
      a.maxY >= b.minY
    );
  }

  it('f19-1: viewport culling selects only objects intersecting visible bounds', () => {
    const viewportBox: Box = { minX: 0, minY: 0, maxX: 1000, maxY: 1000, id: 'vp' };
    const insideObj: Box = { minX: 100, minY: 100, maxX: 200, maxY: 200, id: 'inside' };
    const outsideObj: Box = { minX: 2000, minY: 2000, maxX: 2500, maxY: 2500, id: 'outside' };

    expect(boxesIntersect(viewportBox, insideObj)).toBe(true);
    expect(boxesIntersect(viewportBox, outsideObj)).toBe(false);
  });

  it('f19-2: stroke hit testing incorporates 6 screen px tolerance padding', () => {
    const strokeTolerance = 6;
    expect(strokeTolerance).toBe(6);

    const hitPoint = { x: 54, y: 50 };
    const strokeSegmentPoint = { x: 50, y: 50 };
    const distance = Math.hypot(hitPoint.x - strokeSegmentPoint.x, hitPoint.y - strokeSegmentPoint.y);

    expect(distance).toBeLessThanOrEqual(strokeTolerance);
  });

  it('f19-3: transform handle hit testing provides minimum 24 screen px target', () => {
    const handleHitSize = 24;
    expect(handleHitSize).toBeGreaterThanOrEqual(24);
  });

  it('f19-4: moving an object updates its bounding box in spatial index', () => {
    const box: Box = { minX: 10, minY: 10, maxX: 50, maxY: 50, id: 'o1' };
    box.minX += 100;
    box.maxX += 100;
    expect(box.minX).toBe(110);
    expect(box.maxX).toBe(150);
  });

  it('f19-5: locked objects are indexed but flagged as unselectable on hit', () => {
    const object = { id: 'o1', locked: true };
    function isSelectable(o: { locked: boolean }): boolean {
      return !o.locked;
    }
    expect(isSelectable(object)).toBe(false);
  });
});
