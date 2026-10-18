/**
 * Lazy-String Stabilizer.
 * Authoritative: Spec §9.
 * - Leash radius: r = percent * 0.4 px (0 to 100 maps to 0 to 40 screen px).
 * - Pen point trails cursor along displacement vector while cursor is farther away than radius.
 * - Pen remains stationary when cursor is within radius.
 */

import type { Point } from '../types.js';

/**
 * Computes stabilizer radius from percentage (0..100 -> 0..40px).
 */
export function calculateStabilizerRadius(percent: number): number {
  const clamped = Math.max(0, Math.min(100, percent));
  return clamped * 0.4;
}

/**
 * Pure function applying lazy-string trailing logic.
 */
export function applyLazyStringStabilizer(
  cursor: Point,
  currentPen: Point,
  radius: number
): Point {
  const dx = cursor.x - currentPen.x;
  const dy = cursor.y - currentPen.y;
  const dist = Math.hypot(dx, dy);

  if (dist <= radius || dist === 0) {
    return { ...currentPen };
  }

  // Pen trails the cursor while cursor is farther away than radius
  const ratio = (dist - radius) / dist;
  return {
    x: currentPen.x + dx * ratio,
    y: currentPen.y + dy * ratio,
  };
}

/**
 * Stateful LazyStringStabilizer for continuous pointer streaming.
 */
export class LazyStringStabilizer {
  private radius: number;
  private currentPen: Point | null = null;

  constructor(percent = 0) {
    this.radius = calculateStabilizerRadius(percent);
  }

  setPercent(percent: number): void {
    this.radius = calculateStabilizerRadius(percent);
  }

  getRadius(): number {
    return this.radius;
  }

  reset(startPoint?: Point): void {
    this.currentPen = startPoint ? { ...startPoint } : null;
  }

  update(cursor: Point): Point {
    if (!this.currentPen) {
      this.currentPen = { ...cursor };
      return { ...cursor };
    }

    if (this.radius <= 0) {
      this.currentPen = { ...cursor };
      return { ...cursor };
    }

    const next = applyLazyStringStabilizer(cursor, this.currentPen, this.radius);
    this.currentPen = next;
    return next;
  }

  getCurrentPen(): Point | null {
    return this.currentPen ? { ...this.currentPen } : null;
  }
}
