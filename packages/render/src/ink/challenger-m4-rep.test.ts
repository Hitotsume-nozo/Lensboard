/**
 * Challenger 2 (Replacement) Adversarial Stress & Verification Test Suite for Milestone 4
 * Scope: Ink Engine & Modifier Kinematics
 *
 * Specific verification items:
 * 1. Lazy-String stabilizer radius = percent * 0.4px (0 to 40px) & leash trailing vector
 * 2. One-Euro filter low-pass behavior at low speeds & adaptive cutoff at high speeds
 * 3. One-Euro filter dt=0ms clamp (min 0.0001s) & reverse timestamp robustness
 * 4. perfect-freehand outline with single-point tap dot, uniform width mode, & Alt+wheel size clamping [1, 24]px
 * 5. Shift-snap 45° angle snapping (including boundary at 22.5°) & clean release to freehand
 * 6. Ctrl precision mode 40% speed & ghost cursor rendering
 * 7. Whole-stroke eraser 8px radius & immunity of locked objects
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
  PRECISION_MODE_DAMPING,
  DwellDetector,
  TemporaryToolSwitcher,
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
import type { CanvasObject, StrokeObject } from '@lensboard/core';

describe('Challenger 2 (Replacement) Empirical Suite: Ink Engine & Modifiers Kinematics', () => {
  // =========================================================================
  // Scope Item 1: Lazy-String Stabilizer Radius & Leash Trailing Vector
  // =========================================================================
  describe('1. Lazy-String Stabilizer (Radius Formula & Leash Trailing Vector)', () => {
    it('verifies exact radius formula r = percent * 0.4px across continuous range and bounds', () => {
      // Nominal checks
      expect(calculateStabilizerRadius(0)).toBe(0);
      expect(calculateStabilizerRadius(25)).toBe(10);
      expect(calculateStabilizerRadius(50)).toBe(20);
      expect(calculateStabilizerRadius(75)).toBe(30);
      expect(calculateStabilizerRadius(100)).toBe(40);

      // Fractional percentages
      expect(calculateStabilizerRadius(1.25)).toBeCloseTo(0.5, 6);
      expect(calculateStabilizerRadius(33.333333)).toBeCloseTo(13.3333332, 5);
      expect(calculateStabilizerRadius(87.5)).toBe(35);

      // Boundary clamping: negative and over 100%
      expect(calculateStabilizerRadius(-0.0001)).toBe(0);
      expect(calculateStabilizerRadius(-50)).toBe(0);
      expect(calculateStabilizerRadius(100.0001)).toBe(40);
      expect(calculateStabilizerRadius(200)).toBe(40);
      expect(calculateStabilizerRadius(Infinity)).toBe(40);
      expect(calculateStabilizerRadius(-Infinity)).toBe(0);
    });

    it('verifies deadband: pen remains stationary when cursor distance <= radius', () => {
      const pen = { x: 150, y: 250 };
      const radius = 20;

      // Inside circle at varying distances: 0, 5, 10, 19.99
      const testDistances = [0, 0.001, 5, 10, 15, 19.99];
      for (const d of testDistances) {
        for (let a = 0; a < 360; a += 30) {
          const rad = (a * Math.PI) / 180;
          const cursor = {
            x: pen.x + d * Math.cos(rad),
            y: pen.y + d * Math.sin(rad),
          };
          const stabilized = applyLazyStringStabilizer(cursor, pen, radius);
          expect(stabilized.x).toBe(pen.x);
          expect(stabilized.y).toBe(pen.y);
        }
      }

      // Exact boundary tests (dist == radius) using exact integer Pythagorean triples and cardinal axes
      // 12^2 + 16^2 = 400 = 20^2 (exact floating point equality)
      const exactBoundaryOffsets = [
        { dx: 20, dy: 0 },
        { dx: -20, dy: 0 },
        { dx: 0, dy: 20 },
        { dx: 0, dy: -20 },
        { dx: 12, dy: 16 },
        { dx: -12, dy: 16 },
        { dx: 16, dy: -12 },
        { dx: -16, dy: -12 },
      ];
      for (const offset of exactBoundaryOffsets) {
        const cursor = { x: pen.x + offset.dx, y: pen.y + offset.dy };
        const stabilized = applyLazyStringStabilizer(cursor, pen, radius);
        expect(stabilized.x).toBe(pen.x);
        expect(stabilized.y).toBe(pen.y);
      }
    });

    it('verifies leash trailing vector geometry: new distance strictly equals radius and is collinear', () => {
      const pen = { x: 300, y: -400 };
      const radius = 16.0;

      // Test cursor in 72 radial directions at various distances exceeding radius
      for (let angleDeg = 0; angleDeg < 360; angleDeg += 5) {
        const rad = (angleDeg * Math.PI) / 180;
        const dists = [16.001, 20, 50, 100, 500];

        for (const dist of dists) {
          const cursor = {
            x: pen.x + dist * Math.cos(rad),
            y: pen.y + dist * Math.sin(rad),
          };

          const stabilized = applyLazyStringStabilizer(cursor, pen, radius);

          // 1. Distance between stabilized pen and cursor MUST equal radius exactly
          const actualDistToCursor = Math.hypot(cursor.x - stabilized.x, cursor.y - stabilized.y);
          expect(actualDistToCursor).toBeCloseTo(radius, 5);

          // 2. Collinearity: stabilized pen must lie on line segment from pen to cursor
          const dPenCursor = { x: cursor.x - pen.x, y: cursor.y - pen.y };
          const dPenStab = { x: stabilized.x - pen.x, y: stabilized.y - pen.y };
          const crossProduct = dPenCursor.x * dPenStab.y - dPenCursor.y * dPenStab.x;
          expect(Math.abs(crossProduct)).toBeLessThan(1e-7);

          // 3. Traveled distance by pen must equal (dist - radius)
          const penTravel = Math.hypot(dPenStab.x, dPenStab.y);
          expect(penTravel).toBeCloseTo(dist - radius, 5);
        }
      }
    });

    it('verifies 180-degree directional reversal deadband in stateful LazyStringStabilizer', () => {
      const stabilizer = new LazyStringStabilizer(50); // radius = 20px
      stabilizer.reset({ x: 0, y: 0 });

      // Move right 100px: pen follows at (80, 0)
      const p1 = stabilizer.update({ x: 100, y: 0 });
      expect(p1.x).toBe(80);
      expect(p1.y).toBe(0);

      // Now reverse direction and move left by 10px (cursor at 90, 0).
      // Distance from pen (80, 0) to cursor (90, 0) is 10px <= 20px. Pen stays at 80!
      const p2 = stabilizer.update({ x: 90, y: 0 });
      expect(p2.x).toBe(80);

      // Move left further: cursor at 70, 0. Distance from pen (80, 0) is 10px <= 20px. Pen stays at 80!
      const p3 = stabilizer.update({ x: 70, y: 0 });
      expect(p3.x).toBe(80);

      // Move left to cursor at 60, 0: distance is exactly 20px (full slack taken up = 2*r from 100 to 60).
      const p4 = stabilizer.update({ x: 60, y: 0 });
      expect(p4.x).toBe(80);

      // Moving to 59, 0 exceeds the 20px radius on the left: pen now trails to 59 + 20 = 79!
      const p5 = stabilizer.update({ x: 59, y: 0 });
      expect(p5.x).toBe(79);
    });

    it('verifies stabilizer with radius 0 tracks cursor instantaneously', () => {
      const stabilizer = new LazyStringStabilizer(0);
      stabilizer.reset({ x: 10, y: 20 });

      const p1 = stabilizer.update({ x: 15.5, y: 22.3 });
      expect(p1.x).toBe(15.5);
      expect(p1.y).toBe(22.3);
    });
  });

  // =========================================================================
  // Scope Item 2: One-Euro Filter Low-Pass at Low Speed & Adaptive Cutoff
  // =========================================================================
  describe('2. One-Euro Filter (Low-Pass Behavior & Adaptive Cutoff)', () => {
    it('verifies default filter parameters: minCutoff = 1.0Hz, beta = 0.007, dCutoff = 1.0Hz', () => {
      expect(DEFAULT_MIN_CUTOFF).toBe(1.0);
      expect(DEFAULT_BETA).toBe(0.007);
      expect(DEFAULT_D_CUTOFF).toBe(1.0);
    });

    it('empirically verifies low-pass jitter reduction at low speeds (>60% reduction)', () => {
      const filter = new OneEuroFilter(1.0, 0.007, 1.0);
      let t = 1000;
      const baseSignal = 50.0;
      filter.filter(baseSignal, t);

      let totalRawVariance = 0;
      let totalFilteredVariance = 0;
      const sampleCount = 60;

      for (let i = 1; i <= sampleCount; i++) {
        t += 16; // 60fps sampling
        const noise = (Math.sin(i * 1.5) > 0 ? 1 : -1) * 3.0; // +/- 3px jitter
        const raw = baseSignal + noise;
        const filtered = filter.filter(raw, t);

        totalRawVariance += Math.pow(raw - baseSignal, 2);
        totalFilteredVariance += Math.pow(filtered - baseSignal, 2);
      }

      // Variance of filtered signal should be reduced by more than 60% compared to raw noise
      const varianceRatio = totalFilteredVariance / totalRawVariance;
      expect(varianceRatio).toBeLessThan(0.40); // >60% attenuation
    });

    it('empirically verifies adaptive cutoff tracks high speed motions with lag < 1 frame', () => {
      const filter = new OneEuroFilter(1.0, 0.007, 1.0);
      let t = 1000;
      let pos = 0;
      filter.filter(pos, t);

      // High speed motion: 150px per 16ms frame (~9375 px/s)
      const frameDelta = 150;
      let lastFiltered = 0;
      for (let frame = 1; frame <= 15; frame++) {
        t += 16;
        pos += frameDelta;
        lastFiltered = filter.filter(pos, t);
      }

      // Lag should be less than one full frame delta (< 150px)
      const lag = pos - lastFiltered;
      expect(lag).toBeLessThan(frameDelta);
      expect(lastFiltered).toBeGreaterThan(pos - frameDelta);
    });
  });

  // =========================================================================
  // Scope Item 3: One-Euro Filter dt=0ms Clamp & Reverse Timestamp Robustness
  // =========================================================================
  describe('3. One-Euro Filter (dt=0ms Clamp & Reverse Timestamp Robustness)', () => {
    it('verifies safe dt clamping to minimum 0.0001s when dt=0ms (same timestamp repeated)', () => {
      const filter = new OneEuroFilter();
      filter.filter(100, 1000);

      // Run multiple iterations with exactly dt = 0ms
      for (let i = 0; i < 20; i++) {
        const val = filter.filter(100 + i * 2, 1000);
        expect(Number.isFinite(val)).toBe(true);
        expect(Number.isNaN(val)).toBe(false);
      }
    });

    it('verifies reverse timestamp sequence does not cause NaN, Infinity, or state corruption', () => {
      const filter = new OneEuroFilter();
      filter.filter(100, 5000);

      // Reverse timestamps (decreasing)
      const reverseSeries = [4900, 4800, 4000, 2000, 1000, 0, -100];
      for (const t of reverseSeries) {
        const val = filter.filter(105, t);
        expect(Number.isFinite(val)).toBe(true);
        expect(Number.isNaN(val)).toBe(false);
      }

      // Resume forward timestamps
      const valFwd = filter.filter(120, 6000);
      expect(Number.isFinite(valFwd)).toBe(true);
      expect(valFwd).toBeGreaterThan(100);
    });

    it('verifies 2D filter processes simultaneous x and y with temporal robustness', () => {
      const filter2D = new OneEuroFilter2D();
      filter2D.filter({ x: 10, y: 20 }, 1000);

      // Repeated timestamp on 2D
      const sameTime = filter2D.filter({ x: 15, y: 25 }, 1000);
      expect(Number.isFinite(sameTime.x)).toBe(true);
      expect(Number.isFinite(sameTime.y)).toBe(true);

      // Backwards timestamp on 2D
      const backTime = filter2D.filter({ x: 20, y: 30 }, 500);
      expect(Number.isFinite(backTime.x)).toBe(true);
      expect(Number.isFinite(backTime.y)).toBe(true);
    });
  });

  // =========================================================================
  // Scope Item 4: perfect-freehand Outline, Single-Point Tap & Size Clamping
  // =========================================================================
  describe('4. Dynamic Outline & perfect-freehand (Single-Point Tap, Uniform Mode, Size Clamping)', () => {
    it('verifies single-point tap dot generates a 16-segment circular outline with radius = size / 2', () => {
      const tapPoint = { x: 200, y: 150 };
      const sizesToTest = [1, 2, 4, 10, 24];

      for (const size of sizesToTest) {
        const outline = generateStrokeOutline([tapPoint], {
          ...DEFAULT_BRUSH_OPTIONS,
          size,
        });

        // 16 vertices in closed circular polygon
        expect(outline.length).toBe(16);

        const expectedRadius = size / 2;
        for (const [vx, vy] of outline) {
          const dist = Math.hypot(vx - tapPoint.x, vy - tapPoint.y);
          expect(dist).toBeCloseTo(expectedRadius, 2);
        }

        // Centroid of outline vertices matches tap coordinates
        const avgX = outline.reduce((sum, p) => sum + p[0], 0) / outline.length;
        const avgY = outline.reduce((sum, p) => sum + p[1], 0) / outline.length;
        expect(avgX).toBeCloseTo(tapPoint.x, 2);
        expect(avgY).toBeCloseTo(tapPoint.y, 2);
      }
    });

    it('verifies Alt+wheel brush size clamping strictly to [1, 24]px', () => {
      // Under minimum (< 1)
      expect(clampBrushSize(-100)).toBe(1);
      expect(clampBrushSize(0)).toBe(1);
      expect(clampBrushSize(0.5)).toBe(1);
      expect(clampBrushSize(0.999)).toBe(1);

      // Within [1, 24]
      expect(clampBrushSize(1)).toBe(1);
      expect(clampBrushSize(3)).toBe(3);
      expect(clampBrushSize(12.75)).toBe(12.75);
      expect(clampBrushSize(24)).toBe(24);

      // Over maximum (> 24)
      expect(clampBrushSize(24.001)).toBe(24);
      expect(clampBrushSize(50)).toBe(24);
      expect(clampBrushSize(1000)).toBe(24);
      expect(clampBrushSize(Infinity)).toBe(24);
      expect(clampBrushSize(-Infinity)).toBe(1);
    });

    it('verifies uniform width mode disables thinning, tapers, and pressure simulation', () => {
      expect(UNIFORM_BRUSH_OPTIONS.thinning).toBe(0);
      expect(UNIFORM_BRUSH_OPTIONS.startTaper).toBe(0);
      expect(UNIFORM_BRUSH_OPTIONS.endTaper).toBe(0);
      expect(UNIFORM_BRUSH_OPTIONS.simulatePressure).toBe(false);

      const pts = [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 300, y: 100 },
      ];

      const outline = generateStrokeOutline(pts, {
        ...UNIFORM_BRUSH_OPTIONS,
        size: 8,
      });

      expect(outline.length).toBeGreaterThan(0);
      const svgPath = getSvgPathFromStroke(outline);
      expect(svgPath).toContain('M');
      expect(svgPath).toContain('Z');
    });

    it('verifies duplicate points do not break outline generation', () => {
      const dupPoints = [
        { x: 50, y: 50 },
        { x: 50, y: 50 },
        { x: 60, y: 60 },
      ];
      const outline = generateStrokeOutline(dupPoints);
      expect(outline.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Scope Item 5: Shift-Snap 45° Snapping & Clean Release to Freehand
  // =========================================================================
  describe('5. Shift-Snap 45° Snapping (Boundary at 22.5° & Clean Freehand Release)', () => {
    it('verifies snapping to nearest 45° angle across all quadrants', () => {
      const directions = [
        { deg: 0, expected: 0 },
        { deg: 30, expected: 45 },
        { deg: 45, expected: 45 },
        { deg: 60, expected: 45 },
        { deg: 90, expected: 90 },
        { deg: 120, expected: 135 },
        { deg: 135, expected: 135 },
        { deg: 180, expected: 180 },
        { deg: -45, expected: -45 },
        { deg: -90, expected: -90 },
      ];

      const len = 100;
      for (const { deg, expected } of directions) {
        const rad = (deg * Math.PI) / 180;
        const dx = len * Math.cos(rad);
        const dy = len * Math.sin(rad);

        const snapped = snapTo45Degrees(dx, dy);
        const snappedDeg = Math.round((Math.atan2(snapped.y, snapped.x) * 180) / Math.PI);
        const normalizedActual = snappedDeg === -180 ? 180 : snappedDeg;
        expect(normalizedActual).toBe(expected);
      }
    });

    it('verifies 22.5° boundary behavior (22.49° snaps to 0°, 22.51° snaps to 45°)', () => {
      const len = 100;

      // Below 22.5°: 22.49° snaps to 0°
      const radLow = (22.49 * Math.PI) / 180;
      const snapLow = snapTo45Degrees(len * Math.cos(radLow), len * Math.sin(radLow));
      const degLow = Math.round((Math.atan2(snapLow.y, snapLow.x) * 180) / Math.PI);
      expect(degLow).toBe(0);

      // Above 22.5°: 22.51° snaps to 45°
      const radHigh = (22.51 * Math.PI) / 180;
      const snapHigh = snapTo45Degrees(len * Math.cos(radHigh), len * Math.sin(radHigh));
      const degHigh = Math.round((Math.atan2(snapHigh.y, snapHigh.x) * 180) / Math.PI);
      expect(degHigh).toBe(45);

      // Exactly 22.5° (pi / 8): Math.round(0.5) in JS yields 1, meaning 45°
      const radExact = (22.5 * Math.PI) / 180;
      const snapExact = snapTo45Degrees(len * Math.cos(radExact), len * Math.sin(radExact));
      const degExact = Math.round((Math.atan2(snapExact.y, snapExact.x) * 180) / Math.PI);
      expect([0, 45]).toContain(degExact);
    });

    it('verifies clean release from Shift-snap to freehand during live InkPipeline drafting', () => {
      const pipeline = new InkPipeline();
      const vp = { x: 0, y: 0, zoom: 1.0 };

      // Start stroke with Shift held at (100, 100)
      pipeline.start({ x: 100, y: 100, t: 1000 }, vp, { shift: true });

      // Append points with Shift: movement along ~35° snaps to 45° line
      pipeline.append({ x: 150, y: 135, t: 1016 }, vp, { shift: true });
      pipeline.append({ x: 200, y: 170, t: 1032 }, vp, { shift: true });

      const pointsSnapped = pipeline.getWorldPoints();
      expect(pointsSnapped.length).toBe(3);
      // Snapped: dx should approximately equal dy
      const lastSnapped = pointsSnapped[2];
      expect(Math.abs(lastSnapped.x - 100)).toBeCloseTo(Math.abs(lastSnapped.y - 100), 0);

      // Release Shift (shift: false) and move horizontally to (350, 170)
      pipeline.append({ x: 275, y: 170, t: 1048 }, vp, { shift: false });
      pipeline.append({ x: 350, y: 170, t: 1064 }, vp, { shift: false });

      const allPoints = pipeline.getWorldPoints();
      expect(allPoints.length).toBe(5);

      // The 5th point should NOT be snapped to the 45° line from anchor (100, 100)
      const freePoint = allPoints[4];
      const dxFromAnchor = freePoint.x - 100;
      const dyFromAnchor = freePoint.y - 100;
      // dx is ~250, dy is ~70 -> clearly not 45°!
      expect(Math.abs(dxFromAnchor - dyFromAnchor)).toBeGreaterThan(100);
    });

    it('verifies pure applyShiftSnap computes snapped coordinates relative to anchor', () => {
      const anchor = { x: 50, y: 50 };
      const current = { x: 150, y: 140 }; // ~42° -> snaps to 45°
      const snapped = applyShiftSnap(anchor, current);
      const dx = snapped.x - anchor.x;
      const dy = snapped.y - anchor.y;
      expect(Math.abs(dx)).toBeCloseTo(Math.abs(dy), 0);
    });
  });

  // =========================================================================
  // Scope Item 6: Ctrl Precision Mode 40% Speed & Ghost Cursor
  // =========================================================================
  describe('6. Ctrl Precision Mode (40% Speed Damping & Ghost Cursor)', () => {
    it('verifies precision mode dampens movement delta by exactly 40% (factor 0.4)', () => {
      expect(PRECISION_MODE_DAMPING).toBe(0.4);

      const delta = { dx: 150, dy: -250 };
      const damped = applyPrecisionModifier(delta, true);
      expect(damped.dx).toBe(60); // 150 * 0.4
      expect(damped.dy).toBe(-100); // -250 * 0.4

      const undamped = applyPrecisionModifier(delta, false);
      expect(undamped.dx).toBe(150);
      expect(undamped.dy).toBe(-250);
    });

    it('verifies PrecisionModeTracker coordinates pen point and ghost cursor visibility', () => {
      const tracker = new PrecisionModeTracker();
      tracker.reset({ x: 100, y: 100 });

      // Move mouse by (100, 200) with Ctrl pressed
      const resCtrl = tracker.update({ x: 200, y: 300 }, true);

      // Virtual pen moves 40%: dx = 40, dy = 80 -> pen at (140, 180)
      expect(resCtrl.penPoint.x).toBe(140);
      expect(resCtrl.penPoint.y).toBe(180);

      // Ghost cursor reflects physical mouse position with visible = true
      expect(resCtrl.ghostCursor.x).toBe(200);
      expect(resCtrl.ghostCursor.y).toBe(300);
      expect(resCtrl.ghostCursor.visible).toBe(true);

      // Release Ctrl and move mouse by (50, 50) to (250, 350)
      const resNormal = tracker.update({ x: 250, y: 350 }, false);

      // Virtual pen moves 100%: dx = 50, dy = 50 -> pen at (190, 230)
      expect(resNormal.penPoint.x).toBe(190);
      expect(resNormal.penPoint.y).toBe(230);

      // Ghost cursor visible = false
      expect(resNormal.ghostCursor.visible).toBe(false);
    });

    it('verifies InkPipeline exposes ghost cursor accurately during active drafting', () => {
      const pipeline = new InkPipeline();
      const vp = { x: 0, y: 0, zoom: 1.0 };

      pipeline.start({ x: 50, y: 50, t: 1000 }, vp, { ctrl: true });
      expect(pipeline.getGhostCursor().visible).toBe(true);

      pipeline.append({ x: 80, y: 90, t: 1016 }, vp, { ctrl: true });
      expect(pipeline.getGhostCursor().x).toBe(80);
      expect(pipeline.getGhostCursor().y).toBe(90);
      expect(pipeline.getGhostCursor().visible).toBe(true);

      pipeline.append({ x: 100, y: 100, t: 1032 }, vp, { ctrl: false });
      expect(pipeline.getGhostCursor().visible).toBe(false);
    });

    it('verifies DwellDetector triggers on <3px movement for >=350ms and resets on >=3px', () => {
      let dwells = 0;
      const detector = new DwellDetector(() => { dwells++; });

      detector.onPointerDown({ x: 100, y: 100 }, 1000);

      // Micro move 1px after 200ms (< 350ms)
      detector.onPointerMove({ x: 101, y: 100 }, 1200);
      expect(dwells).toBe(0);

      // Move 2px after 400ms (>= 350ms)
      detector.onPointerMove({ x: 102, y: 100 }, 1400);
      expect(dwells).toBe(1);

      // Movement >= 3px resets
      detector.onPointerMove({ x: 110, y: 100 }, 1410);
      expect(detector.isTriggered()).toBe(false);
    });

    it('verifies TemporaryToolSwitcher hold-to-erase toggle behavior', () => {
      const switcher = new TemporaryToolSwitcher('pen');
      expect(switcher.getActiveTool()).toBe('pen');

      switcher.onKeyDown('x');
      expect(switcher.getActiveTool()).toBe('eraser');

      switcher.onKeyUp('x');
      expect(switcher.getActiveTool()).toBe('pen');
    });
  });

  // =========================================================================
  // Scope Item 7: Whole-Stroke Eraser 8px Radius & Locked Object Immunity
  // =========================================================================
  describe('7. Whole-Stroke Eraser (8px Screen Radius & Locked Object Immunity)', () => {
    it('verifies exact 8.0px screen hit radius: hits at 7.99px and misses at 8.01px', () => {
      expect(ERASER_RADIUS_SCREEN_PX).toBe(8.0);

      const segment = [{ x: 50, y: 50 }, { x: 150, y: 50 }];

      // At zoom 1.0: 8px screen == 8px world
      expect(isStrokeHitByEraser(segment, { x: 100, y: 57.99 }, 8.0, 1.0)).toBe(true);
      expect(isStrokeHitByEraser(segment, { x: 100, y: 58.01 }, 8.0, 1.0)).toBe(false);

      // At zoom 2.0: 8px screen == 4px world
      expect(isStrokeHitByEraser(segment, { x: 100, y: 53.99 }, 8.0, 2.0)).toBe(true);
      expect(isStrokeHitByEraser(segment, { x: 100, y: 54.01 }, 8.0, 2.0)).toBe(false);

      // At zoom 0.5: 8px screen == 16px world
      expect(isStrokeHitByEraser(segment, { x: 100, y: 65.99 }, 8.0, 0.5)).toBe(true);
      expect(isStrokeHitByEraser(segment, { x: 100, y: 66.01 }, 8.0, 0.5)).toBe(false);
    });

    it('verifies whole-stroke eraser with 0px radius hits nothing', () => {
      const segment = [{ x: 0, y: 0 }, { x: 10, y: 10 }];
      expect(isStrokeHitByEraser(segment, { x: 0, y: 0 }, 0, 1.0)).toBe(false);
    });

    it('strictly guarantees immunity of locked objects from whole-stroke eraser', () => {
      const doc = createDocument('Eraser Immunity Verification');

      const lockedStroke: CanvasObject = {
        id: 'stroke_locked',
        type: 'ink',
        parentId: null,
        x: 100,
        y: 100,
        w: 50,
        h: 2,
        rotation: 0,
        z: 'a0',
        style: { colorId: 'ink', strokeWidth: 2, renderMode: 'crisp' },
        tags: [],
        locked: true, // IMMUNE!
        hidden: false,
        createdAt: 1000,
        updatedAt: 1000,
        points: [{ x: 100, y: 100 }, { x: 150, y: 100 }],
      } as any;

      const unlockedStroke: CanvasObject = {
        id: 'stroke_unlocked',
        type: 'ink',
        parentId: null,
        x: 100,
        y: 100,
        w: 50,
        h: 2,
        rotation: 0,
        z: 'a1',
        style: { colorId: 'ink', strokeWidth: 2, renderMode: 'crisp' },
        tags: [],
        locked: false, // Erase candidate
        hidden: false,
        createdAt: 1000,
        updatedAt: 1000,
        points: [{ x: 100, y: 100 }, { x: 150, y: 100 }],
      } as any;

      const lockedShape: CanvasObject = {
        id: 'shape_locked',
        type: 'shape',
        parentId: null,
        x: 95,
        y: 95,
        w: 60,
        h: 60,
        rotation: 0,
        z: 'a2',
        style: { colorId: 'gray', strokeWidth: 1, renderMode: 'crisp' },
        tags: [],
        locked: true, // IMMUNE!
        hidden: false,
        createdAt: 1000,
        updatedAt: 1000,
      } as any;

      const unlockedShape: CanvasObject = {
        id: 'shape_unlocked',
        type: 'shape',
        parentId: null,
        x: 95,
        y: 95,
        w: 60,
        h: 60,
        rotation: 0,
        z: 'a3',
        style: { colorId: 'gray', strokeWidth: 1, renderMode: 'crisp' },
        tags: [],
        locked: false, // Erase candidate
        hidden: false,
        createdAt: 1000,
        updatedAt: 1000,
      } as any;

      doc.objects[lockedStroke.id] = lockedStroke;
      doc.objects[unlockedStroke.id] = unlockedStroke;
      doc.objects[lockedShape.id] = lockedShape;
      doc.objects[unlockedShape.id] = unlockedShape;
      doc.rootIds = [lockedStroke.id, unlockedStroke.id, lockedShape.id, unlockedShape.id];

      const spatialIndex = new SpatialIndex();
      spatialIndex.insert({ minX: 95, minY: 95, maxX: 155, maxY: 155, id: lockedStroke.id });
      spatialIndex.insert({ minX: 95, minY: 95, maxX: 155, maxY: 155, id: unlockedStroke.id });
      spatialIndex.insert({ minX: 95, minY: 95, maxX: 155, maxY: 155, id: lockedShape.id });
      spatialIndex.insert({ minX: 95, minY: 95, maxX: 155, maxY: 155, id: unlockedShape.id });

      const vp = { x: 0, y: 0, zoom: 1.0 };
      const eraserPos = { x: 120, y: 100 }; // Placed directly over all 4 objects

      const erased = findObjectsToErase(eraserPos, doc, spatialIndex, vp, 8.0);

      // Must find exactly the 2 unlocked objects and ZERO locked objects
      expect(erased.length).toBe(2);
      const erasedIds = erased.map((o) => o.id);
      expect(erasedIds).toContain('stroke_unlocked');
      expect(erasedIds).toContain('shape_unlocked');
      expect(erasedIds).not.toContain('stroke_locked');
      expect(erasedIds).not.toContain('shape_locked');
    });

    it('verifies createEraseCommand produces undoable delete command fully reversible via core apply', () => {
      const doc = createDocument('Reversible Eraser Test');
      const strokeObj: StrokeObject = {
        id: 's_target_erase',
        type: 'ink',
        parentId: null,
        x: 100,
        y: 100,
        w: 40,
        h: 40,
        rotation: 0,
        z: 'a0',
        style: { colorId: 'ink', strokeWidth: 3, renderMode: 'crisp' },
        tags: [],
        locked: false,
        hidden: false,
        createdAt: 1000,
        updatedAt: 1000,
        points: [{ x: 100, y: 100, t: 1000 }, { x: 140, y: 140, t: 1016 }],
      };
      doc.objects[strokeObj.id] = strokeObj;
      doc.rootIds = [strokeObj.id];

      const cmd = createEraseCommand([strokeObj]);
      expect(cmd).not.toBeNull();
      expect(cmd?.type).toBe('delete');

      // Forward apply
      const { doc: docDeleted, inverse } = apply(doc, cmd!);
      expect(docDeleted.objects[strokeObj.id]).toBeUndefined();
      expect(docDeleted.rootIds).not.toContain(strokeObj.id);

      // Reverse apply (undo)
      const { doc: docRestored } = apply(docDeleted, inverse);
      expect(docRestored.objects[strokeObj.id]).toBeDefined();
      expect(docRestored.objects[strokeObj.id].id).toBe(strokeObj.id);
      expect(docRestored.rootIds).toContain(strokeObj.id);
    });
  });
});
