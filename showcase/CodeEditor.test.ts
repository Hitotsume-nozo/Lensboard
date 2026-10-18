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
});
