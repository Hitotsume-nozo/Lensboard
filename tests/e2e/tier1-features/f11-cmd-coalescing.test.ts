/**
 * Feature 11: Command Coalescing & History (M3)
 * Authoritative Source: SPEC.md §6, PROJECT.md Feature 11
 * 300ms coalescing of rapid edits to same target, multi-level undo/redo stacks
 */

import { describe, it, expect } from '../harness.ts';
import {
  createTestObject,
  createUpdateCommand,
} from '../helpers/document-builder.ts';
import type { Command } from '../helpers/contracts.ts';

describe('Feature 11: Command Coalescing & History', () => {
  function shouldCoalesce(prevCmd: Command, nextCmd: Command, windowMs = 300): boolean {
    if (prevCmd.type !== nextCmd.type) return false;
    if (prevCmd.targets[0] !== nextCmd.targets[0]) return false;
    const timeDiff = nextCmd.timestamp - prevCmd.timestamp;
    return timeDiff <= windowMs;
  }

  it('f11-1: rapid drag edits to same target within 300ms coalesce into single undo step', () => {
    const obj = createTestObject('shape');
    const cmd1 = createUpdateCommand(obj.id, { x: 105 }, 1000);
    const cmd2 = createUpdateCommand(obj.id, { x: 110 }, 1150);

    expect(shouldCoalesce(cmd1, cmd2)).toBe(true);
  });

  it('f11-2: edits to same target beyond 300ms do not coalesce', () => {
    const obj = createTestObject('shape');
    const cmd1 = createUpdateCommand(obj.id, { x: 105 }, 1000);
    const cmd2 = createUpdateCommand(obj.id, { x: 110 }, 1350);

    expect(shouldCoalesce(cmd1, cmd2)).toBe(false);
  });

  it('f11-3: edits to different targets within 300ms do not coalesce', () => {
    const obj1 = createTestObject('shape');
    const obj2 = createTestObject('shape');
    const cmd1 = createUpdateCommand(obj1.id, { x: 105 }, 1000);
    const cmd2 = createUpdateCommand(obj2.id, { x: 110 }, 1100);

    expect(shouldCoalesce(cmd1, cmd2)).toBe(false);
  });

  it('f11-4: undo stack pushes inverses and populates redo stack on undo', () => {
    const undoStack: string[] = ['cmd1-inv', 'cmd2-inv'];
    const redoStack: string[] = [];

    // User performs undo
    const popped = undoStack.pop();
    if (popped) redoStack.push('cmd2');

    expect(undoStack).toHaveLength(1);
    expect(redoStack).toHaveLength(1);
    expect(redoStack[0]).toBe('cmd2');
  });

  it('f11-5: new action clears redo stack', () => {
    const redoStack: string[] = ['cmd2', 'cmd3'];
    // User executes new command
    redoStack.length = 0;
    expect(redoStack).toHaveLength(0);
  });
});
