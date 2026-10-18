/**
 * LENSBoard 2.0 — Unified E2E Test Harness
 * Dual-compatible with Vitest and Node.js native test runner (node:test).
 */

import nodeTest, { describe as nodeDescribe, it as nodeIt, beforeEach as nodeBeforeEach, afterEach as nodeAfterEach } from 'node:test';
import assert from 'node:assert/strict';

// Export test lifecycle functions
export const describe = nodeDescribe;
export const it = nodeIt;
export const test = nodeIt;
export const beforeEach = nodeBeforeEach;
export const afterEach = nodeAfterEach;

// Rich assertion matcher interface
export interface Matcher<T = unknown> {
  toBe(expected: T): void;
  toEqual(expected: unknown): void;
  toBeCloseTo(expected: number, precision?: number): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toBeNull(): void;
  toBeUndefined(): void;
  toBeDefined(): void;
  toBeGreaterThan(expected: number): void;
  toBeGreaterThanOrEqual(expected: number): void;
  toBeLessThan(expected: number): void;
  toBeLessThanOrEqual(expected: number): void;
  toContain(item: unknown): void;
  toHaveLength(length: number): void;
  toMatch(pattern: RegExp | string): void;
  toThrow(expectedMessage?: string | RegExp): void;
  rejects: {
    toThrow(expectedMessage?: string | RegExp): Promise<void>;
  };
  resolves: {
    toBe(expected: unknown): Promise<void>;
    toEqual(expected: unknown): Promise<void>;
  };
  not: Omit<Matcher<T>, 'not' | 'rejects' | 'resolves'>;
}

/**
 * Custom expect assertion function matching Vitest / Jest syntax
 */
