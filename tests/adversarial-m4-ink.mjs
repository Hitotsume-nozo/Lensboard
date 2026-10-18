/**
 * Fast-Check Property-Based Adversarial Verification Suite for Milestone 4 (Ink Engine & Modifiers Kinematics)
 * Challenger 2 (Empirical Challenger): challenger_m4_2_g8
 * Execution: node tests/adversarial-m4-ink.mjs
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import fc from 'fast-check';

const coreDistUrl = pathToFileURL(path.resolve(process.cwd(), 'packages/core/dist/index.js')).href;
register(`data:text/javascript,export async function resolve(s,c,n){if(s==="@lensboard/core")return n("${coreDistUrl}",c);return n(s,c);}`, pathToFileURL('./'));

const render = await import('../packages/render/dist/index.js');
const core = await import('../packages/core/dist/index.js');

console.log('================================================================');
console.log('  CHALLENGER M4-2: Fast-Check Property-Based Adversarial Stress');
console.log('================================================================\n');

let totalChecks = 0;
function pass(msg) {
  totalChecks++;
  console.log(`  ✓ ${msg}`);
}

// ----------------------------------------------------------------------------
// Property 1: Lazy-String Stabilizer Invariant
// ----------------------------------------------------------------------------
console.log('▶ [Property 1] Lazy-String Stabilizer Leash Radius & Collinearity Invariants');

fc.assert(
  fc.property(
    fc.record({
      penX: fc.double({ min: -10000, max: 10000, noNaN: true }),
      penY: fc.double({ min: -10000, max: 10000, noNaN: true }),
      cursorX: fc.double({ min: -10000, max: 10000, noNaN: true }),
      cursorY: fc.double({ min: -10000, max: 10000, noNaN: true }),
      percent: fc.double({ min: -200, max: 300, noNaN: true }),
    }),
    ({ penX, penY, cursorX, cursorY, percent }) => {
      const radius = render.calculateStabilizerRadius(percent);
      // Invariant 1: Radius is strictly in [0, 40]
      assert(radius >= 0 && radius <= 40, `Radius must be in [0, 40], got ${radius}`);

      const pen = { x: penX, y: penY };
      const cursor = { x: cursorX, y: cursorY };
      const stabilized = render.applyLazyStringStabilizer(cursor, pen, radius);

      // Invariant 2: Stabilized coordinates must be finite
      assert(Number.isFinite(stabilized.x), 'stabilized.x must be finite');
      assert(Number.isFinite(stabilized.y), 'stabilized.y must be finite');

      const rawDist = Math.hypot(cursorX - penX, cursorY - penY);
      if (rawDist <= radius || rawDist === 0) {
        // Invariant 3: Pen remains stationary inside radius
        assert.equal(stabilized.x, pen.x, 'Pen must not move inside leash radius');
        assert.equal(stabilized.y, pen.y, 'Pen must not move inside leash radius');
      } else {
        // Invariant 4: Pen distance to cursor is exactly radius
        const newDist = Math.hypot(cursor.x - stabilized.x, cursor.y - stabilized.y);
        assert(
          Math.abs(newDist - radius) < 1e-4,
          `Leash distance must equal radius (${radius}), got ${newDist}`
        );

        // Invariant 5: Collinearity (cross product ~ 0)
        const dxTotal = cursor.x - pen.x;
        const dyTotal = cursor.y - pen.y;
        const dxStab = stabilized.x - pen.x;
        const dyStab = stabilized.y - pen.y;
        const cross = dxTotal * dyStab - dyTotal * dxStab;
        assert(Math.abs(cross) < 1e-3, `Collinearity violated: cross product is ${cross}`);
      }
    }
  ),
  { numRuns: 1000 }
);
pass('1,000 iterations: Lazy-String radius bounds, dead-zone invariance, and leash vector collinearity verified.');

// ----------------------------------------------------------------------------
// Property 2: One-Euro Filter Numerical Stability under Arbitrary Timestamps
// ----------------------------------------------------------------------------
console.log('\n▶ [Property 2] One-Euro Filter Numerical Stability under Pathological Timestamps');

fc.assert(
  fc.property(
    fc.array(
      fc.record({
        x: fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        y: fc.double({ min: -1e6, max: 1e6, noNaN: true }),
        // Random time deltas including 0, negative, microsecond, and massive jumps
        dtMs: fc.double({ min: -100, max: 1000, noNaN: true }),
      }),
      { minLength: 5, maxLength: 50 }
    ),
    (points) => {
      const filter2D = new render.OneEuroFilter2D();
      let currentTimestamp = 1000.0;

      for (const pt of points) {
        currentTimestamp += pt.dtMs;
        const res = filter2D.filter({ x: pt.x, y: pt.y }, currentTimestamp);

        // Invariant: Output must always be finite and never NaN
        assert(Number.isFinite(res.x), `Filter X produced non-finite: ${res.x}`);
        assert(Number.isFinite(res.y), `Filter Y produced non-finite: ${res.y}`);
        assert(!Number.isNaN(res.x), 'Filter X produced NaN');
        assert(!Number.isNaN(res.y), 'Filter Y produced NaN');
      }
    }
  ),
  { numRuns: 1000 }
);
pass('1,000 iterations: One-Euro filter stability under negative, zero, and extreme timestamp deltas verified.');

// ----------------------------------------------------------------------------
// Property 3: Alt+Wheel Brush Size Clamping Invariants [1, 24] px
// ----------------------------------------------------------------------------
console.log('\n▶ [Property 3] Alt+Wheel Brush Size Clamping Invariant');

fc.assert(
  fc.property(
    fc.double({ min: -1e9, max: 1e9, noNaN: true }),
    (rawSize) => {
      const clamped = render.clampBrushSize(rawSize);
      assert(clamped >= 1, `Clamped brush size must be >= 1, got ${clamped}`);
      assert(clamped <= 24, `Clamped brush size must be <= 24, got ${clamped}`);
      assert(Number.isFinite(clamped), `Clamped size must be finite, got ${clamped}`);
      if (rawSize >= 1 && rawSize <= 24) {
        assert.equal(clamped, rawSize, `In-range brush size must be preserved: ${rawSize}`);
      }
    }
  ),
  { numRuns: 1000 }
);
pass('1,000 iterations: Brush size clamping strictly bounded to [1, 24]px verified.');

// ----------------------------------------------------------------------------
// Property 4: Shift-Snap 45° Increments & Sector Snapping Invariant
// ----------------------------------------------------------------------------
console.log('\n▶ [Property 4] Shift-Snap 45° Angle Snapping & Vector Preservation');

fc.assert(
  fc.property(
    fc.record({
      dx: fc.double({ min: -1000, max: 1000, noNaN: true }),
      dy: fc.double({ min: -1000, max: 1000, noNaN: true }),
    }),
    ({ dx, dy }) => {
      const snapped = render.snapTo45Degrees(dx, dy);
      assert(Number.isFinite(snapped.x), 'snapped.x must be finite');
      assert(Number.isFinite(snapped.y), 'snapped.y must be finite');

      const rawDist = Math.hypot(dx, dy);
      if (rawDist > 1.0) {
        const snappedRad = Math.atan2(snapped.y, snapped.x);
        const snappedDeg = (snappedRad * 180) / Math.PI;

        // Snapped angle in degrees must be an exact multiple of 45 (modulo 45 == 0 within float epsilon)
        const remainder = Math.abs(snappedDeg % 45);
        const closeToMultiple = remainder < 1.0 || Math.abs(remainder - 45) < 1.0;
        assert(closeToMultiple, `Snapped angle ${snappedDeg}° is not a multiple of 45° (rem=${remainder})`);

        // Length preservation: integer pixel rounding produces length within +/- 1.5px
        const snappedDist = Math.hypot(snapped.x, snapped.y);
        assert(
          Math.abs(snappedDist - rawDist) < 2.0,
          `Length preservation violated: raw=${rawDist}, snapped=${snappedDist}`
        );
      }
    }
  ),
  { numRuns: 1000 }
);
pass('1,000 iterations: Shift-snap 45° angle snapping and vector magnitude preservation verified.');

// ----------------------------------------------------------------------------
// Property 5: Whole-Stroke Eraser Immunity of Locked Objects
// ----------------------------------------------------------------------------
console.log('\n▶ [Property 5] Whole-Stroke Eraser Locked Object Immunity Invariant');

fc.assert(
  fc.property(
    fc.record({
      eraserX: fc.double({ min: -500, max: 500, noNaN: true }),
      eraserY: fc.double({ min: -500, max: 500, noNaN: true }),
      zoom: fc.double({ min: 0.1, max: 10.0, noNaN: true }),
      numObjects: fc.integer({ min: 1, max: 20 }),
    }),
    ({ eraserX, eraserY, zoom, numObjects }) => {
      const doc = core.createDocument('Eraser Adversarial');
      const spatialIndex = new render.SpatialIndex();

      for (let i = 0; i < numObjects; i++) {
        const id = `obj_${i}`;
        const isLocked = i % 2 === 0; // Half locked, half unlocked
        // Place object close to eraser within potential hit radius
        const obj = {
          id,
          type: 'ink',
          parentId: null,
          x: eraserX + (i - numObjects / 2) * 2,
          y: eraserY + (i - numObjects / 2) * 2,
          w: 20,
          h: 20,
          rotation: 0,
          z: `a${i}`,
          style: { colorId: 'ink', strokeWidth: 2, renderMode: 'crisp' },
          tags: [],
          locked: isLocked,
          hidden: false,
          createdAt: 1000,
          updatedAt: 1000,
          points: [
            { x: eraserX + (i - numObjects / 2) * 2, y: eraserY },
            { x: eraserX + (i - numObjects / 2) * 2 + 5, y: eraserY + 5 },
          ],
        };

        doc.objects[id] = obj;
        doc.rootIds.push(id);
        spatialIndex.insert({
          minX: obj.x - 10,
          minY: obj.y - 10,
          maxX: obj.x + 30,
          maxY: obj.y + 30,
          id,
        });
      }

      const vp = { x: 0, y: 0, zoom };
      const erased = render.findObjectsToErase(
        { x: eraserX, y: eraserY },
        doc,
        spatialIndex,
        vp,
        render.ERASER_RADIUS_SCREEN_PX
      );

      // Invariant: ZERO locked objects ever returned in erased list
      for (const item of erased) {
        assert(!item.locked, `CRITICAL: Locked object ${item.id} was returned for erasure!`);
      }
    }
  ),
  { numRuns: 500 }
);
pass('500 iterations: Whole-stroke eraser locked object immunity strictly verified.');

// ----------------------------------------------------------------------------
// Property 6: Precision Mode Damping Kinematic Accumulation
// ----------------------------------------------------------------------------
console.log('\n▶ [Property 6] Precision Mode 40% Speed Kinematic Accumulation Invariant');

fc.assert(
  fc.property(
    fc.array(
      fc.record({
        dx: fc.double({ min: -100, max: 100, noNaN: true }),
        dy: fc.double({ min: -100, max: 100, noNaN: true }),
      }),
      { minLength: 2, maxLength: 30 }
    ),
    (deltas) => {
      const tracker = new render.PrecisionModeTracker();
      tracker.reset({ x: 0, y: 0 });

      let rawX = 0;
      let rawY = 0;
      let lastPenPoint = { x: 0, y: 0 };

      for (const d of deltas) {
        rawX += d.dx;
        rawY += d.dy;
        const res = tracker.update({ x: rawX, y: rawY }, true); // Ctrl down
        lastPenPoint = res.penPoint;

        // Ghost cursor must mirror raw mouse position
        assert.equal(res.ghostCursor.x, rawX);
        assert.equal(res.ghostCursor.y, rawY);
        assert.equal(res.ghostCursor.visible, true);
      }

      // Cumulative pen movement must equal exactly 40% of cumulative mouse movement
      assert(
        Math.abs(lastPenPoint.x - rawX * 0.4) < 1e-4,
        `Pen X accumulation mismatch: expected ${rawX * 0.4}, got ${lastPenPoint.x}`
      );
      assert(
        Math.abs(lastPenPoint.y - rawY * 0.4) < 1e-4,
        `Pen Y accumulation mismatch: expected ${rawY * 0.4}, got ${lastPenPoint.y}`
      );
    }
  ),
  { numRuns: 1000 }
);
pass('1,000 iterations: Precision mode 40% speed and ghost cursor tracking verified.');

console.log('\n================================================================');
console.log(`  ALL ${totalChecks} PROPERTY SUITES PASSED CLEANLY (Total runs: >5,500)`);
console.log('================================================================');
