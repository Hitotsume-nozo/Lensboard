import React, { useState, useRef, useEffect, useCallback } from 'react';

export interface CodeExecutionOutput {
  logs: string[];
  result?: string;
  error?: string;
  durationMs: number;
  success: boolean;
}

/**
 * Strips TypeScript type annotations and syntax for safe browser Function execution.
 * Preserves JS `#` private identifiers inside class bodies while sanitizing
 * Python/shell `#` comments, TypeScript access modifiers (public/private/protected),
 * parameter/return type annotations, and generics so LeetCode-style code runs cleanly.
 */
/**
 * Strips TypeScript types from parameter lists while preserving default values
 * and respecting nested brackets (<>, [], {}, ()) so multi-type generics like
 * Map<string, number> don't get broken by comma splitting.
 */
function cleanParamList(params: string): string {
  if (!params.includes(':')) return params;

  // Split on commas only at depth 0
  const paramChunks: string[] = [];
  let depth = 0;
  let cur = '';

  for (let i = 0; i < params.length; i++) {
    const ch = params[i];
    if (ch === '<' || ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === '>' || ch === ')' || ch === ']' || ch === '}') depth = Math.max(0, depth - 1);

    if (ch === ',' && depth === 0) {
      paramChunks.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur) paramChunks.push(cur);

  const cleaned = paramChunks.map((chunk) => {
    const s = chunk.trim();
    if (!s.includes(':')) return s;

    // Find colon at depth 0
    let colIdx = -1;
    let d = 0;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '<' || ch === '(' || ch === '[' || ch === '{') d++;
      else if (ch === '>' || ch === ')' || ch === ']' || ch === '}') d = Math.max(0, d - 1);
      else if (ch === ':' && d === 0) {
        colIdx = i;
        break;
      }
    }

    if (colIdx === -1) return s;

    const rawName = s.slice(0, colIdx).trim();
    // A parameter name must be a valid identifier (with optional ? for optional param)
    // If it is an expression like `val === undefined ? 0`, it is a ternary, NOT a parameter type annotation!
    if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*\??$/.test(rawName)) {
      return s;
    }

    const paramName = rawName.replace(/\?$/, '');
    const afterColon = s.slice(colIdx + 1);

    // Check for default value (= ...) at depth 0 after colon
    let eqIdx = -1;
    d = 0;
    for (let i = 0; i < afterColon.length; i++) {
      const ch = afterColon[i];
      if (ch === '<' || ch === '(' || ch === '[' || ch === '{') d++;
      else if (ch === '>' || ch === ')' || ch === ']' || ch === '}') d = Math.max(0, d - 1);
      else if (ch === '=' && d === 0) {
        eqIdx = i;
        break;
      }
    }

    if (eqIdx !== -1) {
      const defaultVal = afterColon.slice(eqIdx);
      return `${paramName} ${defaultVal.trim()}`;
    }

    return paramName;
  });

  return cleaned.join(', ');
}

/**
 * Strips TypeScript type annotations and syntax for safe browser Function execution.
 * Preserves JS `#` private identifiers inside class bodies while sanitizing
 * Python/shell `#` comments, TypeScript access modifiers (public/private/protected),
 * parameter/return type annotations, and generics so LeetCode-style code runs cleanly.
 */
