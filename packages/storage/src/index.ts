/**
 * @lensboard/storage
 * Durable SQLite WAL storage service, atomic op-log, and recovery salvage.
 * Layer Invariants: Imports downward ONLY to @lensboard/core. Strictly main-process only.
 */

export { SCHEMA_PRAGMAS, SCHEMA_DDL } from './sqlite/schema.js';
export { openDatabase, ensureDefaultBoard } from './sqlite/connection.js';

export { executeDualWrite } from './oplog/dual-write.js';
export {
  GroupCommitFlusher,
  type SaveState,
  type PendingOp,
} from './oplog/group-commit.js';
export { SnapshotEngine } from './oplog/snapshots.js';

export { quickCheck } from './recovery/integrity.js';
export { salvage, getSalvagePath } from './recovery/salvage.js';

export {
  type StorageService,
  SQLiteStorageService,
  createStorageService,
} from './service.js';
