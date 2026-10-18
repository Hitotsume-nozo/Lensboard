/**
 * Ink Curve Smoothing and Fast Geometric Transforms.
 * Smooths raw, jagged freehand strokes into graceful Bézier/spline curves
 * and detects close geometric primitives (box, diamond, circle, line).
 */

import type { StrokePoint } from '@lensboard/core';

export interface GeometricCandidate {
  kind: 'line' | 'diamond' | 'circle' | 'rect' | 'none';
  label: string;
  confidence: number;
  bounds: { x: number; y: number; w: number; h: number };
}

/**
 * Applies multi-pass Chaikin corner-cutting and Catmull-Rom interpolation
 * to eliminate jitter and squeegee artifacts, producing silky-smooth curves.
 */
export function smoothStrokePoints(
  points: StrokePoint[],
  iterations = 2
): StrokePoint[] {
  if (points.length <= 2) {
    return [...points];
  }

  // 1. Remove micro-jitter points closer than 1.2px
  const deduped: StrokePoint[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = deduped[deduped.length - 1];
    const curr = points[i];
    const dist = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    if (dist >= 1.2 || i === points.length - 1) {
      deduped.push(curr);
    }
  }

  if (deduped.length <= 2) {
    return deduped;
  }

  // 2. Chaikin algorithm for curve refinement
  let current = deduped;
  for (let it = 0; it < iterations; it++) {
    const next: StrokePoint[] = [current[0]];
    for (let i = 0; i < current.length - 1; i++) {
      const p0 = current[i];
      const p1 = current[i + 1];

      // Q = 0.75 * p0 + 0.25 * p1
      const q: StrokePoint = {
        x: 0.75 * p0.x + 0.25 * p1.x,
        y: 0.75 * p0.y + 0.25 * p1.y,
        t: Math.round(0.75 * p0.t + 0.25 * p1.t),
      };

      // R = 0.25 * p0 + 0.75 * p1
      const r: StrokePoint = {
        x: 0.25 * p0.x + 0.75 * p1.x,
        y: 0.25 * p0.y + 0.75 * p1.y,
        t: Math.round(0.25 * p0.t + 0.75 * p1.t),
      };

      next.push(q, r);
    }
    next.push(current[current.length - 1]);
    current = next;
  }

  return current;
}

/**
 * Calculates distance from point P to segment A -> B.
 */
function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Fast Geometric Recognition: classifies stroke points into box, diamond, circle, line.
 */
export function detectPrimitiveFromPoints(points: StrokePoint[]): GeometricCandidate {
  if (points.length < 2) {
    return {
      kind: 'none',
      label: 'Freehand Stroke',
      confidence: 1.0,
      bounds: { x: points[0]?.x ?? 0, y: points[0]?.y ?? 0, w: 10, h: 10 },
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let pathLen = 0;

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
    if (i > 0) {
      pathLen += Math.hypot(pt.x - points[i - 1].x, pt.y - points[i - 1].y);
    }
  }

  const w = Math.max(10, maxX - minX);
  const h = Math.max(10, maxY - minY);
  const bounds = { x: minX, y: minY, w, h };
  const first = points[0];
  const last = points[points.length - 1];
  const chordLen = Math.hypot(last.x - first.x, last.y - first.y);

  // 1. Line Test
  if (chordLen / Math.max(1, pathLen) > 0.85 && pathLen > 15) {
    let maxDeviation = 0;
    for (let i = 1; i < points.length - 1; i++) {
      const d = distToSegment(points[i].x, points[i].y, first.x, first.y, last.x, last.y);
      if (d > maxDeviation) maxDeviation = d;
    }
    if (maxDeviation <= Math.max(14, pathLen * 0.12)) {
      const conf = Math.min(0.98, Math.max(0.75, 1 - maxDeviation / (pathLen * 0.2)));
      return { kind: 'line', label: 'Recognized Line', confidence: conf, bounds };
    }
  }

  // 2. Closed-shape tests
  const isClosed = chordLen <= Math.max(45, (w + h) * 0.32) && points.length >= 6;
  if (isClosed) {
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    // 2a. Circle / Ellipse error
    const radii: number[] = [];
    let sumR = 0;
    for (const p of points) {
      const r = Math.hypot(p.x - cx, p.y - cy);
      radii.push(r);
      sumR += r;
    }
    const meanR = sumR / points.length;
    let varR = 0;
    for (const r of radii) {
      varR += (r - meanR) ** 2;
    }
    const stdR = Math.sqrt(varR / points.length);
    const aspect = Math.min(w, h) / Math.max(w, h);

    // 2b. Diamond test: 4 corners at (cx, minY), (maxX, cy), (cx, maxY), (minX, cy)
    const dCorners = [
      { x: cx, y: minY },
      { x: maxX, y: cy },
      { x: cx, y: maxY },
      { x: minX, y: cy },
    ];
    let diamondDistSum = 0;
    for (const p of points) {
      let minD = Infinity;
      for (let s = 0; s < 4; s++) {
        const nextS = (s + 1) % 4;
        const d = distToSegment(
          p.x,
          p.y,
          dCorners[s].x,
          dCorners[s].y,
          dCorners[nextS].x,
          dCorners[nextS].y
        );
        if (d < minD) minD = d;
      }
      diamondDistSum += minD;
    }
    const avgDiamondDist = diamondDistSum / points.length;

    // 2c. Rectangle / Box test
    const rCorners = [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ];
    let rectDistSum = 0;
    for (const p of points) {
      let minD = Infinity;
      for (let s = 0; s < 4; s++) {
        const nextS = (s + 1) % 4;
        const d = distToSegment(
          p.x,
          p.y,
          rCorners[s].x,
          rCorners[s].y,
          rCorners[nextS].x,
          rCorners[nextS].y
        );
        if (d < minD) minD = d;
      }
      rectDistSum += minD;
    }
    const avgRectDist = rectDistSum / points.length;

    const minDim = Math.min(w, h);
    const circleRelError = aspect >= 0.65 ? stdR / Math.max(1, meanR) : 1.0;
    const diamondRelError = avgDiamondDist / Math.max(1, minDim);
    const rectRelError = avgRectDist / Math.max(1, minDim);

    if (
      diamondRelError < circleRelError &&
      diamondRelError <= rectRelError &&
      diamondRelError <= 0.22
    ) {
      const conf = Math.min(0.96, Math.max(0.72, 1 - diamondRelError * 2.5));
      return { kind: 'diamond', label: 'Recognized Diamond', confidence: conf, bounds };
    }

    if (
      rectRelError < circleRelError &&
      rectRelError < diamondRelError &&
      rectRelError <= 0.22
    ) {
      const conf = Math.min(0.96, Math.max(0.72, 1 - rectRelError * 2.5));
      return { kind: 'rect', label: 'Recognized Box', confidence: conf, bounds };
    }

    if (circleRelError <= 0.12) {
      const conf = Math.min(0.96, Math.max(0.75, 1 - circleRelError * 3));
      return { kind: 'circle', label: 'Recognized Circle', confidence: conf, bounds };
    }
  }

  return {
    kind: 'none',
    label: 'Freehand Curve',
    confidence: 0.90,
    bounds,
  };
}
