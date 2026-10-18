/**
 * @lensboard/storage - SQLite Schema & PRAGMAs
 * Complete 10-table schema DDL conforming to SPEC §7.
 */

export const SCHEMA_PRAGMAS = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
`;

export const SCHEMA_DDL = `
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

-- 1. Metadata key-value store
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 2. Projects table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- 3. Boards table
CREATE TABLE IF NOT EXISTS boards (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  meta TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 4. Canvas objects table (durable current state)
CREATE TABLE IF NOT EXISTS objects (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  z TEXT NOT NULL,
  data TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

-- 5. Append-only operations log
CREATE TABLE IF NOT EXISTS ops (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  tx_id TEXT NOT NULL,
  ts INTEGER NOT NULL,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  inverse TEXT NOT NULL
);

-- 6. Periodic and starred snapshots
CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  at_seq INTEGER NOT NULL,
  data BLOB NOT NULL,
  starred INTEGER NOT NULL DEFAULT 0,
  label TEXT,
  ts INTEGER NOT NULL
);

-- 7. Content-addressed binary assets
CREATE TABLE IF NOT EXISTS assets (
  hash TEXT PRIMARY KEY,
  mime TEXT NOT NULL,
  bytes BLOB NOT NULL
);

-- 8. Spaced repetition review queue
CREATE TABLE IF NOT EXISTS reviews (
  board_id TEXT PRIMARY KEY REFERENCES boards(id) ON DELETE CASCADE,
  confidence INTEGER,
  next_review INTEGER,
  interval_days INTEGER,
  needs_review INTEGER NOT NULL DEFAULT 0
);

-- 9. Board backlinks table
CREATE TABLE IF NOT EXISTS links (
  from_board TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  to_board TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  PRIMARY KEY (from_board, to_board)
);

-- 10. FTS5 full-text search virtual table
CREATE VIRTUAL TABLE IF NOT EXISTS search USING fts5 (
  board_id UNINDEXED,
  object_id UNINDEXED,
  kind UNINDEXED,
  body,
  tokenize = 'unicode61 remove_diacritics 2'
);

-- Performance indices
CREATE INDEX IF NOT EXISTS idx_ops_board_seq ON ops(board_id, seq);
CREATE INDEX IF NOT EXISTS idx_objects_board_z ON objects(board_id, z);
CREATE INDEX IF NOT EXISTS idx_snapshots_board_seq ON snapshots(board_id, at_seq);
CREATE INDEX IF NOT EXISTS idx_boards_project ON boards(project_id);
`;