export function expect<T = unknown>(actual: T): Matcher<T> {
  const isNot = false;

  const createMatcher = (negated: boolean): Matcher<T> => {
    return {
      toBe(expected: unknown) {
        if (negated) {
          assert.notStrictEqual(actual, expected, `Expected value NOT to be ${expected}, got ${actual}`);
        } else {
          assert.strictEqual(actual, expected, `Expected value to be ${expected}, got ${actual}`);
        }
      },
      toEqual(expected: unknown) {
        if (negated) {
          assert.notDeepStrictEqual(actual, expected, `Expected deep unequal`);
        } else {
          assert.deepStrictEqual(actual, expected, `Expected deep equality`);
        }
      },
      toBeCloseTo(expected: number, precision = 2) {
        const diff = Math.abs((actual as number) - expected);
        const tolerance = Math.pow(10, -precision) / 2;
        const pass = diff < tolerance;
        if (negated) {
          assert.ok(!pass, `Expected ${actual} NOT to be close to ${expected} (within ${tolerance})`);
        } else {
          assert.ok(pass, `Expected ${actual} to be close to ${expected} (diff: ${diff}, tolerance: ${tolerance})`);
        }
      },
      toBeTruthy() {
        if (negated) {
          assert.ok(!actual, `Expected ${actual} to be falsy`);
        } else {
          assert.ok(!!actual, `Expected ${actual} to be truthy`);
        }
      },
      toBeFalsy() {
        if (negated) {
          assert.ok(!!actual, `Expected ${actual} to be truthy`);
        } else {
          assert.ok(!actual, `Expected ${actual} to be falsy`);
        }
      },
      toBeNull() {
        if (negated) {
          assert.notStrictEqual(actual, null, `Expected ${actual} not to be null`);
        } else {
          assert.strictEqual(actual, null, `Expected ${actual} to be null`);
        }
      },
      toBeUndefined() {
        if (negated) {
          assert.notStrictEqual(actual, undefined, `Expected ${actual} not to be undefined`);
        } else {
          assert.strictEqual(actual, undefined, `Expected ${actual} to be undefined`);
        }
      },
      toBeDefined() {
        if (negated) {
          assert.strictEqual(actual, undefined, `Expected ${actual} to be undefined`);
        } else {
          assert.notStrictEqual(actual, undefined, `Expected ${actual} to be defined`);
        }
      },
      toBeGreaterThan(expected: number) {
        const pass = (actual as number) > expected;
        if (negated) {
          assert.ok(!pass, `Expected ${actual} NOT to be > ${expected}`);
        } else {
          assert.ok(pass, `Expected ${actual} to be > ${expected}`);
        }
      },
      toBeGreaterThanOrEqual(expected: number) {
        const pass = (actual as number) >= expected;
        if (negated) {
          assert.ok(!pass, `Expected ${actual} NOT to be >= ${expected}`);
        } else {
          assert.ok(pass, `Expected ${actual} to be >= ${expected}`);
        }
      },
      toBeLessThan(expected: number) {
        const pass = (actual as number) < expected;
        if (negated) {
          assert.ok(!pass, `Expected ${actual} NOT to be < ${expected}`);
        } else {
          assert.ok(pass, `Expected ${actual} to be < ${expected}`);
        }
      },
      toBeLessThanOrEqual(expected: number) {
        const pass = (actual as number) <= expected;
        if (negated) {
          assert.ok(!pass, `Expected ${actual} NOT to be <= ${expected}`);
        } else {
          assert.ok(pass, `Expected ${actual} to be <= ${expected}`);
        }
      },
      toContain(item: unknown) {
        let contains = false;
        if (typeof actual === 'string') {
          contains = actual.includes(item as string);
        } else if (Array.isArray(actual)) {
          contains = actual.includes(item);
        } else if (actual instanceof Set) {
          contains = actual.has(item);
        } else if (actual instanceof Map) {
          contains = actual.has(item);
        } else if (typeof actual === 'object' && actual !== null) {
          contains = (item as string) in actual;
        }
        if (negated) {
          assert.ok(!contains, `Expected container NOT to contain ${item}`);
        } else {
          assert.ok(contains, `Expected container to contain ${item}`);
        }
      },
      toHaveLength(length: number) {
        const actualLength = (actual as { length?: number })?.length ?? (actual as { size?: number })?.size;
        if (negated) {
          assert.notStrictEqual(actualLength, length, `Expected length NOT to be ${length}`);
        } else {
          assert.strictEqual(actualLength, length, `Expected length to be ${length}, got ${actualLength}`);
        }
      },
      toMatch(pattern: RegExp | string) {
        const str = String(actual);
        const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
        const pass = regex.test(str);
        if (negated) {
          assert.ok(!pass, `Expected "${str}" NOT to match ${regex}`);
        } else {
          assert.ok(pass, `Expected "${str}" to match ${regex}`);
        }
      },
      toThrow(expectedMessage?: string | RegExp) {
        if (typeof actual !== 'function') {
          throw new Error('actual must be a function to test toThrow');
        }
        let threw = false;
        let thrownError: unknown;
        try {
          (actual as () => void)();
        } catch (err) {
          threw = true;
          thrownError = err;
        }
        if (negated) {
          assert.ok(!threw, `Expected function NOT to throw, but it threw: ${thrownError}`);
        } else {
          assert.ok(threw, `Expected function to throw`);
          if (expectedMessage) {
            const msg = thrownError instanceof Error ? thrownError.message : String(thrownError);
            if (typeof expectedMessage === 'string') {
              assert.ok(msg.includes(expectedMessage), `Expected error message "${msg}" to contain "${expectedMessage}"`);
            } else {
              assert.ok(expectedMessage.test(msg), `Expected error message "${msg}" to match ${expectedMessage}`);
            }
          }
        }
      },
      rejects: {
        async toThrow(expectedMessage?: string | RegExp) {
          let threw = false;
          let thrownError: unknown;
          try {
            await (actual as Promise<unknown>);
          } catch (err) {
            threw = true;
            thrownError = err;
          }
          if (negated) {
            assert.ok(!threw, `Expected promise NOT to reject`);
          } else {
            assert.ok(threw, `Expected promise to reject`);
            if (expectedMessage) {
              const msg = thrownError instanceof Error ? thrownError.message : String(thrownError);
              if (typeof expectedMessage === 'string') {
                assert.ok(msg.includes(expectedMessage), `Expected rejection "${msg}" to contain "${expectedMessage}"`);
              } else {
                assert.ok(expectedMessage.test(msg), `Expected rejection "${msg}" to match ${expectedMessage}`);
              }
            }
          }
        }
      },
      resolves: {
        async toBe(expected: unknown) {
          const val = await (actual as Promise<unknown>);
          if (negated) {
            assert.notStrictEqual(val, expected);
          } else {
            assert.strictEqual(val, expected);
          }
        },
        async toEqual(expected: unknown) {
          const val = await (actual as Promise<unknown>);
          if (negated) {
            assert.notDeepStrictEqual(val, expected);
          } else {
            assert.deepStrictEqual(val, expected);
          }
        }
      },
      get not() {
        return createMatcher(!negated);
      }
    };
  };

  return createMatcher(false);
}

export default {
  describe,
  it,
  test,
  expect,
  beforeEach,
  afterEach,
};
