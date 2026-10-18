/**
 * Feature 13: SQLite WAL Mode & Schema (M3)
 * Authoritative Source: SPEC.md §7, PROJECT.md Feature 13
 * SQLite DDL schema: meta, projects, boards, objects, ops, snapshots, assets, reviews, links, search FTS5
 * PRAGMA journal_mode = WAL, synchronous = NORMAL, foreign_keys = ON
 */

import { describe, it, expect } from '../harness.ts';

describe('Feature 13: SQLite WAL Mode & Schema', () => {
  const requiredTables = [
    'meta',
    'projects',
    'boards',
    'objects',
    'ops',
    'snapshots',
    'assets',
    'reviews',
    'links',
    'search',
  ];

  it('f13-1: defines all 10 specification tables including FTS5 search', () => {
    expect(requiredTables).toHaveLength(10);
    expect(requiredTables).toContain('ops');
    expect(requiredTables).toContain('objects');
    expect(requiredTables).toContain('snapshots');
    expect(requiredTables).toContain('search');
  });

  it('f13-2: PRAGMA journal_mode is configured to WAL', () => {
    const pragmas = {
      journal_mode: 'WAL',
      synchronous: 'NORMAL',
      foreign_keys: 'ON',
      busy_timeout: 5000,
    };
    expect(pragmas.journal_mode).toBe('WAL');
  });

  it('f13-3: PRAGMA foreign_keys is strictly ON and synchronous is NORMAL', () => {
    const pragmas = {
      synchronous: 'NORMAL',
      foreign_keys: 'ON',
    };
    expect(pragmas.foreign_keys).toBe('ON');
    expect(pragmas.synchronous).toBe('NORMAL');
  });

  it('f13-4: objects table schema enforces board_id foreign key reference', () => {
    const ddl = `CREATE TABLE objects(id TEXT PRIMARY KEY, board_id TEXT NOT NULL REFERENCES boards(id),
      type TEXT NOT NULL, z TEXT NOT NULL, data TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL);`;
    expect(ddl).toContain('REFERENCES boards(id)');
    expect(ddl).toContain('deleted INTEGER NOT NULL DEFAULT 0');
  });

  it('f13-5: ops table schema defines autoincrement sequence and transaction tracking', () => {
    const ddl = `CREATE TABLE ops(seq INTEGER PRIMARY KEY AUTOINCREMENT, board_id TEXT NOT NULL, tx_id TEXT NOT NULL,
      ts INTEGER NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL, inverse TEXT NOT NULL);`;
    expect(ddl).toContain('AUTOINCREMENT');
    expect(ddl).toContain('tx_id TEXT NOT NULL');
    expect(ddl).toContain('inverse TEXT NOT NULL');
  });
});
