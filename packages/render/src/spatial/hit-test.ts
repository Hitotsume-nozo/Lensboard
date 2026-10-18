/**
 * Distance-Based Hit Testing and Handle Selection.
 * Authoritative: Spec §8.
 * - Stroke tolerance: strictly 6.000 screen px (<= 6.000 hits, 6.001 misses).
 * - Transform handle hit target: >= 24 screen px.
 * - Locked objects: indexed for culling, but unselectable on hit testing.
 * - Topmost selection: resolved in reverse z-index order.
 */

import type { CanvasObject, LensDocument } from '@lensboard/core';
import type { Point, ViewportTransform, HandleHit } from '../types.js';
import type { SpatialIndex } from './index.js';

export const STROKE_HIT_TOLERANCE_SCREEN_PX = 6.0;
export const HANDLE_HIT_SIZE_SCREEN_PX = 24.0;

/**
 * Calculates orthogonal distance from point P to line segment A -> B.
 */
export function pointToSegmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }

  const wx = p.x - a.x;
  const wy = p.y - a.y;
  const t = Math.max(0, Math.min(1, (wx * dx + wy * dy) / lenSq));

  const projX = a.x + t * dx;
  const projY = a.y + t * dy;

  return Math.hypot(p.x - projX, p.y - projY);
}

/**
 * Checks if a point hits a stroke polyline within stroke tolerance (in screen space).
 */