export function stripTypeScriptTypes(code: string): string {
  // Step 1: Mask strings and standard JS comments to protect them from regex transforms
  const literals: string[] = [];
  const maskRegex =
    /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`|\/\*[\s\S]*?\*\/|\/\/[^\n]*)/g;

  let masked = code.replace(maskRegex, (match) => {
    literals.push(match);
    return `__LB_LITERAL_${literals.length - 1}__`;
  });

  // Step 2: Handle `#` comments without affecting valid JS private identifiers.
  // In JavaScript, a private identifier (#ident) is ONLY valid:
  //   a) As a member declaration directly in a class body: e.g. `#field;`, `#field =`, `#field(`, `get #field(`, `set #field(`, `static #field`
  //   b) As property access: `this.#field`, `obj.#field`, or `#field in obj`
  // All other `#` occurrences (e.g. `# 1. Two Sum`, `#O(n)`, `#TODO`, `#include`, `let x = 1; #O(1)`, `#def`, `# Complexity`, `#`)
  // are comments that cause `SyntaxError: Private names aren't valid in this context`.
  const lines = masked.split('\n');
  let inClass = false;
  let awaitingClassBrace = false;
  let braceDepth = 0;
  let classBraceLevel = -1;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];

    if (/\bclass\s+[a-zA-Z_$]/.test(l) && !l.trim().startsWith('//')) {
      if (l.includes('{')) {
        inClass = true;
        classBraceLevel = braceDepth;
      } else {
        awaitingClassBrace = true;
      }
    }

    if (awaitingClassBrace && l.includes('{')) {
      inClass = true;
      awaitingClassBrace = false;
      classBraceLevel = braceDepth;
    }

    // Check if line starts with `#` (with optional whitespace)
    const hashMatch = l.match(/^(\s*)#(.*)$/);
    if (hashMatch) {
      const indent = hashMatch[1];
      const rest = hashMatch[2];
      // Check if it's a valid class private field declaration directly in class body (braceDepth === classBraceLevel + 1)
      const isClassPrivateDecl =
        inClass &&
        braceDepth === classBraceLevel + 1 &&
        /^[a-zA-Z_$][a-zA-Z0-9_$]*(?:\s*[:=;(]|\s*$)/.test(rest) &&
        !/^[a-zA-Z_$][a-zA-Z0-9_$]*\s+[a-zA-Z0-9_$]/.test(rest);

      if (!isClassPrivateDecl) {
        const cleanRest = rest.startsWith(' ') ? rest.slice(1) : rest;
        lines[i] = `${indent}//${cleanRest ? ' ' + cleanRest : ''}`;
      }
    } else {
      // Mid-line `#`: check if it's not a private field access or `#field in obj`
      // Replace any `#` that is not preceded by `.` or `?.` and not followed by `[ident]\s+in\b`
      lines[i] = l.replace(/(^|[^.\w$])#(?!\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s+in\b)(.*)$/, (_full, prefix, comment) => {
        return `${prefix}// ${comment.trim()}`;
      });
    }

    const openCount = (l.match(/\{/g) || []).length;
    const closeCount = (l.match(/\}/g) || []).length;
    braceDepth += openCount - closeCount;

    if (inClass && braceDepth <= classBraceLevel) {
      inClass = false;
      classBraceLevel = -1;
    }
  }
  masked = lines.join('\n');

  // Step 3: TypeScript stripping
  // 3a. Strip imports (in case user pasted module imports)
  masked = masked.replace(/^\s*import\b[^\n]*/gm, (match) => '// ' + match.trim());

  // 3b. Strip export and export default
  masked = masked.replace(/\bexport\s+default\s+/g, '').replace(/\bexport\s+/g, '');

  // 3c. Interfaces (including extends and generics)
  masked = masked.replace(/\binterface\s+[A-Za-z0-9_$]+(?:<[^>]*>)?(?:\s+extends\s+[^{]+)?\s*\{[\s\S]*?\}/g, '');

  // 3d. Type aliases
  masked = masked
    .replace(/\btype\s+[A-Za-z0-9_$]+(?:<[^>]*>)?\s*=[\s\S]*?;/g, '')
    .replace(/\btype\s+[A-Za-z0-9_$]+(?:<[^>]*>)?\s*=[^;\n]*\n/g, '\n');

  // 3e. Enums
  masked = masked.replace(/\benum\s+([A-Za-z0-9_$]+)\s*\{([\s\S]*?)\}/g, (_full, name, body) => {
    const members = body.split(',').map((m: string) => m.trim()).filter(Boolean);
    const assignments: string[] = [];
    let autoVal = 0;
    for (const m of members) {
      if (m.includes('=')) {
        const [k, v] = m.split('=').map((s: string) => s.trim());
        assignments.push(`${k}: ${v}`);
        const num = Number(v);
        if (!isNaN(num)) autoVal = num + 1;
      } else {
        assignments.push(`${m}: ${autoVal++}`);
      }
    }
    return `const ${name} = { ${assignments.join(', ')} };`;
  });

  // 3f. Generic classes and implements
  masked = masked.replace(/\bclass\s+([A-Za-z0-9_$]+)<[^>]+>/g, 'class $1');
  masked = masked.replace(/\bextends\s+([A-Za-z0-9_$]+)<[^>]+>/g, 'extends $1');
  masked = masked.replace(/\s+implements\s+[A-Za-z0-9_$,\s<>]+(?=\s*\{)/g, '');

  // 3g. Generic functions and arrow functions
  masked = masked.replace(/\bfunction\s+([A-Za-z0-9_$]+)<[^>]+>\s*\(/g, 'function $1(');
  masked = masked.replace(/([A-Za-z0-9_$]+)<[A-Za-z0-9_$,\s]+>\s*\(/g, '$1(');
  masked = masked.replace(/=\s*<[A-Za-z0-9_$,\s]+>\s*\(/g, '= (');

  // 3h. Class access modifiers: public, private, protected, readonly, override
  masked = masked.replace(/\b(public|private|protected|readonly|override)\s+(?=[a-zA-Z_$#])/g, '');

  // 3i. Function/method return types (with [ \t] instead of \s so it never matches across lines)
  masked = masked
    .replace(/\)\s*:\s*[A-Za-z0-9_$<>\[\]| &,]+(?=[ \t]*(?:\{|=>|;|$))/gm, ')')
    .replace(/\)\s*:\s*[A-Za-z0-9_$<>\[\]| &,]+(?=\s*=>)/g, ') =>');

  // 3j. Optional parameter marker: `val?: Type` -> `val: Type`
  masked = masked.replace(/([a-zA-Z0-9_$]+)\?\s*:/g, '$1:');

  // 3k. Variable declaration types (both initialized and uninitialized)
  // Uninitialized: `let ans: number;` -> `let ans;` or `let ans: number` -> `let ans`
  masked = masked.replace(
    /\b(let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*[A-Za-z0-9_$<>\[\]| &,]+(?=[ \t]*[;\n]|$)/gm,
    '$1 $2'
  );
  // Initialized: `const x: Type = ...` -> `const x = ...`
  masked = masked.replace(
    /\b(const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:\s*[A-Za-z0-9_$<>\[\]| &,]+(?=\s*=)/g,
    '$1 $2'
  );

  // 3l. Class property declarations (with or without semicolons)
  masked = masked.replace(
    /^(\s*[a-zA-Z_$#][a-zA-Z0-9_$]*)\??\s*:\s*[A-Za-z0-9_$<>\[\]| &,]+(?=\s*=)/gm,
    '$1'
  );
  masked = masked.replace(
    /^(\s*[a-zA-Z_$#][a-zA-Z0-9_$]*)\??\s*:\s*[A-Za-z0-9_$<>\[\]| &,]+(?=[ \t]*[;\n]|$)/gm,
    '$1;'
  );

  // 3m. Parameter types inside parentheses with depth-aware cleaner
  masked = masked.replace(/\(([^()]*)\)/g, (_full, params) => {
    return `(${cleanParamList(params)})`;
  });

  // 3n. Generics in instantiation: `new Set<number>()` -> `new Set()`, `new Map<K, V>()` -> `new Map()`
  masked = masked.replace(/new\s+([A-Za-z0-9_$]+)<[^>]+>\(/g, 'new $1(');

  // 3o. Type assertions: `as string`, `as any`
  masked = masked.replace(/\bas\s+[A-Za-z0-9_$<>\[\]| &]+/g, '');

  // 3p. Non-null assertions: `val!` followed by punctuation
  masked = masked.replace(/!([.[\],);])/g, '$1');

  // Step 4: Unmask string and comment literals
  let restored = masked;
  for (let idx = literals.length - 1; idx >= 0; idx--) {
    restored = restored.replace(`__LB_LITERAL_${idx}__`, () => literals[idx]);
  }

  return restored;
}

/**
 * Executes user code safely in a browser sandbox.
 * Supports REPL-style trailing expression evaluation, print() alias,
 * console logging capture, and descriptive status messages.
 */
export function executeCodeSandbox(codeToRun: string): CodeExecutionOutput {
  const logs: string[] = [];
  const customConsole = {
    log: (...args: unknown[]) => {
      logs.push(
        args
          .map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)))
          .join(' ')
      );
    },
    warn: (...args: unknown[]) => {
      logs.push(
        '[WARN] ' +
          args
            .map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)))
            .join(' ')
      );
    },
    error: (...args: unknown[]) => {
      logs.push(
        '[ERR] ' +
          args
            .map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)))
            .join(' ')
      );
    },
    info: (...args: unknown[]) => {
      logs.push(
        '[INFO] ' +
          args
            .map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)))
            .join(' ')
      );
    },
  };

  const startTime = performance.now();
  let result: unknown = undefined;
  let error: string | undefined = undefined;

  const trimmed = codeToRun.trim();
  if (!trimmed) {
    return {
      logs: ['(Empty code block — enter statements or expressions to execute)'],
      result: undefined,
      durationMs: 0,
      success: true,
    };
  }

  try {
    const sanitized = stripTypeScriptTypes(codeToRun);
    let fn: Function | null = null;

    // Check if trailing expression can be evaluated as a return value
    const lines = sanitized.trim().split('\n');
    let lastExprIdx = lines.length - 1;
    // Skip empty lines and full comment lines at the end
    while (
      lastExprIdx >= 0 &&
      (lines[lastExprIdx].trim() === '' || lines[lastExprIdx].trim().startsWith('//'))
    ) {
      lastExprIdx--;
    }

    if (lastExprIdx >= 0) {
      const lastLineRaw = lines[lastExprIdx].trim();
      const lastLineClean = lastLineRaw
        .replace(/\/\/[^\n]*$/, '')
        .trim()
        .replace(/;+$/, '');
      const statementKeywords = [
        'const',
        'let',
        'var',
        'function',
        'class',
        'import',
        'export',
        'if',
        'for',
        'while',
        'switch',
        'try',
        'catch',
        'finally',
        'throw',
        'return',
      ];
      const startsWithStmt = statementKeywords.some(
        (kw) => lastLineClean.startsWith(kw + ' ') || lastLineClean === kw
      );

      if (
        !startsWithStmt &&
        lastLineClean.length > 0 &&
        !lastLineClean.endsWith('{') &&
        !lastLineClean.endsWith('}')
      ) {
        try {
          const prefix = lines.slice(0, lastExprIdx).join('\n');
          const exprCode = `"use strict";\n${prefix}\nreturn (${lastLineClean});`;
          fn = new Function('console', 'print', exprCode);
        } catch {
          fn = null;
        }
      }
    }

    if (!fn) {
      fn = new Function('console', 'print', `"use strict";\n${sanitized}`);
    }

    result = fn(customConsole, customConsole.log);
  } catch (err: unknown) {
    error = err instanceof Error ? err.message : String(err);
  }

  const durationMs = Math.round(performance.now() - startTime);
  const success = !error;

  // If code executed without error and produced no output logs or return value, provide informative status
  if (success && logs.length === 0 && result === undefined) {
    const declaredClasses = [...codeToRun.matchAll(/class\s+([a-zA-Z0-9_$]+)/g)].map((m) => m[1]);
    const declaredFns = [...codeToRun.matchAll(/(?:function|def)\s+([a-zA-Z0-9_$]+)/g)].map((m) => m[1]);
    if (declaredClasses.length > 0) {
      logs.push(`✓ Declared class(es): ${declaredClasses.join(', ')}`);
    } else if (declaredFns.length > 0) {
      logs.push(`✓ Declared function(s): ${declaredFns.join(', ')}`);
    } else {
      logs.push(`✓ Program completed successfully in ${durationMs}ms (no return value)`);
    }
  }

  return {
    logs,
    result:
      result !== undefined
        ? typeof result === 'object' && result !== null
          ? JSON.stringify(result)
          : String(result)
        : undefined,
    error,
    durationMs,
    success,
  };
}

