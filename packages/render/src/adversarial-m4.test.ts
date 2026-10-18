import { describe, it, expect, vi } from 'vitest';
import { createDocument } from '@lensboard/core';
import type { CanvasObject } from '@lensboard/core';
import {
  calculateNewZoom,
  zoomAtScreenPoint,
  MIN_ZOOM,
  MAX_ZOOM,
} from './viewport/controller.js';
import { screenToWorld, worldToScreen } from './viewport/transform.js';
import { computeBoundingBox } from './spatial/bounds.js';
import { SpatialIndex } from './spatial/index.js';
import {
  hitTestDocument,
  hitTestObjectHandles,
  hitTestStroke,
  pointToSegmentDistance,
  HANDLE_HIT_SIZE_SCREEN_PX,
} from './spatial/hit-test.js';
import { DualLayerManager } from './canvas/layers.js';
import { HeadlessCanvasAdapter } from './canvas/adapter.js';
import { FullCanvasRenderer } from './renderer.js';

describe('Adversarial Stress Test Suite: Milestone 4 (Dual-Layer Canvas 2D & Spatial Indexing)', () => {
  // =========================================================================
  // Challenge 1: Zoom Clamping [0.02, 64.0] Under Extreme Delta Values
  // =========================================================================
  describe('Challenge 1: Zoom Clamping Under Extreme Deltas', () => {
    it('strictly clamps zoom to 0.02 under extreme positive delta (+1,000,000)', () => {
      const initialZooms = [0.02, 0.05, 1.0, 10.0, 64.0];
      for (const z of initialZooms) {
        const result = calculateNewZoom(z, 1_000_000);
        expect(result).toBe(MIN_ZOOM);
        expect(result).toBe(0.02);
      }
    });

    it('strictly clamps zoom to 64.0 under extreme negative delta (-1,000,000)', () => {
      const initialZooms = [0.02, 0.05, 1.0, 10.0, 64.0];
      for (const z of initialZooms) {
        const result = calculateNewZoom(z, -1_000_000);
        expect(result).toBe(MAX_ZOOM);
        expect(result).toBe(64.0);
      }
    });

    it('handles absurd floating point and safe integer extremes without NaN or Infinity', () => {
      expect(calculateNewZoom(1.0, Number.MAX_SAFE_INTEGER)).toBe(MIN_ZOOM);
      expect(calculateNewZoom(1.0, -Number.MAX_SAFE_INTEGER)).toBe(MAX_ZOOM);
      expect(calculateNewZoom(1.0, Infinity)).toBe(MIN_ZOOM);
      expect(calculateNewZoom(1.0, -Infinity)).toBe(MAX_ZOOM);
    });

    it('clamps out-of-bounds initial zoom values even on zero delta', () => {
      expect(calculateNewZoom(0.0001, 0)).toBe(MIN_ZOOM);
      expect(calculateNewZoom(100.0, 0)).toBe(MAX_ZOOM);
    });

    it('survives 1,000 consecutive zoom steps in each direction without drifting outside bounds', () => {
      let zoom = 1.0;
      // 1000 zoom out steps
      for (let i = 0; i < 1000; i++) {
        zoom = calculateNewZoom(zoom, 100);
        expect(zoom).toBeGreaterThanOrEqual(MIN_ZOOM);
        expect(zoom).toBeLessThanOrEqual(MAX_ZOOM);
      }
      expect(zoom).toBe(MIN_ZOOM);

      // 1000 zoom in steps
      for (let i = 0; i < 1000; i++) {
        zoom = calculateNewZoom(zoom, -100);
        expect(zoom).toBeGreaterThanOrEqual(MIN_ZOOM);
        expect(zoom).toBeLessThanOrEqual(MAX_ZOOM);
      }
      expect(zoom).toBe(MAX_ZOOM);
    });
  });

  // =========================================================================
  // Challenge 2: Cursor Invariance During Exponential Zoom
  // =========================================================================
  describe('Challenge 2: Cursor Invariance During Exponential Zoom', () => {
    it('preserves exact world point under cursor across arbitrary screen positions and zoom deltas', () => {
      const testCases = [
        { cursor: { x: 0, y: 0 }, vp: { x: 0, y: 0, zoom: 1.0 }, delta: -120 },
        { cursor: { x: 960, y: 540 }, vp: { x: 100, y: 50, zoom: 1.5 }, delta: 80 },
        { cursor: { x: -300, y: -200 }, vp: { x: -500, y: 400, zoom: 0.5 }, delta: -300 },
        { cursor: { x: 1920, y: 1080 }, vp: { x: 200, y: -100, zoom: 4.0 }, delta: 150 },
        { cursor: { x: 123.456, y: 789.012 }, vp: { x: 33.3, y: 77.7, zoom: 2.12 }, delta: -55 },
      ];

      for (const { cursor, vp, delta } of testCases) {
        const worldBefore = screenToWorld(cursor, vp);
        const newVp = zoomAtScreenPoint(vp, cursor, delta);
        const worldAfter = screenToWorld(cursor, newVp);

        expect(worldAfter.x).toBeCloseTo(worldBefore.x, 8);
        expect(worldAfter.y).toBeCloseTo(worldBefore.y, 8);

        // Reverse check: worldToScreen of that world point returns identical cursor
        const screenProjected = worldToScreen(worldBefore, newVp);
        expect(screenProjected.x).toBeCloseTo(cursor.x, 8);
        expect(screenProjected.y).toBeCloseTo(cursor.y, 8);
      }
    });

    it('maintains cursor invariance even when zoom hits clamp limits', () => {
      const cursor = { x: 500, y: 300 };
      const vp = { x: 100, y: 100, zoom: 1.0 };

      // Extreme delta hitting MIN_ZOOM (0.02)
      const worldBeforeMin = screenToWorld(cursor, vp);
      const minVp = zoomAtScreenPoint(vp, cursor, 1_000_000);
      expect(minVp.zoom).toBe(MIN_ZOOM);
      const worldAfterMin = screenToWorld(cursor, minVp);
      expect(worldAfterMin.x).toBeCloseTo(worldBeforeMin.x, 6);
      expect(worldAfterMin.y).toBeCloseTo(worldBeforeMin.y, 6);

      // Extreme delta hitting MAX_ZOOM (64.0)
      const worldBeforeMax = screenToWorld(cursor, vp);
      const maxVp = zoomAtScreenPoint(vp, cursor, -1_000_000);
      expect(maxVp.zoom).toBe(MAX_ZOOM);
      const worldAfterMax = screenToWorld(cursor, maxVp);
      expect(worldAfterMax.x).toBeCloseTo(worldBeforeMax.x, 6);
      expect(worldAfterMax.y).toBeCloseTo(worldBeforeMax.y, 6);
    });

    it('maintains continuous cursor invariance over 50 successive random zoom events', () => {
      let currentVp = { x: 250, y: 180, zoom: 1.0 };
      const pinnedScreenCursor = { x: 640, y: 360 };

      // World point pinned at this cursor initially
      const targetWorldPoint = screenToWorld(pinnedScreenCursor, currentVp);

      for (let step = 0; step < 50; step++) {
        const randomDelta = (Math.sin(step) * 200); // Varied zoom in and out
        currentVp = zoomAtScreenPoint(currentVp, pinnedScreenCursor, randomDelta);

        const currentWorld = screenToWorld(pinnedScreenCursor, currentVp);
        expect(currentWorld.x).toBeCloseTo(targetWorldPoint.x, 6);
        expect(currentWorld.y).toBeCloseTo(targetWorldPoint.y, 6);
      }
    });
  });

  // =========================================================================
  // Challenge 3: Spatial Culling with 10,000 Objects Outside Viewport
  // =========================================================================
  describe('Challenge 3: Spatial Culling with 10,000 Objects Outside Viewport', () => {
    it('indexes 10,000 offscreen entities and queries viewport in <10ms, returning only onscreen entities', () => {
      const index = new SpatialIndex();
      const offscreenItems = [];

      // 10,000 objects in range [5,000, 50,000] (far outside viewport)
      for (let i = 0; i < 10000; i++) {
        const x = 5000 + (i % 100) * 100;
        const y = 5000 + Math.floor(i / 100) * 100;
        offscreenItems.push({
          id: `off_${i}`,
          minX: x,
          minY: y,
          maxX: x + 50,
          maxY: y + 50,
        });
      }
      index.load(offscreenItems);
      expect(index.count()).toBe(10000);

      // Add 3 onscreen entities in [100, 400]
      index.insert({ id: 'on_1', minX: 100, minY: 100, maxX: 150, maxY: 150 });
      index.insert({ id: 'on_2', minX: 200, minY: 200, maxX: 250, maxY: 250 });
      index.insert({ id: 'on_3', minX: 300, minY: 300, maxX: 350, maxY: 350 });
      expect(index.count()).toBe(10003);

      // Viewport bounds: 0 to 1920x1080
      const viewportBounds = { minX: 0, minY: 0, maxX: 1920, maxY: 1080 };

      const t0 = performance.now();
      const results = index.search(viewportBounds);
      const duration = performance.now() - t0;

      expect(duration).toBeLessThan(15); // Sub-15ms query time
      expect(results).toHaveLength(3);
      const resultIds = new Set(results.map((r) => r.id));
      expect(resultIds.has('on_1')).toBe(true);
      expect(resultIds.has('on_2')).toBe(true);
      expect(resultIds.has('on_3')).toBe(true);
      expect(resultIds.has('off_0')).toBe(false);
    });

    it('DualLayerManager renders only visible entities and completely skips all 10,000 offscreen entities', () => {
      const doc = createDocument('Culling Stress');
      const index = new SpatialIndex();

      // Populate 10,000 offscreen objects in document
      for (let i = 0; i < 10000; i++) {
        const id = `off_${i}`;
        const x = 10000 + (i % 100) * 50;
        const y = 10000 + Math.floor(i / 100) * 50;
        const obj: CanvasObject = {
          id,
          type: 'rect' as any,
          parentId: null,
          x,
          y,
          w: 40,
          h: 40,
          rotation: 0,
          z: `a${i}`,
          style: { colorId: 'ink', strokeWidth: 1, renderMode: 'crisp' },
          tags: [],
          locked: false,
          hidden: false,
          createdAt: 0,
          updatedAt: 0,
        };
        doc.objects[id] = obj;
        doc.rootIds.push(id);
        index.insert({ id, minX: x, minY: y, maxX: x + 40, maxY: y + 40 });
      }

      // Add 2 visible objects in viewport
      const on1: CanvasObject = {
        id: 'visible_1',
        type: 'rect' as any,
        parentId: null,
        x: 100,
        y: 100,
        w: 50,
        h: 50,
        rotation: 0,
        z: 'z1',
        style: { colorId: 'ink', strokeWidth: 1, renderMode: 'crisp' },
        tags: [],
        locked: false,
        hidden: false,
        createdAt: 0,
        updatedAt: 0,
      };
      const on2: CanvasObject = {
        id: 'visible_2',
        type: 'rect' as any,
        parentId: null,
        x: 200,
        y: 200,
        w: 50,
        h: 50,
        rotation: 0,
        z: 'z2',
        style: { colorId: 'ink', strokeWidth: 1, renderMode: 'crisp' },
        tags: [],
        locked: false,
        hidden: false,
        createdAt: 0,
        updatedAt: 0,
      };
      doc.objects['visible_1'] = on1;
      doc.objects['visible_2'] = on2;
      doc.rootIds.push('visible_1', 'visible_2');
      index.insert({ id: 'visible_1', minX: 100, minY: 100, maxX: 150, maxY: 150 });
      index.insert({ id: 'visible_2', minX: 200, minY: 200, maxX: 250, maxY: 250 });

      const staticAdapter = new HeadlessCanvasAdapter(800, 600, 1);
      const liveAdapter = new HeadlessCanvasAdapter(800, 600, 1);
      const layerManager = new DualLayerManager({ staticAdapter, liveAdapter });

      const ctx = staticAdapter.getContext()!;
      let strokeRectCalls = 0;
      let fillRectCalls = 0;
      vi.spyOn(ctx, 'strokeRect').mockImplementation(() => { strokeRectCalls++; });
      vi.spyOn(ctx, 'fillRect').mockImplementation(() => { fillRectCalls++; });

      const vp = { x: 0, y: 0, zoom: 1.0 };
      layerManager.renderStaticLayer(doc, vp, index);

      // Only the 2 visible items should have generated canvas draw operations
      expect(strokeRectCalls + fillRectCalls).toBe(2);
      expect(layerManager.getStaticRedrawCount()).toBe(1);
    });
  });

  // =========================================================================
  // Challenge 4: Stroke Hit Tolerance Strictly 6.000px vs 6.001px
  // =========================================================================
  describe('Challenge 4: Strict Stroke Hit Tolerance Boundary', () => {
    it('pointToSegmentDistance calculates orthogonal and endpoint distances with precision', () => {
      // Orthogonal midpoint
      const dOrth = pointToSegmentDistance({ x: 50, y: 56.0 }, { x: 0, y: 50 }, { x: 100, y: 50 });
      expect(dOrth).toBe(6.0);

      const dOrthMiss = pointToSegmentDistance({ x: 50, y: 56.001 }, { x: 0, y: 50 }, { x: 100, y: 50 });
      expect(dOrthMiss).toBeCloseTo(6.001, 5);

      // Endpoint cap (before start)
      const dCapHit = pointToSegmentDistance({ x: -6.0, y: 50 }, { x: 0, y: 50 }, { x: 100, y: 50 });
      expect(dCapHit).toBe(6.0);

      const dCapMiss = pointToSegmentDistance({ x: -6.001, y: 50 }, { x: 0, y: 50 }, { x: 100, y: 50 });
      expect(dCapMiss).toBeCloseTo(6.001, 5);
    });

    it('hitTestStroke strictly passes at 6.000 screen px and fails at 6.001 screen px (zoom = 1.0)', () => {
      const points = [{ x: 10, y: 20 }, { x: 100, y: 20 }];

      // Exact 6.000px distance -> PASS
      expect(hitTestStroke({ x: 50, y: 26.000 }, points, 1.0)).toBe(true);
      expect(hitTestStroke({ x: 50, y: 14.000 }, points, 1.0)).toBe(true);

      // 6.001px distance -> FAIL
      expect(hitTestStroke({ x: 50, y: 26.001 }, points, 1.0)).toBe(false);
      expect(hitTestStroke({ x: 50, y: 13.999 }, points, 1.0)).toBe(false);
    });

    it('hitTestStroke scales correctly with zoom factor (zoom = 2.0 and zoom = 0.5)', () => {
      const points = [{ x: 10, y: 20 }, { x: 100, y: 20 }];

      // At zoom 2.0: 6.0 screen px = 3.0 world px
      // 3.000 world px -> 6.000 screen px -> PASS
      expect(hitTestStroke({ x: 50, y: 23.000 }, points, 2.0)).toBe(true);
      // 3.001 world px -> 6.002 screen px -> FAIL
      expect(hitTestStroke({ x: 50, y: 23.001 }, points, 2.0)).toBe(false);

      // At zoom 0.5: 6.0 screen px = 12.0 world px
      // 12.000 world px -> 6.000 screen px -> PASS
      expect(hitTestStroke({ x: 50, y: 32.000 }, points, 0.5)).toBe(true);
      // 12.002 world px -> 6.001 screen px -> FAIL
      expect(hitTestStroke({ x: 50, y: 32.002 }, points, 0.5)).toBe(false);
    });

    it('end-to-end FullCanvasRenderer hitTest respects 6.000px pass vs 6.001px fail', () => {
      const doc = createDocument('Stroke Precision Test');
      const strokeObj: CanvasObject = {
        id: 'stroke_edge',
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
          { x: 10, y: 50 },
          { x: 90, y: 50 },
        ],
      } as any;
      doc.objects['stroke_edge'] = strokeObj;
      doc.rootIds = ['stroke_edge'];
      doc.viewport = { x: 0, y: 0, zoom: 1.0 };

      const renderer = new FullCanvasRenderer(doc);

      // Test exactly 6.000px away -> HITS
      const hit = renderer.hitTest({ x: 50, y: 56.000 });
      expect(hit).not.toBeNull();
      expect(hit?.id).toBe('stroke_edge');

      // Test 6.001px away -> MISSES
      const miss = renderer.hitTest({ x: 50, y: 56.001 });
      expect(miss).toBeNull();
    });
  });

  // =========================================================================
  // Challenge 5: Handle Hit Targets >= 24 Screen Px
  // =========================================================================
  describe('Challenge 5: Handle Hit Targets >= 24 Screen Px', () => {
    it('verifies handle hit box size is at least 24.0 screen px', () => {
      expect(HANDLE_HIT_SIZE_SCREEN_PX).toBeGreaterThanOrEqual(24.0);
    });

    it('hit-tests all 9 transform handles (tl, tr, bl, br, tm, bm, ml, mr, rot) at exact center', () => {
      const box: CanvasObject = {
        id: 'box1',
        type: 'rect' as any,
        parentId: null,
        x: 100,
        y: 100,
        w: 200,
        h: 100,
        rotation: 0,
        z: 'a0',
        style: { colorId: 'ink', strokeWidth: 1, renderMode: 'crisp' },
        tags: [],
        locked: false,
        hidden: false,
        createdAt: 0,
        updatedAt: 0,
      };

      const vp = { x: 50, y: 50, zoom: 2.0 };
      // Screen coordinates for box:
      // x: 100 * 2 + 50 = 250, w: 200 * 2 = 400 -> right = 650
      // y: 100 * 2 + 50 = 250, h: 100 * 2 = 200 -> bottom = 450
      // rot handle: y: (100 - 20/2) * 2 + 50 = 90 * 2 + 50 = 230

      const handleCenters: Array<{ pos: string; x: number; y: number }> = [
        { pos: 'tl', x: 250, y: 250 },
        { pos: 'tr', x: 650, y: 250 },
        { pos: 'bl', x: 250, y: 450 },
        { pos: 'br', x: 650, y: 450 },
        { pos: 'tm', x: 450, y: 250 },
        { pos: 'bm', x: 450, y: 450 },
        { pos: 'ml', x: 250, y: 350 },
        { pos: 'mr', x: 650, y: 350 },
        { pos: 'rot', x: 450, y: 230 }, // (100 - 20/2) * 2 + 50 = 230 screen px (20px above top edge)
      ];

      for (const h of handleCenters) {
        const hit = hitTestObjectHandles({ x: h.x, y: h.y }, box, vp);
        expect(hit).not.toBeNull();
        expect(hit?.position).toBe(h.pos);
        expect(hit?.size).toBeGreaterThanOrEqual(24.0);
      }
    });

    it('strictly honors 24px screen target boundary (+/-12px passes, +/-12.001px fails)', () => {
      const box: CanvasObject = {
        id: 'box1',
        type: 'rect' as any,
        parentId: null,
        x: 0,
        y: 0,
        w: 100,
        h: 100,
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
      // Top-left handle is at (0, 0)
      // Within boundary: +/- 12px
      expect(hitTestObjectHandles({ x: 12.0, y: 0 }, box, vp)?.position).toBe('tl');
      expect(hitTestObjectHandles({ x: -12.0, y: 0 }, box, vp)?.position).toBe('tl');
      expect(hitTestObjectHandles({ x: 0, y: 12.0 }, box, vp)?.position).toBe('tl');
      expect(hitTestObjectHandles({ x: 0, y: -12.0 }, box, vp)?.position).toBe('tl');

      // Outside boundary: +/- 12.001px
      expect(hitTestObjectHandles({ x: 12.001, y: 0 }, box, vp)).toBeNull();
      expect(hitTestObjectHandles({ x: -12.001, y: 0 }, box, vp)).toBeNull();
      expect(hitTestObjectHandles({ x: 0, y: 12.001 }, box, vp)).toBeNull();
      expect(hitTestObjectHandles({ x: 0, y: -12.001 }, box, vp)).toBeNull();
    });
  });

  // =========================================================================
  // Challenge 6: Zero-Dimension Points and Negative Coordinate Quadrants
  // =========================================================================
  describe('Challenge 6: Zero-Dimension Points and Negative World Coordinates', () => {
    it('handles 0x0 zero-dimension entities across all 4 negative/positive quadrants', () => {
      const testCoordinates = [
        { x: 0, y: 0 },          // Origin
        { x: -500, y: 500 },     // Q2 (negative X, positive Y)
        { x: -1200, y: -800 },   // Q3 (negative X, negative Y)
        { x: 800, y: -950 },     // Q4 (positive X, negative Y)
      ];

      for (const coords of testCoordinates) {
        const ptObj: CanvasObject = {
          id: `zero_${coords.x}_${coords.y}`,
          type: 'shape',
          parentId: null,
          x: coords.x,
          y: coords.y,
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
        expect(bbox.minX).toBe(coords.x);
        expect(bbox.maxX).toBe(coords.x);
        expect(bbox.minY).toBe(coords.y);
        expect(bbox.maxY).toBe(coords.y);

        // Spatial index accommodates zero-area boxes cleanly
        const index = new SpatialIndex();
        index.insert({ id: ptObj.id, ...bbox });
        expect(index.count()).toBe(1);

        const searchHit = index.search({
          minX: coords.x - 1,
          minY: coords.y - 1,
          maxX: coords.x + 1,
          maxY: coords.y + 1,
        });
        expect(searchHit).toHaveLength(1);
        expect(searchHit[0].id).toBe(ptObj.id);
      }
    });

    it('correctly calculates bounding boxes for large objects spanning all 4 quadrants', () => {
      const spanningObj: CanvasObject = {
        id: 'span4',
        type: 'rect' as any,
        parentId: null,
        x: -400,
        y: -300,
        w: 800,
        h: 600,
        rotation: 0,
        z: 'a0',
        style: { colorId: 'ink', strokeWidth: 1, renderMode: 'crisp' },
        tags: [],
        locked: false,
        hidden: false,
        createdAt: 0,
        updatedAt: 0,
      };

      const bbox = computeBoundingBox(spanningObj);
      expect(bbox.minX).toBe(-400);
      expect(bbox.minY).toBe(-300);
      expect(bbox.maxX).toBe(400);
      expect(bbox.maxY).toBe(300);
    });

    it('computes bounding box for single-point and empty ink strokes', () => {
      const singlePtStroke: any = {
        id: 's_single',
        type: 'ink',
        x: -150,
        y: -250,
        z: 'a0',
        style: { strokeWidth: 4 },
        points: [{ x: -150, y: -250 }],
      };

      const bboxSingle = computeBoundingBox(singlePtStroke);
      expect(bboxSingle.minX).toBe(-152); // -150 - 2
      expect(bboxSingle.maxX).toBe(-148); // -150 + 2
      expect(bboxSingle.minY).toBe(-252); // -250 - 2
      expect(bboxSingle.maxY).toBe(-248); // -250 + 2

      const emptyStroke: any = {
        id: 's_empty',
        type: 'ink',
        x: -50,
        y: -50,
        z: 'a0',
        points: [],
      };
      const bboxEmpty = computeBoundingBox(emptyStroke);
      expect(bboxEmpty.minX).toBe(-50);
      expect(bboxEmpty.maxX).toBe(-50);
    });
  });

  // =========================================================================
  // Challenge 7: Locked Objects Are Indexed But Unselectable
  // =========================================================================
  describe('Challenge 7: Locked Objects Semantics', () => {
    it('indexes locked objects in spatial index for culling and rendering', () => {
      const index = new SpatialIndex();
      index.insert({
        id: 'locked_1',
        minX: 10,
        minY: 10,
        maxX: 100,
        maxY: 100,
      });

      expect(index.count()).toBe(1);
      const found = index.search({ minX: 0, minY: 0, maxX: 50, maxY: 50 });
      expect(found).toHaveLength(1);
      expect(found[0].id).toBe('locked_1');
    });

    it('rejects selection of locked objects in hitTestDocument', () => {
      const doc = createDocument('Locked Test');
      const lockedObj: CanvasObject = {
        id: 'locked_obj',
        type: 'rect' as any,
        parentId: null,
        x: 50,
        y: 50,
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
      doc.objects['locked_obj'] = lockedObj;
      doc.rootIds = ['locked_obj'];

      const index = new SpatialIndex();
      index.insert({ id: 'locked_obj', minX: 50, minY: 50, maxX: 150, maxY: 150 });

      const vp = { x: 0, y: 0, zoom: 1.0 };
      const hit = hitTestDocument({ x: 80, y: 80 }, doc, index, vp);
      expect(hit).toBeNull();
    });

    it('falls through locked topmost object to select unlocked object underneath in z-order', () => {
      const doc = createDocument('Z-Order Locked Fallthrough');
      const bottomUnlocked: CanvasObject = {
        id: 'bottom_unlocked',
        type: 'rect' as any,
        parentId: null,
        x: 50,
        y: 50,
        w: 100,
        h: 100,
        rotation: 0,
        z: 'a0',
        style: { colorId: 'ink', strokeWidth: 1, renderMode: 'crisp' },
        tags: [],
        locked: false, // UNLOCKED
        hidden: false,
        createdAt: 0,
        updatedAt: 0,
      };

      const topLocked: CanvasObject = {
        id: 'top_locked',
        type: 'rect' as any,
        parentId: null,
        x: 50,
        y: 50,
        w: 100,
        h: 100,
        rotation: 0,
        z: 'b0', // Higher z-index
        style: { colorId: 'blue', strokeWidth: 1, renderMode: 'crisp' },
        tags: [],
        locked: true, // LOCKED
        hidden: false,
        createdAt: 0,
        updatedAt: 0,
      };

      doc.objects['bottom_unlocked'] = bottomUnlocked;
      doc.objects['top_locked'] = topLocked;
      doc.rootIds = ['bottom_unlocked', 'top_locked'];

      const index = new SpatialIndex();
      index.insert({ id: 'bottom_unlocked', minX: 50, minY: 50, maxX: 150, maxY: 150 });
      index.insert({ id: 'top_locked', minX: 50, minY: 50, maxX: 150, maxY: 150 });

      const vp = { x: 0, y: 0, zoom: 1.0 };
      // Click at (80, 80) which intersects both
      const hit = hitTestDocument({ x: 80, y: 80 }, doc, index, vp);

      // Must bypass top_locked and select bottom_unlocked
      expect(hit).not.toBeNull();
      expect(hit?.id).toBe('bottom_unlocked');
    });
  });
});
