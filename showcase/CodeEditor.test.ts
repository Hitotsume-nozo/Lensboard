import { describe, it, expect } from 'vitest';
import { executeCodeSandbox, highlightLineTokens } from './CodeEditor.js';

describe('Code Execution Sandbox & Editor', () => {
  it('executes basic arithmetic with explicit return', () => {
    const res = executeCodeSandbox('return 21 * 2;');
    expect(res.success).toBe(true);
    expect(res.result).toBe('42');
    expect(res.error).toBeUndefined();
    expect(res.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('evaluates REPL-style trailing expressions without explicit return keyword', () => {
    const res1 = executeCodeSandbox('21 * 2');
    expect(res1.success).toBe(true);
    expect(res1.result).toBe('42');

    const res2 = executeCodeSandbox('const a = 15;\nconst b = 25;\na + b');
    expect(res2.success).toBe(true);
    expect(res2.result).toBe('40');

    const res3 = executeCodeSandbox('Math.max(10, 42, 7)');
    expect(res3.success).toBe(true);
    expect(res3.result).toBe('42');
  });

  it('supports print() alias matching console.log', () => {
    const res = executeCodeSandbox('print("Hello from print function", 123);');
    expect(res.success).toBe(true);
    expect(res.logs).toContain('Hello from print function 123');
  });

  it('captures console.log, console.warn, and console.error output', () => {
    const code = `
      console.log('Step 1:', 100);
      console.warn('warning message');
      console.error('error message');
      return 'done';
    `;
    const res = executeCodeSandbox(code);
    expect(res.success).toBe(true);
    expect(res.logs).toHaveLength(3);
    expect(res.logs[0]).toBe('Step 1: 100');
    expect(res.logs[1]).toBe('[WARN] warning message');
    expect(res.logs[2]).toBe('[ERR] error message');
    expect(res.result).toBe('done');
  });

  it('catches runtime exceptions without throwing and sets success to false', () => {
    const code = 'throw new Error("Div by zero");';
    const res = executeCodeSandbox(code);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Div by zero');
    expect(res.result).toBeUndefined();
  });

  it('handles object and array return types', () => {
    const code = `
      const obj = { a: 1, b: [2, 3] };
      return obj;
    `;
    const res = executeCodeSandbox(code);
    expect(res.success).toBe(true);
    expect(res.result).toBe('{"a":1,"b":[2,3]}');
  });

  it('handles simple TypeScript type annotations gracefully', () => {
    const code = `
      const x: number = 50;
      const msg: string = "hello";
      console.log(msg, x);
      return x * 2;
    `;
    const res = executeCodeSandbox(code);
    expect(res.success).toBe(true);
    expect(res.logs[0]).toBe('hello 50');
    expect(res.result).toBe('100');
  });

  it('provides informative notice on empty code blocks', () => {
    const res = executeCodeSandbox('   \n  \t ');
    expect(res.success).toBe(true);
    expect(res.logs[0]).toContain('Empty code block');
  });

  it('provides declaration confirmation when defining functions without logs or returns', () => {
    const code = 'function calculateMetric(x) { return x * 2; }';
    const res = executeCodeSandbox(code);
    expect(res.success).toBe(true);
    expect(res.logs[0]).toContain('calculateMetric');
  });

  it('tokenizes code into syntax-highlighted spans', () => {
    const tokens = highlightLineTokens('const answer = 42; // comment');
    expect(tokens.length).toBeGreaterThan(1);
  });

  it('executes LeetCode solutions with Python-style comments without spurious private name syntax errors', () => {
    const code = `
      # 1. Two Sum
      # Given an array of integers nums and an integer target, return indices...
      class Solution {
        twoSum(nums, target) {
          const map = new Map();
          for (let i = 0; i < nums.length; i++) {
            const comp = target - nums[i];
            if (map.has(comp)) return [map.get(comp), i];
            map.set(nums[i], i);
          }
          return [];
        }
      }
      new Solution().twoSum([2, 7, 11, 15], 9);
    `;
    const res = executeCodeSandbox(code);
    expect(res.success).toBe(true);
    expect(res.error).toBeUndefined();
    expect(res.result).toBe('[0,1]');
  });

  it('executes classes containing JavaScript private identifier fields (#field) correctly', () => {
    const code = `
      class LRUCache {
        #capacity;
        #cache;
        constructor(cap) {
          this.#capacity = cap;
          this.#cache = new Map();
        }
        get(key) {
          if (!this.#cache.has(key)) return -1;
          const val = this.#cache.get(key);
          this.#cache.delete(key);
          this.#cache.set(key, val);
          return val;
        }
        put(key, val) {
          this.#cache.set(key, val);
        }
      }
      const lru = new LRUCache(2);
      lru.put(1, 100);
      lru.get(1);
    `;
    const res = executeCodeSandbox(code);
    expect(res.success).toBe(true);
    expect(res.error).toBeUndefined();
    expect(res.result).toBe('100');
  });

  it('handles LeetCode TypeScript solution with public/private modifiers and type annotations', () => {
    const code = `
      class Solution {
        private memo: Map<number, number>;
        public constructor() {
          this.memo = new Map();
        }
        public climbStairs(n: number): number {
          if (n <= 2) return n;
          if (this.memo.has(n)) return this.memo.get(n)!;
          const res: number = this.climbStairs(n - 1) + this.climbStairs(n - 2);
          this.memo.set(n, res);
          return res;
        }
      }
      new Solution().climbStairs(5);
    `;
    const res = executeCodeSandbox(code);
    expect(res.success).toBe(true);
    expect(res.error).toBeUndefined();
    expect(res.result).toBe('8');
  });

  it('protects string literals and template literals containing # from comment conversion', () => {
    const code = `
      const str1 = "hello # world";
      const str2 = '#notacomment';
      const str3 = \`template # literal \${10 + 20}\`;
      return [str1, str2, str3].join(' | ');
    `;
    const res = executeCodeSandbox(code);
    expect(res.success).toBe(true);
    expect(res.result).toBe('hello # world | #notacomment | template # literal 30');
  });

  it('handles inline # comments with or without spaces and inside method bodies', () => {
    const code = `
      class Solution {
        solve(n) {
          #O(n) time complexity inside method
          let a = 10; #O(1) inline comment without space
          let b = 20; # comment with space
          return a + b;
        }
      }
      new Solution().solve(5); # trailing call with inline comment
    `;
    const res = executeCodeSandbox(code);
    expect(res.success).toBe(true);
    expect(res.error).toBeUndefined();
    expect(res.result).toBe('30');
  });

  it('handles Python-style class comments and boilerplate without spurious private names errors', () => {
    const code = `
      # Definition for a binary tree node.
      # class TreeNode:
      #     def __init__(self, val=0, left=None, right=None):
      #         self.val = val
      #         self.left = left
      #         self.right = right
      class Solution {
        maxDepth(val) {
          return val > 0 ? val : 0;
        }
      }
      new Solution().maxDepth(3);
      // trailing comment line
    `;
    const res = executeCodeSandbox(code);
    expect(res.success).toBe(true);
    expect(res.error).toBeUndefined();
    expect(res.result).toBe('3');
  });

  it('evaluates trailing expressions with trailing inline comments', () => {
    const code = `
      const factor = 7;
      factor * 6; // returns 42
    `;
    const res = executeCodeSandbox(code);
    expect(res.success).toBe(true);
    expect(res.result).toBe('42');
  });

  it('handles TypeScript interfaces, type aliases, and cast assertions', () => {
    const code = `
      interface Point {
        x: number;
        y: number;
      }
      type Coord = Point;
      const pt: Coord = { x: 12, y: 30 } as Point;
      pt.x + pt.y;
    `;
    const res = executeCodeSandbox(code);
    expect(res.success).toBe(true);
    expect(res.error).toBeUndefined();
    expect(res.result).toBe('42');
  });

  it('handles multi-type generic parameters like Map<string, number> without breaking on commas', () => {
    const code = `
      function getCount(memo: Map<string, number>, key: string): number {
        return memo.get(key) ?? 0;
      }
      const m = new Map<string, number>();
      m.set("apple", 5);
      getCount(m, "apple");
    `;
    const res = executeCodeSandbox(code);
    expect(res.success).toBe(true);
    expect(res.error).toBeUndefined();
    expect(res.result).toBe('5');
  });

  it('handles generic classes like class PriorityQueue<T>', () => {
    const code = `
      class Box<T> {
        val: T;
        constructor(v: T) {
          this.val = v;
        }
      }
      new Box<number>(42).val;
    `;
    const res = executeCodeSandbox(code);
    expect(res.success).toBe(true);
    expect(res.error).toBeUndefined();
    expect(res.result).toBe('42');
  });

  it('handles uninitialized typed variable declarations like let ans: number', () => {
    const code = `
      let ans: number;
      let memo: Map<number, number>;
      ans = 99;
      return ans;
    `;
    const res = executeCodeSandbox(code);
    expect(res.success).toBe(true);
    expect(res.error).toBeUndefined();
    expect(res.result).toBe('99');
  });

  it('handles standalone # and whitespace-only # comment lines without private name syntax errors', () => {
    const code = `
      #
      # 
      #   
      const x = 10;
      #
      return x * 2;
    `;
    const res = executeCodeSandbox(code);
    expect(res.success).toBe(true);
    expect(res.error).toBeUndefined();
    expect(res.result).toBe('20');
  });

  it('handles export declarations copied from TypeScript modules or LeetCode', () => {
    const code = `
      export function add(a: number, b: number): number {
        return a + b;
      }
      export const multiplier = 3;
      add(10, 4) * multiplier;
    `;
    const res = executeCodeSandbox(code);
    expect(res.success).toBe(true);
    expect(res.error).toBeUndefined();
    expect(res.result).toBe('42');
  });

  it('handles interface extends and type declarations without semicolons', () => {
    const code = `
      interface Animal {
        name: string
      }
      interface Dog extends Animal {
        breed: string
      }
      const d: Dog = { name: "Rex", breed: "Golden" }
      d.name
    `;
    const res = executeCodeSandbox(code);
    expect(res.success).toBe(true);
    expect(res.error).toBeUndefined();
    expect(res.result).toBe('Rex');
  });

  it('handles LeetCode class property definitions without semicolons', () => {
    const code = `
      class ListNode {
        val: number
        next: ListNode | null
        constructor(val?: number, next?: ListNode | null) {
          this.val = (val === undefined ? 0 : val)
          this.next = (next === undefined ? null : next)
        }
      }
      const node = new ListNode(42)
      node.val
    `;
    const res = executeCodeSandbox(code);
    expect(res.success).toBe(true);
    expect(res.error).toBeUndefined();
    expect(res.result).toBe('42');
  });

  it('handles class with opening brace on a new line and private #field', () => {
    const code = `
      class Counter
      {
        #count = 10;
        increment() {
          this.#count++;
          return this.#count;
        }
      }
      const c = new Counter();
      c.increment();
    `;
    const res = executeCodeSandbox(code);
    expect(res.success).toBe(true);
    expect(res.error).toBeUndefined();
    expect(res.result).toBe('11');
  });

  it('preserves ternary expressions with colons inside parentheses without stripping', () => {
    const code = `
      const check = (val: number): string => (val > 0 ? "positive" : "negative");
      check(42);
    `;
    const res = executeCodeSandbox(code);
    expect(res.success).toBe(true);
    expect(res.error).toBeUndefined();
    expect(res.result).toBe('positive');
  });

  it('handles enums by converting them to accessible lookup objects', () => {
    const code = `
      enum Direction {
        Up = 1,
        Down = 2,
        Left = 3,
        Right = 4
      }
      return Direction.Right * 10;
    `;
    const res = executeCodeSandbox(code);
    expect(res.success).toBe(true);
    expect(res.error).toBeUndefined();
    expect(res.result).toBe('40');
  });
});


