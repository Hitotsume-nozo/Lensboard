import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Command, LensDocument } from '@lensboard/core';
import { createDocument, createCanvasObject } from '@lensboard/core';
import {
  SCHEMA_DDL,
  SCHEMA_PRAGMAS,
  createStorageService,
  openDatabase,
  executeDualWrite,
  SnapshotEngine,
  quickCheck,
  salvage,
  getSalvagePath,
  type StorageService,
} from './index.js';

describe('@lensboard/storage Comprehensive Unit Tests', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lensboard-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('Schema DDL & PRAGMAs', () => {
    it('defines all 10 specification tables including FTS5 search', () => {
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
      for (const table of requiredTables) {
        expect(SCHEMA_DDL).toContain(table);
      }
      expect(SCHEMA_DDL).toContain('PRAGMA journal_mode = WAL;');
      expect(SCHEMA_DDL).toContain('CREATE VIRTUAL TABLE IF NOT EXISTS search USING fts5');
      expect(SCHEMA_PRAGMAS).toContain('journal_mode = WAL');
      expect(SCHEMA_PRAGMAS).toContain('synchronous = NORMAL');
      expect(SCHEMA_PRAGMAS).toContain('foreign_keys = ON');
      expect(SCHEMA_PRAGMAS).toContain('busy_timeout = 5000');
    });

    it('enforces foreign key constraints and schema relations', () => {
      const db = openDatabase(':memory:');
      // Inserting board with non-existent project_id fails due to PRAGMA foreign_keys = ON
      expect(() => {
        db.prepare(
          `INSERT INTO boards (id, project_id, title, kind, meta, created_at, updated_at)
           VALUES ('b1', 'non_existent_project', 'Title', 'canvas', '{}', 1, 1)`
        ).run();
      }).toThrow();
      db.close();
    });
  });

  describe('StorageService Lifecycle Contract', () => {
    it('opens in-memory database and passes quickCheck', async () => {
      const storage: StorageService = createStorageService();
      await storage.open(':memory:');

      const isHealthy = await storage.quickCheck();
      expect(isHealthy).toBe(true);

      await storage.close();
    });

    it('throws error when persisting operation to closed storage service', async () => {
      const storage: StorageService = createStorageService();
      const cmd: Command = {
        id: 'cmd_1',
        type: 'create',
        timestamp: 1000,
        targets: ['obj_1'],
        payload: { id: 'obj_1' },
      };

      await expect(storage.persistOp(cmd)).rejects.toThrow('Storage service is not open');
    });

    it('persists operation and loads latest snapshot state', async () => {
      const storage: StorageService = createStorageService();
      await storage.open(':memory:');

      const testDoc: LensDocument = createDocument('Persistent Board', 'board_1');
      const testObj = createCanvasObject({ id: 'obj_1', type: 'shape', x: 10, y: 20 });

      const cmd: Command = {
        id: 'op_1',
        type: 'create',
        timestamp: 1000,
        targets: [testObj.id],
        payload: { object: testObj },
      };

      await storage.persistOp(cmd, testDoc);
      const { doc, opsSince } = await storage.loadLatestSnapshot();

      expect(doc.id).toBe('board_1');
      expect(opsSince.length).toBe(1);
      expect(opsSince[0].id).toBe('op_1');

      await storage.flush();
      await storage.close();
    });
  });

  describe('Atomic Dual-Write & Op-Log', () => {
    it('appends to ops and updates objects simultaneously', () => {
      const db = openDatabase(':memory:');
      const testObj = createCanvasObject({ id: 'shape_1', type: 'shape', x: 50, y: 60 });
      const cmd: Command = {
        id: 'tx_1',
        type: 'create',
        timestamp: 1000,
        targets: [testObj.id],
        payload: { object: testObj },
      };

      const seq = executeDualWrite(db, 'board_default', cmd);
      expect(seq).toBe(1);

      // Verify row in ops table
      const opRow = db.prepare('SELECT * FROM ops WHERE seq = 1').get() as any;
      expect(opRow).toBeDefined();
      expect(opRow.tx_id).toBe('tx_1');
      expect(opRow.type).toBe('create');

      // Verify row in objects table
      const objRow = db.prepare('SELECT * FROM objects WHERE id = ?').get(testObj.id) as any;
      expect(objRow).toBeDefined();
      expect(objRow.deleted).toBe(0);

      db.close();
    });

    it('delete operation soft-deletes by setting deleted: 1', () => {
      const db = openDatabase(':memory:');
      const testObj = createCanvasObject({ id: 'shape_2', type: 'shape' });

      // Create
      executeDualWrite(db, 'board_default', {
        id: 'tx_create',
        type: 'create',
        timestamp: 1000,
        targets: [testObj.id],
        payload: { object: testObj },
      });

      // Delete
      executeDualWrite(db, 'board_default', {
        id: 'tx_delete',
        type: 'delete',
        timestamp: 1100,
        targets: [testObj.id],
        payload: { id: testObj.id },
      });

      // Verify objects row is marked deleted: 1 rather than physical row drop
      const objRow = db.prepare('SELECT * FROM objects WHERE id = ?').get(testObj.id) as any;
      expect(objRow).toBeDefined();
      expect(objRow.deleted).toBe(1);

      db.close();
    });

    it('sequence number strictly autoincrements per operation', () => {
      const db = openDatabase(':memory:');
      for (let i = 1; i <= 5; i++) {
        const seq = executeDualWrite(db, 'board_default', {
          id: `tx_${i}`,
          type: 'create',
          timestamp: 1000 + i,
          targets: [`id_${i}`],
          payload: { id: `id_${i}` },
        });
        expect(seq).toBe(i);
      }
      db.close();
    });
  });

  describe('Snapshots & Compaction', () => {
    it('creates and loads snapshots with data blob and at_seq', () => {
      const db = openDatabase(':memory:');
      const engine = new SnapshotEngine(db);

      const doc = createDocument('Snapshot Test', 'board_snap');
      const snapId = engine.createSnapshot('board_default', doc, 50, 'v1', 1);
      expect(snapId).toBeDefined();

      const latest = engine.loadLatest('board_default');
      expect(latest).toBeDefined();
      expect(latest?.doc.id).toBe('board_snap');
      expect(latest?.atSeq).toBe(50);

      db.close();
    });

    it('snapshot condition triggers at 500 ops threshold', () => {
      const db = openDatabase(':memory:');
      const engine = new SnapshotEngine(db);

      for (let i = 0; i < 499; i++) {
        engine.recordOp();
      }
      expect(engine.shouldSnapshot()).toBe(false);

      engine.recordOp(); // 500th op
      expect(engine.shouldSnapshot()).toBe(true);

      db.close();
    });
  });

  describe('Integrity & Non-Destructive Salvage', () => {
    it('quickCheck returns false on corrupted or 0-byte file', () => {
      const zeroByteFile = path.join(tempDir, 'empty.lens');
      fs.writeFileSync(zeroByteFile, Buffer.alloc(0));
      expect(quickCheck(zeroByteFile)).toBe(false);

      const garbageFile = path.join(tempDir, 'corrupt.lens');
      fs.writeFileSync(garbageFile, 'not-a-sqlite-database-header');
      expect(quickCheck(garbageFile)).toBe(false);
    });

    it('salvage mode recovers uncorrupted ops into .salvaged.lens without overwriting original', async () => {
      const originalFile = path.join(tempDir, 'board.lens');
      const db = openDatabase(originalFile);

      // Persist 3 valid operations
      const obj1 = createCanvasObject({ id: 'o1', type: 'shape', x: 10, y: 20 });
      const obj2 = createCanvasObject({ id: 'o2', type: 'shape', x: 30, y: 40 });

      executeDualWrite(db, 'board_default', {
        id: 'tx1',
        type: 'create',
        timestamp: 1000,
        targets: [obj1.id],
        payload: { object: obj1 },
      });
      executeDualWrite(db, 'board_default', {
        id: 'tx2',
        type: 'create',
        timestamp: 1001,
        targets: [obj2.id],
        payload: { object: obj2 },
      });
      db.close();

      // Original file exists and has size
      const originalStatBefore = fs.statSync(originalFile);

      // Run salvage recovery
      const salvagedDoc = salvage(originalFile, 'board_default');
      expect(salvagedDoc).toBeDefined();
      expect(salvagedDoc.objects['o1']).toBeDefined();
      expect(salvagedDoc.objects['o2']).toBeDefined();

      // Verify the salvaged file was created with correct naming pattern
      const expectedSalvagePath = getSalvagePath(originalFile);
      expect(expectedSalvagePath).not.toBe(originalFile);
      expect(fs.existsSync(expectedSalvagePath)).toBe(true);

      // Original file was NOT overwritten
      const originalStatAfter = fs.statSync(originalFile);
      expect(originalStatAfter.size).toBe(originalStatBefore.size);
    });
  });
});
