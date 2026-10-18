/**
 * Bounding Box Calculation across entity types.
 * Supports:
 * - Single points (0x0 zero-dimension entities)
 * - Negative world coordinate quadrants
 * - Multi-point ink strokes with stroke-width padding
 * - Shapes, rectangles, frames, smart objects (with rotation support)
 */

import type { CanvasObject } from '@lensboard/core';
import type { BoundingBox, Point } from '../types.js';

/**
 * Checks if two bounding boxes intersect (AABB collision test).
 */
export function boxesIntersect(a: BoundingBox, b: BoundingBox): boolean {
  return (
    a.minX <= b.maxX &&
    a.maxX >= b.minX &&
    a.minY <= b.maxY &&
    a.maxY >= b.minY
  );
}

/**
 * Rotates a 2D point around a center origin by angle in radians.
 */
function rotatePoint(p: Point, center: Point, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

/**
 * Computes the axis-aligned world bounding box (AABB) for any CanvasObject.
 */
export function computeBoundingBox(obj: CanvasObject): BoundingBox {
  // 1. Ink and Stroke Entities
  if (obj.type === 'ink' || (obj as { type: string }).type === 'stroke') {
    const points: Array<{ x: number; y: number }> =
      (obj as { points?: Array<{ x: number; y: number }> }).points ?? [];

    if (points.length === 0) {
      return {
        minX: obj.x,
        minY: obj.y,
        maxX: obj.x,
        maxY: obj.y,
      };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const strokeWidth =
      obj.style?.strokeWidth ??
      (obj as { size?: number }).size ??
      3;
    const halfWidth = strokeWidth / 2;

    return {
      minX: minX - halfWidth,
      minY: minY - halfWidth,
      maxX: maxX + halfWidth,
      maxY: maxY + halfWidth,
    };
  }

  // 2. Rectangles, Shapes, Frames, Smart Objects
  const width = obj.w ?? (obj as { width?: number }).width ?? 0;
  const height = obj.h ?? (obj as { height?: number }).height ?? 0;
  const rotation = obj.rotation ?? 0;

  // Zero-dimension single-point entity
  if (width === 0 && height === 0) {
    return {
      minX: obj.x,
      minY: obj.y,
      maxX: obj.x,
      maxY: obj.y,
    };
  }

  // Axis-aligned unrotated box
  if (rotation === 0) {
    if (obj.type === 'line' || obj.type === 'ruler') {
      const x2 = (obj.data?.x2 as number) ?? (obj.x + width);
      const y2 = (obj.data?.y2 as number) ?? (obj.y + height);
      const minX = Math.min(obj.x, x2);
      const minY = Math.min(obj.y, y2);
      const maxX = Math.max(obj.x, x2);
      const maxY = Math.max(obj.y, y2);
      const pad = 8;
      return {
        minX: minX - pad,
        minY: minY - pad,
        maxX: maxX + pad,
        maxY: maxY + pad,
      };
    }
    const minX = Math.min(obj.x, obj.x + width);
    const minY = Math.min(obj.y, obj.y + height);
    const maxX = Math.max(obj.x, obj.x + width);
    const maxY = Math.max(obj.y, obj.y + height);
    return { minX, minY, maxX, maxY };
  }

  // Rotated bounding box: calculate AABB of the 4 rotated vertices
  const center: Point = {
    x: obj.x + width / 2,
    y: obj.y + height / 2,
  };

  const corners: Point[] = [
    { x: obj.x, y: obj.y },
    { x: obj.x + width, y: obj.y },
    { x: obj.x + width, y: obj.y + height },
    { x: obj.x, y: obj.y + height },
  ];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < corners.length; i++) {
    const rotated = rotatePoint(corners[i], center, rotation);
    if (rotated.x < minX) minX = rotated.x;
    if (rotated.x > maxX) maxX = rotated.x;
    if (rotated.y < minY) minY = rotated.y;
    if (rotated.y > maxY) maxY = rotated.y;
  }

  return { minX, minY, maxX, maxY };
}