/**
 * Tokenizes a single code line into color-linted syntax highlighting spans.
 */
export function highlightLineTokens(line: string): React.ReactNode[] {
  if (!line) {
    return [<span key="empty">&nbsp;</span>];
  }

  const tokenRegex =
    /(\/\/[^\n]*|#[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b(?:const|let|var|function|return|if|else|for|while|import|export|from|class|type|interface|extends|implements|async|await|new|typeof|instanceof|try|catch|finally|throw|switch|case|default|break|continue|void|def|self|None|True|False|elif|in|is|not|with|as|lambda|yield)\b)|(\b(?:number|string|boolean|any|unknown|never|Record|Array|Map|Set|List|Optional|Dict|Tuple|int|float|str|bool)\b)|(\b\d+(?:\.\d+)?\b)|(\b(?:true|false|null|undefined)\b)|([a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\())|([{}()[\];,+\-*/%=<>!&|^~?:])/g;

  let lastIndex = 0;
  const nodes: React.ReactNode[] = [];
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        <span key={`txt-${lastIndex}`} style={{ color: '#C0CAF5' }}>
          {line.slice(lastIndex, match.index)}
        </span>
      );
    }

    const [full, comment, str, kw, typeKw, num, bool, fnName, punct] = match;

    if (comment) {
      nodes.push(
        <span key={`comm-${match.index}`} style={{ color: '#565F89', fontStyle: 'italic' }}>
          {comment}
        </span>
      );
    } else if (str) {
      nodes.push(
        <span key={`str-${match.index}`} style={{ color: '#9ECE6A' }}>
          {str}
        </span>
      );
    } else if (kw) {
      nodes.push(
        <span key={`kw-${match.index}`} style={{ color: '#BB9AF7', fontWeight: 600 }}>
          {kw}
        </span>
      );
    } else if (typeKw) {
      nodes.push(
        <span key={`type-${match.index}`} style={{ color: '#7AA2F7', fontWeight: 600 }}>
          {typeKw}
        </span>
      );
    } else if (num) {
      nodes.push(
        <span key={`num-${match.index}`} style={{ color: '#FF9E64' }}>
          {num}
        </span>
      );
    } else if (bool) {
      nodes.push(
        <span key={`bool-${match.index}`} style={{ color: '#FF9E64', fontWeight: 600 }}>
          {bool}
        </span>
      );
    } else if (fnName) {
      nodes.push(
        <span key={`fn-${match.index}`} style={{ color: '#7DCFFF' }}>
          {fnName}
        </span>
      );
    } else if (punct) {
      nodes.push(
        <span key={`punct-${match.index}`} style={{ color: '#89DDFF' }}>
          {punct}
        </span>
      );
    }

    lastIndex = match.index + full.length;
  }

  if (lastIndex < line.length) {
    nodes.push(
      <span key={`rest-${lastIndex}`} style={{ color: '#C0CAF5' }}>
        {line.slice(lastIndex)}
      </span>
    );
  }

  return nodes;
}