export function hitTestStroke(
  worldPoint: Point,
  points: Array<{ x: number; y: number }>,
  zoom: number,
  toleranceScreenPx = STROKE_HIT_TOLERANCE_SCREEN_PX
): boolean {
  if (points.length === 0) return false;

  if (points.length === 1) {
    const distScreen = Math.hypot(worldPoint.x - points[0].x, worldPoint.y - points[0].y) * zoom;
    return distScreen <= toleranceScreenPx;
  }

  for (let i = 0; i < points.length - 1; i++) {
    const segDistWorld = pointToSegmentDistance(worldPoint, points[i], points[i + 1]);
    const segDistScreen = segDistWorld * zoom;
    if (segDistScreen <= toleranceScreenPx) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if a world point falls inside a shape's bounds (handling rotation).
 */
export function hitTestShape(
  worldPoint: Point,
  obj: CanvasObject
): boolean {
  const width = obj.w ?? (obj as { width?: number }).width ?? 0;
  const height = obj.h ?? (obj as { height?: number }).height ?? 0;

  if (width === 0 && height === 0) {
    return worldPoint.x === obj.x && worldPoint.y === obj.y;
  }

  const rotation = obj.rotation ?? 0;
  let localX = worldPoint.x;
  let localY = worldPoint.y;

  if (rotation !== 0) {
    // Inverse rotation about center
    const cx = obj.x + width / 2;
    const cy = obj.y + height / 2;
    const cos = Math.cos(-rotation);
    const sin = Math.sin(-rotation);
    const dx = worldPoint.x - cx;
    const dy = worldPoint.y - cy;
    localX = cx + dx * cos - dy * sin;
    localY = cy + dx * sin + dy * cos;
  }

  const minX = Math.min(obj.x, obj.x + width);
  const maxX = Math.max(obj.x, obj.x + width);
  const minY = Math.min(obj.y, obj.y + height);
  const maxY = Math.max(obj.y, obj.y + height);

  // Quick bounding box rejection
  if (localX < minX || localX > maxX || localY < minY || localY > maxY) {
    return false;
  }

  const shapeType = (obj.shapeType as string) || (obj.data?.shapeType as string) || 'rectangle';

  if (shapeType === 'diamond') {
    const cx = obj.x + width / 2;
    const cy = obj.y + height / 2;
    const normX = Math.abs(localX - cx) / Math.max(0.001, width / 2);
    const normY = Math.abs(localY - cy) / Math.max(0.001, height / 2);
    return (normX + normY) <= 1.0;
  }

  if (shapeType === 'circle' || shapeType === 'ellipse') {
    const cx = obj.x + width / 2;
    const cy = obj.y + height / 2;
    const rx = Math.max(0.001, width / 2);
    const ry = Math.max(0.001, height / 2);
    return (((localX - cx) / rx) ** 2 + ((localY - cy) / ry) ** 2) <= 1.0;
  }

  return true;
}

/**
 * Performs full hierarchical hit testing against the document objects.
 * Uses the spatial index for broadphase pruning, then conducts precise narrowphase tests.
 * Locked objects are unselectable and bypassed.
 */
export function hitTestDocument(
  worldPoint: Point,
  doc: LensDocument,
  spatialIndex: SpatialIndex,
  viewport: ViewportTransform
): CanvasObject | null {
  const worldTolerance = STROKE_HIT_TOLERANCE_SCREEN_PX / viewport.zoom;
  const queryBox = {
    minX: worldPoint.x - worldTolerance,
    minY: worldPoint.y - worldTolerance,
    maxX: worldPoint.x + worldTolerance,
    maxY: worldPoint.y + worldTolerance,
  };

  const candidates = spatialIndex.search(queryBox);
  if (candidates.length === 0) return null;

  const candidateIds = new Set(candidates.map((c) => c.id));

  // Traverse rootIds in reverse (topmost z-order first)
  for (let i = doc.rootIds.length - 1; i >= 0; i--) {
    const id = doc.rootIds[i];
    if (!candidateIds.has(id)) continue;

    const obj = doc.objects[id];
    if (!obj || obj.hidden) continue;

    // Locked objects are unselectable per Spec §8 & f19-5
    if (obj.locked) continue;

    if (obj.type === 'ink' || (obj as { type: string }).type === 'stroke') {
      const points = (obj as { points?: Array<{ x: number; y: number }> }).points ?? [];
      if (hitTestStroke(worldPoint, points, viewport.zoom, STROKE_HIT_TOLERANCE_SCREEN_PX)) {
        return obj;
      }
    } else if (obj.type === 'line' || obj.type === 'ruler') {
      const x2 = (obj.data?.x2 as number) ?? obj.x + (obj.w ?? 0);
      const y2 = (obj.data?.y2 as number) ?? obj.y + (obj.h ?? 0);
      const distWorld = pointToSegmentDistance(worldPoint, { x: obj.x, y: obj.y }, { x: x2, y: y2 });
      const distScreen = distWorld * viewport.zoom;
      if (distScreen <= Math.max(STROKE_HIT_TOLERANCE_SCREEN_PX, 8.0) || hitTestShape(worldPoint, obj)) {
        return obj;
      }
    } else {
      if (hitTestShape(worldPoint, obj)) {
        return obj;
      }
    }
  }

  return null;
}

/**
 * Hit tests transform handles of a selected object.
 * Returns the hit handle if the click is within the minimum 24 screen px target.
 */
export function hitTestObjectHandles(
  screenPoint: Point,
  obj: CanvasObject,
  viewport: ViewportTransform
): HandleHit | null {
  const width = obj.w ?? (obj as { width?: number }).width ?? 0;
  const height = obj.h ?? (obj as { height?: number }).height ?? 0;
  const halfHit = HANDLE_HIT_SIZE_SCREEN_PX / 2;

  let minX = obj.x;
  let minY = obj.y;
  let maxX = obj.x + width;
  let maxY = obj.y + height;

  if (obj.type === 'line' || obj.type === 'ruler') {
    const x2 = (obj.data?.x2 as number) ?? obj.x + width;
    const y2 = (obj.data?.y2 as number) ?? obj.y + height;
    minX = Math.min(obj.x, x2);
    maxX = Math.max(obj.x, x2);
    minY = Math.min(obj.y, y2);
    maxY = Math.max(obj.y, y2);
  } else if (
    (obj.type === 'ink' || (obj as { type: string }).type === 'stroke') &&
    (obj as { points?: Array<{ x: number; y: number }> }).points?.length
  ) {
    const pts = (obj as { points?: Array<{ x: number; y: number }> }).points!;
    minX = Infinity;
    maxX = -Infinity;
    minY = Infinity;
    maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  } else {
    minX = Math.min(obj.x, obj.x + width);
    maxX = Math.max(obj.x, obj.x + width);
    minY = Math.min(obj.y, obj.y + height);
    maxY = Math.max(obj.y, obj.y + height);
  }

  const boxW = maxX - minX;
  const boxH = maxY - minY;

  // World handle positions
  const worldHandles: Array<{ pos: HandleHit['position']; x: number; y: number }> = [
    { pos: 'tl', x: minX, y: minY },
    { pos: 'tr', x: maxX, y: minY },
    { pos: 'bl', x: minX, y: maxY },
    { pos: 'br', x: maxX, y: maxY },
    { pos: 'tm', x: minX + boxW / 2, y: minY },
    { pos: 'bm', x: minX + boxW / 2, y: maxY },
    { pos: 'ml', x: minX, y: minY + boxH / 2 },
    { pos: 'mr', x: maxX, y: minY + boxH / 2 },
    // Rotation handle 20px above top-center in world units
    { pos: 'rot', x: minX + boxW / 2, y: minY - 20 / viewport.zoom },
  ];

  for (const h of worldHandles) {
    const screenX = h.x * viewport.zoom + viewport.x;
    const screenY = h.y * viewport.zoom + viewport.y;

    if (
      Math.abs(screenPoint.x - screenX) <= halfHit &&
      Math.abs(screenPoint.y - screenY) <= halfHit
    ) {
      return {
        type: 'handle',
        position: h.pos,
        point: { x: screenX, y: screenY },
        size: HANDLE_HIT_SIZE_SCREEN_PX,
      };
    }
  }

  return null;
}
