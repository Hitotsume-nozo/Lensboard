import { describe, it, expect } from 'vitest';
import { createDocument } from '@lensboard/core';
import type { CanvasObject } from '@lensboard/core';
import { computeBoundingBox, boxesIntersect } from './bounds.js';
import { SpatialIndex } from './index.js';
import {
  hitTestDocument,
  hitTestShape,
  hitTestObjectHandles,
  pointToSegmentDistance,
  STROKE_HIT_TOLERANCE_SCREEN_PX,
  HANDLE_HIT_SIZE_SCREEN_PX,
} from './hit-test.js';

describe('Spatial Indexing and Hit Testing', () => {
  it('computes valid bounding box for 0x0 single-point entities (f19-b1)', () => {
    const ptObj: CanvasObject = {
      id: 'pt1',
      type: 'shape',
      parentId: null,
      x: 150,
      y: 250,
      w: 0,
      h: 0,
      rotation: 0,
      z: 'a0',
      style: { colorId: 'ink', strokeWidth: 1, renderMode: 'crisp' },
      tags: [],
      locked: false,
      hidden: false,
      createdAt: 0,
      updatedAt: 0,
    };

    const bbox = computeBoundingBox(ptObj);
    expect(bbox.minX).toBe(150);
    expect(bbox.maxX).toBe(150);
    expect(bbox.minY).toBe(250);
    expect(bbox.maxY).toBe(250);
  });

  it('accurately indexes objects spanning across negative world quadrants (f19-b2)', () => {
    const negObj: CanvasObject = {
      id: 'neg1',
      type: 'rect' as any,
      parentId: null,
      x: -200,
      y: -150,
      w: 300,
      h: 250,
      rotation: 0,
      z: 'a0',
      style: { colorId: 'ink', strokeWidth: 1, renderMode: 'crisp' },
      tags: [],
      locked: false,
      hidden: false,
      createdAt: 0,
      updatedAt: 0,
    };

    const bbox = computeBoundingBox(negObj);
    expect(bbox.minX).toBe(-200);
    expect(bbox.maxX).toBe(100);
    expect(bbox.minY).toBe(-150);
    expect(bbox.maxY).toBe(100);
    expect(bbox.maxX - bbox.minX).toBe(300);
    expect(bbox.maxY - bbox.minY).toBe(250);
  });

  it('correctly calculates bounding box for multi-point stroke including strokeWidth padding', () => {
    const strokeObj: any = {
      id: 's1',
      type: 'ink',
      x: 0,
      y: 0,
      z: 'a0',
      style: { strokeWidth: 4 },
      points: [
        { x: 10, y: 20 },
        { x: 50, y: 80 },
      ],
    };

    const bbox = computeBoundingBox(strokeObj);
    expect(bbox.minX).toBe(8); // 10 - 2
    expect(bbox.maxX).toBe(52); // 50 + 2
    expect(bbox.minY).toBe(18); // 20 - 2
    expect(bbox.maxY).toBe(82); // 80 + 2
  });

  it('calculates bounding box for rotated rectangles', () => {
    const rotObj: CanvasObject = {
      id: 'rot1',
      type: 'rect' as any,
      parentId: null,
      x: 100,
      y: 100,
      w: 100,
      h: 50,
      rotation: Math.PI / 2, // 90 degrees
      z: 'a0',
      style: { colorId: 'ink', strokeWidth: 1, renderMode: 'crisp' },
      tags: [],
      locked: false,
      hidden: false,
      createdAt: 0,
      updatedAt: 0,
    };

    const bbox = computeBoundingBox(rotObj);
    expect(bbox.minX).toBeCloseTo(125, 1);
    expect(bbox.maxX).toBeCloseTo(175, 1);
  });

  it('boxesIntersect performs accurate AABB intersection', () => {
    const a = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    const b = { minX: 50, minY: 50, maxX: 150, maxY: 150 };
    const c = { minX: 200, minY: 200, maxX: 300, maxY: 300 };

    expect(boxesIntersect(a, b)).toBe(true);
    expect(boxesIntersect(a, c)).toBe(false);
  });

  it('SpatialIndex supports insert, load, update, search, remove, count', () => {
    const index = new SpatialIndex();
    expect(index.count()).toBe(0);

    // Empty search returns [] without throwing
    expect(index.search({ minX: 0, minY: 0, maxX: 10, maxY: 10 })).toEqual([]);

    index.insert({ minX: 10, minY: 10, maxX: 50, maxY: 50, id: 'box1' });
    index.insert({ minX: 100, minY: 100, maxX: 150, maxY: 150, id: 'box2' });
    expect(index.count()).toBe(2);

    // Search query
    const results = index.search({ minX: 0, minY: 0, maxX: 60, maxY: 60 });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('box1');

    // Update
    index.update({ minX: 20, minY: 20, maxX: 60, maxY: 60, id: 'box1' });
    expect(index.count()).toBe(2);

    // Remove
    index.remove('box1');
    expect(index.count()).toBe(1);
    expect(index.search({ minX: 0, minY: 0, maxX: 60, maxY: 60 })).toHaveLength(0);

    // Clear
    index.clear();
    expect(index.count()).toBe(0);
  });

  it('calculates pointToSegmentDistance correctly', () => {
    const dist = pointToSegmentDistance({ x: 5, y: 10 }, { x: 0, y: 0 }, { x: 10, y: 0 });
    expect(dist).toBe(10);
  });

  it('stroke hit testing strictly enforces 6.000px screen tolerance (f19-b3, f19-b4)', () => {
    expect(STROKE_HIT_TOLERANCE_SCREEN_PX).toBe(6.0);

    const doc = createDocument('Hit Test');
    doc.objects['stroke1'] = {
      id: 'stroke1',
      type: 'ink',
      parentId: null,
      x: 0,
      y: 0,
      w: 100,
      h: 0,
      rotation: 0,
      z: 'a0',
      style: { colorId: 'ink', strokeWidth: 2, renderMode: 'crisp' },
      tags: [],
      locked: false,
      hidden: false,
      createdAt: 0,
      updatedAt: 0,
      points: [
        { x: 0, y: 50, t: 0 },
        { x: 100, y: 50, t: 10 },
      ],
    } as any;
    doc.rootIds = ['stroke1'];

    const index = new SpatialIndex();
    index.insert({ minX: 0, minY: 48, maxX: 100, maxY: 52, id: 'stroke1' });

    const vp = { x: 0, y: 0, zoom: 1.0 };

    // Point exactly at 6.000px distance -> HITS
    const hitAt6 = hitTestDocument({ x: 50, y: 56.0 }, doc, index, vp);
    expect(hitAt6).not.toBeNull();
    expect(hitAt6?.id).toBe('stroke1');

    // Point at 6.001px distance -> MISSES
    const missAt6001 = hitTestDocument({ x: 50, y: 56.001 }, doc, index, vp);
    expect(missAt6001).toBeNull();
  });

  it('locked objects are indexed but unselectable (f19-5, f23-b4)', () => {
    const doc = createDocument('Locked');
    doc.objects['lockedBox'] = {
      id: 'lockedBox',
      type: 'rect' as any,
      parentId: null,
      x: 10,
      y: 10,
      w: 100,
      h: 100,
      rotation: 0,
      z: 'a0',
      style: { colorId: 'ink', strokeWidth: 1, renderMode: 'crisp' },
      tags: [],
      locked: true, // LOCKED
      hidden: false,
      createdAt: 0,
      updatedAt: 0,
    };
    doc.rootIds = ['lockedBox'];

    const index = new SpatialIndex();
    index.insert({ minX: 10, minY: 10, maxX: 110, maxY: 110, id: 'lockedBox' });

    const vp = { x: 0, y: 0, zoom: 1.0 };
    const hit = hitTestDocument({ x: 50, y: 50 }, doc, index, vp);
    expect(hit).toBeNull(); // Unselectable!
  });

  it('transform handle hit testing provides >= 24 screen px hit target (f19-3)', () => {
    expect(HANDLE_HIT_SIZE_SCREEN_PX).toBeGreaterThanOrEqual(24);

    const box: CanvasObject = {
      id: 'b1',
      type: 'rect' as any,
      parentId: null,
      x: 100,
      y: 100,
      w: 200,
      h: 150,
      rotation: 0,
      z: 'a0',
      style: { colorId: 'ink', strokeWidth: 1, renderMode: 'crisp' },
      tags: [],
      locked: false,
      hidden: false,
      createdAt: 0,
      updatedAt: 0,
    };

    const vp = { x: 0, y: 0, zoom: 1.0 };

    // Click at top-left handle (100, 100) within 10px screen distance (< 12px half-extent)
    const handleHit = hitTestObjectHandles({ x: 105, y: 95 }, box, vp);
    expect(handleHit).not.toBeNull();
    expect(handleHit?.type).toBe('handle');
    expect(handleHit?.position).toBe('tl');

    // Click far outside handles
    const miss = hitTestObjectHandles({ x: 150, y: 150 }, box, vp);
    expect(miss).toBeNull();
  });

  it('calculates point to segment distance accurately', () => {
    const d = pointToSegmentDistance({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 10, y: 0 });
    expect(d).toBeCloseTo(5);
  });

  it('accurately hit-tests diamond rhombus geometry vs bounding box corners', () => {
    const diamond: CanvasObject = {
      id: 'd1',
      type: 'shape',
      shapeType: 'diamond',
      parentId: null,
      x: 100,
      y: 100,
      w: 100,
      h: 100,
      rotation: 0,
      z: 'a0',
      label: 'Decision',
      tags: [],
      locked: false,
      hidden: false,
      createdAt: 0,
      updatedAt: 0,
    };

    // Center is inside rhombus
    expect(hitTestShape({ x: 150, y: 150 }, diamond)).toBe(true);
    // Near vertex (150, 105) is inside rhombus
    expect(hitTestShape({ x: 150, y: 105 }, diamond)).toBe(true);
    // Bounding box corner (105, 105) is OUTSIDE the diamond rhombus
    expect(hitTestShape({ x: 105, y: 105 }, diamond)).toBe(false);
    expect(hitTestShape({ x: 195, y: 105 }, diamond)).toBe(false);
  });
});
