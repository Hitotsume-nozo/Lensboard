/**
 * Deep Adversarial Edge Case Verification Suite for Milestone 3 packages/storage
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const coreDistUrl = pathToFileURL(path.resolve(process.cwd(), 'packages/core/dist/index.js')).href;
register(`data:text/javascript,export async function resolve(s,c,n){if(s==="@lensboard/core")return n("${coreDistUrl}",c);return n(s,c);}`, pathToFileURL('./'));

const {
  openDatabase,
  executeDualWrite,
  GroupCommitFlusher,
  SnapshotEngine,
  quickCheck,
  salvage,
  getSalvagePath,
  createStorageService,
} = await import('../packages/storage/dist/index.js');

const {
  createDocument,
  createCanvasObject,
  apply,
} = await import('../packages/core/dist/index.js');

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'lensboard-deep-adv-'));
}

function cleanTempDir(dir: string) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

async function runDeepStress() {
  console.log('--- Deep Adversarial Edge Cases ---');

  // Edge Case 1: Corrupted JSON in ops table during salvage
  console.log('Testing Edge Case 1: Salvage with corrupted payload strings...');
  const tmp1 = createTempDir();
  try {
    const dbPath = path.join(tmp1, 'partially_corrupt.lens');
    const db = openDatabase(dbPath);
    // Write 3 valid ops and 2 corrupted ops directly
    db.prepare(`INSERT INTO ops (board_id, tx_id, ts, type, payload, inverse) VALUES (?, ?, ?, ?, ?, ?)`).run(
      'board_default', 'tx_valid_1', 100, 'create', JSON.stringify({ id: 'valid_1', object: { id: 'valid_1', type: 'shape', x: 10, y: 10 } }), '{}'
    );
    db.prepare(`INSERT INTO ops (board_id, tx_id, ts, type, payload, inverse) VALUES (?, ?, ?, ?, ?, ?)`).run(
      'board_default', 'tx_corrupt_1', 101, 'create', 'CORRUPT_NOT_JSON{{{{', '{}'
    );
    db.prepare(`INSERT INTO ops (board_id, tx_id, ts, type, payload, inverse) VALUES (?, ?, ?, ?, ?, ?)`).run(
      'board_default', 'tx_valid_2', 102, 'create', JSON.stringify({ id: 'valid_2', object: { id: 'valid_2', type: 'shape', x: 20, y: 20 } }), '{}'
    );
    db.prepare(`INSERT INTO ops (board_id, tx_id, ts, type, payload, inverse) VALUES (?, ?, ?, ?, ?, ?)`).run(
      'board_default', 'tx_corrupt_2', 103, 'unknown_type', '}{', '{}'
    );
    db.prepare(`INSERT INTO ops (board_id, tx_id, ts, type, payload, inverse) VALUES (?, ?, ?, ?, ?, ?)`).run(
      'board_default', 'tx_valid_3', 104, 'create', JSON.stringify({ id: 'valid_3', object: { id: 'valid_3', type: 'shape', x: 30, y: 30 } }), '{}'
    );
    db.close();

    const recovered = salvage(dbPath, 'board_default');
    assert(recovered.objects['valid_1'] !== undefined, 'valid_1 must be recovered');
    assert(recovered.objects['valid_2'] !== undefined, 'valid_2 must be recovered');
    assert(recovered.objects['valid_3'] !== undefined, 'valid_3 must be recovered');
    console.log('✔ Edge Case 1 Passed: Salvage gracefully skips corrupted ops and reconstructs all valid entities.');
  } finally {
    cleanTempDir(tmp1);
  }

  // Edge Case 2: Deeply nested Unicode and Special characters in objects & ops
  console.log('Testing Edge Case 2: Extreme Unicode, RTL, Emoji, and 100KB payload...');
  const tmp2 = createTempDir();
  try {
    const dbPath = path.join(tmp2, 'unicode.lens');
    const storage = createStorageService();
    await storage.open(dbPath);

    const unicodeText = '🔥 Unicode Test: 复杂的中文, עִברִית, العربية, 𝕸𝖆𝖙𝖍, ﷽, \u0000 escaped null';
    const largeBlob = 'A'.repeat(100 * 1024); // 100KB text
    const obj = createCanvasObject({
      id: 'unicode_obj',
      type: 'text',
      data: { text: unicodeText, blob: largeBlob },
    });

    const doc = createDocument('Unicode Board', 'b_uni');
    doc.objects[obj.id] = obj;
    doc.rootIds.push(obj.id);

    await storage.persistOp(
      {
        id: 'tx_uni',
        type: 'create',
        timestamp: Date.now(),
        targets: [obj.id],
        payload: { object: obj },
      },
      doc
    );
    await storage.flush();

    const { doc: loadedDoc, opsSince } = await storage.loadLatestSnapshot();
    assert(loadedDoc.objects['unicode_obj'] !== undefined, 'Object must persist with complex data');
    const retrievedObj = loadedDoc.objects['unicode_obj'];
    assert((retrievedObj.data as any)?.text === unicodeText, 'Unicode string preserved bit-exact');
    assert((retrievedObj.data as any)?.blob.length === 100 * 1024, '100KB payload preserved');

    await storage.close();
    console.log('✔ Edge Case 2 Passed: Unicode, emojis, RTL, and large payload persisted durably.');
  } finally {
    cleanTempDir(tmp2);
  }

  // Edge Case 3: Rapid Create -> Delete -> Revive cycles for same ULID
  console.log('Testing Edge Case 3: Rapid Create -> Delete -> Revive cycle for identical entity ID...');
  const tmp3 = createTempDir();
  try {
    const dbPath = path.join(tmp3, 'revive.lens');
    const db = openDatabase(dbPath);

    const id = 'reusable_id_001';
    for (let cycle = 1; cycle <= 10; cycle++) {
      // 1. Create
      const obj = createCanvasObject({ id, type: 'shape', x: cycle * 10 });
      executeDualWrite(db, 'board_default', {
        id: `tx_create_${cycle}`,
        type: 'create',
        timestamp: cycle * 100,
        targets: [id],
        payload: { object: obj },
      });

      const rowCreated = db.prepare('SELECT deleted, data FROM objects WHERE id = ?').get(id) as any;
      assert(rowCreated.deleted === 0, `Cycle ${cycle}: Object must be active (deleted: 0)`);
      assert(JSON.parse(rowCreated.data).x === cycle * 10, `Cycle ${cycle}: Data updated to ${cycle * 10}`);

      // 2. Soft Delete
      executeDualWrite(db, 'board_default', {
        id: `tx_del_${cycle}`,
        type: 'delete',
        timestamp: cycle * 100 + 50,
        targets: [id],
        payload: { id },
      });

      const rowDeleted = db.prepare('SELECT deleted FROM objects WHERE id = ?').get(id) as any;
      assert(rowDeleted.deleted === 1, `Cycle ${cycle}: Object must be soft-deleted (deleted: 1)`);
    }

    // Exactly 1 row in objects table (no duplicates)
    const count = db.prepare('SELECT count(*) as c FROM objects').get() as { c: number };
    assert(count.c === 1, `Expected exactly 1 object row in table, found: ${count.c}`);

    // Exactly 20 ops in ops table
    const opCount = db.prepare('SELECT count(*) as c FROM ops').get() as { c: number };
    assert(opCount.c === 20, `Expected exactly 20 ops, found: ${opCount.c}`);

    db.close();
    console.log('✔ Edge Case 3 Passed: 10 cycles of create/delete/revive maintained upsert integrity with zero duplicates.');
  } finally {
    cleanTempDir(tmp3);
  }

  // Edge Case 4: 1,000 Burst Ops Stress Test with Random Flushes
  console.log('Testing Edge Case 4: 1,000 Burst operations with random flushes and snapshots...');
  const tmp4 = createTempDir();
  try {
    const dbPath = path.join(tmp4, 'burst_1000.lens');
    const storage = createStorageService();
    await storage.open(dbPath);

    const doc = createDocument('Stress 1000', 'b_1000');
    const promises: Promise<void>[] = [];

    for (let i = 1; i <= 1000; i++) {
      const obj = createCanvasObject({ id: `obj_${i}`, type: 'shape', x: i, y: i });
      doc.objects[obj.id] = obj;
      doc.rootIds.push(obj.id);

      promises.push(
        storage.persistOp(
          {
            id: `tx_1000_${i}`,
            type: 'create',
            timestamp: Date.now(),
            targets: [obj.id],
            payload: { object: obj },
          },
          doc
        )
      );

      // Random intermediate flush every ~200 ops
      if (i % 200 === 0) {
        await Promise.all(promises.splice(0));
        await storage.flush();
      }
    }

    await Promise.all(promises);
    await storage.flush();

    // Verify disk consistency
    const diskDb = openDatabase(dbPath);
    const opCount = diskDb.prepare('SELECT count(*) as c FROM ops').get() as { c: number };
    const objCount = diskDb.prepare('SELECT count(*) as c FROM objects').get() as { c: number };
    const snapCount = diskDb.prepare('SELECT count(*) as c FROM snapshots').get() as { c: number };

    assert(opCount.c === 1000, `Expected 1000 ops, got: ${opCount.c}`);
    assert(objCount.c === 1000, `Expected 1000 objects, got: ${objCount.c}`);
    assert(snapCount.c >= 2, `Expected at least 2 snapshots (every 500 ops), got: ${snapCount.c}`);

    diskDb.close();
    await storage.close();
    console.log('✔ Edge Case 4 Passed: 1,000 burst ops with random flushes and snapshots completed with zero loss.');
  } finally {
    cleanTempDir(tmp4);
  }

  console.log('\n--- All Deep Adversarial Tests PASSED! ---');
}

runDeepStress().catch((err) => {
  console.error('Deep stress failed:', err);
  process.exit(1);
});
