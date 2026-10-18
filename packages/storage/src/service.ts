/**
 * @lensboard/storage - Storage Service Implementation
 * Fulfills PROJECT.md Interface Contract 2 with native node:sqlite.
 */

import { DatabaseSync } from 'node:sqlite';
import { createDocument, type Command, type LensDocument } from '@lensboard/core';
import { ensureDefaultBoard, openDatabase } from './sqlite/connection.js';
import { executeDualWrite } from './oplog/dual-write.js';
import { GroupCommitFlusher } from './oplog/group-commit.js';
import { SnapshotEngine } from './oplog/snapshots.js';
import { quickCheck } from './recovery/integrity.js';
import { salvage } from './recovery/salvage.js';

export interface StorageService {
  open(path: string): Promise<void>;
  persistOp(command: Command, docSnapshot?: LensDocument): Promise<void>;
  loadLatestSnapshot(): Promise<{ doc: LensDocument; opsSince: Command[] }>;
  quickCheck(): Promise<boolean>;
  salvage(): Promise<LensDocument>;
  flush(): Promise<void>;
  close(): Promise<void>;
}

export class SQLiteStorageService implements StorageService {
  private db: DatabaseSync | null = null;
  private currentPath = ':memory:';
  private activeBoardId = 'board_default';
  private flusher: GroupCommitFlusher | null = null;
  private snapshotEngine: SnapshotEngine | null = null;
  private latestDoc: LensDocument | null = null;

  async open(path: string): Promise<void> {
    this.currentPath = path;

    // Run quick_check before opening existing non-memory files
    if (path !== ':memory:') {
      const isHealthy = quickCheck(path);
      if (!isHealthy) {
        throw new Error(
          `Database integrity check failed for ${path}. Run salvage() to recover.`
        );
      }
    }

    this.db = openDatabase(path);
    ensureDefaultBoard(this.db, this.activeBoardId);

    this.snapshotEngine = new SnapshotEngine(this.db);
    this.flusher = new GroupCommitFlusher(async (batch) => {
      if (!this.db) return;
      for (const item of batch) {
        const seq = executeDualWrite(this.db, item.boardId, item.command);
        this.snapshotEngine?.recordOp();
        if (item.docSnapshot) {
          this.latestDoc = item.docSnapshot;
          if (this.snapshotEngine?.shouldSnapshot()) {
            this.snapshotEngine.createSnapshot(item.boardId, item.docSnapshot, seq);
          }
        }
      }
    }, 100);
  }

  async persistOp(command: Command, docSnapshot?: LensDocument): Promise<void> {
    if (!this.db || !this.flusher) {
      throw new Error('Storage service is not open');
    }
    if (docSnapshot) {
      this.latestDoc = docSnapshot;
    }
    return this.flusher.enqueue(this.activeBoardId, command, docSnapshot);
  }

  async loadLatestSnapshot(): Promise<{ doc: LensDocument; opsSince: Command[] }> {
    if (!this.db || !this.snapshotEngine) {
      throw new Error('Storage service is not open');
    }

    // Flush any pending buffered writes before loading snapshot state
    await this.flush();

    const snap = this.snapshotEngine.loadLatest(this.activeBoardId);
    let doc: LensDocument;
    let minSeq = 0;

    if (snap) {
      doc = snap.doc;
      minSeq = snap.atSeq;
    } else {
      doc = this.latestDoc ?? createDocument('Default Board');
    }

    const opRows = this.db
      .prepare(
        `SELECT seq, tx_id, ts, type, payload FROM ops WHERE board_id = ? AND seq > ? ORDER BY seq ASC`
      )
      .all(this.activeBoardId, minSeq) as Array<{
      seq: number | bigint;
      tx_id: string;
      ts: number | bigint;
      type: string;
      payload: string;
    }>;

    const opsSince: Command[] = opRows.map((r) => {
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(String(r.payload));
      } catch {}
      const targetId = (payload as any)?.id || (payload as any)?.object?.id;
      return {
        id: String(r.tx_id),
        type: String(r.type),
        timestamp: Number(r.ts),
        targets: targetId ? [targetId] : [],
        payload,
      };
    });

    return { doc, opsSince };
  }

  async quickCheck(): Promise<boolean> {
    if (!this.db) return false;
    return quickCheck(this.db);
  }

  async salvage(): Promise<LensDocument> {
    const recovered = salvage(this.currentPath, this.activeBoardId);
    this.latestDoc = recovered;
    return recovered;
  }

  async flush(): Promise<void> {
    if (this.flusher) {
      await this.flusher.flush();
    }
  }

  async close(): Promise<void> {
    if (this.flusher) {
      await this.flusher.flush();
    }
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.flusher = null;
    this.snapshotEngine = null;
  }
}

export function createStorageService(): StorageService {
  return new SQLiteStorageService();
}
