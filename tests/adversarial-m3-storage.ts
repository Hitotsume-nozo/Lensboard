/**
 * Empirical Adversarial Stress Harness for Milestone 3 (SQLite Storage & Core Engine, R4)
 * Authoritative targets: packages/storage (SQLite WAL, Foreign Keys, Dual-Write, Group Commits, Snapshots, Recovery)
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import type { Command, LensDocument } from '../packages/core/dist/index.js';

// Self-register dist resolver for @lensboard/core before importing storage
const coreDistUrl = pathToFileURL(path.resolve(process.cwd(), 'packages/core/dist/index.js')).href;
register(`data:text/javascript,export async function resolve(s,c,n){if(s==="@lensboard/core")return n("${coreDistUrl}",c);return n(s,c);}`, pathToFileURL('./'));

const {
  openDatabase,
  ensureDefaultBoard,
  executeDualWrite,
  GroupCommitFlusher,
  SnapshotEngine,
  quickCheck,
  salvage,
  getSalvagePath,
  SQLiteStorageService,
  createStorageService,
  SCHEMA_DDL,
  SCHEMA_PRAGMAS,
} = await import('../packages/storage/dist/index.js');

const {
  createDocument,
  createCanvasObject,
  apply,
} = await import('../packages/core/dist/index.js');

interface TestResult {
  section: string;
  name: string;
  passed: boolean;
  error?: string;
  durationMs?: number;
}

const results: TestResult[] = [];
let currentSection = '';

function section(name: string) {
  currentSection = name;
  console.log(`\n▶ ${name}`);
}

async function test(name: string, fn: () => Promise<void> | void) {
  const start = performance.now();
  try {
    await fn();
    const durationMs = performance.now() - start;
    results.push({ section: currentSection, name, passed: true, durationMs });
    console.log(`  ✔ [PASS] ${name} (${durationMs.toFixed(2)}ms)`);
  } catch (err) {
    const durationMs = performance.now() - start;
    const msg = (err as Error).message || String(err);
    results.push({ section: currentSection, name, passed: false, error: msg, durationMs });
    console.error(`  ✖ [FAIL] ${name} (${durationMs.toFixed(2)}ms): ${msg}`);
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lensboard-adv-storage-'));
}

function cleanTempDir(dir: string) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}

async function runAllTests() {
  console.log('================================================================');
  console.log('  Milestone 3 Storage Adversarial Empirical Verification Harness  ');
  console.log('================================================================');

  // =========================================================================
  // Section 1: SQLite WAL Mode, Pragmas & Foreign Keys Enforcement
  // =========================================================================
  section('Section 1: SQLite WAL Mode, Pragmas & Foreign Keys Enforcement');

  await test('s1-1: Real disk database initializes strictly in WAL journal_mode', () => {
    const tempDir = createTempDir();
    try {
      const dbPath = path.join(tempDir, 'test_wal.lens');
      const db = openDatabase(dbPath);

      const modeRow = db.prepare('PRAGMA journal_mode').get() as { journal_mode: string };
      assert(
        modeRow.journal_mode.toLowerCase() === 'wal',
        `Expected WAL journal_mode on disk, got: ${modeRow.journal_mode}`
      );

      const syncRow = db.prepare('PRAGMA synchronous').get() as { synchronous: number };
      // NORMAL is 1 in SQLite
      assert(
        syncRow.synchronous === 1,
        `Expected synchronous=1 (NORMAL), got: ${syncRow.synchronous}`
      );

      db.close();
    } finally {
      cleanTempDir(tempDir);
    }
  });

  await test('s1-2: PRAGMA busy_timeout is configured to exactly 5000ms', () => {
    const db = openDatabase(':memory:');
    try {
      const row = db.prepare('PRAGMA busy_timeout').get() as { timeout: number };
      assert(row.timeout === 5000, `Expected busy_timeout 5000, got: ${row.timeout}`);
    } finally {
      db.close();
    }
  });

  await test('s1-3: PRAGMA foreign_keys is strictly ON (returns 1)', () => {
    const db = openDatabase(':memory:');
    try {
      const row = db.prepare('PRAGMA foreign_keys').get() as { foreign_keys: number };
      assert(row.foreign_keys === 1, `Expected foreign_keys=1, got: ${row.foreign_keys}`);
    } finally {
      db.close();
    }
  });

  await test('s1-4: Foreign key violation throws when inserting board with invalid project_id', () => {
    const db = openDatabase(':memory:');
    try {
      let threw = false;
      try {
        db.prepare(
          `INSERT INTO boards (id, project_id, title, kind, meta, created_at, updated_at)
           VALUES ('b_orphan', 'nonexistent_proj', 'Title', 'canvas', '{}', 1, 1)`
        ).run();
      } catch (err: any) {
        threw = true;
        assert(
          err.message.includes('FOREIGN KEY') || err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY',
          `Expected foreign key error, got: ${err.message}`
        );
      }
      assert(threw, 'Expected foreign key constraint violation to throw');
    } finally {
      db.close();
    }
  });

  await test('s1-5: Foreign key violation throws when inserting op with invalid board_id', () => {
    const db = openDatabase(':memory:');
    try {
      let threw = false;
      try {
        db.prepare(
          `INSERT INTO ops (board_id, tx_id, ts, type, payload, inverse)
           VALUES ('nonexistent_board', 'tx_test', 1000, 'create', '{}', '{}')`
        ).run();
      } catch (err: any) {
        threw = true;
        assert(
          err.message.includes('FOREIGN KEY') || err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY',
          `Expected foreign key error, got: ${err.message}`
        );
      }
      assert(threw, 'Expected foreign key constraint violation to throw on ops insertion');
    } finally {
      db.close();
    }
  });

  await test('s1-6: Foreign key violation throws when inserting object with invalid board_id', () => {
    const db = openDatabase(':memory:');
    try {
      let threw = false;
      try {
        db.prepare(
          `INSERT INTO objects (id, board_id, type, z, data, deleted, updated_at)
           VALUES ('obj_orphan', 'nonexistent_board', 'shape', 'a0', '{}', 0, 1000)`
        ).run();
      } catch (err: any) {
        threw = true;
        assert(
          err.message.includes('FOREIGN KEY') || err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY',
          `Expected foreign key error, got: ${err.message}`
        );
      }
      assert(threw, 'Expected foreign key constraint violation to throw on objects insertion');
    } finally {
      db.close();
    }
  });

  await test('s1-7: Cascading deletion cleans up boards, objects, and ops when project is deleted', () => {
    const db = openDatabase(':memory:');
    try {
      // Create project, board, object, op
      db.prepare(`INSERT INTO projects (id, title, created_at) VALUES ('p_test', 'Proj', 100)`).run();
      db.prepare(
        `INSERT INTO boards (id, project_id, title, kind, meta, created_at, updated_at)
         VALUES ('b_test', 'p_test', 'Board', 'canvas', '{}', 100, 100)`
      ).run();
      db.prepare(
        `INSERT INTO objects (id, board_id, type, z, data, deleted, updated_at)
         VALUES ('obj_test', 'b_test', 'shape', 'a0', '{}', 0, 100)`
      ).run();
      db.prepare(
        `INSERT INTO ops (board_id, tx_id, ts, type, payload, inverse)
         VALUES ('b_test', 'tx_test', 100, 'create', '{}', '{}')`
      ).run();

      // Delete project
      db.prepare(`DELETE FROM projects WHERE id = 'p_test'`).run();

      // Verify cascading deletion
      const boardCount = db.prepare(`SELECT count(*) as c FROM boards WHERE id = 'b_test'`).get() as { c: number };
      const objCount = db.prepare(`SELECT count(*) as c FROM objects WHERE id = 'obj_test'`).get() as { c: number };
      const opCount = db.prepare(`SELECT count(*) as c FROM ops WHERE board_id = 'b_test'`).get() as { c: number };

      assert(boardCount.c === 0, 'Boards should be cascade deleted');
      assert(objCount.c === 0, 'Objects should be cascade deleted');
      assert(opCount.c === 0, 'Ops should be cascade deleted');
    } finally {
      db.close();
    }
  });

  await test('s1-8: Real lock contention & busy_timeout handles concurrent writes gracefully', async () => {
    const tempDir = createTempDir();
    try {
      const dbPath = path.join(tempDir, 'lock_test.lens');
      // Initialize DB schema
      const initDb = openDatabase(dbPath);
      initDb.close();

      // Open conn2 connection prior to worker acquiring lock
      const conn2 = openDatabase(dbPath);

      // Spawn worker thread to hold exclusive write lock until signaled
      const workerCode = `
        import { parentPort, workerData } from 'node:worker_threads';
        import { DatabaseSync } from 'node:sqlite';
        const db = new DatabaseSync(workerData.dbPath);
        db.exec('PRAGMA journal_mode = WAL;');
        db.exec('PRAGMA busy_timeout = 5000;');
        db.exec('BEGIN IMMEDIATE');
        db.prepare("INSERT INTO ops (board_id, tx_id, ts, type, payload, inverse) VALUES ('board_default', 'tx_conn1', 1, 'create', '{}', '{}')").run();
        parentPort.postMessage('locked');
        parentPort.on('message', (msg) => {
          if (msg === 'release_in_150ms') {
            setTimeout(() => {
              db.exec('COMMIT');
              db.close();
              parentPort.postMessage('committed');
            }, 150);
          }
        });
      `;
      const worker = new Worker(workerCode, { eval: true, workerData: { dbPath } });

      await new Promise<void>((resolve, reject) => {
        worker.on('error', reject);
        worker.on('message', (msg) => {
          if (msg === 'locked') {
            try {
              worker.postMessage('release_in_150ms');
              const startWait = performance.now();
              conn2.exec('BEGIN IMMEDIATE');
              conn2.prepare(
                `INSERT INTO ops (board_id, tx_id, ts, type, payload, inverse)
                 VALUES ('board_default', 'tx_conn2', 2, 'create', '{}', '{}')`
              ).run();
              conn2.exec('COMMIT');
              const waitTime = performance.now() - startWait;

              assert(waitTime >= 80, `Expected conn2 to wait for conn1 lock release (waited ${waitTime.toFixed(1)}ms)`);

              const count = conn2.prepare('SELECT count(*) as c FROM ops').get() as { c: number };
              assert(count.c === 2, `Expected both ops committed, got: ${count.c}`);

              conn2.close();
              resolve();
            } catch (err) {
              reject(err);
            }
          }
        });
      });

      await worker.terminate();
    } finally {
      cleanTempDir(tempDir);
    }
  });

  // =========================================================================
  // Section 2: Atomic Dual-Write Transaction & Rollback
  // =========================================================================
  section('Section 2: Atomic Dual-Write Transaction & Rollback');

  await test('s2-1: Simultaneous persistence of ops and objects on Create', () => {
    const db = openDatabase(':memory:');
    try {
      const obj = createCanvasObject({ id: 'shape_101', type: 'shape', x: 120, y: 240 });
      const cmd: Command = {
        id: 'tx_create_1',
        type: 'create',
        timestamp: 123456789,
        targets: [obj.id],
        payload: { object: obj },
      };

      const seq = executeDualWrite(db, 'board_default', cmd);
      assert(seq === 1, `Expected seq=1, got ${seq}`);

      // Verify ops table
      const opRow = db.prepare('SELECT * FROM ops WHERE seq = 1').get() as any;
      assert(opRow !== undefined, 'Op row must exist');
      assert(opRow.tx_id === 'tx_create_1', 'tx_id matches');
      assert(opRow.type === 'create', 'type matches');
      assert(opRow.ts === 123456789, 'timestamp preserved');

      // Verify objects table
      const objRow = db.prepare('SELECT * FROM objects WHERE id = ?').get('shape_101') as any;
      assert(objRow !== undefined, 'Object row must exist');
      assert(objRow.deleted === 0, 'deleted flag must be 0');
      assert(objRow.type === 'shape', 'type matches');
      const parsedData = JSON.parse(objRow.data);
      assert(parsedData.x === 120 && parsedData.y === 240, 'object data preserved exactly');
    } finally {
      db.close();
    }
  });

  await test('s2-2: Update/Move simultaneously updates objects state and appends op', () => {
    const db = openDatabase(':memory:');
    try {
      const obj = createCanvasObject({ id: 'shape_102', type: 'shape', x: 10, y: 10 });
      executeDualWrite(db, 'board_default', {
        id: 'tx_c',
        type: 'create',
        timestamp: 100,
        targets: [obj.id],
        payload: { object: obj },
      });

      const updatedObj = { ...obj, x: 500, y: 600 };
      const seq2 = executeDualWrite(db, 'board_default', {
        id: 'tx_m',
        type: 'move',
        timestamp: 200,
        targets: [obj.id],
        payload: { object: updatedObj },
      });

      assert(seq2 === 2, `Expected seq=2, got ${seq2}`);

      const objRow = db.prepare('SELECT * FROM objects WHERE id = ?').get('shape_102') as any;
      assert(objRow.deleted === 0, 'Object must still be active');
      const data = JSON.parse(objRow.data);
      assert(data.x === 500 && data.y === 600, 'Object coordinates must be updated');
    } finally {
      db.close();
    }
  });

  await test('s2-3: Soft deletion (deleted = 1) preserves object row rather than physical drop', () => {
    const db = openDatabase(':memory:');
    try {
      const obj = createCanvasObject({ id: 'shape_del', type: 'shape' });
      executeDualWrite(db, 'board_default', {
        id: 'tx_1',
        type: 'create',
        timestamp: 100,
        targets: [obj.id],
        payload: { object: obj },
      });

      // Soft delete
      executeDualWrite(db, 'board_default', {
        id: 'tx_2',
        type: 'delete',
        timestamp: 200,
        targets: [obj.id],
        payload: { id: obj.id },
      });

      // Total row count in objects must STILL be 1
      const totalCount = db.prepare('SELECT count(*) as c FROM objects').get() as { c: number };
      assert(totalCount.c === 1, 'Object row must not be physically removed');

      // The specific row must have deleted = 1
      const objRow = db.prepare('SELECT * FROM objects WHERE id = ?').get(obj.id) as any;
      assert(objRow.deleted === 1, 'Object must have deleted = 1');

      // Re-create object with same ID: must revive with deleted = 0
      executeDualWrite(db, 'board_default', {
        id: 'tx_3',
        type: 'create',
        timestamp: 300,
        targets: [obj.id],
        payload: { object: obj },
      });

      const revivedRow = db.prepare('SELECT * FROM objects WHERE id = ?').get(obj.id) as any;
      assert(revivedRow.deleted === 0, 'Object revival must restore deleted = 0');
    } finally {
      db.close();
    }
  });

  await test('s2-4: Batch command dual-writes multiple objects and single op atomically', () => {
    const db = openDatabase(':memory:');
    try {
      const objA = createCanvasObject({ id: 'batch_a', type: 'shape' });
      const objB = createCanvasObject({ id: 'batch_b', type: 'text' });
      const objDel = createCanvasObject({ id: 'batch_del', type: 'shape' });

      // Pre-create objDel
      executeDualWrite(db, 'board_default', {
        id: 'tx_pre',
        type: 'create',
        timestamp: 10,
        targets: [objDel.id],
        payload: { object: objDel },
      });

      // Execute batch with 2 creates and 1 delete
      const batchCmd: Command = {
        id: 'tx_batch',
        type: 'batch',
        timestamp: 50,
        targets: [objA.id, objB.id, objDel.id],
        payload: {
          commands: [
            { id: 'sub_1', type: 'create', targets: [objA.id], payload: { object: objA } },
            { id: 'sub_2', type: 'create', targets: [objB.id], payload: { object: objB } },
            { id: 'sub_3', type: 'delete', targets: [objDel.id], payload: { id: objDel.id } },
          ],
        },
      };

      const seq = executeDualWrite(db, 'board_default', batchCmd);
      assert(seq === 2, `Expected seq=2, got ${seq}`);

      const rowA = db.prepare('SELECT * FROM objects WHERE id = ?').get('batch_a') as any;
      const rowB = db.prepare('SELECT * FROM objects WHERE id = ?').get('batch_b') as any;
      const rowDel = db.prepare('SELECT * FROM objects WHERE id = ?').get('batch_del') as any;

      assert(rowA && rowA.deleted === 0, 'batch_a created');
      assert(rowB && rowB.deleted === 0, 'batch_b created');
      assert(rowDel && rowDel.deleted === 1, 'batch_del soft-deleted');
    } finally {
      db.close();
    }
  });

  await test('s2-5: Transaction rollback on simulated write failure leaves NO partial ops or objects', () => {
    const db = openDatabase(':memory:');
    try {
      // Invalidate the second step of the dual-write: create a trigger that throws on objects insertion
      db.exec(`
        CREATE TRIGGER test_abort_trigger
        BEFORE INSERT ON objects
        BEGIN
          SELECT RAISE(ABORT, 'Simulated disk/constraint error on objects write');
        END;
      `);

      const doomedObj = createCanvasObject({ id: 'doomed_obj', type: 'shape' });
      let threw = false;

      try {
        executeDualWrite(db, 'board_default', {
          id: 'tx_doomed',
          type: 'create',
          timestamp: 999,
          targets: [doomedObj.id],
          payload: { object: doomedObj },
        });
      } catch (err: any) {
        threw = true;
        assert(err.message.includes('Simulated disk/constraint error'), 'Must throw trigger error');
      }

      assert(threw, 'executeDualWrite should have thrown');

      // CRITICAL VERIFICATION: Did ROLLBACK undo the op that was inserted in step 1?
      const opCount = db.prepare('SELECT count(*) as c FROM ops').get() as { c: number };
      const objCount = db.prepare('SELECT count(*) as c FROM objects').get() as { c: number };

      assert(opCount.c === 0, `Rollback failed! Found ${opCount.c} ops in ops table!`);
      assert(objCount.c === 0, `Rollback failed! Found ${objCount.c} objects in objects table!`);

      // Drop trigger and verify subsequent transactions succeed normally
      db.exec('DROP TRIGGER test_abort_trigger');

      const seq = executeDualWrite(db, 'board_default', {
        id: 'tx_success_after_rollback',
        type: 'create',
        timestamp: 1000,
        targets: [doomedObj.id],
        payload: { object: doomedObj },
      });

      assert(seq === 1, `Next seq should be 1, got ${seq}`);
      const validOpCount = db.prepare('SELECT count(*) as c FROM ops').get() as { c: number };
      assert(validOpCount.c === 1, 'Valid op persisted cleanly after rollback');
    } finally {
      db.close();
    }
  });

  // =========================================================================
  // Section 3: Group Commits Debouncing & Immediate Flush
  // =========================================================================
  section('Section 3: Group Commits Debouncing & Immediate Flush');

  await test('s3-1: 100ms debouncing groups multiple rapid ops into a single batch commit', async () => {
    let commitCount = 0;
    let committedOpsTotal = 0;

    const flusher = new GroupCommitFlusher(async (batch) => {
      commitCount++;
      committedOpsTotal += batch.length;
    }, 100);

    const states: string[] = [];
    flusher.onStateChange((s) => states.push(s));

    // Enqueue 25 ops rapidly within 5ms
    const promises: Promise<void>[] = [];
    for (let i = 0; i < 25; i++) {
      promises.push(
        flusher.enqueue('board_default', {
          id: `op_${i}`,
          type: 'update',
          timestamp: Date.now(),
          targets: ['o1'],
          payload: { val: i },
        })
      );
    }

    assert(flusher.getState() === 'dirty', 'Flusher state must be dirty immediately after enqueue');
    assert(commitCount === 0, 'No commit should happen synchronously upon enqueue');

    // Wait for the 100ms debounce timer to fire
    await Promise.all(promises);

    assert(commitCount === 1, `Expected exactly 1 grouped batch commit, got: ${commitCount}`);
    assert(committedOpsTotal === 25, `Expected 25 committed ops, got: ${committedOpsTotal}`);
    assert(flusher.getState() === 'saved', 'Flusher state must return to saved');
    assert(states.includes('dirty') && states.includes('saving') && states.includes('saved'), 'States tracked properly');
  });

  await test('s3-2: Immediate flush() synchronously commits pending buffer without waiting for timer', async () => {
    let commitCount = 0;
    let opsCommitted = 0;

    const flusher = new GroupCommitFlusher(async (batch) => {
      commitCount++;
      opsCommitted += batch.length;
    }, 100);

    // Enqueue 10 ops
    for (let i = 0; i < 10; i++) {
      flusher.enqueue('board_default', {
        id: `op_${i}`,
        type: 'move',
        timestamp: Date.now(),
        targets: ['o2'],
        payload: {},
      });
    }

    assert(flusher.getPendingCount() === 10, 'Queue should have 10 pending items');

    // Call flush immediately
    const start = performance.now();
    await flusher.flush();
    const duration = performance.now() - start;

    assert(duration < 50, `Immediate flush took ${duration.toFixed(1)}ms, should not wait 100ms`);
    assert(commitCount === 1, `Expected 1 commit, got ${commitCount}`);
    assert(opsCommitted === 10, `Expected 10 ops committed, got ${opsCommitted}`);
    assert(flusher.getPendingCount() === 0, 'Pending count should be 0 after flush');
    assert(flusher.getState() === 'saved', 'Flusher state should be saved');

    // Wait 150ms to ensure cleared timer does NOT trigger a duplicate second commit
    await new Promise((r) => setTimeout(r, 150));
    assert(commitCount === 1, 'No second commit should be triggered');
  });

  await test('s3-3: Empty flush() is a safe no-op that does not trigger commitBatchFn', async () => {
    let called = false;
    const flusher = new GroupCommitFlusher(async () => {
      called = true;
    }, 100);

    await flusher.flush();

    assert(!called, 'commitBatchFn must not be called when queue is empty');
    assert(flusher.getState() === 'saved', 'Flusher state should remain saved');
  });

  await test('s3-4: Flush error sets state to error and rejects all queued operations', async () => {
    const diskError = new Error('Simulated ENOSPC: disk full');
    const flusher = new GroupCommitFlusher(async () => {
      throw diskError;
    }, 100);

    const p1 = flusher.enqueue('board_default', {
      id: 'op_err_1',
      type: 'create',
      timestamp: 1,
      targets: ['o1'],
      payload: {},
    });

    let p1Rejected = false;
    p1.catch((err) => {
      p1Rejected = true;
      assert(err === diskError, 'Expected disk error to reject op');
    });

    let flushRejected = false;
    try {
      await flusher.flush();
    } catch (err) {
      flushRejected = true;
    }

    await new Promise((r) => setTimeout(r, 10));

    assert(flushRejected, 'flush() must throw on commit failure');
    assert(p1Rejected, 'Enqueued promise must reject on commit failure');
    assert(flusher.getState() === 'error', `Flusher state should be error, got: ${flusher.getState()}`);
  });

  // =========================================================================
  // Section 4: Snapshots & Non-Destructive Recovery Salvage
  // =========================================================================
  section('Section 4: Snapshots & Non-Destructive Recovery Salvage');

  await test('s4-1: Snapshot condition strictly evaluates 500 ops threshold and sequence boundaries', () => {
    const db = openDatabase(':memory:');
    try {
      const engine = new SnapshotEngine(db, 500);

      for (let i = 0; i < 499; i++) {
        engine.recordOp();
      }
      assert(!engine.shouldSnapshot(), 'Should not snapshot before 500 ops');

      engine.recordOp(); // 500th
      assert(engine.shouldSnapshot(), 'Must trigger snapshot on 500th op');

      const testDoc = createDocument('Snapshot Board', 'b_snap_test');
      const snapId = engine.createSnapshot('board_default', testDoc, 500, 'v500');

      assert(snapId.startsWith('snap_'), 'Snapshot ID generated');
      assert(!engine.shouldSnapshot(), 'Counter must reset after creating snapshot');
      assert(engine.getOpsSinceLastSnapshot() === 0, 'Ops since last snapshot should be 0');

      const latest = engine.loadLatest('board_default');
      assert(latest !== null, 'Latest snapshot must load');
      assert(latest?.atSeq === 500, `Snapshot at_seq must be 500, got: ${latest?.atSeq}`);
      assert(latest?.doc.id === 'b_snap_test', 'Snapshot doc ID matches');
    } finally {
      db.close();
    }
  });

  await test('s4-2: Starred snapshots (starred = 1) are permanently retained during pruning', () => {
    const db = openDatabase(':memory:');
    try {
      const engine = new SnapshotEngine(db);
      const doc = createDocument('Prune Test');

      // Create 8 regular snapshots and 2 starred snapshots
      for (let i = 1; i <= 8; i++) {
        engine.createSnapshot('board_default', doc, i * 10, `reg_${i}`, 0);
      }
      const star1 = engine.createSnapshot('board_default', doc, 25, 'star_old', 1);
      const star2 = engine.createSnapshot('board_default', doc, 75, 'star_new', 1);

      // Prune to retain only the 3 newest unstarred snapshots
      engine.pruneOldSnapshots('board_default', 3);

      const remainingRows = db.prepare('SELECT id, starred, at_seq FROM snapshots WHERE board_id = ?').all('board_default') as any[];

      // Starred must both remain
      const starIds = remainingRows.filter((r) => r.starred === 1).map((r) => r.id);
      assert(starIds.includes(star1), 'Older starred snapshot must be retained');
      assert(starIds.includes(star2), 'Newer starred snapshot must be retained');

      // Unstarred must be capped at 3
      const unstarredCount = remainingRows.filter((r) => r.starred === 0).length;
      assert(unstarredCount === 3, `Expected 3 unstarred retained, got: ${unstarredCount}`);
    } finally {
      db.close();
    }
  });

  await test('s4-3: quickCheck evaluates valid databases, 0-byte truncated files, and corrupted headers', () => {
    const tempDir = createTempDir();
    try {
      // 1. Valid database
      const validPath = path.join(tempDir, 'valid.lens');
      const validDb = openDatabase(validPath);
      validDb.close();
      assert(quickCheck(validPath) === true, 'Healthy database should pass quickCheck');

      // 2. 0-byte truncated file
      const zeroPath = path.join(tempDir, 'zero.lens');
      fs.writeFileSync(zeroPath, Buffer.alloc(0));
      assert(quickCheck(zeroPath) === false, '0-byte truncated file must fail quickCheck');

      // 3. Garbage header file
      const garbagePath = path.join(tempDir, 'garbage.lens');
      fs.writeFileSync(garbagePath, Buffer.from('NOT A SQLITE FILE AT ALL! 1234567890'));
      assert(quickCheck(garbagePath) === false, 'Garbage header must fail quickCheck');

      // 4. Memory database
      assert(quickCheck(':memory:') === true, ':memory: should pass quickCheck');
    } finally {
      cleanTempDir(tempDir);
    }
  });

  await test('s4-4: salvage() creates workspace.salvaged.lens and NEVER overwrites damaged original file', () => {
    const tempDir = createTempDir();
    try {
      const originalPath = path.join(tempDir, 'workspace.lens');
      const db = openDatabase(originalPath);

      // Persist 5 valid operations to the database
      for (let i = 1; i <= 5; i++) {
        const obj = createCanvasObject({ id: `item_${i}`, type: 'shape', x: i * 20, y: i * 30 });
        executeDualWrite(db, 'board_default', {
          id: `op_save_${i}`,
          type: 'create',
          timestamp: 1000 + i,
          targets: [obj.id],
          payload: { object: obj },
        });
      }
      db.close();

      // Read original file stats & compute SHA-256 hash BEFORE salvage
      const originalBytesBefore = fs.readFileSync(originalPath);
      const originalHashBefore = crypto.createHash('sha256').update(originalBytesBefore).digest('hex');

      // Expected salvage output path
      const expectedSalvagePath = getSalvagePath(originalPath);
      assert(
        expectedSalvagePath === path.join(tempDir, 'workspace.salvaged.lens'),
        `Expected workspace.salvaged.lens, got: ${expectedSalvagePath}`
      );
      assert(expectedSalvagePath !== originalPath, 'Salvaged path must not equal original path');

      // Execute salvage
      const recoveredDoc = salvage(originalPath, 'board_default');

      // 1. VERIFY ORIGINAL FILE INTEGRITY (MUST BE UNTOUCHED)
      const originalBytesAfter = fs.readFileSync(originalPath);
      const originalHashAfter = crypto.createHash('sha256').update(originalBytesAfter).digest('hex');

      assert(
        originalHashAfter === originalHashBefore,
        'CRITICAL VIOLATION: Damaged original file was modified or overwritten during salvage!'
      );
      assert(
        originalBytesAfter.length === originalBytesBefore.length,
        'Damaged original file length changed after salvage'
      );

      // 2. VERIFY SALVAGED DATABASE FILE
      assert(fs.existsSync(expectedSalvagePath), 'Salvaged database file must be created on disk');
      assert(quickCheck(expectedSalvagePath) === true, 'Salvaged database file must pass quickCheck');

      // 3. VERIFY RECOVERED DOCUMENT STATE
      assert(recoveredDoc !== undefined, 'Recovered document must be returned');
      for (let i = 1; i <= 5; i++) {
        assert(recoveredDoc.objects[`item_${i}`] !== undefined, `Item ${i} must be present in recovered doc`);
        assert(recoveredDoc.objects[`item_${i}`].x === i * 20, `Item ${i} coordinates verified`);
      }
    } finally {
      cleanTempDir(tempDir);
    }
  });

  // =========================================================================
  // Section 5: SQLiteStorageService Integration Lifecycle & Stress
  // =========================================================================
  section('Section 5: SQLiteStorageService Integration Lifecycle & Stress');

  await test('s5-1: Storage service enforces open lifecycle and prevents operations when closed', async () => {
    const storage = createStorageService();
    const cmd: Command = { id: 'c1', type: 'create', timestamp: 1, targets: ['o1'], payload: {} };

    let threw = false;
    try {
      await storage.persistOp(cmd);
    } catch (err: any) {
      threw = true;
      assert(err.message.includes('not open'), 'Must throw not open error');
    }
    assert(threw, 'persistOp on closed service must reject');
  });

  await test('s5-2: Storage service loadLatestSnapshot returns snapshot document + ops since snapshot', async () => {
    const storage = createStorageService();
    await storage.open(':memory:');

    try {
      const baseDoc = createDocument('Base Doc', 'board_snap_flow');
      const obj1 = createCanvasObject({ id: 'base_obj', type: 'shape' });
      baseDoc.objects[obj1.id] = obj1;
      baseDoc.rootIds.push(obj1.id);

      // Persist 1 op with document snapshot
      await storage.persistOp(
        {
          id: 'op_init',
          type: 'create',
          timestamp: 100,
          targets: [obj1.id],
          payload: { object: obj1 },
        },
        baseDoc
      );

      // Persist 2 ops after the snapshot
      const obj2 = createCanvasObject({ id: 'after_obj_1', type: 'text' });
      const obj3 = createCanvasObject({ id: 'after_obj_2', type: 'shape' });

      await storage.persistOp({
        id: 'op_after_1',
        type: 'create',
        timestamp: 200,
        targets: [obj2.id],
        payload: { object: obj2 },
      });

      await storage.persistOp({
        id: 'op_after_2',
        type: 'create',
        timestamp: 300,
        targets: [obj3.id],
        payload: { object: obj3 },
      });

      const { doc, opsSince } = await storage.loadLatestSnapshot();

      assert(doc.id === 'board_snap_flow', 'Doc ID matches');
      assert(opsSince.length === 3, `Expected 3 ops total, got ${opsSince.length}`);
      assert(opsSince[0].id === 'op_init', 'First op matches');
      assert(opsSince[1].id === 'op_after_1', 'Second op matches');
      assert(opsSince[2].id === 'op_after_2', 'Third op matches');
    } finally {
      await storage.close();
    }
  });

  await test('s5-3: Burst stress test with 500 rapid ops persists durably with zero data loss', async () => {
    const tempDir = createTempDir();
    const dbPath = path.join(tempDir, 'stress_burst.lens');
    const storage = createStorageService();
    await storage.open(dbPath);

    try {
      const doc = createDocument('Stress Board', 'board_stress');
      const promises: Promise<void>[] = [];

      for (let i = 1; i <= 500; i++) {
        const obj = createCanvasObject({ id: `burst_${i}`, type: 'shape', x: i, y: i });
        doc.objects[obj.id] = obj;
        doc.rootIds.push(obj.id);

        promises.push(
          storage.persistOp(
            {
              id: `burst_tx_${i}`,
              type: 'create',
              timestamp: Date.now(),
              targets: [obj.id],
              payload: { object: obj },
            },
            doc
          )
        );
      }

      await Promise.all(promises);
      await storage.flush();

      // Open raw DB connection to independently verify disk state
      const verifyDb = openDatabase(dbPath);
      const opCount = verifyDb.prepare('SELECT count(*) as c FROM ops').get() as { c: number };
      const objCount = verifyDb.prepare('SELECT count(*) as c FROM objects').get() as { c: number };
      const snapCount = verifyDb.prepare('SELECT count(*) as c FROM snapshots').get() as { c: number };

      assert(opCount.c === 500, `Expected 500 ops on disk, found: ${opCount.c}`);
      assert(objCount.c === 500, `Expected 500 objects on disk, found: ${objCount.c}`);
      assert(snapCount.c >= 1, `Expected at least 1 snapshot on disk at 500th boundary, found: ${snapCount.c}`);

      verifyDb.close();
    } finally {
      await storage.close();
      cleanTempDir(tempDir);
    }
  });

  // =========================================================================
  // Summary
  // =========================================================================
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('\n================================================================');
  console.log(`Results: ${passed} passed, ${failed} failed (${total} total)`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal test harness execution error:', err);
  process.exit(1);
});
