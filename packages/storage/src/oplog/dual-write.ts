/**
 * @lensboard/storage - Atomic Dual-Write Op-Log
 * Appends to ops and updates objects (or marks deleted = 1) in a single atomic transaction.
 */

import type { DatabaseSync } from 'node:sqlite';
import type { Command } from '@lensboard/core';

export function executeDualWrite(
  db: DatabaseSync,
  boardId: string,
  command: Command,
  inverseCommand?: Command
): number {
  const insertOpStmt = db.prepare(
    `INSERT INTO ops (board_id, tx_id, ts, type, payload, inverse)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const upsertObjStmt = db.prepare(
    `INSERT INTO objects (id, board_id, type, z, data, deleted, updated_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)
     ON CONFLICT(id) DO UPDATE SET
       type = excluded.type,
       z = excluded.z,
       data = excluded.data,
       deleted = 0,
       updated_at = excluded.updated_at`
  );

  const softDeleteObjStmt = db.prepare(
    `UPDATE objects SET deleted = 1, updated_at = ? WHERE id = ? AND board_id = ?`
  );

  db.exec('BEGIN IMMEDIATE');
  try {
    // 1. Append to ops table
    const opResult = insertOpStmt.run(
      boardId,
      command.id,
      command.timestamp || Date.now(),
      command.type,
      JSON.stringify(command.payload ?? {}),
      JSON.stringify(inverseCommand?.payload ?? {})
    );
    const seq = Number(opResult.lastInsertRowid);

    // 2. Dual-write to objects table
    const now = Date.now();
    const payload = (command.payload || {}) as Record<string, any>;

    if (
      command.type === 'create' ||
      command.type === 'create_object' ||
      command.type === 'update' ||
      command.type === 'move' ||
      command.type === 'resize' ||
      command.type === 'setStyle' ||
      command.type === 'reorder' ||
      command.type === 'convertInk'
    ) {
      const obj = payload.object || payload.newObject || payload;
      const targetId = obj?.id || (command.targets && command.targets[0]);
      if (targetId) {
        upsertObjStmt.run(
          targetId,
          boardId,
          obj?.type || 'shape',
          obj?.z || 'a0',
          JSON.stringify(obj || {}),
          now
        );
      }
    } else if (
      command.type === 'delete' ||
      command.type === 'delete_object' ||
      command.type === 'revertConversion'
    ) {
      const targetId =
        payload.id ||
        payload.convertedObjectId ||
        (command.targets && command.targets[0]);
      if (targetId) {
        softDeleteObjStmt.run(now, targetId, boardId);
      }
    } else if (command.type === 'batch') {
      const subCommands = (payload.commands as Command[]) || [];
      for (const subCmd of subCommands) {
        const subPayload = (subCmd.payload || {}) as Record<string, any>;
        if (subCmd.type === 'create' || subCmd.type === 'update') {
          const obj = subPayload.object || subPayload;
          const targetId = obj?.id || (subCmd.targets && subCmd.targets[0]);
          if (targetId) {
            upsertObjStmt.run(
              targetId,
              boardId,
              obj?.type || 'shape',
              obj?.z || 'a0',
              JSON.stringify(obj || {}),
              now
            );
          }
        } else if (subCmd.type === 'delete') {
          const targetId = subPayload.id || (subCmd.targets && subCmd.targets[0]);
          if (targetId) {
            softDeleteObjStmt.run(now, targetId, boardId);
          }
        }
      }
    }

    db.exec('COMMIT');
    return seq;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
