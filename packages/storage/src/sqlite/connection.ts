/**
 * @lensboard/core / @lensboard/storage - SQLite Connection Manager
 * Native zero-dependency SQLite connection using Node.js DatabaseSync.
 */

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_DDL } from './schema.js';

export function openDatabase(dbPath: string): DatabaseSync {
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (dir && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec(SCHEMA_DDL);
  ensureDefaultBoard(db);

  return db;
}

export function ensureDefaultBoard(db: DatabaseSync, defaultBoardId = 'board_default'): void {
  const now = Date.now();
  db.prepare(`INSERT OR IGNORE INTO projects (id, title, created_at) VALUES (?, ?, ?)`).run(
    'proj_default',
    'Default Project',
    now
  );
  db.prepare(
    `INSERT OR IGNORE INTO boards (id, project_id, title, kind, meta, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(defaultBoardId, 'proj_default', 'Default Board', 'canvas', '{}', now, now);
}
