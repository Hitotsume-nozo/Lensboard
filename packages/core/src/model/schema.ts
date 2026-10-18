/**
 * @lensboard/core - Zod Runtime Validation Schemas
 * Validates document, objects, styles, viewports, and coordinates according to spec §6.
 */

import { z } from 'zod';
import { ALL_ENTITY_TYPES } from './entities.js';

export const PenColorSlotSchema = z.enum([
  'ink',
  'gray',
  'orange',
  'sky',
  'green',
  'yellow',
  'blue',
  'vermillion',
  'purple',
  'custom',
]);

export const ObjectStyleSchema = z.object({
  colorId: PenColorSlotSchema,
  strokeWidth: z.number().min(0.1),
  fill: z.string().optional(),
  renderMode: z.enum(['crisp', 'sketch']),
  sketchSeed: z.number().optional(),
});

export const StrokePointSchema = z.object({
  x: z.number(),
  y: z.number(),
  t: z.number(),
});

export const EntityTypeSchema = z.enum(
  ALL_ENTITY_TYPES as unknown as [string, ...string[]]
);

export const CanvasObjectSchema = z.object({
  id: z.string().min(1),
  type: z.string(),
  parentId: z.string().nullable().optional().default(null),
  x: z.number(),
  y: z.number(),
  w: z.number().optional().default(0),
  h: z.number().optional().default(0),
  width: z.number().optional(),
  height: z.number().optional(),
  rotation: z.number().default(0),
  z: z.string(),
  style: ObjectStyleSchema.optional(),
  tags: z.array(z.string()).default([]),
  locked: z.boolean().default(false),
  hidden: z.boolean().default(false),
  createdAt: z.number(),
  updatedAt: z.number(),
  opacity: z.number().optional(),
  data: z.record(z.unknown()).optional(),
  sourceInk: z.array(z.string()).optional(),
  props: z.record(z.unknown()).optional(),
  points: z.array(StrokePointSchema).optional(),
});

export const ViewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number().min(0.02).max(64.0),
});

export const LensDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  title: z.string(),
  objects: z.record(z.string(), CanvasObjectSchema),
  rootIds: z.array(z.string()),
  viewport: ViewportSchema,
});

/**
 * Sanitizes NaN, Infinity, or -Infinity floating-point numbers to 0.0 float64.
 */
export function sanitizeCoordinate(val: number): number {
  return Number.isFinite(val) ? val : 0;
}

/**
 * Clamps viewport zoom strictly within [0.02, 64.0].
 */
export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom) || isNaN(zoom)) return 1.0;
  return Math.min(Math.max(zoom, 0.02), 64.0);
}
