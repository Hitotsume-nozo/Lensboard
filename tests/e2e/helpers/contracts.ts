/**
 * LENSBoard 2.0 — Canonical Architectural Contracts & Type Definitions
 * Source of truth: PROJECT.md § Interface Contracts, SPEC.md §6-§14
 */

export type ThemeName = 'midnight' | 'paper' | 'blueprint' | 'blackboard' | 'high-contrast';

export interface ThemeTokens {
  canvas: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accent2: string;
  warning: string;
  danger: string;
}

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

export type DSACellState =
  | 'base-case'
  | 'computed'
  | 'active'
  | 'to-compute'
  | 'mismatch'
  | 'final-answer';

export interface DSACodingDefinition {
  state: DSACellState;
  colorName: string;
  shapeCue: 'triangle' | 'none' | 'thick-outline' | 'dashed-outline' | 'hatch' | 'star-badge';
}

export const DSA_STATE_DEFINITIONS: Record<DSACellState, DSACodingDefinition> = {
  'base-case': { state: 'base-case', colorName: 'teal', shapeCue: 'triangle' },
  'computed': { state: 'computed', colorName: 'indigo', shapeCue: 'none' },
  'active': { state: 'active', colorName: 'amber', shapeCue: 'thick-outline' },
  'to-compute': { state: 'to-compute', colorName: 'transparent', shapeCue: 'dashed-outline' },
  'mismatch': { state: 'mismatch', colorName: 'vermillion', shapeCue: 'hatch' },
  'final-answer': { state: 'final-answer', colorName: 'gold', shapeCue: 'star-badge' },
};

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

export interface ObjectStyle {
  colorId: PenColorSlot;
  strokeWidth: number;
  fill?: string;
  renderMode: 'crisp' | 'sketch';
  sketchSeed?: number;
}

export interface CanvasObject {
  id: string; // ULID
  type: EntityType;
  parentId: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  z: string; // Fractional index
  style: ObjectStyle;
  tags: string[];
  locked: boolean;
  hidden: boolean;
  createdAt: number;
  updatedAt: number;
  data?: Record<string, unknown>;
  sourceInk?: string[]; // Preserved source stroke IDs when converted
}

export interface StrokePoint {
  x: number;
  y: number;
  t: number;
}

export interface StrokeObject extends CanvasObject {
  type: 'ink';
  points: StrokePoint[];
}

export interface LensDocument {
  schemaVersion: number;
  id: string; // ULID
  title: string;
  objects: Record<string, CanvasObject>;
  rootIds: string[]; // sorted by fractional index z
  viewport: { x: number; y: number; zoom: number };
}

export type CommandType =
  | 'create'
  | 'update'
  | 'delete'
  | 'move'
  | 'resize'
  | 'setStyle'
  | 'reorder'
  | 'group'
  | 'ungroup'
  | 'convertInk'
  | 'revertConversion'
  | 'batch';

export interface Command {
  id: string;
  type: CommandType;
  timestamp: number;
  targets: string[];
  payload: Record<string, unknown>;
}

export interface CommandResult {
  doc: LensDocument;
  inverse: Command;
}

export interface ShortcutBinding {
  id: string;
  keys: string;
  context: 'global' | 'canvas' | 'editor';
  action: string;
  description?: string;
}

export interface StorageService {
  open(path: string): Promise<void>;
  persistOp(command: Command, docSnapshot?: LensDocument): Promise<void>;
  loadLatestSnapshot(): Promise<{ doc: LensDocument; opsSince: Command[] }>;
  quickCheck(): Promise<boolean>;
  salvage(): Promise<LensDocument>;
  flush(): Promise<void>;
  close(): Promise<void>;
}

export interface CanvasRenderer {
  setScene(doc: LensDocument): void;
  setViewport(x: number, y: number, zoom: number): void;
  toWorld(screenPoint: { x: number; y: number }): { x: number; y: number };
  toScreen(worldPoint: { x: number; y: number }): { x: number; y: number };
  hitTest(worldPoint: { x: number; y: number }): CanvasObject | null;
  startLiveStroke(point: StrokePoint): void;
  appendLiveStrokePoint(point: StrokePoint): void;
  finishLiveStroke(): StrokeObject;
  renderFrame(): void;
  dispose(): void;
}
