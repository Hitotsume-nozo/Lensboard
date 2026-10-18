/**
 * @lensboard/storage - Snapshot Engine & Compaction
 * Periodically stores document snapshots every 500 ops or 5 minutes of activity.
 */

import type { DatabaseSync } from 'node:sqlite';
import type { LensDocument } from '@lensboard/core';

export class SnapshotEngine {
  private opsCountSinceLast = 0;
  private lastSnapshotTime = Date.now();

  constructor(
    private readonly db: DatabaseSync,
    private readonly opsThreshold = 500,
    private readonly timeThresholdMs = 5 * 60 * 1000
  ) {}

  shouldSnapshot(): boolean {
    const elapsed = Date.now() - this.lastSnapshotTime;
    return (
      this.opsCountSinceLast >= this.opsThreshold ||
      (elapsed >= this.timeThresholdMs && this.opsCountSinceLast > 0)
    );
  }

  recordOp(): void {
    this.opsCountSinceLast++;
  }

  getOpsSinceLastSnapshot(): number {
    return this.opsCountSinceLast;
  }

  createSnapshot(
    boardId: string,
    doc: LensDocument,
    atSeq: number,
    label?: string,
    starred = 0
  ): string {
    const snapshotId = `snap_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const dataBlob = Buffer.from(JSON.stringify(doc), 'utf-8');

    const stmt = this.db.prepare(
      `INSERT INTO snapshots (id, board_id, at_seq, data, starred, label, ts)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    stmt.run(snapshotId, boardId, atSeq, dataBlob, starred, label ?? null, Date.now());

    this.opsCountSinceLast = 0;
    this.lastSnapshotTime = Date.now();
    return snapshotId;
  }

  loadLatest(boardId: string): { doc: LensDocument; atSeq: number } | null {
    const stmt = this.db.prepare(
      `SELECT id, at_seq, data FROM snapshots WHERE board_id = ? ORDER BY at_seq DESC LIMIT 1`
    );
    const row = stmt.get(boardId) as
      | { id: string; at_seq: number | bigint; data: Buffer | Uint8Array }
      | undefined;

    if (!row) return null;

    try {
      const jsonStr = Buffer.from(row.data).toString('utf-8');
      const doc = JSON.parse(jsonStr) as LensDocument;
      return { doc, atSeq: Number(row.at_seq) };
    } catch (e) {
      console.warn(`[SnapshotEngine] Failed to parse snapshot ${row.id}:`, e);
      return null;
    }
  }

  pruneOldSnapshots(boardId: string, retainCount = 5): void {
    // Only prune unstarred snapshots (starred = 1 are permanently retained per spec §7)
    const stmt = this.db.prepare(
      `DELETE FROM snapshots
       WHERE board_id = ? AND starred = 0 AND id NOT IN (
         SELECT id FROM snapshots
         WHERE board_id = ? AND starred = 0
         ORDER BY at_seq DESC
         LIMIT ?
       )`
    );
    stmt.run(boardId, boardId, retainCount);
  }
}
