/**
 * Adversarial Stress & Property Test Suite for Milestone 3 (Core Engine & SQLite Storage)
 * Reviewer & Critic: reviewer_m3_2_g5
 * Execution: node tests/adversarial-m3.mjs
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import fc from 'fast-check';

// Set up ESM resolution for workspace packages
const coreUrl = pathToFileURL(path.resolve('packages/core/dist/index.js')).href;
const loaderCode = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@lensboard/core') {
    return {
      url: '${coreUrl}',
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
`;
register('data:text/javascript,' + encodeURIComponent(loaderCode), import.meta.url);

const core = await import('../packages/core/dist/index.js');
const storage = await import('../packages/storage/dist/index.js');

console.log('================================================================');
console.log('  CRITIC & REVIEWER M3: Adversarial Stress & Verification Harness');
console.log('================================================================\n');

let totalAssertions = 0;
function check(condition, message) {
  totalAssertions++;
  assert(condition, message);
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lensboard-adv-m3-'));

try {
  // ----------------------------------------------------------------------------
  // 1. Reducer Purity & Mathematical Inversion Invariants
  // ----------------------------------------------------------------------------
  console.log('▶ [Suite 1] Pure Reducer & Exact Mathematical Inverses');

  // Input doc immutability check
  {
    const originalDoc = core.createDocument('Immutable Board');
    const shape = core.createCanvasObject({ id: 's1', type: 'shape', x: 10, y: 20 });
    originalDoc.objects['s1'] = shape;
    originalDoc.rootIds = ['s1'];

    const snapshot = JSON.stringify(originalDoc);

    const moveCmd = {
      id: 'cmd-1',
      type: 'move',
      timestamp: 1000,
      targets: ['s1'],
      payload: { patch: { x: 99, y: 88 } },
    };

    const res = core.apply(originalDoc, moveCmd);
    check(res.doc.objects['s1'].x === 99, 'Applied document has updated x');
    check(originalDoc.objects['s1'].x === 10, 'Original document x must remain 10 (no mutation)');
    check(JSON.stringify(originalDoc) === snapshot, 'Original document must be byte-for-byte immutable');
  }

  // Exact inversion across all 12 command types
  {
    const doc = core.createDocument('Inversion Test Board');
    const ink = core.createStrokeObject([{ x: 1, y: 1, t: 10 }, { x: 5, y: 5, t: 20 }], { id: 'ink_1' });
    doc.objects['ink_1'] = ink;
    doc.rootIds = ['ink_1'];

    // 1. create
    const obj1 = core.createCanvasObject({ id: 'o1', type: 'shape', x: 50, y: 60 });
    const c1 = { id: 'c1', type: 'create', timestamp: 100, targets: ['o1'], payload: { object: obj1 } };
    const r1 = core.apply(doc, c1);
    check(core.apply(r1.doc, r1.inverse).doc.objects['o1'] === undefined, 'create inverse deletes object');

    // 2. move
    const c2 = { id: 'c2', type: 'move', timestamp: 200, targets: ['o1'], payload: { patch: { x: 150, y: 260 } } };
    const r2 = core.apply(r1.doc, c2);
    check(r2.doc.objects['o1'].x === 150, 'move applied');
    check(core.apply(r2.doc, r2.inverse).doc.objects['o1'].x === 50, 'move inverse restores exact x');

    // 3. resize
    const c3 = { id: 'c3', type: 'resize', timestamp: 300, targets: ['o1'], payload: { patch: { w: 400, h: 300 } } };
    const r3 = core.apply(r2.doc, c3);
    check(core.apply(r3.doc, r3.inverse).doc.objects['o1'].w === obj1.w, 'resize inverse restores exact w');

    // 4. setStyle
    const c4 = { id: 'c4', type: 'setStyle', timestamp: 400, targets: ['o1'], payload: { patch: { style: { colorId: 'orange', strokeWidth: 8, renderMode: 'sketch' } } } };
    const r4 = core.apply(r3.doc, c4);
    check(core.apply(r4.doc, r4.inverse).doc.objects['o1'].style.colorId === 'ink', 'setStyle inverse restores original style');

    // 5. update
    const c5 = { id: 'c5', type: 'update', timestamp: 500, targets: ['o1'], payload: { patch: { rotation: 90 } } };
    const r5 = core.apply(r4.doc, c5);
    check(core.apply(r5.doc, r5.inverse).doc.objects['o1'].rotation === 0, 'update inverse restores original rotation');

    // 6. reorder
    const c6 = { id: 'c6', type: 'reorder', timestamp: 600, targets: ['o1'], payload: { z: 'a9' } };
    const r6 = core.apply(r5.doc, c6);
    check(core.apply(r6.doc, r6.inverse).doc.objects['o1'].z === obj1.z, 'reorder inverse restores original z');

    // 7. group & 8. ungroup
    const c7 = { id: 'c7', type: 'group', timestamp: 700, targets: ['o1'], payload: { frameId: 'frame_1' } };
    const r7 = core.apply(r6.doc, c7);
    check(r7.doc.objects['o1'].parentId === 'frame_1', 'group sets parentId');
    const r8 = core.apply(r7.doc, r7.inverse);
    check(r8.doc.objects['o1'].parentId === null, 'ungroup inverse restores null parentId');

    // 9. convertInk & 10. revertConversion
    const convObj = core.createCanvasObject({ id: 'conv_1', type: 'shape' });
    const c9 = { id: 'c9', type: 'convertInk', timestamp: 900, targets: ['conv_1'], payload: { newObject: convObj, sourceInkIds: ['ink_1'] } };
    const r9 = core.apply(r8.doc, c9);
    check(r9.doc.objects['ink_1'].hidden === true, 'convertInk hides source ink');
    check(r9.doc.objects['conv_1'].sourceInk[0] === 'ink_1', 'new object records source ink ID');
    const r10 = core.apply(r9.doc, r9.inverse);
    check(r10.doc.objects['ink_1'].hidden === false, 'revertConversion unhides source ink');
    check(r10.doc.objects['conv_1'] === undefined, 'revertConversion deletes converted object');

    // 11. batch
    const itemX = core.createCanvasObject({ id: 'ix' });
    const itemY = core.createCanvasObject({ id: 'iy' });
    const c11 = {
      id: 'c11',
      type: 'batch',
      timestamp: 1100,
      targets: ['ix', 'iy'],
      payload: {
        commands: [
          { id: 'sub1', type: 'create', timestamp: 1101, targets: ['ix'], payload: { object: itemX } },
          { id: 'sub2', type: 'create', timestamp: 1102, targets: ['iy'], payload: { object: itemY } },
        ],
      },
    };
    const r11 = core.apply(r10.doc, c11);
    check(r11.doc.objects['ix'] && r11.doc.objects['iy'], 'batch created both items');
    const r11Rev = core.apply(r11.doc, r11.inverse);
    check(!r11Rev.doc.objects['ix'] && !r11Rev.doc.objects['iy'], 'batch inverse removed both items');

    // 12. setViewport
    const c12 = { id: 'c12', type: 'setViewport', timestamp: 1200, targets: [], payload: { viewport: { x: 300, y: -400, zoom: 2.5 } } };
    const r12 = core.apply(r11Rev.doc, c12);
    check(r12.doc.viewport.zoom === 2.5, 'viewport updated');
    const r12Rev = core.apply(r12.doc, r12.inverse);
    check(r12Rev.doc.viewport.zoom === 1.0, 'viewport inverse restored');
  }

  // fast-check property test: 1,000 runs of random (x, y) move and inverse
  fc.assert(
    fc.property(
      fc.integer({ min: -10000, max: 10000 }),
      fc.integer({ min: -10000, max: 10000 }),
      fc.integer({ min: -10000, max: 10000 }),
      fc.integer({ min: -10000, max: 10000 }),
      (xInit, yInit, xMove, yMove) => {
        const d = core.createDocument();
        const obj = core.createCanvasObject({ id: 'fc_obj', x: xInit, y: yInit });
        d.objects['fc_obj'] = obj;
        d.rootIds = ['fc_obj'];

        const cmd = {
          id: 'fc_cmd',
          type: 'move',
          timestamp: 1000,
          targets: ['fc_obj'],
          payload: { patch: { x: xMove, y: yMove } },
        };

        const res = core.apply(d, cmd);
        const restored = core.apply(res.doc, res.inverse).doc;
        return restored.objects['fc_obj'].x === xInit && restored.objects['fc_obj'].y === yInit;
      }
    ),
    { numRuns: 1000 }
  );
  console.log('  ✔ Passed fast-check (1,000 runs): apply(apply(D, move), move^-1) === D');

  // Fast-check property test: 1,000 runs of sanitizeCoordinate and clampZoom
  fc.assert(
    fc.property(fc.double({ noNaN: false }), (rawCoord) => {
      const sanitized = core.sanitizeCoordinate(rawCoord);
      return Number.isFinite(sanitized) && !Number.isNaN(sanitized);
    }),
    { numRuns: 1000 }
  );
  console.log('  ✔ Passed fast-check (1,000 runs): sanitizeCoordinate produces finite float64');

  fc.assert(
    fc.property(fc.double({ noNaN: false }), (rawZoom) => {
      const clamped = core.clampZoom(rawZoom);
      return clamped >= 0.02 && clamped <= 64.0 && Number.isFinite(clamped);
    }),
    { numRuns: 1000 }
  );
  console.log('  ✔ Passed fast-check (1,000 runs): clampZoom bounded strictly in [0.02, 64.0]');

  // ----------------------------------------------------------------------------
  // 2. Command Coalescing & HistoryManager
  // ----------------------------------------------------------------------------
  console.log('\n▶ [Suite 2] Command Coalescing & HistoryManager Stress Testing');

  // Coalescing boundary: 300ms vs 301ms
  {
    const cPrev = { id: 'c1', type: 'move', timestamp: 1000, targets: ['obj1'], payload: { patch: { x: 10 } } };
    const cAt300 = { id: 'c2', type: 'move', timestamp: 1300, targets: ['obj1'], payload: { patch: { x: 20 } } };
    const cAt301 = { id: 'c3', type: 'move', timestamp: 1301, targets: ['obj1'], payload: { patch: { x: 30 } } };

    check(core.shouldCoalesce(cPrev, cAt300) === true, 'Delta exactly 300ms qualifies for coalescing');
    check(core.shouldCoalesce(cPrev, cAt301) === false, 'Delta 301ms splits into new command');

    // Negative timestamp diff must not coalesce
    const cNegative = { id: 'c_neg', type: 'move', timestamp: 999, targets: ['obj1'], payload: { patch: { x: 5 } } };
    check(core.shouldCoalesce(cPrev, cNegative) === false, 'Negative time diff must not coalesce');

    // Different targets must not coalesce
    const cDiffTarget = { id: 'c_diff', type: 'move', timestamp: 1100, targets: ['obj2'], payload: { patch: { x: 20 } } };
    check(core.shouldCoalesce(cPrev, cDiffTarget) === false, 'Different targets must not coalesce');
  }

  // Coalescing preserves INITIAL pre-drag inverse state
  {
    const doc = core.createDocument();
    const box = core.createCanvasObject({ id: 'box', x: 0, y: 0 });
    doc.objects['box'] = box;
    doc.rootIds = ['box'];

    const hm = new core.HistoryManager(doc);

    // 5 moves within 300ms intervals
    hm.apply({ id: 'm1', type: 'move', timestamp: 100, targets: ['box'], payload: { patch: { x: 10 } } });
    hm.apply({ id: 'm2', type: 'move', timestamp: 200, targets: ['box'], payload: { patch: { x: 20 } } });
    hm.apply({ id: 'm3', type: 'move', timestamp: 300, targets: ['box'], payload: { patch: { x: 30 } } });
    hm.apply({ id: 'm4', type: 'move', timestamp: 400, targets: ['box'], payload: { patch: { x: 40 } } });
    hm.apply({ id: 'm5', type: 'move', timestamp: 500, targets: ['box'], payload: { patch: { x: 50 } } });

    check(hm.getUndoStack().length === 1, 'All 5 rapid moves coalesced into exactly 1 undo entry');
    check(hm.getDocument().objects['box'].x === 50, 'Current state is x: 50');

    // Undo must restore x: 0 (the initial pre-drag position, NOT x: 40!)
    const undone = hm.undo();
    check(undone !== null, 'Undo executed');
    check(hm.getDocument().objects['box'].x === 0, 'Undo restored initial pre-drag x = 0');

    // Redo restores x: 50
    hm.redo();
    check(hm.getDocument().objects['box'].x === 50, 'Redo restored final coalesced x = 50');
  }

  // History capacity clamp at 5,000 commands
  {
    const doc = core.createDocument();
    const hm = new core.HistoryManager(doc, 5000);

    for (let i = 0; i < 5050; i++) {
      hm.apply({
        id: `seq_${i}`,
        type: 'setViewport',
        timestamp: 1000 + i * 1000, // Non-coalescing
        targets: [],
        payload: { viewport: { x: i, y: 0, zoom: 1 } },
      });
    }

    check(hm.getUndoStack().length === 5000, 'Undo stack strictly clamped at 5,000 capacity');
    check(hm.getUndoStack()[0].command.id === 'seq_50', 'Oldest 50 commands purged via FIFO');

    // Safe no-op on empty redo
    check(hm.canRedo() === false, 'canRedo is false');
    check(hm.redo() === null, 'redo on empty stack returns null');
  }

  // ----------------------------------------------------------------------------
  // 3. Shortcut Registry & Context Isolation
  // ----------------------------------------------------------------------------
  console.log('\n▶ [Suite 3] Shortcut Registry & Context Conflict Detection');

  // Conflict detection within same context
  {
    const conflicts = core.detectDuplicateBindings([
      { id: 'b1', keys: 'Ctrl+Shift+Z', context: 'global', action: 'redo' },
      { id: 'b2', keys: 'ctrl + shift + z', context: 'global', action: 'otherRedo' },
    ]);
    check(conflicts.length === 1, 'Duplicate binding in same context detected');
    check(conflicts[0].includes('Conflict detected'), 'Conflict message contains details');
  }

  // Identical binding in DIFFERENT contexts allowed
  {
    const conflicts = core.detectDuplicateBindings([
      { id: 'b1', keys: 'Enter', context: 'canvas', action: 'edit' },
      { id: 'b2', keys: 'Enter', context: 'editor', action: 'newline' },
    ]);
    check(conflicts.length === 0, 'Identical keys permitted across canvas and editor contexts');
  }

  // Single-key suppression during editor focus
  {
    const reg = new core.ShortcutRegistry(core.DEFAULT_SHORTCUT_BINDINGS);
    check(reg.checkConflicts().length === 0, 'Default bindings have zero conflicts');

    const penBinding = reg.getBinding('tool-pen');
    check(penBinding.keys === 'P', 'Pen shortcut is P');
    check(reg.isShortcutActive(penBinding, false) === true, 'P is active when editor has no focus');
    check(reg.isShortcutActive(penBinding, true) === false, 'P is suppressed when editor has focus');

    // Multi-key binding NOT suppressed during editor focus
    const undoBinding = reg.getBinding('history-undo');
    check(reg.isShortcutActive(undoBinding, true) === true, 'Ctrl+Z remains active during editor focus');
  }

  // ----------------------------------------------------------------------------
  // 4. SQLite WAL Mode, Group Commits, Dual-Write & Salvage
  // ----------------------------------------------------------------------------
  console.log('\n▶ [Suite 4] SQLite WAL Storage, Op-Log & Non-Destructive Salvage');

  // SQLite PRAGMAs & 10 Tables
  {
    const dbPath = path.join(tempDir, 'storage_test.lens');
    const db = storage.openDatabase(dbPath);

    // Verify WAL mode
    const walRow = db.prepare('PRAGMA journal_mode').get();
    check(walRow.journal_mode.toLowerCase() === 'wal', 'journal_mode is WAL');

    // Verify busy timeout = 5000
    const timeoutRow = db.prepare('PRAGMA busy_timeout').get();
    check(Number(timeoutRow.timeout) === 5000, 'busy_timeout is 5000ms');

    // Verify foreign keys = ON (1)
    const fkRow = db.prepare('PRAGMA foreign_keys').get();
    check(Number(fkRow.foreign_keys) === 1, 'foreign_keys is enabled');

    // Verify all 10 tables
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((t) => t.name);
    const required = ['meta', 'projects', 'boards', 'objects', 'ops', 'snapshots', 'assets', 'reviews', 'links', 'search'];
    for (const req of required) {
      check(tables.includes(req), `Schema includes table "${req}"`);
    }

    db.close();
  }

  // Atomic Dual-Write Transaction
  {
    const dbPath = path.join(tempDir, 'dual_write.lens');
    const db = storage.openDatabase(dbPath);

    const testObj = core.createCanvasObject({ id: 'dw_1', type: 'text', x: 20, y: 30 });
    const seq = storage.executeDualWrite(db, 'board_default', {
      id: 'tx_create_dw',
      type: 'create',
      timestamp: 1000,
      targets: ['dw_1'],
      payload: { object: testObj },
    });
    check(seq === 1, 'First op has seq 1');

    const opRow = db.prepare('SELECT * FROM ops WHERE seq = 1').get();
    check(opRow.tx_id === 'tx_create_dw', 'Op record stored tx_id');

    const objRow = db.prepare('SELECT * FROM objects WHERE id = ?').get('dw_1');
    check(objRow.deleted === 0, 'Object row created with deleted = 0');

    // Soft delete
    storage.executeDualWrite(db, 'board_default', {
      id: 'tx_del_dw',
      type: 'delete',
      timestamp: 1100,
      targets: ['dw_1'],
      payload: { id: 'dw_1' },
    });

    const objRowAfterDel = db.prepare('SELECT * FROM objects WHERE id = ?').get('dw_1');
    check(objRowAfterDel.deleted === 1, 'Object row marked deleted = 1 (soft delete preserved)');

    db.close();
  }

  // Group Commit Debouncer & Flush
  {
    let commitCount = 0;
    let flushedOps = 0;
    const flusher = new storage.GroupCommitFlusher(async (batch) => {
      commitCount++;
      flushedOps += batch.length;
    }, 100);

    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(
        flusher.enqueue('b1', {
          id: `cmd_${i}`,
          type: 'move',
          timestamp: 1000 + i,
          targets: ['target'],
          payload: { patch: { x: i } },
        })
      );
    }

    check(flusher.getState() === 'dirty', 'Flusher state transitioned to dirty');
    check(flusher.getPendingCount() === 20, 'Queue has 20 pending items');

    // Immediate flush
    await flusher.flush();
    check(flusher.getState() === 'saved', 'Flusher state transitioned to saved');
    check(flusher.getPendingCount() === 0, 'Queue is empty after flush');
    check(commitCount === 1, 'All 20 operations grouped into exactly 1 batch commit');
    check(flushedOps === 20, 'All 20 operations accounted for');

    await Promise.all(promises);
  }

  // Snapshots & Compaction
  {
    const db = storage.openDatabase(':memory:');
    const engine = new storage.SnapshotEngine(db, 500, 300000);

    const doc = core.createDocument('Snapshot Test', 'b_snap');
    engine.createSnapshot('board_default', doc, 50, 'Starred V1', 1);

    for (let i = 1; i <= 5; i++) {
      engine.createSnapshot('board_default', doc, 50 + i, `V${i}`, 0);
    }

    engine.pruneOldSnapshots('board_default', 2);

    const starredRows = db.prepare('SELECT * FROM snapshots WHERE starred = 1').all();
    check(starredRows.length === 1, 'Starred snapshot was retained during pruning');
    check(starredRows[0].at_seq === 50, 'Starred snapshot sequence number matches');

    db.close();
  }

  // Non-destructive Salvage Mode
  {
    const damagedFile = path.join(tempDir, 'damaged.lens');
    const db = storage.openDatabase(damagedFile);

    const o1 = core.createCanvasObject({ id: 'rec_1', type: 'shape', x: 100, y: 150 });
    storage.executeDualWrite(db, 'board_default', {
      id: 'tx_rec1',
      type: 'create',
      timestamp: 1000,
      targets: ['rec_1'],
      payload: { object: o1 },
    });
    db.close();

    const damagedSizeBefore = fs.statSync(damagedFile).size;

    // Salvage
    const recoveredDoc = storage.salvage(damagedFile, 'board_default');
    check(recoveredDoc.objects['rec_1'] !== undefined, 'Salvaged document contains recovered object');
    check(recoveredDoc.objects['rec_1'].x === 100, 'Recovered object geometry restored');

    // Check that original damaged file is unmodified
    const damagedSizeAfter = fs.statSync(damagedFile).size;
    check(damagedSizeAfter === damagedSizeBefore, 'Original damaged file was NOT overwritten');

    // Check that salvaged file was created
    const salvagePath = storage.getSalvagePath(damagedFile);
    check(fs.existsSync(salvagePath), 'workspace.salvaged.lens created');
  }

  console.log('\n================================================================');
  console.log(`  ALL CRITIC ADVERSARIAL ASSERTIONS PASSED! Total assertions checked: ${totalAssertions}`);
  console.log('  Fast-check property runs: 3,000 executions without failure');
  console.log('================================================================\n');

} finally {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}
}
