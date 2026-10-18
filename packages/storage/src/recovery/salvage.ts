/**
 * @lensboard/storage - Non-Destructive Salvage Recovery
 * Reconstructs workspace into workspace.salvaged.lens from valid op-log replay
 * without overwriting the original damaged file.
 */

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { apply, createDocument, type Command, type LensDocument } from '@lensboard/core';
import { ensureDefaultBoard, openDatabase } from '../sqlite/connection.js';
import { executeDualWrite } from '../oplog/dual-write.js';

export function getSalvagePath(originalPath: string): string {
  if (originalPath === ':memory:') {
    return 'workspace.salvaged.lens';
  }
  const dir = path.dirname(originalPath);
  const base = path.basename(originalPath);
  if (base.endsWith('.lens')) {
    return path.join(dir, `${base.slice(0, -5)}.salvaged.lens`);
  }
  return path.join(dir, `${base}.salvaged.lens`);
}

export function salvage(
  damagedPath: string,
  boardId = 'board_default'
): LensDocument {
  const salvagedPath = getSalvagePath(damagedPath);

  // 1. Read uncorrupted ops from damaged file (safely, never writing to it)
  const recoverableOps: Array<{
    seq: number;
    txId: string;
    ts: number;
    type: string;
    payload: string;
  }> = [];

  if (damagedPath !== ':memory:' && fs.existsSync(damagedPath)) {
    let damagedDb: DatabaseSync | null = null;
    try {
      damagedDb = new DatabaseSync(damagedPath, { readOnly: true });
      const rows = damagedDb
        .prepare('SELECT seq, tx_id, ts, type, payload FROM ops ORDER BY seq ASC')
        .all() as Array<{
        seq: number | bigint;
        tx_id: string;
        ts: number | bigint;
        type: string;
        payload: string;
      }>;

      for (const r of rows) {
        recoverableOps.push({
          seq: Number(r.seq),
          txId: String(r.tx_id),
          ts: Number(r.ts),
          type: String(r.type),
          payload: String(r.payload),
        });
      }
    } catch (e) {
      console.warn('[Salvage] Partial read failure on damaged file:', e);
    } finally {
      if (damagedDb) {
        try {
          damagedDb.close();
        } catch {}
      }
    }
  }

  // 2. Initialize new salvaged database file
  if (fs.existsSync(salvagedPath)) {
    try {
      fs.unlinkSync(salvagedPath);
    } catch {}
  }

  const salvagedDb = openDatabase(salvagedPath);
  ensureDefaultBoard(salvagedDb, boardId);

  // 3. Reconstruct document state from scratch by replaying ops
  let doc: LensDocument = createDocument('Salvaged Board');

  for (const op of recoverableOps) {
    try {
      const payloadObj = JSON.parse(op.payload);
      const targetId = payloadObj?.id || payloadObj?.object?.id || payloadObj?.newObject?.id;
      const cmd: Command = {
        id: op.txId,
        type: op.type,
        timestamp: op.ts,
        targets: targetId ? [targetId] : [],
        payload: payloadObj,
      };

      const result = apply(doc, cmd);
      doc = result.doc;

      // Persist the recovered op and object into the salvaged database
      executeDualWrite(salvagedDb, boardId, cmd, result.inverse);
    } catch {
      // Skip individually corrupt payload without aborting remainder of recovery
    }
  }

  salvagedDb.close();
  return doc;
}
