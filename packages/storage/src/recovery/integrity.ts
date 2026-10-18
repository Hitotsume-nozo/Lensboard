/**
 * @lensboard/storage - Database Integrity Checker
 * Runs PRAGMA quick_check to detect corruption on startup.
 */

import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

export function quickCheck(dbOrPath: DatabaseSync | string): boolean {
  if (typeof dbOrPath === 'string') {
    if (dbOrPath === ':memory:') return true;
    if (!fs.existsSync(dbOrPath)) return true;

    // Check for 0-byte file
    const stat = fs.statSync(dbOrPath);
    if (stat.size === 0) return false;

    let db: DatabaseSync | null = null;
    try {
      db = new DatabaseSync(dbOrPath);
      const row = db.prepare('PRAGMA quick_check(1)').get() as
        | { quick_check: string }
        | undefined;
      return row?.quick_check === 'ok';
    } catch {
      return false;
    } finally {
      if (db) {
        try {
          db.close();
        } catch {}
      }
    }
  }

  try {
    const row = dbOrPath.prepare('PRAGMA quick_check(1)').get() as
      | { quick_check: string }
      | undefined;
    return row?.quick_check === 'ok';
  } catch {
    return false;
  }
}