export interface CodeEditorProps {
  initialCode: string;
  language?: string;
  initialOutput?: CodeExecutionOutput;
  onSave: (code: string, output?: CodeExecutionOutput) => void;
  onClose: () => void;
  style?: React.CSSProperties;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  initialCode,
  language = 'typescript',
  initialOutput,
  onSave,
  onClose,
  style,
}) => {
  const [lines, setLines] = useState<string[]>(() => {
    const split = initialCode.split('\n');
    return split.length > 0 ? split : [''];
  });
  const [activeLineIdx, setActiveLineIdx] = useState<number>(0);
  const [cursorCol, setCursorCol] = useState<number>(0);
  const [editorMode, setEditorMode] = useState<'NORMAL' | 'INSERT' | 'COMMAND'>('INSERT');
  const [commandText, setCommandText] = useState<string>('');
  const [yankedLine, setYankedLine] = useState<string>('');
  const [undoStack, setUndoStack] = useState<string[][]>([]);
  const redoStackRef = useRef<string[][]>([]);
  const [isAllSelected, setIsAllSelected] = useState<boolean>(false);
  const [output, setOutput] = useState<CodeExecutionOutput | undefined>(initialOutput);
  const [showOutputDrawer, setShowOutputDrawer] = useState(Boolean(initialOutput));

  const activeInputRef = useRef<HTMLTextAreaElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const linesContainerRef = useRef<HTMLDivElement | null>(null);
  const lastNormalKeyRef = useRef<string>('');

  const fullCode = lines.join('\n');

  const pushUndo = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-30), lines]);
    redoStackRef.current = [];
  }, [lines]);

  const handleUndo = useCallback(() => {
    if (undoStack.length > 0) {
      const prevLines = undoStack[undoStack.length - 1];
      setUndoStack((s) => s.slice(0, -1));
      redoStackRef.current.push(lines);
      setLines(prevLines);
      setActiveLineIdx((prev) => Math.min(prev, Math.max(0, prevLines.length - 1)));
      setIsAllSelected(false);
    }
  }, [undoStack, lines]);

  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length > 0) {
      const nextLines = redoStackRef.current.pop()!;
      setUndoStack((s) => [...s, lines]);
      setLines(nextLines);
      setActiveLineIdx((prev) => Math.min(prev, Math.max(0, nextLines.length - 1)));
      setIsAllSelected(false);
    }
  }, [lines]);

  const handleRun = useCallback(() => {
    const res = executeCodeSandbox(fullCode);
    setOutput(res);
    setShowOutputDrawer(true);
  }, [fullCode]);

  const handleSaveAndClose = useCallback(() => {
    onSave(fullCode, output);
    onClose();
  }, [fullCode, output, onSave, onClose]);

  // Keep active line textarea focused in INSERT mode, auto-resize height, and keep container focused in NORMAL mode
  useEffect(() => {
    if (editorMode === 'INSERT' && activeInputRef.current) {
      activeInputRef.current.focus();
      const col = Math.min(cursorCol, activeInputRef.current.value.length);
      activeInputRef.current.setSelectionRange(col, col);
      activeInputRef.current.style.height = 'auto';
      activeInputRef.current.style.height = `${Math.max(22, activeInputRef.current.scrollHeight)}px`;
    } else if (editorMode === 'NORMAL' && containerRef.current) {
      containerRef.current.focus();
    }
  }, [activeLineIdx, editorMode, cursorCol]);

  // Handle active line text change in INSERT mode
  const handleLineChange = (val: string) => {
    setLines((prev) => {
      const next = [...prev];
      next[activeLineIdx] = val;
      return next;
    });
  };

  // Multi-line paste handler: splits pasted clipboard text across multiple lines
  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    if (!text) return;

    if (isAllSelected) {
      e.preventDefault();
      pushUndo();
      const newLines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
      setLines(newLines.length > 0 ? newLines : ['']);
      setActiveLineIdx(Math.max(0, newLines.length - 1));
      setCursorCol((newLines[newLines.length - 1] || '').length);
      setIsAllSelected(false);
      return;
    }

    if (editorMode === 'NORMAL') {
      e.preventDefault();
      pushUndo();
      const pasteLines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
      setLines((prev) => {
        const next = [...prev];
        next.splice(activeLineIdx + 1, 0, ...pasteLines);
        return next;
      });
      setActiveLineIdx(activeLineIdx + pasteLines.length);
      return;
    }

    if (text.includes('\n') || text.includes('\r')) {
      e.preventDefault();
      pushUndo();
      const pasteLines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
      const curLine = lines[activeLineIdx] || '';
      const curPos = activeInputRef.current?.selectionStart ?? cursorCol;
      const selEnd = activeInputRef.current?.selectionEnd ?? curPos;

      const before = curLine.slice(0, curPos);
      const after = curLine.slice(selEnd);

      const firstLine = before + pasteLines[0];
      const lastLinePasted = pasteLines[pasteLines.length - 1] + after;

      setLines((prev) => {
        const next = [...prev];
        if (pasteLines.length === 1) {
          next[activeLineIdx] = firstLine + after;
        } else {
          const middle = pasteLines.slice(1, -1);
          next.splice(activeLineIdx, 1, firstLine, ...middle, lastLinePasted);
        }
        return next;
      });

      const newIdx = activeLineIdx + pasteLines.length - 1;
      setActiveLineIdx(newIdx);
      setCursorCol(pasteLines[pasteLines.length - 1].length);
    }
  };

  // Full-buffer copy handler when isAllSelected is active
  const handleCopy = (e: React.ClipboardEvent) => {
    if (isAllSelected) {
      e.clipboardData.setData('text/plain', fullCode);
      e.preventDefault();
    }
  };

  // Full-buffer cut handler when isAllSelected is active
  const handleCut = (e: React.ClipboardEvent) => {
    if (isAllSelected) {
      e.clipboardData.setData('text/plain', fullCode);
      pushUndo();
      setYankedLine(fullCode);
      setLines(['']);
      setActiveLineIdx(0);
      setCursorCol(0);
      setIsAllSelected(false);
      e.preventDefault();
    }
  };

  // Keyboard navigation, auto-brackets, autospacing, auto-indent, and commands in INSERT mode
  const handleInsertKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const input = e.currentTarget;
    const curPos = input.selectionStart || 0;
    const selEnd = input.selectionEnd || curPos;
    const hasSelection = selEnd > curPos;
    const selectedText = hasSelection ? input.value.slice(curPos, selEnd) : '';
    setCursorCol(curPos);

    // Global Run / Save shortcuts
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRun();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      handleSaveAndClose();
      return;
    }

    // Ctrl+A / Cmd+A: select entire buffer
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      setIsAllSelected(true);
      return;
    }

    // Full buffer selection actions (mass delete, replace, cancel)
    if (isAllSelected) {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        pushUndo();
        setLines(['']);
        setActiveLineIdx(0);
        setCursorCol(0);
        setIsAllSelected(false);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        pushUndo();
        navigator.clipboard?.writeText(fullCode);
        setYankedLine(fullCode);
        setLines(['']);
        setActiveLineIdx(0);
        setCursorCol(0);
        setIsAllSelected(false);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsAllSelected(false);
        return;
      }
      if (e.key.startsWith('Arrow')) {
        setIsAllSelected(false);
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        pushUndo();
        setLines([e.key]);
        setActiveLineIdx(0);
        setCursorCol(1);
        setIsAllSelected(false);
        return;
      }
      setIsAllSelected(false);
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setEditorMode('NORMAL');
      setIsAllSelected(false);
      requestAnimationFrame(() => {
        containerRef.current?.focus();
      });
      return;
    }

    const before = input.value.slice(0, curPos);
    const after = input.value.slice(selEnd);

    // ── Auto-bracket Completion Pairs & Step-Over ───────────────────────────
    const PAIRS: Record<string, string> = {
      '(': ')',
      '[': ']',
      '{': '}',
      '"': '"',
      "'": "'",
      '`': '`',
    };
    const CLOSING_CHARS = new Set([')', ']', '}', '"', "'", '`']);

    // Step over existing closing character without inserting duplicate
    if (!hasSelection && CLOSING_CHARS.has(e.key) && after.startsWith(e.key)) {
      e.preventDefault();
      setCursorCol(curPos + 1);
      setTimeout(() => {
        if (activeInputRef.current) {
          activeInputRef.current.setSelectionRange(curPos + 1, curPos + 1);
        }
      }, 0);
      return;
    }

    // Auto-complete bracket / quote pair (with selection wrapping & smart quote)
    if (PAIRS[e.key]) {
      // Smart quote: if single quote following an alphanumeric character (like don't), type single quote
      if (e.key === "'" && !hasSelection && curPos > 0 && /[a-zA-Z0-9_]/.test(before.slice(-1))) {
        return;
      }

      e.preventDefault();
      pushUndo();
      const closing = PAIRS[e.key];

      // Autospacer for `{`: if preceding char is an identifier or `)` or `>` without a space (e.g. `class Foo{` -> `class Foo {}`)
      const needsSpaceBeforeBrace =
        e.key === '{' &&
        !hasSelection &&
        curPos > 0 &&
        /[a-zA-Z0-9_)>]$/.test(before);
      const preSpace = needsSpaceBeforeBrace ? ' ' : '';

      if (hasSelection) {
        // Wrap selected text: `(` + selectedText + `)`
        const nextVal = before + e.key + selectedText + closing + after;
        handleLineChange(nextVal);
        const newCol = curPos + 1 + selectedText.length;
        setCursorCol(newCol);
        setTimeout(() => {
          if (activeInputRef.current) {
            activeInputRef.current.setSelectionRange(newCol, newCol);
          }
        }, 0);
        return;
      }

      const nextVal = before + preSpace + e.key + closing + after;
      handleLineChange(nextVal);
      const newCol = curPos + preSpace.length + 1;
      setCursorCol(newCol);
      setTimeout(() => {
        if (activeInputRef.current) {
          activeInputRef.current.setSelectionRange(newCol, newCol);
        }
      }, 0);
      return;
    }

    // ── Autospacer for Colons in Type Annotations & Block Headers ───────────
    if (e.key === ':' && !hasSelection && curPos > 0 && /[a-zA-Z0-9_]$/.test(before)) {
      e.preventDefault();
      pushUndo();
      const nextVal = before + ': ' + after;
      handleLineChange(nextVal);
      const newCol = curPos + 2;
      setCursorCol(newCol);
      setTimeout(() => {
        if (activeInputRef.current) {
          activeInputRef.current.setSelectionRange(newCol, newCol);
        }
      }, 0);
      return;
    }

    // Step-over space if typed right after an auto-spaced colon
    if (
      e.key === ' ' &&
      !hasSelection &&
      (before.endsWith(': ') || (before.endsWith(':') && after.startsWith(' ')))
    ) {
      e.preventDefault();
      if (before.endsWith(':') && after.startsWith(' ')) {
        setCursorCol(curPos + 1);
        setTimeout(() => {
          if (activeInputRef.current) {
            activeInputRef.current.setSelectionRange(curPos + 1, curPos + 1);
          }
        }, 0);
      }
      return;
    }

    // Backspace: delete matching pair if cursor is positioned between them e.g. (|)
    if (e.key === 'Backspace' && !hasSelection && curPos > 0 && curPos <= input.value.length) {
      const charBefore = input.value[curPos - 1];
      const charAfter = input.value[curPos];
      if (PAIRS[charBefore] && PAIRS[charBefore] === charAfter) {
        e.preventDefault();
        pushUndo();
        const nextVal = input.value.slice(0, curPos - 1) + input.value.slice(curPos + 1);
        handleLineChange(nextVal);
        setCursorCol(curPos - 1);
        setTimeout(() => {
          if (activeInputRef.current) {
            activeInputRef.current.setSelectionRange(curPos - 1, curPos - 1);
          }
        }, 0);
        return;
      }
    }

    // Auto-dedent on } when current line contains only leading whitespace
    if (e.key === '}' && before.trim() === '' && before.length >= 2) {
      e.preventDefault();
      pushUndo();
      const dedented = before.slice(2) + '}' + after;
      handleLineChange(dedented);
      setCursorCol(curPos - 1);
      setTimeout(() => {
        if (activeInputRef.current) {
          activeInputRef.current.setSelectionRange(curPos - 1, curPos - 1);
        }
      }, 0);
      return;
    }

    // Tab / Shift+Tab indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      pushUndo();
      if (e.shiftKey) {
        const curVal = input.value;
        if (curVal.startsWith('  ')) {
          handleLineChange(curVal.slice(2));
          setCursorCol(Math.max(0, curPos - 2));
        } else if (curVal.startsWith(' ')) {
          handleLineChange(curVal.slice(1));
          setCursorCol(Math.max(0, curPos - 1));
        }
      } else {
        const nextVal = before + '  ' + after;
        handleLineChange(nextVal);
        setCursorCol(curPos + 2);
        setTimeout(() => {
          if (activeInputRef.current) {
            activeInputRef.current.setSelectionRange(curPos + 2, curPos + 2);
          }
        }, 0);
      }
      return;
    }

    // ── Intelligent Auto-Indent & Auto-Spacing on Enter ─────────────────────
    if (e.key === 'Enter') {
      e.preventDefault();
      pushUndo();
      const matchIndent = before.match(/^(\s*)/);
      const curIndent = matchIndent ? matchIndent[1] : '';
      const trimmedBefore = before.trimEnd();

      // Increased indent after opening braces, colons, or block headers (classes, defs, functions, ifs, etc.)
      const triggersIndent =
        /[{([]$/.test(trimmedBefore) ||
        /:\s*$/.test(trimmedBefore) ||
        /^\s*(class|function|interface|def|if|for|while|try|catch|finally|switch|elif|else)\b/.test(
          trimmedBefore
        );
      const extraIndent = triggersIndent ? '  ' : '';

      // Check if Enter is pressed between matching brackets e.g. { | } or ( | ) or [ | ]
      const isBetweenBrackets =
        (trimmedBefore.endsWith('{') && after.trimStart().startsWith('}')) ||
        (trimmedBefore.endsWith('(') && after.trimStart().startsWith(')')) ||
        (trimmedBefore.endsWith('[') && after.trimStart().startsWith(']'));

      if (isBetweenBrackets) {
        const middleIndent = curIndent + '  ';
        const closingIndent = curIndent + after.trimStart();
        setLines((prev) => {
          const next = [...prev];
          next[activeLineIdx] = before;
          next.splice(activeLineIdx + 1, 0, middleIndent, closingIndent);
          return next;
        });
        setActiveLineIdx(activeLineIdx + 1);
        setCursorCol(middleIndent.length);
        return;
      }

      // Standard Enter with auto-indent
      const newLineContent = curIndent + extraIndent + after;
      setLines((prev) => {
        const next = [...prev];
        next[activeLineIdx] = before;
        next.splice(activeLineIdx + 1, 0, newLineContent);
        return next;
      });
      setActiveLineIdx(activeLineIdx + 1);
      setCursorCol((curIndent + extraIndent).length);
      return;
    }

    // Backspace at col 0: merge with previous line
    if (e.key === 'Backspace' && curPos === 0 && !hasSelection) {
      if (activeLineIdx > 0) {
        e.preventDefault();
        pushUndo();
        const prevLine = lines[activeLineIdx - 1];
        const curLine = input.value;
        const newPrevLine = prevLine + curLine;
        const targetCol = prevLine.length;
        setLines((prev) => {
          const next = [...prev];
          next[activeLineIdx - 1] = newPrevLine;
          next.splice(activeLineIdx, 1);
          return next;
        });
        setActiveLineIdx(activeLineIdx - 1);
        setCursorCol(targetCol);
        setTimeout(() => {
          if (activeInputRef.current) {
            activeInputRef.current.setSelectionRange(targetCol, targetCol);
          }
        }, 0);
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      if (activeLineIdx > 0) {
        e.preventDefault();
        setActiveLineIdx((prev) => prev - 1);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      if (activeLineIdx < lines.length - 1) {
        e.preventDefault();
        setActiveLineIdx((prev) => prev + 1);
      }
      return;
    }
  };

  // Keyboard commands in NORMAL mode (Neovim keybindings)
  const handleNormalKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (editorMode !== 'NORMAL') return;

    // Run / Save shortcuts
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRun();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      handleSaveAndClose();
      return;
    }

    // Ctrl+A / Cmd+A in normal mode: select all lines
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      setIsAllSelected(true);
      return;
    }

    // Actions when buffer is selected in normal mode
    if (isAllSelected) {
      if (e.key === 'd' || e.key === 'x' || e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        pushUndo();
        setLines(['']);
        setActiveLineIdx(0);
        setCursorCol(0);
        setIsAllSelected(false);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        pushUndo();
        navigator.clipboard?.writeText(fullCode);
        setYankedLine(fullCode);
        setLines(['']);
        setActiveLineIdx(0);
        setCursorCol(0);
        setIsAllSelected(false);
        return;
      }
      if (e.key === 'y') {
        e.preventDefault();
        navigator.clipboard?.writeText(fullCode);
        setYankedLine(fullCode);
        setIsAllSelected(false);
        return;
      }
      if (e.key === 'c') {
        e.preventDefault();
        pushUndo();
        setLines(['']);
        setActiveLineIdx(0);
        setCursorCol(0);
        setEditorMode('INSERT');
        setIsAllSelected(false);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsAllSelected(false);
        return;
      }
      setIsAllSelected(false);
    }

    // Visual mode toggle (V / v)
    if (e.key === 'V' || e.key === 'v') {
      e.preventDefault();
      setIsAllSelected((prev) => !prev);
      return;
    }

    // Redo (Ctrl+R)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      handleRedo();
      return;
    }

    // Navigation & delete motions (gg, dgg, G, dG, yG)
    if (e.key === 'g') {
      if (lastNormalKeyRef.current === 'dg') {
        // dgg: delete from 0 to activeLineIdx
        pushUndo();
        const yanked = lines.slice(0, activeLineIdx + 1).join('\n');
        setYankedLine(yanked);
        setLines((prev) => {
          const next = prev.slice(activeLineIdx + 1);
          return next.length > 0 ? next : [''];
        });
        setActiveLineIdx(0);
        setCursorCol(0);
        lastNormalKeyRef.current = '';
        return;
      }
      if (lastNormalKeyRef.current === 'd') {
        lastNormalKeyRef.current = 'dg';
        setTimeout(() => {
          if (lastNormalKeyRef.current === 'dg') lastNormalKeyRef.current = '';
        }, 1000);
        return;
      }
      if (lastNormalKeyRef.current === 'g') {
        e.preventDefault();
        setActiveLineIdx(0);
        setCursorCol(0);
        lastNormalKeyRef.current = '';
        return;
      } else {
        lastNormalKeyRef.current = 'g';
        setTimeout(() => {
          if (lastNormalKeyRef.current === 'g') lastNormalKeyRef.current = '';
        }, 800);
        return;
      }
    }

    if (e.key === 'G') {
      e.preventDefault();
      if (lastNormalKeyRef.current === 'd') {
        // dG: delete from activeLineIdx to end of buffer (mass delete if on line 0)
        pushUndo();
        const yanked = lines.slice(activeLineIdx).join('\n');
        setYankedLine(yanked);
        setLines((prev) => {
          const next = prev.slice(0, activeLineIdx);
          return next.length > 0 ? next : [''];
        });
        setActiveLineIdx((prev) => Math.max(0, Math.min(prev, lines.length - 1)));
        setCursorCol(0);
        lastNormalKeyRef.current = '';
        return;
      }
      if (lastNormalKeyRef.current === 'y') {
        // yG: yank from activeLineIdx to end of buffer
        const yanked = lines.slice(activeLineIdx).join('\n');
        setYankedLine(yanked);
        navigator.clipboard?.writeText(yanked);
        lastNormalKeyRef.current = '';
        return;
      }
      setActiveLineIdx(lines.length - 1);
      setCursorCol(0);
      return;
    }

    if (e.key === 'j' || e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveLineIdx((prev) => Math.min(lines.length - 1, prev + 1));
      return;
    }
    if (e.key === 'k' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveLineIdx((prev) => Math.max(0, prev - 1));
      return;
    }
    if (e.key === 'h' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setCursorCol((prev) => Math.max(0, prev - 1));
      return;
    }
    if (e.key === 'l' || e.key === 'ArrowRight') {
      e.preventDefault();
      setCursorCol((prev) => Math.min((lines[activeLineIdx] || '').length, prev + 1));
      return;
    }
    if (e.key === '0' || e.key === '^') {
      e.preventDefault();
      setCursorCol(0);
      return;
    }
    if (e.key === '$') {
      e.preventDefault();
      setCursorCol((lines[activeLineIdx] || '').length);
      return;
    }

    // Insert mode transitions
    if (e.key === 'i') {
      e.preventDefault();
      setEditorMode('INSERT');
      return;
    }
    if (e.key === 'a') {
      e.preventDefault();
      setCursorCol((prev) => Math.min((lines[activeLineIdx] || '').length, prev + 1));
      setEditorMode('INSERT');
      return;
    }
    if (e.key === 'I') {
      e.preventDefault();
      setCursorCol(0);
      setEditorMode('INSERT');
      return;
    }
    if (e.key === 'A') {
      e.preventDefault();
      setCursorCol((lines[activeLineIdx] || '').length);
      setEditorMode('INSERT');
      return;
    }
    if (e.key === 'o') {
      e.preventDefault();
      pushUndo();
      setLines((prev) => {
        const next = [...prev];
        next.splice(activeLineIdx + 1, 0, '');
        return next;
      });
      setActiveLineIdx((prev) => prev + 1);
      setCursorCol(0);
      setEditorMode('INSERT');
      return;
    }
    if (e.key === 'O') {
      e.preventDefault();
      pushUndo();
      setLines((prev) => {
        const next = [...prev];
        next.splice(activeLineIdx, 0, '');
        return next;
      });
      setCursorCol(0);
      setEditorMode('INSERT');
      return;
    }

    // Editing in NORMAL mode
    if (e.key === 'c') {
      if (lastNormalKeyRef.current === 'c') {
        // cc clears line, preserves indentation, and enters INSERT mode
        pushUndo();
        const curLine = lines[activeLineIdx] || '';
        const matchIndent = curLine.match(/^(\s*)/);
        const indent = matchIndent ? matchIndent[1] : '';
        setYankedLine(curLine);
        handleLineChange(indent);
        setCursorCol(indent.length);
        setEditorMode('INSERT');
        lastNormalKeyRef.current = '';
        return;
      } else {
        lastNormalKeyRef.current = 'c';
        setTimeout(() => {
          if (lastNormalKeyRef.current === 'c') lastNormalKeyRef.current = '';
        }, 1000);
        return;
      }
    }
    if (e.key === 'C') {
      // C changes from cursor to end of line, enters INSERT mode
      e.preventDefault();
      pushUndo();
      const curLine = lines[activeLineIdx] || '';
      const nextLine = curLine.slice(0, cursorCol);
      handleLineChange(nextLine);
      setEditorMode('INSERT');
      return;
    }
    if (e.key === 'D') {
      // D deletes from cursor to end of line
      e.preventDefault();
      pushUndo();
      const curLine = lines[activeLineIdx] || '';
      const nextLine = curLine.slice(0, cursorCol);
      handleLineChange(nextLine);
      setCursorCol(Math.max(0, nextLine.length - 1));
      return;
    }
    if (e.key === 'x') {
      e.preventDefault();
      pushUndo();
      const curLine = lines[activeLineIdx];
      if (curLine.length > 0) {
        const nextLine = curLine.slice(0, cursorCol) + curLine.slice(cursorCol + 1);
        handleLineChange(nextLine);
      }
      return;
    }
    if (e.key === 'd') {
      if (lastNormalKeyRef.current === 'd') {
        // dd deletes current line
        pushUndo();
        setYankedLine(lines[activeLineIdx]);
        setLines((prev) => {
          if (prev.length <= 1) return [''];
          const next = [...prev];
          next.splice(activeLineIdx, 1);
          return next;
        });
        setActiveLineIdx((prev) => Math.min(prev, Math.max(0, lines.length - 2)));
        lastNormalKeyRef.current = '';
        return;
      } else {
        lastNormalKeyRef.current = 'd';
        setTimeout(() => {
          if (lastNormalKeyRef.current === 'd') lastNormalKeyRef.current = '';
        }, 1000);
        return;
      }
    }
    if (e.key === 'y') {
      if (lastNormalKeyRef.current === 'y') {
        // yy yanks current line
        setYankedLine(lines[activeLineIdx]);
        navigator.clipboard?.writeText(lines[activeLineIdx]);
        lastNormalKeyRef.current = '';
        return;
      } else {
        lastNormalKeyRef.current = 'y';
        setTimeout(() => {
          if (lastNormalKeyRef.current === 'y') lastNormalKeyRef.current = '';
        }, 1000);
        return;
      }
    }
    if (e.key === 'p') {
      // Paste yanked line below
      if (yankedLine !== undefined) {
        pushUndo();
        const pLines = yankedLine.split('\n');
        setLines((prev) => {
          const next = [...prev];
          next.splice(activeLineIdx + 1, 0, ...pLines);
          return next;
        });
        setActiveLineIdx((prev) => prev + pLines.length);
      }
      return;
    }
    if (e.key === 'P') {
      // Paste yanked line above
      if (yankedLine !== undefined) {
        pushUndo();
        const pLines = yankedLine.split('\n');
        setLines((prev) => {
          const next = [...prev];
          next.splice(activeLineIdx, 0, ...pLines);
          return next;
        });
      }
      return;
    }
    if (e.key === 'u') {
      handleUndo();
      return;
    }
    if (e.key === 'r') {
      e.preventDefault();
      handleRun();
      return;
    }
    if (e.key === ':') {
      e.preventDefault();
      setEditorMode('COMMAND');
      setCommandText('');
      return;
    }
    if (e.key === 'Escape') {
      onClose();
      return;
    }
  };

  // Execute Neovim-style command line (:w, :q, :wq, :run, :%d, :%y, :%s)
  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawCmd = commandText.trim();
    const cmd = rawCmd.replace(/^:+/, '').trim();
    if (
      cmd === '%d' ||
      cmd === '1,$d' ||
      cmd === '%delete' ||
      cmd === 'd' ||
      cmd === 'd%' ||
      cmd === 'clear'
    ) {
      // Standard Neovim :%d mass delete
      pushUndo();
      setLines(['']);
      setActiveLineIdx(0);
      setCursorCol(0);
      setEditorMode('NORMAL');
      setIsAllSelected(false);
    } else if (cmd === '%y' || cmd === '%yank' || cmd === 'y') {
      navigator.clipboard?.writeText(fullCode);
      setYankedLine(fullCode);
      setEditorMode('NORMAL');
      setIsAllSelected(false);
    } else if (cmd.startsWith('%s/')) {
      const parts = cmd.split('/');
      if (parts.length >= 3) {
        const findStr = parts[1];
        const repStr = parts[2];
        const isGlobal = parts[3]?.includes('g');
        pushUndo();
        setLines((prev) =>
          prev.map((l) =>
            isGlobal ? l.split(findStr).join(repStr) : l.replace(findStr, repStr)
          )
        );
      }
      setEditorMode('NORMAL');
    } else if (cmd === 'w') {
      onSave(fullCode, output);
      setEditorMode('NORMAL');
    } else if (cmd === 'q') {
      onClose();
    } else if (cmd === 'wq' || cmd === 'x') {
      handleSaveAndClose();
    } else if (cmd === 'run' || cmd === 'r') {
      handleRun();
      setEditorMode('NORMAL');
    } else {
      setEditorMode('NORMAL');
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleNormalKeyDown}
      onPaste={handlePaste}
      onCopy={handleCopy}
      onCut={handleCut}
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#131622',
        border: '1.5px solid #3B4261',
        borderRadius: '8px',
        boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
        color: '#C0CAF5',
        fontFamily: "'Fira Code', Menlo, Monaco, Consolas, monospace",
        fontSize: '12px',
        overflow: 'hidden',
        minWidth: '480px',
        maxWidth: '740px',
        outline: 'none',
        ...style,
      }}
      data-testid="code-block-editor"
    >
      {/* ── Top Header Bar ──────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          backgroundColor: '#1E2233',
          borderBottom: '1px solid #2F354D',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#F7768E' }} />
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#E0AF68' }} />
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#9ECE6A' }} />
          </div>
          <span style={{ fontWeight: 600, color: '#7AA2F7', fontSize: '12px', marginLeft: '6px' }}>
            algorithm.{language === 'typescript' ? 'ts' : 'js'}
          </span>
          <span
            style={{
              padding: '1px 6px',
              borderRadius: '4px',
              backgroundColor: '#24283B',
              color: '#565F89',
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
          >
            {language}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={handleRun}
            title="Execute code in sandbox (Ctrl+Enter or :run)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              borderRadius: '5px',
              border: 'none',
              backgroundColor: '#9ECE6A',
              color: '#1A1B26',
              fontWeight: 700,
              fontSize: '11px',
              cursor: 'pointer',
              transition: 'opacity 120ms ease',
            }}
          >
            ▶ Run
          </button>

          <button
            type="button"
            onClick={handleSaveAndClose}
            title="Save changes (Ctrl+S or :wq)"
            style={{
              padding: '4px 10px',
              borderRadius: '5px',
              border: '1px solid #3B4261',
              backgroundColor: '#24283B',
              color: '#A9B1D6',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Save
          </button>

          <button
            type="button"
            onClick={onClose}
            title="Close editor (Esc or :q)"
            style={{
              padding: '4px 8px',
              borderRadius: '5px',
              border: 'none',
              backgroundColor: 'transparent',
              color: '#565F89',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── Line-by-Line Code Editor Body with Text Wrapping ─────── */}
      <div
        ref={linesContainerRef}
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '180px',
          maxHeight: '340px',
          backgroundColor: '#131622',
          overflowY: 'auto',
          padding: '6px 0',
        }}
      >
        {lines.map((lineContent, idx) => {
          const lineNum = idx + 1;
          const isActive = idx === activeLineIdx;

          return (
            <div
              key={idx}
              onClick={() => {
                setActiveLineIdx(idx);
                if (editorMode !== 'INSERT') {
                  setEditorMode('INSERT');
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                minHeight: '22px',
                lineHeight: '22px',
                backgroundColor: isAllSelected
                  ? 'rgba(65, 132, 228, 0.35)'
                  : isActive
                    ? 'rgba(47, 53, 77, 0.45)'
                    : 'transparent',
                cursor: 'text',
                borderLeft: isActive ? '3px solid #7AA2F7' : '3px solid transparent',
              }}
            >
              {/* Line Number Gutter */}
              <div
                style={{
                  width: '42px',
                  paddingRight: '10px',
                  textAlign: 'right',
                  color: isActive ? '#7AA2F7' : '#414868',
                  fontWeight: isActive ? 700 : 400,
                  fontSize: '11px',
                  userSelect: 'none',
                  flexShrink: 0,
                  lineHeight: '22px',
                }}
              >
                {lineNum}
              </div>

              {/* Line Content: Input in INSERT mode on active line, Color Linter Tokens otherwise */}
              <div
                style={{
                  flex: 1,
                  paddingRight: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  minWidth: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  overflowWrap: 'anywhere',
                }}
              >
                {isActive && editorMode === 'INSERT' ? (
                  <textarea
                    ref={activeInputRef}
                    rows={1}
                    value={lineContent}
                    onChange={(e) => {
                      handleLineChange(e.target.value);
                      e.target.style.height = 'auto';
                      e.target.style.height = `${Math.max(22, e.target.scrollHeight)}px`;
                    }}
                    onKeyDown={handleInsertKeyDown}
                    onPaste={handlePaste}
                    onCopy={handleCopy}
                    onCut={handleCut}
                    spellCheck={false}
                    autoComplete="off"
                    style={{
                      width: '100%',
                      backgroundColor: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: isAllSelected ? '#FFFFFF' : '#C0CAF5',
                      fontFamily: 'inherit',
                      fontSize: '12px',
                      lineHeight: '22px',
                      padding: 0,
                      margin: 0,
                      caretColor: '#7AA2F7',
                      resize: 'none',
                      overflow: 'hidden',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere',
                      boxSizing: 'border-box',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      fontFamily: 'inherit',
                      fontSize: '12px',
                      lineHeight: '22px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere',
                      width: '100%',
                      color: isAllSelected ? '#FFFFFF' : undefined,
                    }}
                  >
                    {highlightLineTokens(lineContent)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Command Mode Input Bar (when : is pressed) ──────────── */}
      {editorMode === 'COMMAND' && (
        <form
          onSubmit={handleCommandSubmit}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '2px 10px',
            backgroundColor: '#1E2233',
            borderTop: '1px solid #3B4261',
          }}
        >
          <span style={{ color: '#E0AF68', fontWeight: 700, marginRight: '4px' }}>:</span>
          <input
            autoFocus
            type="text"
            value={commandText}
            onChange={(e) => setCommandText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                setEditorMode('NORMAL');
              }
            }}
            placeholder="w, q, wq, run, clear..."
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#F8FAFC',
              fontFamily: 'inherit',
              fontSize: '11px',
            }}
          />
        </form>
      )}

      {/* ── Neovim-Style Statusline ─────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 10px',
          backgroundColor: '#1A1B26',
          borderTop: '1px solid #24283B',
          fontSize: '11px',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setEditorMode((prev) => (prev === 'INSERT' ? 'NORMAL' : 'INSERT'))}
            title="Click to toggle between NORMAL and INSERT mode (or press Esc / i)"
            style={{
              padding: '1px 6px',
              borderRadius: '3px',
              fontWeight: 800,
              fontSize: '10px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor:
                editorMode === 'INSERT' ? '#9ECE6A' : editorMode === 'COMMAND' ? '#E0AF68' : '#7AA2F7',
              color: '#131622',
            }}
          >
            -- {editorMode} --
          </button>
          <span style={{ color: '#7AA2F7', fontWeight: 600 }}>NVIM</span>
          <span style={{ color: '#565F89' }}>[{language}]</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#565F89' }}>
          <span>utf-8</span>
          <span style={{ color: '#7AA2F7' }}>
            Ln {activeLineIdx + 1}, Col {cursorCol + 1}
          </span>
          <span>{lines.length} lines</span>
          <button
            type="button"
            onClick={() => setShowOutputDrawer((prev) => !prev)}
            style={{
              background: 'none',
              border: 'none',
              color: output ? (output.success ? '#9ECE6A' : '#F7768E') : '#7AA2F7',
              cursor: 'pointer',
              fontSize: '10px',
              fontWeight: 600,
              padding: '1px 4px',
            }}
          >
            {showOutputDrawer ? '▼ Hide Output' : '▲ Show Output'}
          </button>
        </div>
      </div>

      {/* ── Execution Output Window / Drawer ────────────────────── */}
      {showOutputDrawer && (
        <div
          style={{
            backgroundColor: '#0E1017',
            borderTop: '1px solid #24283B',
            padding: '8px 12px',
            maxHeight: '160px',
            overflowY: 'auto',
            fontSize: '11px',
          }}
          data-testid="code-output-window"
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '6px',
              borderBottom: '1px solid #1E2233',
              paddingBottom: '4px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontWeight: 700, color: '#7AA2F7' }}>Execution Output:</span>
              {output && (
                <span
                  style={{
                    padding: '1px 6px',
                    borderRadius: '3px',
                    fontSize: '10px',
                    fontWeight: 700,
                    backgroundColor: output.success ? 'rgba(158, 206, 106, 0.2)' : 'rgba(247, 118, 142, 0.2)',
                    color: output.success ? '#9ECE6A' : '#F7768E',
                  }}
                >
                  {output.success ? `✓ SUCCESS (${output.durationMs}ms)` : `✕ ERROR (${output.durationMs}ms)`}
                </span>
              )}
            </div>
            {output && (
              <button
                type="button"
                onClick={() => setOutput(undefined)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#565F89',
                  cursor: 'pointer',
                  fontSize: '10px',
                }}
              >
                Clear
              </button>
            )}
          </div>

          {!output ? (
            <div style={{ color: '#565F89', fontStyle: 'italic', padding: '4px 0' }}>
              Click '▶ Run' or press Ctrl+Enter to execute.
            </div>
          ) : (
            <div>
              {output.logs.length > 0 && (
                <div style={{ marginBottom: '6px' }}>
                  {output.logs.map((log, idx) => (
                    <div
                      key={idx}
                      style={{
                        color: log.startsWith('[ERR]')
                          ? '#F7768E'
                          : log.startsWith('[WARN]')
                            ? '#E0AF68'
                            : log.startsWith('✓')
                              ? '#9ECE6A'
                              : '#C0CAF5',
                        lineHeight: '18px',
                      }}
                    >
                      {log}
                    </div>
                  ))}
                </div>
              )}

              {output.error && (
                <div style={{ color: '#F7768E', fontWeight: 600, marginTop: '4px' }}>
                  Error: {output.error}
                </div>
              )}

              {output.result !== undefined && (
                <div style={{ color: '#7DCFFF', fontWeight: 600, marginTop: '4px' }}>
                  ⇒ Return: {output.result}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export interface StandaloneOutputWindowProps {
  output: CodeExecutionOutput;
  title?: string;
  onClose: () => void;
  onRerun?: () => void;
  onClear?: () => void;
}

export const StandaloneOutputWindow: React.FC<StandaloneOutputWindowProps> = ({
  output,
  title = 'Code Execution Output',
  onClose,
  onRerun,
  onClear,
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: '380px',
        maxHeight: '300px',
        backgroundColor: '#131622',
        border: `1.5px solid ${output.success ? '#9ECE6A' : '#F7768E'}`,
        borderRadius: '8px',
        boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
        color: '#C0CAF5',
        fontFamily: "'Fira Code', Menlo, Monaco, Consolas, monospace",
        fontSize: '12px',
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      data-testid="standalone-output-window"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          backgroundColor: '#1E2233',
          borderBottom: '1px solid #2F354D',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 700, color: '#7AA2F7', fontSize: '11px' }}>{title}</span>
          <span
            style={{
              padding: '1px 6px',
              borderRadius: '3px',
              fontSize: '10px',
              fontWeight: 700,
              backgroundColor: output.success ? 'rgba(158, 206, 106, 0.2)' : 'rgba(247, 118, 142, 0.2)',
              color: output.success ? '#9ECE6A' : '#F7768E',
            }}
          >
            {output.success ? `✓ ${output.durationMs}ms` : `✕ ERR (${output.durationMs}ms)`}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {onRerun && (
            <button
              type="button"
              onClick={onRerun}
              title="Re-run code"
              style={{
                background: '#9ECE6A',
                border: 'none',
                borderRadius: '4px',
                color: '#131622',
                padding: '2px 6px',
                fontSize: '10px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ▶ Re-run
            </button>
          )}
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              title="Clear output"
              style={{
                background: 'none',
                border: '1px solid #3B4261',
                borderRadius: '4px',
                color: '#A9B1D6',
                padding: '2px 6px',
                fontSize: '10px',
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            title="Close output window"
            style={{
              background: 'none',
              border: 'none',
              color: '#565F89',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      <div
        style={{
          padding: '10px 12px',
          overflowY: 'auto',
          backgroundColor: '#0E1017',
          flex: 1,
        }}
      >
        {output.logs.length > 0 && (
          <div style={{ marginBottom: '6px' }}>
            {output.logs.map((log, idx) => (
              <div
                key={idx}
                style={{
                  color: log.startsWith('[ERR]')
                    ? '#F7768E'
                    : log.startsWith('[WARN]')
                      ? '#E0AF68'
                      : log.startsWith('✓')
                        ? '#9ECE6A'
                        : '#C0CAF5',
                  lineHeight: '18px',
                }}
              >
                {log}
              </div>
            ))}
          </div>
        )}

        {output.error && (
          <div style={{ color: '#F7768E', fontWeight: 600, marginTop: '4px' }}>
            Error: {output.error}
          </div>
        )}

        {output.result !== undefined && (
          <div style={{ color: '#7DCFFF', fontWeight: 600, marginTop: '4px' }}>
            ⇒ Return: {output.result}
          </div>
        )}

        {output.logs.length === 0 && !output.error && output.result === undefined && (
          <div style={{ color: '#565F89', fontStyle: 'italic' }}>
            Program completed with no output logs or return value.
          </div>
        )}
      </div>
    </div>
  );
};
