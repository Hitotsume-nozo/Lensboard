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
 * Resamples a stroke to `targetCount` uniformly spaced points along its arc length.
 * Uniform spatial sampling is required before running a spatial FFT.
 */
function resampleUniformArcLength(points: StrokePoint[], targetCount: number): StrokePoint[] {
  if (points.length <= 2 || targetCount <= 2) return [...points];

  const cumDist = new Float64Array(points.length);
  cumDist[0] = 0;
  for (let i = 1; i < points.length; i++) {
    cumDist[i] =
      cumDist[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }

  const totalLength = cumDist[points.length - 1];
  if (totalLength < 1e-3) return [...points];

  const step = totalLength / (targetCount - 1);
  const resampled: StrokePoint[] = [{ ...points[0] }];
  let segIdx = 0;

  for (let i = 1; i < targetCount - 1; i++) {
    const targetD = i * step;
    while (segIdx < points.length - 2 && cumDist[segIdx + 1] < targetD) {
      segIdx++;
    }
    const segLen = cumDist[segIdx + 1] - cumDist[segIdx];
    const alpha = segLen > 0 ? (targetD - cumDist[segIdx]) / segLen : 0;
    const p0 = points[segIdx];
    const p1 = points[segIdx + 1];
    resampled.push({
      x: p0.x + alpha * (p1.x - p0.x),
      y: p0.y + alpha * (p1.y - p0.y),
      t: Math.round(p0.t + alpha * (p1.t - p0.t)),
    });
  }

  resampled.push({ ...points[points.length - 1] });
  return resampled;
}

/**
 * In-place Radix-2 Cooley-Tukey FFT / IFFT on complex arrays (re + i*im).
 */
function fftRadix2(re: Float64Array, im: Float64Array, invert: boolean): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1;
    const angle = ((2 * Math.PI) / len) * (invert ? 1 : -1);
    const wlenRe = Math.cos(angle);
    const wlenIm = Math.sin(angle);

    for (let i = 0; i < n; i += len) {
      let wRe = 1;
      let wIm = 0;
      for (let j = 0; j < halfLen; j++) {
        const uRe = re[i + j];
        const uIm = im[i + j];
        const vRe = re[i + j + halfLen] * wRe - im[i + j + halfLen] * wIm;
        const vIm = re[i + j + halfLen] * wIm + im[i + j + halfLen] * wRe;

        re[i + j] = uRe + vRe;
        im[i + j] = uIm + vIm;
        re[i + j + halfLen] = uRe - vRe;
        im[i + j + halfLen] = uIm - vIm;

        const nextWRe = wRe * wlenRe - wIm * wlenIm;
        wIm = wRe * wlenIm + wIm * wlenRe;
        wRe = nextWRe;
      }
    }
  }

  if (invert) {
    for (let i = 0; i < n; i++) {
      re[i] /= n;
      im[i] /= n;
    }
  }
}

/**
 * Smooths a 2D stroke in the frequency domain using a Mirror-Padded Complex FFT
 * with a Gaussian low-pass roll-off window.
 */
export function smoothStrokePointsFFT(
  points: StrokePoint[],
  cutoffRatio = 0.16
): StrokePoint[] {
  if (points.length <= 3) {
    return [...points];
  }

  const minSamples = Math.max(32, points.length * 2);
  const M = Math.min(512, Math.pow(2, Math.ceil(Math.log2(minSamples))));
  const uniform = resampleUniformArcLength(points, M);

  // Mirror-pad to N = 2*M to eliminate periodic boundary discontinuity
  const N = M * 2;
  const re = new Float64Array(N);
  const im = new Float64Array(N);

  for (let i = 0; i < M; i++) {
    re[i] = uniform[i].x;
    im[i] = uniform[i].y;
    re[N - 1 - i] = uniform[i].x;
    im[N - 1 - i] = uniform[i].y;
  }

  fftRadix2(re, im, false);

  const clampedCutoff = Math.max(0.05, Math.min(0.5, cutoffRatio));
  const sigma = Math.max(2, (N / 2) * clampedCutoff);
  for (let k = 1; k < N; k++) {
    const freq = k <= N / 2 ? k : N - k;
    const weight = Math.exp(-0.5 * (freq / sigma) * (freq / sigma));
    re[k] *= weight;
    im[k] *= weight;
  }

  fftRadix2(re, im, true);

  const result: StrokePoint[] = new Array(M);
  for (let i = 0; i < M; i++) {
    result[i] = {
      x: re[i],
      y: im[i],
      t: uniform[i].t,
    };
  }
  result[0] = { ...points[0] };
  result[M - 1] = { ...points[points.length - 1] };

  return result;
}

/**
 * Applies micro-jitter deduplication, Mirrored Complex FFT low-pass filtering,
 * and Chaikin refinement to eliminate hand shake and produce uniform curves.
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

  // 2. Run FFT spectral low-pass smoothing when stroke has >= 4 points
  if (deduped.length >= 4) {
    const cutoff = iterations >= 3 ? 0.12 : iterations === 2 ? 0.16 : 0.24;
    return smoothStrokePointsFFT(deduped, cutoff);
  }

  // 3. Fallback Chaikin for 3-point short segments
  let current = deduped;
  for (let it = 0; it < iterations; it++) {
    const next: StrokePoint[] = [current[0]];
    for (let i = 0; i < current.length - 1; i++) {
      const p0 = current[i];
      const p1 = current[i + 1];
      next.push(
        {
          x: 0.75 * p0.x + 0.25 * p1.x,
          y: 0.75 * p0.y + 0.25 * p1.y,
          t: Math.round(0.75 * p0.t + 0.25 * p1.t),
        },
        {
          x: 0.25 * p0.x + 0.75 * p1.x,
          y: 0.25 * p0.y + 0.75 * p1.y,
          t: Math.round(0.25 * p0.t + 0.75 * p1.t),
        }
      );
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
