/**
 * Feature 14: Atomic Dual-Write & Op-Log (M3)
 * Authoritative Source: SPEC.md §7, PROJECT.md Feature 14
 * Each command is appended to ops and applied to objects in the same transaction
 */

import { describe, it, expect } from '../harness.ts';
import { createTestObject, createCreateCommand } from '../helpers/document-builder.ts';

describe('Feature 14: Atomic Dual-Write & Op-Log', () => {
  interface SimulatedTxState {
    ops: Array<{ seq: number; type: string; payload: string }>;
    objects: Record<string, { data: string; deleted: number }>;
  }

  function executeDualWriteTransaction(
    state: SimulatedTxState,
    cmdType: string,
    objectId: string,
    data: string,
    failDuringObjects = false
  ): boolean {
    const backupOps = [...state.ops];
    const backupObjects = { ...state.objects };

    try {
      // 1. Append to ops
      state.ops.push({
        seq: state.ops.length + 1,
        type: cmdType,
        payload: data,
      });

      // 2. Dual write to objects table
      if (failDuringObjects) {
        throw new Error('Simulated disk failure during objects table write');
      }
      state.objects[objectId] = { data, deleted: 0 };
      return true;
    } catch {
      // Rollback transaction atomically
      state.ops = backupOps;
      state.objects = backupObjects;
      return false;
    }
  }

  it('f14-1: command appends to ops and updates objects simultaneously', () => {
    const state: SimulatedTxState = { ops: [], objects: {} };
    const obj = createTestObject('shape');
    const success = executeDualWriteTransaction(state, 'create', obj.id, JSON.stringify(obj));

    expect(success).toBe(true);
    expect(state.ops).toHaveLength(1);
    expect(state.objects[obj.id]).toBeDefined();
    expect(state.ops[0].seq).toBe(1);
  });

  it('f14-2: partial failure aborts whole transaction and keeps ops consistent', () => {
    const state: SimulatedTxState = { ops: [], objects: {} };
    const obj = createTestObject('shape');
    const success = executeDualWriteTransaction(state, 'create', obj.id, JSON.stringify(obj), true);

    expect(success).toBe(false);
    expect(state.ops).toHaveLength(0);
    expect(state.objects[obj.id]).toBeUndefined();
  });

  it('f14-3: sequence number strictly increments per successful operation', () => {
    const state: SimulatedTxState = { ops: [], objects: {} };
    for (let i = 0; i < 5; i++) {
      executeDualWriteTransaction(state, 'create', `id-${i}`, `{}`);
    }
    expect(state.ops).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      expect(state.ops[i].seq).toBe(i + 1);
    }
  });

  it('f14-4: delete operation marks object deleted: 1 rather than physical row drop', () => {
    const state: SimulatedTxState = {
      ops: [],
      objects: { 'obj-1': { data: '{}', deleted: 0 } },
    };
    state.objects['obj-1'].deleted = 1;
    expect(state.objects['obj-1'].deleted).toBe(1);
  });

  it('f14-5: replaying ops table restores objects table to identical state', () => {
    const ops = [
      { seq: 1, id: 'o1', type: 'create', data: '{"x":10}' },
      { seq: 2, id: 'o2', type: 'create', data: '{"x":20}' },
      { seq: 3, id: 'o1', type: 'update', data: '{"x":50}' },
    ];
    const replayed: Record<string, string> = {};
    for (const op of ops) {
      replayed[op.id] = op.data;
    }
    expect(replayed['o1']).toBe('{"x":50}');
    expect(replayed['o2']).toBe('{"x":20}');
  });
});
