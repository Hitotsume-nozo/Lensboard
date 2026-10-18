import React, { useState, useRef, useEffect, useCallback } from 'react';

export interface CodeExecutionOutput {
  logs: string[];
  result?: string;
  error?: string;
  durationMs: number;
  success: boolean;
}

/**
 * Strips basic TypeScript type annotations and syntax for safe browser Function execution.
 */
function stripTypeScriptTypes(code: string): string {
  return code
    .replace(/\b(?:interface|type)\s+[A-Za-z0-9_$]+[\s\S]*?(?:;|\n\})/g, '')
    .replace(/: (number|string|boolean|any|void|unknown|object|never)(\[\])?/g, '')
    .replace(/<[A-Za-z0-9_$]+>/g, '')
    .replace(/\bas\s+[A-Za-z0-9_$]+/g, '');
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

    // REPL-style: If no explicit return statement exists, try wrapping trailing expression in return (...)
    const hasExplicitReturn =
      sanitized.includes('return ') ||
      sanitized.includes('return;') ||
      sanitized.includes('return\n');

    if (!hasExplicitReturn) {
      const lines = sanitized.trim().split('\n');
      const lastLine = lines[lines.length - 1].trim().replace(/;$/, '');
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
      ];
      const startsWithStmt = statementKeywords.some(
        (kw) => lastLine.startsWith(kw + ' ') || lastLine === kw
      );

      if (!startsWithStmt && !lastLine.endsWith('}')) {
        try {
          const prefix = lines.slice(0, -1).join('\n');
          const exprCode = `"use strict";\n${prefix}\nreturn (${lastLine});`;
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
    const declaredFns = [...codeToRun.matchAll(/function\s+([a-zA-Z0-9_$]+)/g)].map((m) => m[1]);
    if (declaredFns.length > 0) {
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
    /(\/\/[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b(?:const|let|var|function|return|if|else|for|while|import|export|from|class|type|interface|extends|implements|async|await|new|typeof|instanceof|try|catch|finally|throw|switch|case|default|break|continue|void|any|number|string|boolean)\b)|(\b\d+(?:\.\d+)?\b)|(\b(?:true|false|null|undefined)\b)|([a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\())|([{}()[\];,+\-*/%=<>!&|^~?:])/g;

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

    const [full, comment, str, kw, num, bool, fnName, punct] = match;

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
  const [output, setOutput] = useState<CodeExecutionOutput | undefined>(initialOutput);
  const [showOutputDrawer, setShowOutputDrawer] = useState(Boolean(initialOutput));

  const activeInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const linesContainerRef = useRef<HTMLDivElement | null>(null);

  const fullCode = lines.join('\n');

  const pushUndo = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-20), lines]);
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

  // Keep active line input focused when in INSERT mode
  useEffect(() => {
    if (editorMode === 'INSERT' && activeInputRef.current) {
      activeInputRef.current.focus();
      const col = Math.min(cursorCol, activeInputRef.current.value.length);
      activeInputRef.current.setSelectionRange(col, col);
    }
  }, [activeLineIdx, editorMode]);

  // Handle active line text change in INSERT mode
  const handleLineChange = (val: string) => {
    setLines((prev) => {
      const next = [...prev];
      next[activeLineIdx] = val;
      return next;
    });
  };

  // Keyboard navigation and commands in INSERT mode
  const handleInsertKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const curPos = input.selectionStart || 0;
    setCursorCol(curPos);

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

    if (e.key === 'Escape') {
      e.preventDefault();
      setEditorMode('NORMAL');
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      pushUndo();
      const before = input.value.slice(0, curPos);
      const after = input.value.slice(curPos);
      const nextVal = before + '  ' + after;
      handleLineChange(nextVal);
      setCursorCol(curPos + 2);
      setTimeout(() => {
        if (activeInputRef.current) {
          activeInputRef.current.setSelectionRange(curPos + 2, curPos + 2);
        }
      }, 0);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      pushUndo();
      const before = input.value.slice(0, curPos);
      const after = input.value.slice(curPos);
      setLines((prev) => {
        const next = [...prev];
        next[activeLineIdx] = before;
        next.splice(activeLineIdx + 1, 0, after);
        return next;
      });
      setActiveLineIdx((prev) => prev + 1);
      setCursorCol(0);
      return;
    }

    if (e.key === 'Backspace' && curPos === 0) {
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
        setActiveLineIdx((prev) => prev - 1);
        setCursorCol(targetCol);
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

    // Navigation
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
      // Handle dd
      pushUndo();
      setYankedLine(lines[activeLineIdx]);
      setLines((prev) => {
        if (prev.length <= 1) return [''];
        const next = [...prev];
        next.splice(activeLineIdx, 1);
        return next;
      });
      setActiveLineIdx((prev) => Math.min(prev, Math.max(0, lines.length - 2)));
      return;
    }
    if (e.key === 'y') {
      // Handle yy
      setYankedLine(lines[activeLineIdx]);
      return;
    }
    if (e.key === 'p') {
      // Paste yanked line below
      if (yankedLine !== undefined) {
        pushUndo();
        setLines((prev) => {
          const next = [...prev];
          next.splice(activeLineIdx + 1, 0, yankedLine);
          return next;
        });
        setActiveLineIdx((prev) => prev + 1);
      }
      return;
    }
    if (e.key === 'u') {
      // Undo
      if (undoStack.length > 0) {
        const prevLines = undoStack[undoStack.length - 1];
        setUndoStack((s) => s.slice(0, -1));
        setLines(prevLines);
      }
      return;
    }
    if (e.key === 'r') {
      // Run code shortcut in normal mode
      e.preventDefault();
      handleRun();
      return;
    }
    if (e.key === ':') {
      // Enter command mode
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

  // Execute Neovim-style command line (:w, :q, :wq, :run)
  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = commandText.trim();
    if (cmd === 'w') {
      onSave(fullCode, output);
      setEditorMode('NORMAL');
    } else if (cmd === 'q') {
      onClose();
    } else if (cmd === 'wq' || cmd === 'x') {
      handleSaveAndClose();
    } else if (cmd === 'run' || cmd === 'r') {
      handleRun();
      setEditorMode('NORMAL');
    } else if (cmd === 'clear') {
      setOutput(undefined);
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

      {/* ── Line-by-Line Code Editor Body ───────────────────────── */}
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
                alignItems: 'center',
                minHeight: '22px',
                lineHeight: '22px',
                backgroundColor: isActive ? 'rgba(47, 53, 77, 0.45)' : 'transparent',
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
                }}
              >
                {lineNum}
              </div>

              {/* Line Content: Input in INSERT mode on active line, Color Linter Tokens otherwise */}
              <div style={{ flex: 1, paddingRight: '12px', display: 'flex', alignItems: 'center' }}>
                {isActive && editorMode === 'INSERT' ? (
                  <input
                    ref={activeInputRef}
                    type="text"
                    value={lineContent}
                    onChange={(e) => handleLineChange(e.target.value)}
                    onKeyDown={handleInsertKeyDown}
                    spellCheck={false}
                    autoComplete="off"
                    style={{
                      width: '100%',
                      backgroundColor: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: '#C0CAF5',
                      fontFamily: 'inherit',
                      fontSize: '12px',
                      lineHeight: '22px',
                      padding: 0,
                      margin: 0,
                      caretColor: '#7AA2F7',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      fontFamily: 'inherit',
                      fontSize: '12px',
                      lineHeight: '22px',
                      whiteSpace: 'pre',
                      width: '100%',
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
