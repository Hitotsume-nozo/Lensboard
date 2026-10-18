/**
 * Viewport Coordinate Transformations.
 * Maps seamlessly between screen coordinates (CSS pixels) and world coordinates (canvas units).
 */

import type { Point, ViewportTransform, BoundingBox } from '../types.js';

/**
 * Transforms screen coordinates (CSS pixels) to world canvas coordinates.
 */
export function screenToWorld(
  screenPoint: Point,
  viewport: ViewportTransform
): Point {
  return {
    x: (screenPoint.x - viewport.x) / viewport.zoom,
    y: (screenPoint.y - viewport.y) / viewport.zoom,
  };
}

/**
 * Transforms world canvas coordinates to screen coordinates (CSS pixels).
 */
export function worldToScreen(
  worldPoint: Point,
  viewport: ViewportTransform
): Point {
  return {
    x: worldPoint.x * viewport.zoom + viewport.x,
    y: worldPoint.y * viewport.zoom + viewport.y,
  };
}

/**
 * Computes the visible axis-aligned world bounding box for the current viewport dimensions.
 */
export function getVisibleWorldBounds(
  viewport: ViewportTransform,
  screenWidth: number,
  screenHeight: number
): BoundingBox {
  const minX = (0 - viewport.x) / viewport.zoom;
  const minY = (0 - viewport.y) / viewport.zoom;
  const maxX = (screenWidth - viewport.x) / viewport.zoom;
  const maxY = (screenHeight - viewport.y) / viewport.zoom;

  return {
    minX: Math.min(minX, maxX),
    minY: Math.min(minY, maxY),
    maxX: Math.max(minX, maxX),
    maxY: Math.max(minY, maxY),
  };
}
