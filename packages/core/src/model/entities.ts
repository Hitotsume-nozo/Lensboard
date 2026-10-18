/**
 * @lensboard/core - Model Entities
 * Canonical types and factory functions for the pure document model.
 */

export const SCHEMA_VERSION = 1;

export type EntityType =
  | 'ink'
  | 'shape'
  | 'line'
  | 'text'
  | 'equation'
  | 'code'
  | 'table'
  | 'array'
  | 'dpTable'
  | 'graph'
  | 'recursionTree'
  | 'nnBlock'
  | 'heatmap'
  | 'plot'
  | 'featureCard'
  | 'derivation'
  | 'paper'
  | 'frame'
  | 'note'
  | 'flow'
  | 'image'
  | 'stamp'
  | 'bookmark';

export const ALL_ENTITY_TYPES: readonly EntityType[] = [
  'ink',
  'shape',
  'line',
  'text',
  'equation',
  'code',
  'table',
  'array',
  'dpTable',
  'graph',
  'recursionTree',
  'nnBlock',
  'heatmap',
  'plot',
  'featureCard',
  'derivation',
  'paper',
  'frame',
  'note',
  'flow',
  'image',
  'stamp',
  'bookmark',
] as const;

export type PenColorSlot =
  | 'ink'
  | 'gray'
  | 'orange'
  | 'sky'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'vermillion'
  | 'purple'
  | 'custom';

export interface ObjectStyle {
  colorId: PenColorSlot;
  strokeWidth: number;
  fill?: string;
  renderMode: 'crisp' | 'sketch';
  sketchSeed?: number;
}

export interface StrokePoint {
  x: number;
  y: number;
  t: number;
}

export interface CanvasObject {
  id: string; // ULID
  type: EntityType | string;
  x: number;
  y: number;
  z: string; // Fractional index
  parentId?: string | null;
  w?: number;
  h?: number;
  rotation?: number;
  style?: ObjectStyle;
  tags?: string[];
  locked?: boolean;
  hidden?: boolean;
  createdAt?: number;
  updatedAt?: number;
  data?: Record<string, unknown>;
  opacity?: number;
  sourceInk?: string[]; // Preserved source stroke IDs when converted
  // Backward and downstream compatibility fields
  width?: number;
  height?: number;
  props?: Record<string, unknown>;
  points?: StrokePoint[] | any[];
  color?: string;
  size?: number;
  [key: string]: unknown;
}

export interface StrokeObject extends CanvasObject {
  type: 'ink' | 'stroke' | string;
  points: StrokePoint[] | any[];
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number; // Clamped to [0.02, 64.0]
}

export interface LensDocument {
  schemaVersion: number;
  id: string; // ULID
  title: string;
  objects: Record<string, CanvasObject>;
  rootIds: string[]; // Lexicographically sorted by fractional index z
  viewport: Viewport;
}

export function createDefaultStyle(overrides?: Partial<ObjectStyle>): ObjectStyle {
  return {
    colorId: 'ink',
    strokeWidth: 3,
    renderMode: 'crisp',
    ...overrides,
  };
}

export function createCanvasObject(
  overrides?: Partial<CanvasObject> & { id?: string; type?: EntityType | string }
): CanvasObject {
  const rawW = overrides?.w ?? overrides?.width ?? 0;
  const rawH = overrides?.h ?? overrides?.height ?? 0;
  const width = Number.isFinite(rawW) ? rawW : 0;
  const height = Number.isFinite(rawH) ? rawH : 0;
  const id = overrides?.id ?? `obj_${Date.now()}`;
  const now = Date.now();

  return {
    id,
    type: overrides?.type ?? 'shape',
    parentId: overrides?.parentId ?? null,
    x: Number.isFinite(overrides?.x) ? (overrides?.x as number) : 0,
    y: Number.isFinite(overrides?.y) ? (overrides?.y as number) : 0,
    w: width,
    h: height,
    width,
    height,
    rotation: overrides?.rotation ?? 0,
    z: overrides?.z ?? 'a0',
    style: createDefaultStyle(overrides?.style),
    tags: overrides?.tags ? [...overrides.tags] : [],
    locked: overrides?.locked ?? false,
    hidden: overrides?.hidden ?? false,
    createdAt: overrides?.createdAt ?? now,
    updatedAt: overrides?.updatedAt ?? now,
    ...(typeof overrides?.opacity === 'number' ? { opacity: overrides.opacity } : {}),
    ...(overrides?.data ? { data: { ...overrides.data } } : {}),
    ...(overrides?.sourceInk ? { sourceInk: [...overrides.sourceInk] } : {}),
    ...(overrides?.points ? { points: [...overrides.points] } : {}),
    ...(overrides?.props ? { props: { ...overrides.props } } : {}),
  };
}

export function createStrokeObject(
  points: StrokePoint[],
  overrides?: Partial<CanvasObject>
): StrokeObject {
  const base = createCanvasObject({
    ...overrides,
    type: 'ink',
  });
  return {
    ...base,
    type: 'ink',
    points: [...points],
  };
}
