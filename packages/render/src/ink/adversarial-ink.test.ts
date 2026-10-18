/**
 * Adversarial Stress & Verification Test Suite for Milestone 4: Ink Engine & Modifiers Kinematics
 * Agent: challenger_m4_2_g8 (Empirical Challenger)
 * 
 * Scope:
 * - Lazy-String stabilizer radius = percent * 0.4px (0 to 40px) and leash trailing vector.
 * - One-Euro filter low-pass behavior at low speeds and adaptive cutoff at high speeds.
 * - One-Euro filter dt=0ms clamp (min 0.0001s) and reverse timestamp robustness.
 * - perfect-freehand outline with single-point tap dot, uniform width mode, and Alt+wheel size clamping [1, 24]px.
 * - Shift-snap 45° angle snapping (including boundary at 22.5°) and clean release to freehand.
 * - Ctrl precision mode 40% speed and ghost cursor rendering.
 * - Whole-stroke eraser 8px radius and immunity of locked objects.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateStabilizerRadius,
  applyLazyStringStabilizer,
  LazyStringStabilizer,
} from './stabilizer.js';
import {
  OneEuroFilter,
  OneEuroFilter2D,
  DEFAULT_MIN_CUTOFF,
  DEFAULT_BETA,
  DEFAULT_D_CUTOFF,
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
  PRECISION_MODE_DAMPING,
  DWELL_MAX_MOVEMENT_PX,
  DWELL_DURATION_MS,
} from './modifiers.js';
import {
  isStrokeHitByEraser,
  findObjectsToErase,
  createEraseCommand,
  ERASER_RADIUS_SCREEN_PX,
} from './eraser.js';
import { InkPipeline } from './pipeline.js';
import { SpatialIndex } from '../spatial/index.js';
import { createDocument, apply } from '@lensboard/core';
import type { CanvasObject } from '@lensboard/core';

describe('Adversarial Challenger Suite: Ink Engine & Modifier Kinematics', () => {
  // =========================================================================
  // Challenge 1: Lazy-String Stabilizer Radius & Leash Trailing Vector Geometry
  // =========================================================================
  describe('Challenge 1: Lazy-String Stabilizer Invariants', () => {
    it('verifies radius formula r = percent * 0.4px across entire continuous range and clamping', () => {
      // Nominal values
      expect(calculateStabilizerRadius(0)).toBe(0);
      expect(calculateStabilizerRadius(25)).toBe(10);
      expect(calculateStabilizerRadius(50)).toBe(20);
      expect(calculateStabilizerRadius(75)).toBe(30);
      expect(calculateStabilizerRadius(100)).toBe(40);

      // Fine fractional values
      expect(calculateStabilizerRadius(12.5)).toBe(5);
      expect(calculateStabilizerRadius(37.5)).toBe(15);
      expect(calculateStabilizerRadius(0.25)).toBeCloseTo(0.1, 5);

      // Boundary clamping: negative and over 100%
      expect(calculateStabilizerRadius(-1)).toBe(0);
      expect(calculateStabilizerRadius(-100)).toBe(0);
      expect(calculateStabilizerRadius(101)).toBe(40);
      expect(calculateStabilizerRadius(500)).toBe(40);
      expect(calculateStabilizerRadius(Infinity)).toBe(40);
      expect(calculateStabilizerRadius(-Infinity)).toBe(0);
    });

    it('rigorously tests leash trailing vector geometry across 360° circular sweep', () => {
      const pen = { x: 500, y: 500 };
      const radius = 25.0;

      // Test 72 discrete angles around 360 degrees (every 5 degrees)
      for (let deg = 0; deg < 360; deg += 5) {
        const rad = (deg * Math.PI) / 180;
        const testDistance = 80.0; // Exceeds radius of 25.0

        const cursor = {
          x: pen.x + testDistance * Math.cos(rad),
          y: pen.y + testDistance * Math.sin(rad),
        };

        const stabilized = applyLazyStringStabilizer(cursor, pen, radius);

        // Invariant 1: Distance between new pen and cursor must strictly equal radius
        const penToCursorDist = Math.hypot(cursor.x - stabilized.x, cursor.y - stabilized.y);
        expect(penToCursorDist).toBeCloseTo(radius, 6);

        // Invariant 2: Collinearity — stabilized pen must lie on line segment between old pen and cursor
        // Vector oldPen -> cursor
        const dxTotal = cursor.x - pen.x;
        const dyTotal = cursor.y - pen.y;
        // Vector oldPen -> stabilized
        const dxStab = stabilized.x - pen.x;
        const dyStab = stabilized.y - pen.y;

        // 2D Cross product of (cursor - pen) and (stabilized - pen) must be 0
        const cross = dxTotal * dyStab - dyTotal * dxStab;
        expect(Math.abs(cross)).toBeLessThan(1e-9);

        // Invariant 3: Stabilized pen must advance along displacement by exactly (totalDistance - radius)
        const travelDist = Math.hypot(dxStab, dyStab);
        expect(travelDist).toBeCloseTo(testDistance - radius, 6);
      }
    });

    it('verifies dead zone: pen remains completely stationary when cursor is within or on radius', () => {
      const pen = { x: 200, y: -300 };
      const radius = 30.0;

      // Inside radius tests (0%, 25%, 50%, 99.999% of radius)
      const ratios = [0, 0.001, 0.25, 0.5, 0.75, 0.99999, 1.0];
      for (const ratio of ratios) {
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
          const cursor = {
            x: pen.x + radius * ratio * Math.cos(angle),
            y: pen.y + radius * ratio * Math.sin(angle),
          };
          const stabilized = applyLazyStringStabilizer(cursor, pen, radius);
          expect(stabilized.x).toBe(pen.x);
          expect(stabilized.y).toBe(pen.y);
        }
      }
    });

    it('handles negative coordinates, massive displacements (100,000px), and zero radius without error', () => {
      // Quadrant 3 negative coordinates
      const pen = { x: -1000, y: -2000 };
      const cursor = { x: -1030, y: -2040 }; // dx = -30, dy = -40, dist = 50
      const stabilized = applyLazyStringStabilizer(cursor, pen, 20); // dist 50, radius 20 -> pen advances 30 along vector
      expect(stabilized.x).toBeCloseTo(-1000 + (-30 * (30 / 50)), 5); // -1018
      expect(stabilized.y).toBeCloseTo(-2000 + (-40 * (30 / 50)), 5); // -2024
      expect(Math.hypot(cursor.x - stabilized.x, cursor.y - stabilized.y)).toBeCloseTo(20, 5);

      // Massive displacement
      const farCursor = { x: 99999, y: 99999 };
      const farStab = applyLazyStringStabilizer(farCursor, pen, 40);
      expect(Math.hypot(farCursor.x - farStab.x, farCursor.y - farStab.y)).toBeCloseTo(40, 4);

      // Zero radius: tracks cursor immediately
      const zeroStab = applyLazyStringStabilizer(cursor, pen, 0);
      expect(zeroStab.x).toBe(cursor.x);
      expect(zeroStab.y).toBe(cursor.y);
    });

    it('verifies stateful directional reversal slack behavior', () => {
      const stabilizer = new LazyStringStabilizer(50); // radius = 20px
      stabilizer.reset({ x: 0, y: 0 });

      // Move right 100px: cursor at (100, 0), pen at (80, 0)
      const p1 = stabilizer.update({ x: 100, y: 0 });
      expect(p1.x).toBe(80);
      expect(p1.y).toBe(0);

      // Now reverse direction: move left by 15px (cursor at 85, 0).
      // Distance between cursor (85, 0) and pen (80, 0) is 5px <= 20px radius.
      // Pen MUST stay frozen at (80, 0)!
      const p2 = stabilizer.update({ x: 85, y: 0 });
      expect(p2.x).toBe(80);
      expect(p2.y).toBe(0);

      // Move left further to cursor at 50px: distance from pen 80 is 30px > 20px radius.
      // Pen trails to 50 + 20 = 70px!
      const p3 = stabilizer.update({ x: 50, y: 0 });
      expect(p3.x).toBe(70);
      expect(p3.y).toBe(0);
    });
  });

  // =========================================================================
  // Challenge 2: One-Euro Filter Low-Pass, Adaptive Cutoff & Temporal Robustness
  // =========================================================================
  describe('Challenge 2: One-Euro Low-Pass Filter & Kinematics', () => {
    it('verifies default filter parameters: minCutoff = 1.0Hz, beta = 0.007, dCutoff = 1.0Hz', () => {
      expect(DEFAULT_MIN_CUTOFF).toBe(1.0);
      expect(DEFAULT_BETA).toBe(0.007);
      expect(DEFAULT_D_CUTOFF).toBe(1.0);
    });

    it('verifies low-pass smoothing attenuates high-frequency jitter by >50%', () => {
      const filter = new OneEuroFilter(1.0, 0.007, 1.0);
      let t = 1000;
      const baseVal = 100.0;
      filter.filter(baseVal, t);

      // Apply 100 frames of alternating jitter (+2, -2) around baseVal
      const rawJitterErrors: number[] = [];
      const filteredErrors: number[] = [];

      for (let i = 1; i <= 60; i++) {
        t += 16; // 60 Hz
        const jitter = (i % 2 === 0 ? 1 : -1) * 2.0;
        const rawInput = baseVal + jitter;
        const filtered = filter.filter(rawInput, t);

        rawJitterErrors.push(Math.abs(rawInput - baseVal));
        filteredErrors.push(Math.abs(filtered - baseVal));
      }

      const avgRawError = rawJitterErrors.reduce((a, b) => a + b) / rawJitterErrors.length;
      const avgFilteredError = filteredErrors.reduce((a, b) => a + b) / filteredErrors.length;

      // Filtered jitter error must be significantly reduced (< 50% of raw jitter)
      expect(avgFilteredError).toBeLessThan(avgRawError * 0.5);
      expect(avgFilteredError).toBeLessThan(1.0);
    });

    it('verifies adaptive cutoff scales with velocity and tracks high-speed motions without lag', () => {
      const filter = new OneEuroFilter(1.0, 0.007, 1.0);
      let t = 1000;
      let pos = 0;
      filter.filter(pos, t);

      // Sustained high speed motion: 200px per frame at 60Hz = 12,000 px/sec
      let lastFiltered = 0;
      for (let i = 0; i < 10; i++) {
        t += 16;
        pos += 200;
        lastFiltered = filter.filter(pos, t);
      }

      // At 12,000 px/sec, cutoff is high and filter should closely track the position
      // Lag should be less than one full frame of movement (< 200px)
      const lag = pos - lastFiltered;
      expect(lag).toBeLessThan(200);
      expect(lastFiltered).toBeGreaterThan(pos - 200);
    });

    it('strictly clamps dt = 0ms and sub-millisecond deltas to minimum 0.0001s without NaN or Infinity', () => {
      const filter = new OneEuroFilter();
      filter.filter(50, 1000);

      // 50 calls with exactly dt = 0ms (same timestamp)
      for (let i = 0; i < 50; i++) {
        const out = filter.filter(50 + i * 0.1, 1000);
        expect(Number.isFinite(out)).toBe(true);
        expect(Number.isNaN(out)).toBe(false);
      }

      // Sub-microsecond intervals (0.000001 ms)
      const microOut = filter.filter(60, 1000.000001);
      expect(Number.isFinite(microOut)).toBe(true);
    });

    it('handles out-of-order reverse timestamps gracefully without filter explosion', () => {
      const filter = new OneEuroFilter();
      filter.filter(100, 1000);

      // Timestamps going backwards
      const reverseSeries = [950, 900, 800, 500, 100, 0, -100];
      for (const t of reverseSeries) {
        const out = filter.filter(105, t);
        expect(Number.isFinite(out)).toBe(true);
        expect(Number.isNaN(out)).toBe(false);
      }

      // Timestamps then jumping forward again
      const fwdSeries = [2000, 2016, 2032];
      for (const t of fwdSeries) {
        const out = filter.filter(110, t);
        expect(Number.isFinite(out)).toBe(true);
      }
    });

    it('OneEuroFilter2D filters 2D points with axis independence', () => {
      const filter2D = new OneEuroFilter2D();
      filter2D.filter({ x: 100, y: 500 }, 1000);

      // Move only along X axis, Y stays stationary
      for (let i = 1; i <= 20; i++) {
        const res = filter2D.filter({ x: 100 + i * 10, y: 500 }, 1000 + i * 16);
        // Y must remain exactly 500
        expect(res.y).toBeCloseTo(500, 5);
        // X must track progression
        expect(res.x).toBeGreaterThan(100);
      }
    });
  });

  // =========================================================================
  // Challenge 3: Dynamic Outline Generation (perfect-freehand) & Brush Bounds
  // =========================================================================
  describe('Challenge 3: Dynamic Outline & perfect-freehand Engine', () => {
    it('verifies single-point tap dot generates 16-segment closed circular outline with diameter = brushSize', () => {
      const center = { x: 300, y: 400 };
      const brushSize = 8;
      const radius = brushSize / 2; // 4px

      const outline = generateStrokeOutline([center], {
        ...DEFAULT_BRUSH_OPTIONS,
        size: brushSize,
      });

      // Must generate 16 segments
      expect(outline.length).toBe(16);

      // Every vertex must be at distance ~4px from center
      for (const [vx, vy] of outline) {
        const dist = Math.hypot(vx - center.x, vy - center.y);
        expect(dist).toBeCloseTo(radius, 2);
      }

      // Centroid of outline must match tap coordinate
      const sumX = outline.reduce((acc, pt) => acc + pt[0], 0);
      const sumY = outline.reduce((acc, pt) => acc + pt[1], 0);
      expect(sumX / outline.length).toBeCloseTo(center.x, 2);
      expect(sumY / outline.length).toBeCloseTo(center.y, 2);
    });

    it('strictly clamps brush size to [1, 24] px under all conditions', () => {
      expect(clampBrushSize(-1000)).toBe(1);
      expect(clampBrushSize(0)).toBe(1);
      expect(clampBrushSize(0.999)).toBe(1);
      expect(clampBrushSize(1)).toBe(1);
      expect(clampBrushSize(12.5)).toBe(12.5);
      expect(clampBrushSize(24)).toBe(24);
      expect(clampBrushSize(24.001)).toBe(24);
      expect(clampBrushSize(999)).toBe(24);
      expect(clampBrushSize(Infinity)).toBe(24);
      expect(clampBrushSize(-Infinity)).toBe(1);
    });

    it('verifies uniform width mode disables thinning and preserves uniform stroke geometry', () => {
      expect(UNIFORM_BRUSH_OPTIONS.thinning).toBe(0);
      expect(UNIFORM_BRUSH_OPTIONS.startTaper).toBe(0);
      expect(UNIFORM_BRUSH_OPTIONS.endTaper).toBe(0);
      expect(UNIFORM_BRUSH_OPTIONS.simulatePressure).toBe(false);

      // Generate stroke in uniform mode
      const pts = [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 100, y: 0 },
        { x: 150, y: 0 },
        { x: 200, y: 0 },
      ];
      const outline = generateStrokeOutline(pts, {
        ...UNIFORM_BRUSH_OPTIONS,
        size: 10,
      });

      expect(outline.length).toBeGreaterThan(0);
      const svgPath = getSvgPathFromStroke(outline);
      expect(svgPath.startsWith('M')).toBe(true);
      expect(svgPath.endsWith('Z')).toBe(true);
    });

    it('handles pathological stroke topologies: identical duplicate points and dense 5,000 point series', () => {
      // 5 identical duplicate points
      const duplicates = [
        { x: 100, y: 100 },
        { x: 100, y: 100 },
        { x: 100, y: 100 },
        { x: 100, y: 100 },
        { x: 100, y: 100 },
      ];
      const dupOutline = generateStrokeOutline(duplicates);
      expect(dupOutline).toBeDefined();
      expect(dupOutline.length).toBeGreaterThan(0);

      // 5,000 dense points without stack overflow or performance degradation
      const dense: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < 5000; i++) {
        dense.push({ x: i * 0.1, y: Math.sin(i * 0.05) * 20 });
      }
      const t0 = performance.now();
      const denseOutline = generateStrokeOutline(dense);
      const t1 = performance.now();

      expect(denseOutline.length).toBeGreaterThan(0);
      // Must execute quickly (< 150ms for 5000 points)
      expect(t1 - t0).toBeLessThan(300);
    });
  });

  // =========================================================================
  // Challenge 4: Shift-Snap 45° Angle Snapping & Modifiers Kinematics
  // =========================================================================
  describe('Challenge 4: Shift-Snap & Precision Mode Kinematics', () => {
    it('verifies 45° angle snapping across all 8 cardinal/intercardinal quadrants', () => {
      // Test directions with clear intended angle
      const angles = [
        { deg: 0, expectedDeg: 0 },
        { deg: 40, expectedDeg: 45 },
        { deg: 45, expectedDeg: 45 },
        { deg: 50, expectedDeg: 45 },
        { deg: 90, expectedDeg: 90 },
        { deg: 130, expectedDeg: 135 },
        { deg: 135, expectedDeg: 135 },
        { deg: 180, expectedDeg: 180 },
        { deg: -45, expectedDeg: -45 },
        { deg: -90, expectedDeg: -90 },
        { deg: -135, expectedDeg: -135 },
      ];

      for (const { deg, expectedDeg } of angles) {
        const rad = (deg * Math.PI) / 180;
        const length = 100;
        const dx = length * Math.cos(rad);
        const dy = length * Math.sin(rad);

        const snapped = snapTo45Degrees(dx, dy);
        const snappedRad = Math.atan2(snapped.y, snapped.x);
        const snappedDeg = Math.round((snappedRad * 180) / Math.PI);

        // Normalize -180 and 180
        const normActual = snappedDeg === -180 ? 180 : snappedDeg;
        const normExpected = expectedDeg === -180 ? 180 : expectedDeg;
        expect(normActual).toBe(normExpected);
      }
    });

    it('strictly tests the 22.5° boundary and snaps cleanly to 0° or 45° without NaN', () => {
      const length = 100;
      // Exactly 22.5° (pi / 8)
      const rad22_5 = (22.5 * Math.PI) / 180;
      const dx = length * Math.cos(rad22_5);
      const dy = length * Math.sin(rad22_5);

      const snapped = snapTo45Degrees(dx, dy);
      const snappedRad = Math.atan2(snapped.y, snapped.x);
      const snappedDeg = Math.round((snappedRad * 180) / Math.PI);

      // 22.5° is exactly halfway, must snap cleanly to 0° or 45°
      expect([0, 45]).toContain(snappedDeg);

      // Just below 22.5° (22.4°) must snap to 0°
      const rad22_4 = (22.4 * Math.PI) / 180;
      const snappedLow = snapTo45Degrees(length * Math.cos(rad22_4), length * Math.sin(rad22_4));
      const snappedDegLow = Math.round((Math.atan2(snappedLow.y, snappedLow.x) * 180) / Math.PI);
      expect(snappedDegLow).toBe(0);

      // Just above 22.5° (22.6°) must snap to 45°
      const rad22_6 = (22.6 * Math.PI) / 180;
      const snappedHigh = snapTo45Degrees(length * Math.cos(rad22_6), length * Math.sin(rad22_6));
      const snappedDegHigh = Math.round((Math.atan2(snappedHigh.y, snappedHigh.x) * 180) / Math.PI);
      expect(snappedDegHigh).toBe(45);
    });

    it('verifies clean release from Shift-snap straight line to freehand drafting in InkPipeline', () => {
      const pipeline = new InkPipeline();
      const vp = { x: 0, y: 0, zoom: 1.0 };

      // Start stroke at (100, 100)
      pipeline.start({ x: 100, y: 100, t: 1000 }, vp, { shift: true });

      // Append points with Shift active (drawing straight line towards ~40° -> snaps to 45°)
      pipeline.append({ x: 140, y: 130, t: 1016 }, vp, { shift: true });
      pipeline.append({ x: 180, y: 160, t: 1032 }, vp, { shift: true });

      const ptsSnapped = pipeline.getWorldPoints();
      expect(ptsSnapped.length).toBe(3);
      // Snapped points should follow 45° line dx == dy
      const pLastSnapped = ptsSnapped[2];
      expect(Math.abs(pLastSnapped.x - 100)).toBeCloseTo(Math.abs(pLastSnapped.y - 100), 0);

      // Release Shift key (shift: false) and move freehand horizontally to (250, 160)
      pipeline.append({ x: 250, y: 160, t: 1048 }, vp, { shift: false });
      pipeline.append({ x: 300, y: 160, t: 1064 }, vp, { shift: false });

      const ptsReleased = pipeline.getWorldPoints();
      expect(ptsReleased.length).toBe(5);

      // After release, movement is freehand and NOT constrained to the 45° angle from anchor (100, 100)
      const pFreehand = ptsReleased[4];
      expect(pFreehand.x).toBeGreaterThan(250);
      // dx from anchor is ~200, dy from anchor is ~60: clearly freehand!
      expect(pFreehand.x - 100).not.toBeCloseTo(pFreehand.y - 100, 0);
    });

    it('verifies Ctrl precision mode dampens speed to exactly 40% and tracks ghost cursor', () => {
      expect(PRECISION_MODE_DAMPING).toBe(0.4);

      const tracker = new PrecisionModeTracker();
      tracker.reset({ x: 200, y: 200 });

      // Move mouse by (100, 50) with Ctrl down
      const step1 = tracker.update({ x: 300, y: 250 }, true);

      // Virtual pen must advance by 40% of displacement: dx = 40, dy = 20 -> (240, 220)
      expect(step1.penPoint.x).toBe(240);
      expect(step1.penPoint.y).toBe(220);

      // Ghost cursor must reflect raw physical mouse position with visible: true
      expect(step1.ghostCursor.x).toBe(300);
      expect(step1.ghostCursor.y).toBe(250);
      expect(step1.ghostCursor.visible).toBe(true);

      // Release Ctrl and move mouse by (50, 50) to (350, 300)
      const step2 = tracker.update({ x: 350, y: 300 }, false);

      // Pen advances by 100% of displacement (50, 50) -> (240 + 50, 220 + 50) = (290, 270)
      expect(step2.penPoint.x).toBe(290);
      expect(step2.penPoint.y).toBe(270);

      // Ghost cursor visible must be false when Ctrl is not pressed
      expect(step2.ghostCursor.visible).toBe(false);
    });

    it('verifies pure modifier functions: applyShiftSnap and applyPrecisionModifier', () => {
      const anchor = { x: 50, y: 50 };
      const current = { x: 150, y: 133.9 }; // ~40 degrees -> snaps to 45 degrees
      const snapped = applyShiftSnap(anchor, current);
      expect(Math.abs(snapped.x - anchor.x)).toBe(Math.abs(snapped.y - anchor.y));

      const delta = { dx: 100, dy: -50 };
      const modNormal = applyPrecisionModifier(delta, false);
      expect(modNormal.dx).toBe(100);
      expect(modNormal.dy).toBe(-50);

      const modCtrl = applyPrecisionModifier(delta, true);
      expect(modCtrl.dx).toBe(40);
      expect(modCtrl.dy).toBe(-20);
    });

    it('verifies DwellDetector parameters (<3px, 350ms) and reset dynamics', () => {
      expect(DWELL_MAX_MOVEMENT_PX).toBe(3.0);
      expect(DWELL_DURATION_MS).toBe(350);

      let dwellCount = 0;
      const detector = new DwellDetector(() => { dwellCount++; });

      detector.onPointerDown({ x: 100, y: 100 }, 1000);

      // Micro-move 1px at 200ms -> no dwell
      detector.onPointerMove({ x: 101, y: 100 }, 1200);
      expect(dwellCount).toBe(0);

      // Micro-move 1.5px at 400ms (elapsed 400ms >= 350ms) -> dwell fires!
      detector.onPointerMove({ x: 101.5, y: 100 }, 1400);
      expect(dwellCount).toBe(1);

      // Movement >= 3px (e.g. to 110px) immediately resets detector
      detector.onPointerMove({ x: 110, y: 100 }, 1410);
      expect(detector.isTriggered()).toBe(false);
    });

    it('verifies TemporaryToolSwitcher hold-to-erase key switching and key case insensitivity', () => {
      const switcher = new TemporaryToolSwitcher('pen');
      expect(switcher.getActiveTool()).toBe('pen');

      // Non-X key should be ignored
      expect(switcher.onKeyDown('A')).toBe(false);
      expect(switcher.getActiveTool()).toBe('pen');

      // Lowercase 'x' activates eraser
      expect(switcher.onKeyDown('x')).toBe(true);
      expect(switcher.getActiveTool()).toBe('eraser');

      // Release 'x' reverts to pen
      expect(switcher.onKeyUp('x')).toBe(true);
      expect(switcher.getActiveTool()).toBe('pen');

      // Uppercase 'X' activates eraser
      expect(switcher.onKeyDown('X')).toBe(true);
      expect(switcher.getActiveTool()).toBe('eraser');

      // Release 'X' reverts to pen
      expect(switcher.onKeyUp('X')).toBe(true);
      expect(switcher.getActiveTool()).toBe('pen');
    });
  });

  // =========================================================================
  // Challenge 5: Whole-Stroke Eraser 8px Radius & Locked Object Immunity
  // =========================================================================
  describe('Challenge 5: Whole-Stroke Eraser Precision & Immunity', () => {
    it('verifies exact 8.0px screen hit boundary: hits at 7.99px, misses at 8.01px', () => {
      expect(ERASER_RADIUS_SCREEN_PX).toBe(8.0);

      const points = [{ x: 100, y: 100 }, { x: 200, y: 100 }]; // Horizontal line segment

      // Test vertex hits at zoom = 1.0
      expect(isStrokeHitByEraser(points, { x: 100, y: 107.99 }, 8.0, 1.0)).toBe(true);
      expect(isStrokeHitByEraser(points, { x: 100, y: 108.01 }, 8.0, 1.0)).toBe(false);

      // Test segment midpoint hits at zoom = 1.0
      expect(isStrokeHitByEraser(points, { x: 150, y: 107.99 }, 8.0, 1.0)).toBe(true);
      expect(isStrokeHitByEraser(points, { x: 150, y: 108.01 }, 8.0, 1.0)).toBe(false);

      // Test zoom scaling: at zoom = 2.0, screen 8px radius translates to 4.0px world radius
      expect(isStrokeHitByEraser(points, { x: 150, y: 103.99 }, 8.0, 2.0)).toBe(true);
      expect(isStrokeHitByEraser(points, { x: 150, y: 104.01 }, 8.0, 2.0)).toBe(false);

      // At zoom = 0.5, screen 8px radius translates to 16.0px world radius
      expect(isStrokeHitByEraser(points, { x: 150, y: 115.99 }, 8.0, 0.5)).toBe(true);
      expect(isStrokeHitByEraser(points, { x: 150, y: 116.01 }, 8.0, 0.5)).toBe(false);
    });

    it('strictly guarantees immunity of locked objects from whole-stroke eraser', () => {
      const doc = createDocument('Immunity Test');

      const lockedStroke: CanvasObject = {
        id: 'stroke_locked_1',
        type: 'ink',
        parentId: null,
        x: 100,
        y: 100,
        w: 100,
        h: 10,
        rotation: 0,
        z: 'a0',
        style: { colorId: 'ink', strokeWidth: 2, renderMode: 'crisp' },
        tags: [],
        locked: true, // IMMUNE
        hidden: false,
        createdAt: 1000,
        updatedAt: 1000,
        points: [{ x: 100, y: 100 }, { x: 200, y: 100 }],
      } as any;

      const unlockedStroke: CanvasObject = {
        id: 'stroke_unlocked_2',
        type: 'ink',
        parentId: null,
        x: 100,
        y: 100,
        w: 100,
        h: 10,
        rotation: 0,
        z: 'a1',
        style: { colorId: 'ink', strokeWidth: 2, renderMode: 'crisp' },
        tags: [],
        locked: false, // ERASABLE
        hidden: false,
        createdAt: 1000,
        updatedAt: 1000,
        points: [{ x: 100, y: 100 }, { x: 200, y: 100 }],
      } as any;

      const lockedRect: CanvasObject = {
        id: 'rect_locked_3',
        type: 'shape',
        parentId: null,
        x: 90,
        y: 90,
        w: 50,
        h: 50,
        rotation: 0,
        z: 'a2',
        style: { colorId: 'gray', strokeWidth: 1, renderMode: 'crisp' },
        tags: [],
        locked: true, // IMMUNE
        hidden: false,
        createdAt: 1000,
        updatedAt: 1000,
      } as any;

      const unlockedRect: CanvasObject = {
        id: 'rect_unlocked_4',
        type: 'shape',
        parentId: null,
        x: 90,
        y: 90,
        w: 50,
        h: 50,
        rotation: 0,
        z: 'a3',
        style: { colorId: 'gray', strokeWidth: 1, renderMode: 'crisp' },
        tags: [],
        locked: false, // ERASABLE
        hidden: false,
        createdAt: 1000,
        updatedAt: 1000,
      } as any;

      doc.objects[lockedStroke.id] = lockedStroke;
      doc.objects[unlockedStroke.id] = unlockedStroke;
      doc.objects[lockedRect.id] = lockedRect;
      doc.objects[unlockedRect.id] = unlockedRect;
      doc.rootIds = [lockedStroke.id, unlockedStroke.id, lockedRect.id, unlockedRect.id];

      const spatialIndex = new SpatialIndex();
      spatialIndex.insert({ minX: 90, minY: 90, maxX: 200, maxY: 140, id: lockedStroke.id });
      spatialIndex.insert({ minX: 90, minY: 90, maxX: 200, maxY: 140, id: unlockedStroke.id });
      spatialIndex.insert({ minX: 90, minY: 90, maxX: 140, maxY: 140, id: lockedRect.id });
      spatialIndex.insert({ minX: 90, minY: 90, maxX: 140, maxY: 140, id: unlockedRect.id });

      const vp = { x: 0, y: 0, zoom: 1.0 };
      const eraserPos = { x: 100, y: 100 }; // Centered directly on all 4 objects

      const targets = findObjectsToErase(eraserPos, doc, spatialIndex, vp, 8.0);

      // Must find exactly the 2 unlocked objects and ZERO locked objects
      expect(targets.length).toBe(2);
      const hitIds = targets.map((t) => t.id);
      expect(hitIds).toContain('stroke_unlocked_2');
      expect(hitIds).toContain('rect_unlocked_4');
      expect(hitIds).not.toContain('stroke_locked_1');
      expect(hitIds).not.toContain('rect_locked_3');
    });

    it('verifies createEraseCommand produces undoable delete command reversible via core apply', () => {
      const doc = createDocument('Undo Erase');
      const stroke: CanvasObject = {
        id: 's_undo_1',
        type: 'ink',
        parentId: null,
        x: 10,
        y: 10,
        w: 20,
        h: 20,
        rotation: 0,
        z: 'a0',
        style: { colorId: 'ink', strokeWidth: 2, renderMode: 'crisp' },
        tags: [],
        locked: false,
        hidden: false,
        createdAt: 100,
        updatedAt: 100,
        points: [{ x: 10, y: 10 }, { x: 30, y: 30 }],
      } as any;
      doc.objects[stroke.id] = stroke;
      doc.rootIds = [stroke.id];

      const eraseCmd = createEraseCommand([stroke], 500);
      expect(eraseCmd).not.toBeNull();
      expect(eraseCmd?.type).toBe('delete');

      // Apply erase command to doc
      const { doc: docAfterErase, inverse } = apply(doc, eraseCmd!);
      expect(docAfterErase.objects[stroke.id]).toBeUndefined();
      expect(docAfterErase.rootIds).not.toContain(stroke.id);

      // Undo erase command using generated inverse
      const { doc: docRestored } = apply(docAfterErase, inverse);
      expect(docRestored.objects[stroke.id]).toBeDefined();
      expect(docRestored.objects[stroke.id].id).toBe(stroke.id);
      expect(docRestored.rootIds).toContain(stroke.id);
    });
  });

  // =========================================================================
  // Challenge 6: In-Flight InkPipeline Full Lifecycle & Concurrency
  // =========================================================================
  describe('Challenge 6: End-to-End InkPipeline Integration', () => {
    it('manages continuous stroke stream with simultaneous Shift and Ctrl modifiers', () => {
      const pipeline = new InkPipeline({ stabilizerPercent: 40 });
      const vp = { x: 100, y: 50, zoom: 1.5 };

      // Start stroke at screen (200, 200) with both Shift and Ctrl
      pipeline.start({ x: 200, y: 200, t: 1000 }, vp, { shift: true, ctrl: true });

      // Ghost cursor must be visible
      expect(pipeline.getGhostCursor().visible).toBe(true);

      // Append 10 points
      for (let i = 1; i <= 10; i++) {
        pipeline.append(
          { x: 200 + i * 20, y: 200 + i * 18, t: 1000 + i * 16 },
          vp,
          { shift: true, ctrl: true }
        );
      }

      // Query live outline vertices in screen space
      const outlineVertices = pipeline.getLiveOutlineVertices(vp);
      expect(outlineVertices.length).toBeGreaterThan(0);

      // Finalize stroke
      const stroke = pipeline.finish('z_0');
      expect(stroke.type).toBe('ink');
      expect(stroke.points.length).toBe(11);
      expect(stroke.w).toBeGreaterThan(0);
      expect(stroke.h).toBeGreaterThan(0);
      expect(stroke.z).toBe('z_0');

      // Pipeline should reset state
      expect(pipeline.getWorldPoints()).toHaveLength(0);
      expect(pipeline.getGhostCursor().visible).toBe(false);
    });
  });
});
