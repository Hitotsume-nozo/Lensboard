/**
 * One-Euro Low-Pass Filter.
 * Authoritative: Spec §9.
 * - Dynamic adaptive cutoff: fc = minCutoff + beta * |dx/dt|
 * - Default parameters: minCutoff = 1.0 Hz, beta = 0.007, dCutoff = 1.0 Hz
 * - Safe dt clamp: minimum 0.0001s (prevents divide-by-zero on dt=0 or backwards timestamps)
 */

import type { Point, TimedPoint } from '../types.js';

export const DEFAULT_MIN_CUTOFF = 1.0;
export const DEFAULT_BETA = 0.007;
export const DEFAULT_D_CUTOFF = 1.0;

/**
 * 1-Dimensional One-Euro Filter.
 */
export class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xHatPrev: number | null = null;
  private dxHatPrev = 0;
  private tPrev: number | null = null;

  constructor(
    minCutoff = DEFAULT_MIN_CUTOFF,
    beta = DEFAULT_BETA,
    dCutoff = DEFAULT_D_CUTOFF
  ) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  private alpha(rate: number, cutoff: number): number {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    const te = 1.0 / rate;
    return 1.0 / (1.0 + tau / te);
  }

  reset(): void {
    this.xHatPrev = null;
    this.dxHatPrev = 0;
    this.tPrev = null;
  }

  filter(x: number, timestamp: number): number {
    if (this.tPrev === null || this.xHatPrev === null) {
      this.xHatPrev = x;
      this.dxHatPrev = 0;
      this.tPrev = timestamp;
      return x;
    }

    // Safe dt clamp: guard against dt = 0 and backwards timestamps
    const rawDt = (timestamp - this.tPrev) / 1000;
    const dt = Math.max(rawDt > 0 ? rawDt : 0, 0.0001); // in seconds
    const rate = 1.0 / dt;

    // Derivative filtering
    const dx = (x - this.xHatPrev) / dt;
    const aD = this.alpha(rate, this.dCutoff);
    const dxHat = aD * dx + (1 - aD) * this.dxHatPrev;

    // Signal filtering with speed-dependent cutoff
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = this.alpha(rate, cutoff);
    const xHat = a * x + (1 - a) * this.xHatPrev;

    this.xHatPrev = xHat;
    this.dxHatPrev = dxHat;
    this.tPrev = timestamp;

    return xHat;
  }
}

/**
 * 2-Dimensional One-Euro Filter for (x, y) coordinates.
 */
export class OneEuroFilter2D {
  private xFilter: OneEuroFilter;
  private yFilter: OneEuroFilter;

  constructor(
    minCutoff = DEFAULT_MIN_CUTOFF,
    beta = DEFAULT_BETA,
    dCutoff = DEFAULT_D_CUTOFF
  ) {
    this.xFilter = new OneEuroFilter(minCutoff, beta, dCutoff);
    this.yFilter = new OneEuroFilter(minCutoff, beta, dCutoff);
  }

  reset(): void {
    this.xFilter.reset();
    this.yFilter.reset();
  }

  filter(point: Point, timestamp: number): Point {
    return {
      x: this.xFilter.filter(point.x, timestamp),
      y: this.yFilter.filter(point.y, timestamp),
    };
  }

  filterTimed(point: TimedPoint): TimedPoint {
    return {
      x: this.xFilter.filter(point.x, point.t),
      y: this.yFilter.filter(point.y, point.t),
      t: point.t,
    };
  }
}
