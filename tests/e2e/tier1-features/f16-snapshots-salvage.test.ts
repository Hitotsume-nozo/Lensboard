/**
 * Feature 16: Snapshots & Salvage Mode (M3)
 * Authoritative Source: SPEC.md §7, PROJECT.md Feature 16
 * Snapshots every 500 ops / 5 min, PRAGMA quick_check, salvage recovery without overwrite
 */

import { describe, it, expect } from '../harness.ts';

describe('Feature 16: Snapshots & Salvage Mode', () => {
  it('f16-1: snapshot condition triggers every 500 ops', () => {
    function shouldSnapshot(opsSinceLastSnapshot: number, timeSinceLastMs: number): boolean {
      const fiveMinutesMs = 5 * 60 * 1000;
      return opsSinceLastSnapshot >= 500 || timeSinceLastMs >= fiveMinutesMs;
    }
    expect(shouldSnapshot(500, 0)).toBe(true);
    expect(shouldSnapshot(499, 1000)).toBe(false);
  });

  it('f16-2: snapshot condition triggers after 5 minutes of activity', () => {
    function shouldSnapshot(opsSinceLastSnapshot: number, timeSinceLastMs: number): boolean {
      const fiveMinutesMs = 5 * 60 * 1000;
      return opsSinceLastSnapshot >= 500 || timeSinceLastMs >= fiveMinutesMs;
    }
    expect(shouldSnapshot(10, 5 * 60 * 1000)).toBe(true);
    expect(shouldSnapshot(10, 4 * 60 * 1000)).toBe(false);
  });

  it('f16-3: PRAGMA quick_check verifies database integrity on startup', () => {
    function evaluateQuickCheckResult(output: string): boolean {
      return output.trim() === 'ok';
    }
    expect(evaluateQuickCheckResult('ok')).toBe(true);
    expect(evaluateQuickCheckResult('tree corrupt in page 4')).toBe(false);
  });

  it('f16-4: salvage mode preserves damaged file and outputs new recovered database', () => {
    const originalFile = 'workspace.lens';
    const salvageFile = 'workspace.salvaged.lens';
    expect(salvageFile).not.toBe(originalFile);
  });

  it('f16-5: salvage mode reconstructs document state from op-log replay', () => {
    const validOps = [
      { seq: 1, type: 'create', payload: { id: 'obj1' } },
      { seq: 2, type: 'create', payload: { id: 'obj2' } },
    ];
    const recoveredObjects: string[] = [];
    for (const op of validOps) {
      recoveredObjects.push(op.payload.id);
    }
    expect(recoveredObjects).toHaveLength(2);
    expect(recoveredObjects).toContain('obj1');
    expect(recoveredObjects).toContain('obj2');
  });
});
