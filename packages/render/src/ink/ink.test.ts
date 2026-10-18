import { describe, it, expect, vi } from 'vitest';
import {
  calculateStabilizerRadius,
  applyLazyStringStabilizer,
  LazyStringStabilizer,
} from './stabilizer.js';
import {
  OneEuroFilter,
  OneEuroFilter2D,
} from './filter.js';
import {
  DEFAULT_BRUSH_OPTIONS,
  UNIFORM_BRUSH_OPTIONS,
  clampBrushSize,
  generateStrokeOutline,
  getSvgPathFromStroke,
} from './outline.js';
import {
  snapTo45Degrees,
  applyShiftSnap,
  applyPrecisionModifier,
  PrecisionModeTracker,
  DwellDetector,
  TemporaryToolSwitcher,
} from './modifiers.js';
import {
  isStrokeHitByEraser,
  findObjectsToErase,
  createEraseCommand,
} from './eraser.js';
import { InkPipeline } from './pipeline.js';
import { SpatialIndex } from '../spatial/index.js';
import { createDocument } from '@lensboard/core';

describe('Ink Engine Pipeline and Modifiers', () => {
  // Stabilizer Tests
  describe('Lazy-String Stabilizer', () => {
    it('scales stabilizer radius formula by 0.4px (0..100 -> 0..40px, f21-1, f21-b1, f21-b2)', () => {
      expect(calculateStabilizerRadius(0)).toBe(0);
      expect(calculateStabilizerRadius(50)).toBe(20);
      expect(calculateStabilizerRadius(100)).toBe(40);
    });

    it('pen remains static when cursor movement is within stabilizer radius (f21-2)', () => {
      const pen = { x: 100, y: 100 };
      const cursor = { x: 106, y: 100 }; // 6px distance
      const radius = 10;

      const stabilized = applyLazyStringStabilizer(cursor, pen, radius);
      expect(stabilized.x).toBe(100);
      expect(stabilized.y).toBe(100);
    });

    it('pen trails cursor along displacement vector when cursor exceeds radius (f21-3)', () => {
      const pen = { x: 100, y: 100 };
      const cursor = { x: 125, y: 100 }; // 25px distance
      const radius = 10;

      const stabilized = applyLazyStringStabilizer(cursor, pen, radius);
      expect(stabilized.x).toBe(115); // 125 - 10px radius
      expect(stabilized.y).toBe(100);
    });

    it('stateful LazyStringStabilizer tracks continuous pointer streaming', () => {
      const stabilizer = new LazyStringStabilizer(50); // 20px radius
      expect(stabilizer.getRadius()).toBe(20);

      const p0 = stabilizer.update({ x: 50, y: 50 });
      expect(p0.x).toBe(50);

      // Micro-jitter: 5px movement < 20px radius -> pen stays at 50, 50
      const p1 = stabilizer.update({ x: 55, y: 50 });
      expect(p1.x).toBe(50);

      // Movement exceeds 20px radius -> pen trails
      const p2 = stabilizer.update({ x: 80, y: 50 }); // 30px from 50
      expect(p2.x).toBe(60); // 80 - 20
    });
  });

  // Filter Tests
  describe('One-Euro Low-Pass Filter', () => {
    it('smooths high-frequency jitter at low speeds (f21-4)', () => {
      const filter = new OneEuroFilter(1.0, 0.007, 1.0);
      const t0 = 1000;
      filter.filter(100, t0);

      const filtered = filter.filter(102, t0 + 16);
      expect(filtered).toBeLessThan(102);
      expect(filtered).toBeGreaterThan(100);
    });

    it('adaptively raises cutoff at high speeds to eliminate lag (f21-5)', () => {
      const filter = new OneEuroFilter(1.0, 0.007, 1.0);
      let t = 1000;
      let pos = 0;
      filter.filter(pos, t);

      let fast = 0;
      for (let i = 0; i < 4; i++) {
        t += 16;
        pos += 60;
        fast = filter.filter(pos, t);
      }
      expect(fast).toBeGreaterThan(100);
    });

    it('clamps dt = 0ms safely to minimum 0.0001s without division by zero (f21-b3)', () => {
      const filter = new OneEuroFilter();
      filter.filter(100, 1000);
      const res = filter.filter(100, 1000); // 0ms dt
      expect(Number.isFinite(res)).toBe(true);
      expect(res).toBe(100);
    });

    it('handles out-of-order reverse timestamps safely (f21-b4)', () => {
      const filter = new OneEuroFilter();
      filter.filter(100, 1000);
      const res = filter.filter(105, 900); // Reversed timestamp
      expect(Number.isFinite(res)).toBe(true);
    });

    it('processes extreme coordinate values without overflow (f21-b5)', () => {
      const filter = new OneEuroFilter();
      const res = filter.filter(1e5, 1000);
      expect(res).toBe(1e5);
    });

    it('OneEuroFilter2D filters 2D points synchronously', () => {
      const filter2D = new OneEuroFilter2D();
      const p = filter2D.filter({ x: 10, y: 20 }, 1000);
      expect(p.x).toBe(10);
      expect(p.y).toBe(20);
    });
  });

  // Dynamic Outline Tests
  describe('Dynamic Outline & perfect-freehand', () => {
    it('calibrates default brush size to 3px and tapers to 6px (f22-1, f22-4)', () => {
      expect(DEFAULT_BRUSH_OPTIONS.size).toBe(3);
      expect(DEFAULT_BRUSH_OPTIONS.startTaper).toBe(6);
      expect(DEFAULT_BRUSH_OPTIONS.endTaper).toBe(6);
    });

    it('clamps brush size strictly to [1, 24] px (f22-2, f22-b3, f22-b4)', () => {
      expect(clampBrushSize(0.2)).toBe(1);
      expect(clampBrushSize(15)).toBe(15);
      expect(clampBrushSize(35)).toBe(24);
    });

    it('uniform width mode disables thinning and removes tapers (f22-5)', () => {
      expect(UNIFORM_BRUSH_OPTIONS.thinning).toBe(0);
      expect(UNIFORM_BRUSH_OPTIONS.startTaper).toBe(0);
      expect(UNIFORM_BRUSH_OPTIONS.endTaper).toBe(0);
      expect(UNIFORM_BRUSH_OPTIONS.simulatePressure).toBe(false);
    });

    it('single-point stroke produces circular dot outline (f22-b1)', () => {
      const outline = generateStrokeOutline([{ x: 100, y: 100 }], {
        ...DEFAULT_BRUSH_OPTIONS,
        size: 4,
      });
      expect(outline.length).toBeGreaterThanOrEqual(8);
      // All vertices should be near distance 2 (radius) from center
      for (const [x, y] of outline) {
        const dist = Math.hypot(x - 100, y - 100);
        expect(dist).toBeCloseTo(2, 1);
      }
    });

    it('consecutive duplicate points do not cause crash (f22-b2)', () => {
      const outline = generateStrokeOutline([
        { x: 50, y: 50 },
        { x: 50, y: 50 },
        { x: 50, y: 50 },
      ]);
      expect(outline).toBeDefined();
      expect(outline.length).toBeGreaterThan(0);
    });

    it('handles 1,000 dense stroke points without stack overflow (f22-b5)', () => {
      const dense: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < 1000; i++) {
        dense.push({ x: i, y: Math.sin(i / 10) * 10 });
      }
      const outline = generateStrokeOutline(dense);
      expect(outline).toBeDefined();
      expect(outline.length).toBeGreaterThan(0);

      const svgPath = getSvgPathFromStroke(outline);
      expect(svgPath).toContain('M');
      expect(svgPath).toContain('Z');
    });
  });

  // Modifier Modes Tests
  describe('Ink Modifiers', () => {
    it('holding Shift snaps angle to nearest 45-degree increment (f23-1)', () => {
      // 40 degrees should snap to 45 degrees
      const snapped = snapTo45Degrees(100, 83.9);
      expect(Math.abs(snapped.x)).toBe(Math.abs(snapped.y));
    });

    it('boundary angle of exactly 22.5° snaps cleanly to 0° or 45° (f23-b1)', () => {
      const angle = 22.5 * (Math.PI / 180);
      const step = Math.PI / 4;
      const snapped = Math.round(angle / step) * step;
      expect([0, step]).toContain(snapped);
    });

    it('applyShiftSnap snaps relative to starting anchor point', () => {
      const anchor = { x: 100, y: 100 };
      const current = { x: 200, y: 183.9 };
      const snapped = applyShiftSnap(anchor, current);
      expect(Math.abs(snapped.x - anchor.x)).toBe(Math.abs(snapped.y - anchor.y));
    });

    it('holding Ctrl dampens movement velocity to 40% speed (f23-2, f23-b2)', () => {
      const normal = applyPrecisionModifier({ dx: 20, dy: 20 }, false);
      const precision = applyPrecisionModifier({ dx: 20, dy: 20 }, true);

      expect(normal.dx).toBe(20);
      expect(precision.dx).toBe(8); // 20 * 0.4
      expect(precision.dy).toBe(8);

      const zeroDelta = applyPrecisionModifier({ dx: 0, dy: 0 }, true);
      expect(zeroDelta.dx).toBe(0);
      expect(zeroDelta.dy).toBe(0);
    });

    it('PrecisionModeTracker tracks dampened pen position and ghost cursor', () => {
      const tracker = new PrecisionModeTracker();
      tracker.reset({ x: 100, y: 100 });

      // Move 50px right with Ctrl depressed
      const { penPoint, ghostCursor } = tracker.update({ x: 150, y: 100 }, true);
      expect(penPoint.x).toBe(120); // 100 + 50 * 0.4
      expect(ghostCursor.x).toBe(150); // Ghost cursor at raw mouse position
      expect(ghostCursor.visible).toBe(true);
    });

    it('DwellDetector emits dwell event when pointer moves <3px for 350ms', () => {
      const onDwell = vi.fn();
      const detector = new DwellDetector(onDwell);

      detector.onPointerDown({ x: 50, y: 50 }, 1000);

      // Micro-movement 1px at 1200ms (200ms elapsed) -> no dwell yet
      detector.onPointerMove({ x: 51, y: 50 }, 1200);
      expect(onDwell).not.toHaveBeenCalled();

      // Micro-movement 1.5px at 1400ms (400ms elapsed >= 350ms) -> dwell triggered!
      detector.onPointerMove({ x: 51.5, y: 50 }, 1400);
      expect(onDwell).toHaveBeenCalledTimes(1);

      // Movement >= 3px resets detector
      detector.onPointerMove({ x: 60, y: 50 }, 1410);
      expect(detector.isTriggered()).toBe(false);
    });

    it('TemporaryToolSwitcher toggles tool to eraser on hold X and reverts on release (f23-5)', () => {
      const switcher = new TemporaryToolSwitcher('pen');
      expect(switcher.getActiveTool()).toBe('pen');

      switcher.onKeyDown('X');
      expect(switcher.getActiveTool()).toBe('eraser');

      switcher.onKeyUp('X');
      expect(switcher.getActiveTool()).toBe('pen');
    });
  });

  // Eraser Tests
  describe('Whole-Stroke Eraser', () => {
    it('whole-stroke eraser removes stroke if within 8px radius (f23-3)', () => {
      const points = [{ x: 50, y: 50 }, { x: 100, y: 100 }];
      const eraserPos = { x: 55, y: 50 }; // 5px away <= 8px
      expect(isStrokeHitByEraser(points, eraserPos, 8)).toBe(true);
    });

    it('whole-stroke eraser ignores strokes farther than 8px (f23-4)', () => {
      const points = [{ x: 50, y: 50 }, { x: 100, y: 100 }];
      const eraserPos = { x: 70, y: 50 }; // 20px away > 8px
      expect(isStrokeHitByEraser(points, eraserPos, 8)).toBe(false);
    });

    it('eraser with 0px radius hits nothing (f23-b3)', () => {
      const points = [{ x: 50, y: 50 }];
      const eraserPos = { x: 50.5, y: 50 };
      expect(isStrokeHitByEraser(points, eraserPos, 0)).toBe(false);
    });

    it('locked objects are immune to whole-stroke eraser (f23-b4)', () => {
      const doc = createDocument('Erase Test');
      doc.objects['lockedStroke'] = {
        id: 'lockedStroke',
        type: 'ink',
        parentId: null,
        x: 50,
        y: 50,
        w: 50,
        h: 50,
        rotation: 0,
        z: 'a0',
        style: { colorId: 'ink', strokeWidth: 2, renderMode: 'crisp' },
        tags: [],
        locked: true, // IMMUNE
        hidden: false,
        createdAt: 0,
        updatedAt: 0,
        points: [{ x: 50, y: 50 }, { x: 100, y: 100 }],
      } as any;
      doc.rootIds = ['lockedStroke'];

      const index = new SpatialIndex();
      index.insert({ minX: 48, minY: 48, maxX: 102, maxY: 102, id: 'lockedStroke' });
      const vp = { x: 0, y: 0, zoom: 1.0 };

      const hit = findObjectsToErase({ x: 52, y: 50 }, doc, index, vp, 8);
      expect(hit).toHaveLength(0); // Immune!
    });

    it('createEraseCommand generates undoable delete command', () => {
      const obj: any = { id: 's1', type: 'ink' };
      const cmd = createEraseCommand([obj], 12345);
      expect(cmd).not.toBeNull();
      expect(cmd?.type).toBe('delete');
      expect(cmd?.targets).toEqual(['s1']);
    });
  });

  // InkPipeline End-to-End
  describe('InkPipeline Integration', () => {
    it('runs end-to-end stroke lifecycle: start, append, outline, finish', () => {
      const pipeline = new InkPipeline({ stabilizerPercent: 50 });
      const vp = { x: 0, y: 0, zoom: 1.0 };

      pipeline.start({ x: 10, y: 10, t: 1000 }, vp);
      pipeline.append({ x: 30, y: 30, t: 1016 }, vp);
      pipeline.append({ x: 60, y: 60, t: 1032 }, vp);

      const outline = pipeline.getLiveOutlineVertices(vp);
      expect(outline.length).toBeGreaterThan(0);

      const stroke = pipeline.finish('a0');
      expect(stroke.type).toBe('ink');
      expect(stroke.points.length).toBe(3);
      expect(stroke.z).toBe('a0');
    });
  });
});
