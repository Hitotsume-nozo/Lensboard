/**
 * @lensboard/core
 * Pure document model, commands, exact mathematical inversion,
 * history management, fractional indexing, and shortcut registry.
 * Layer Invariants: Pure TypeScript, no DOM, no Node.js I/O, zero monorepo dependencies.
 */

// Model exports
export {
  SCHEMA_VERSION,
  type EntityType,
  ALL_ENTITY_TYPES,
  type PenColorSlot,
  type ObjectStyle,
  type StrokePoint,
  type StrokeObject,
  type CanvasObject,
  type Viewport,
  type LensDocument,
  createDefaultStyle,
  createCanvasObject,
  createStrokeObject,
} from './model/entities.js';

export {
  generateUlid,
  generateInitialZ,
  generateZBetween,
  generateNZBetween,
  sortRootIdsByZ,
  insertRootIdInOrder,
  createDocument,
} from './model/fractional.js';

export {
  PenColorSlotSchema,
  ObjectStyleSchema,
  StrokePointSchema,
  EntityTypeSchema,
  CanvasObjectSchema,
  ViewportSchema,
  LensDocumentSchema,
  sanitizeCoordinate,
  clampZoom,
} from './model/schema.js';

// Command exports
export {
  type CommandType,
  type Command,
  type CommandResult,
} from './commands/types.js';

export { apply } from './commands/apply.js';
export { computeInverse } from './commands/inverse.js';

export {
  COALESCE_WINDOW_MS,
  shouldCoalesce,
  coalesceCommands,
} from './commands/coalescing.js';

// History exports
export {
  MAX_HISTORY_CAPACITY,
  type HistoryEntry,
  type SerializedHistory,
  HistoryManager,
} from './history/history-manager.js';

// Shortcut exports
export {
  type ShortcutContext,
  type ShortcutBinding,
  DEFAULT_SHORTCUT_BINDINGS,
} from './shortcuts/types.js';

export {
  normalizeShortcutKey,
  detectDuplicateBindings,
} from './shortcuts/conflicts.js';

export { ShortcutRegistry } from './shortcuts/registry.js';
