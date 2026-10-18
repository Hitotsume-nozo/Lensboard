/**
 * Feature 10: Typed Command Inversion (M3)
 * Authoritative Source: SPEC.md §6, PROJECT.md Feature 10
 * Serializable commands, pure reducer, exact inverses: apply(doc, cmd) => { doc, inverse }
 */

import { describe, it, expect } from '../harness.ts';
import {
  createEmptyDocument,
  createTestObject,
  createCreateCommand,
  createUpdateCommand,
  createDeleteCommand,
} from '../helpers/document-builder.ts';
import { applyCommandOracle } from '../helpers/oracle.ts';

describe('Feature 10: Typed Command Inversion', () => {
  it('f10-1: create command generates exact delete inverse', () => {
    const doc = createEmptyDocument();
    const obj = createTestObject('shape');
    const cmd = createCreateCommand(obj);

    const { doc: nextDoc, inverse } = applyCommandOracle(doc, cmd);
    expect(nextDoc.objects[obj.id]).toBeDefined();
    expect(inverse.type).toBe('delete');
    expect(inverse.targets[0]).toBe(obj.id);

    // Apply inverse
    const { doc: restoredDoc } = applyCommandOracle(nextDoc, inverse);
    expect(restoredDoc.objects[obj.id]).toBeUndefined();
    expect(restoredDoc.rootIds).toHaveLength(0);
  });

  it('f10-2: delete command generates create inverse restoring original state', () => {
    const doc = createEmptyDocument();
    const obj = createTestObject('shape', { x: 42, y: 84 });
    doc.objects[obj.id] = obj;
    doc.rootIds.push(obj.id);

    const cmd = createDeleteCommand(obj.id);
    const { doc: nextDoc, inverse } = applyCommandOracle(doc, cmd);
    expect(nextDoc.objects[obj.id]).toBeUndefined();
    expect(inverse.type).toBe('create');

    const { doc: restoredDoc } = applyCommandOracle(nextDoc, inverse);
    expect(restoredDoc.objects[obj.id]).toBeDefined();
    expect(restoredDoc.objects[obj.id].x).toBe(42);
    expect(restoredDoc.objects[obj.id].y).toBe(84);
  });

  it('f10-3: move and update command inverses restore previous geometry', () => {
    const doc = createEmptyDocument();
    const obj = createTestObject('shape', { x: 100, y: 100 });
    doc.objects[obj.id] = obj;
    doc.rootIds.push(obj.id);

    const cmd = createUpdateCommand(obj.id, { x: 250, y: 350 });
    const { doc: nextDoc, inverse } = applyCommandOracle(doc, cmd);
    expect(nextDoc.objects[obj.id].x).toBe(250);
    expect(nextDoc.objects[obj.id].y).toBe(350);

    const { doc: restoredDoc } = applyCommandOracle(nextDoc, inverse);
    expect(restoredDoc.objects[obj.id].x).toBe(100);
    expect(restoredDoc.objects[obj.id].y).toBe(100);
  });

  it('f10-4: batch command applies sequentially and reverses in inverse order', () => {
    const doc = createEmptyDocument();
    const obj1 = createTestObject('shape', { x: 10 });
    const obj2 = createTestObject('shape', { x: 20 });
    const cmd1 = createCreateCommand(obj1);
    const cmd2 = createCreateCommand(obj2);

    const batchCmd = {
      id: 'cmd-batch-1',
      type: 'batch' as const,
      timestamp: 1776000000000,
      targets: [obj1.id, obj2.id],
      payload: { commands: [cmd1, cmd2] },
    };

    const { doc: nextDoc, inverse } = applyCommandOracle(doc, batchCmd);
    expect(nextDoc.objects[obj1.id]).toBeDefined();
    expect(nextDoc.objects[obj2.id]).toBeDefined();

    const { doc: restoredDoc } = applyCommandOracle(nextDoc, inverse);
    expect(restoredDoc.objects[obj1.id]).toBeUndefined();
    expect(restoredDoc.objects[obj2.id]).toBeUndefined();
  });

  it('f10-5: applying command sequence then their inverses equals original document', () => {
    const initialDoc = createEmptyDocument();
    const obj = createTestObject('shape', { x: 50, y: 50 });
    const cmd1 = createCreateCommand(obj);
    const cmd2 = createUpdateCommand(obj.id, { x: 75, y: 85 });
    const cmd3 = createUpdateCommand(obj.id, { w: 400 });

    const step1 = applyCommandOracle(initialDoc, cmd1);
    const step2 = applyCommandOracle(step1.doc, cmd2);
    const step3 = applyCommandOracle(step2.doc, cmd3);

    // Apply inverses in reverse
    const rev3 = applyCommandOracle(step3.doc, step3.inverse);
    const rev2 = applyCommandOracle(rev3.doc, step2.inverse);
    const rev1 = applyCommandOracle(rev2.doc, step1.inverse);

    expect(rev1.doc).toEqual(initialDoc);
  });
});
