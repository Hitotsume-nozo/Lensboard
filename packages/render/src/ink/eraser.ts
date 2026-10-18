/**
 * Whole-Stroke Eraser.
 * Authoritative: Spec §9, Features 23.
 * - Hit tolerance: 8.0 screen px radius around eraser cursor.
 * - Removes whole strokes and objects within 8px radius.
 * - Locked objects (locked === true) are strictly immune.
 * - Eraser with 0px radius hits nothing (f23-b3).
 * - Every erase produces an undoable command.
 */

import type { CanvasObject, LensDocument, Command } from '@lensboard/core';
import type { Point, ViewportTransform } from '../types.js';
import type { SpatialIndex } from '../spatial/index.js';
import { pointToSegmentDistance } from '../spatial/hit-test.js';

export const ERASER_RADIUS_SCREEN_PX = 8.0;

/**
 * Checks if a stroke is hit by an eraser within a given screen radius.
 */
export function isStrokeHitByEraser(
  points: Array<{ x: number; y: number }>,
  eraserPos: Point,
  radiusScreenPx = ERASER_RADIUS_SCREEN_PX,
  zoom = 1.0
): boolean {
  if (radiusScreenPx <= 0) return false;
  if (points.length === 0) return false;

  const radiusWorld = radiusScreenPx / zoom;

  // Vertex check
  for (let i = 0; i < points.length; i++) {
    const d = Math.hypot(points[i].x - eraserPos.x, points[i].y - eraserPos.y);
    if (d <= radiusWorld) {
      return true;
    }
  }

  // Segment check
  for (let i = 0; i < points.length - 1; i++) {
    const d = pointToSegmentDistance(eraserPos, points[i], points[i + 1]);
    if (d <= radiusWorld) {
      return true;
    }
  }

  return false;
}

/**
 * Finds all objects erasable by the eraser cursor at the given world point.
 * Locked objects are immune and skipped.
 */
export function findObjectsToErase(
  eraserWorldPos: Point,
  doc: LensDocument,
  spatialIndex: SpatialIndex,
  viewport: ViewportTransform,
  radiusScreenPx = ERASER_RADIUS_SCREEN_PX
): CanvasObject[] {
  if (radiusScreenPx <= 0) return [];

  const radiusWorld = radiusScreenPx / viewport.zoom;
  const searchBox = {
    minX: eraserWorldPos.x - radiusWorld,
    minY: eraserWorldPos.y - radiusWorld,
    maxX: eraserWorldPos.x + radiusWorld,
    maxY: eraserWorldPos.y + radiusWorld,
  };

  const candidates = spatialIndex.search(searchBox);
  if (candidates.length === 0) return [];

  const hitObjects: CanvasObject[] = [];

  for (const item of candidates) {
    const obj = doc.objects[item.id];
    if (!obj || obj.hidden) continue;

    // Locked objects are immune per Spec §9 & f23-b4
    if (obj.locked) continue;

    if (obj.type === 'ink' || (obj as { type: string }).type === 'stroke') {
      const points = (obj as { points?: Array<{ x: number; y: number }> }).points ?? [];
      if (isStrokeHitByEraser(points, eraserWorldPos, radiusScreenPx, viewport.zoom)) {
        hitObjects.push(obj);
      }
    } else if (obj.type === 'line' || obj.type === 'ruler') {
      const x2 = (obj.data?.x2 as number) ?? obj.x + (obj.w ?? 0);
      const y2 = (obj.data?.y2 as number) ?? obj.y + (obj.h ?? 0);
      const dist = pointToSegmentDistance(eraserWorldPos, { x: obj.x, y: obj.y }, { x: x2, y: y2 });
      if (dist <= radiusWorld) {
        hitObjects.push(obj);
      }
    } else {
      // For rectangular shapes, check if eraser circle intersects object bounds
      const w = obj.w ?? (obj as { width?: number }).width ?? 0;
      const h = obj.h ?? (obj as { height?: number }).height ?? 0;
      const minX = Math.min(obj.x, obj.x + w);
      const maxX = Math.max(obj.x, obj.x + w);
      const minY = Math.min(obj.y, obj.y + h);
      const maxY = Math.max(obj.y, obj.y + h);
      const closestX = Math.max(minX, Math.min(eraserWorldPos.x, maxX));
      const closestY = Math.max(minY, Math.min(eraserWorldPos.y, maxY));
      const dist = Math.hypot(eraserWorldPos.x - closestX, eraserWorldPos.y - closestY);
      if (dist <= radiusWorld) {
        hitObjects.push(obj);
      }
    }
  }

  return hitObjects;
}

/**
 * Creates undoable delete commands for erased objects.
 */
export function createEraseCommand(
  erasedObjects: CanvasObject[],
  timestamp = Date.now()
): Command | null {
  if (erasedObjects.length === 0) return null;

  if (erasedObjects.length === 1) {
    const target = erasedObjects[0];
    return {
      id: `cmd_erase_${timestamp}_${target.id}`,
      type: 'delete',
      timestamp,
      targets: [target.id],
      payload: { previousObject: target },
    };
  }

  return {
    id: `cmd_batch_erase_${timestamp}`,
    type: 'batch',
    timestamp,
    targets: erasedObjects.map((o) => o.id),
    payload: {
      commands: erasedObjects.map((obj) => ({
        id: `cmd_erase_${timestamp}_${obj.id}`,
        type: 'delete',
        timestamp,
        targets: [obj.id],
        payload: { previousObject: obj },
      })),
    },
  };
}
