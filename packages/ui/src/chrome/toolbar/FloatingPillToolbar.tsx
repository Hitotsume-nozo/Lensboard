import React, { useEffect, useCallback, useState } from 'react';
import type { ToolKey, ToolDefinition, FloatingPillToolbarProps } from './types.js';
import { ToolButton } from './ToolButton.js';

export const TOOLBAR_HEIGHT = 48;
export const BUTTON_SIZE = 40;

export const TOOLS: readonly ToolDefinition[] = [
  { key: 'V', name: 'Select', description: 'Select & Transform' },
  { key: 'P', name: 'Pen', description: 'Freehand Ink Pen' },
  { key: 'L', name: 'Line', description: 'Line or Arrow' },
  { key: 'S', name: 'Shape', description: 'Geometric Shape' },
  { key: 'T', name: 'Text', description: 'Typeset Text' },
  { key: 'E', name: 'Equation', description: 'KaTeX Math Equation' },
  { key: 'C', name: 'Code', description: 'Code Block' },
  { key: 'G', name: 'Grid', description: 'Grid or Table' },
  { key: 'X', name: 'Eraser', description: 'Stroke Eraser' },
  { key: 'R', name: 'Ruler', description: 'Ruler Guide' },
  { key: 'H', name: 'Hand', description: 'Pan Canvas' },
] as const;

export const TOOL_KEYS: readonly ToolKey[] = [
  'V',
  'P',
  'L',
  'S',
  'T',
  'E',
  'C',
  'G',
  'X',
  'R',
  'H',
] as const;

export function isValidTool(key: string): key is ToolKey {
  return TOOL_KEYS.includes(key as ToolKey);
}

export function nextSlot(currentIndex: number): number {
  return (currentIndex + 1) % TOOL_KEYS.length;
}

export function prevSlot(currentIndex: number): number {
  return (currentIndex - 1 + TOOL_KEYS.length) % TOOL_KEYS.length;
}

export function resolveToolbarMode(viewportWidth: number): 'expanded' | 'compact' {
  return viewportWidth < 600 ? 'compact' : 'expanded';
}

export function shouldSuppressToolShortcut(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return true;
  }
  if (
    target.isContentEditable ||
    target.contentEditable === 'true' ||
    target.getAttribute('contenteditable') === 'true' ||
    target.getAttribute('contenteditable') === ''
  ) {
    return true;
  }
  if (target.closest && (target.closest('.cm-editor') || target.closest('.katex-input'))) {
    return true;
  }
  return false;
}

export const FloatingPillToolbar: React.FC<FloatingPillToolbarProps> = ({
  activeTool,
  onSelectTool,
  focusMode = false,
  onToggleFocusMode,
  reducedMotion = false,
  viewportWidth,
  className = '',
}) => {
  const [internalWidth, setInternalWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  useEffect(() => {
    if (viewportWidth !== undefined) return;
    const handleResize = () => setInternalWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [viewportWidth]);

  const effectiveWidth = viewportWidth !== undefined ? viewportWidth : internalWidth;
  const isCompact = resolveToolbarMode(effectiveWidth) === 'compact';

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Focus mode toggle: Ctrl+.
      if ((e.ctrlKey || e.metaKey) && e.key === '.') {
        e.preventDefault();
        if (onToggleFocusMode) {
          onToggleFocusMode();
        }
        return;
      }

      // Suppress single-key tool shortcuts if input has focus
      if (shouldSuppressToolShortcut(e.target)) {
        return;
      }

      // Modifiers should not trigger tool shortcuts
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      // Arrow keys for circular tool traversal when toolbar is focused
      const activeIdx = TOOL_KEYS.indexOf(activeTool);
      if (e.key === 'ArrowRight') {
        const nextIdx = nextSlot(activeIdx >= 0 ? activeIdx : 0);
        onSelectTool(TOOL_KEYS[nextIdx]);
        return;
      }
      if (e.key === 'ArrowLeft') {
        const prevIdx = prevSlot(activeIdx >= 0 ? activeIdx : 0);
        onSelectTool(TOOL_KEYS[prevIdx]);
        return;
      }

      // Single-letter tool hotkeys (case-insensitive)
      const upper = e.key.toUpperCase();
      if (isValidTool(upper)) {
        onSelectTool(upper);
      }
    },
    [activeTool, onSelectTool, onToggleFocusMode]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const transitionDuration = reducedMotion ? '0ms' : '150ms';

  return (
    <div
      className={`lb-pill-toolbar ${className} ${focusMode ? 'lb-pill-toolbar--collapsed' : ''}`}
      role="toolbar"
      aria-label="Drawing tools"
      data-testid="floating-pill-toolbar"
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: focusMode
          ? 'translate(-50%, 80px)'
          : 'translateX(-50%)',
        opacity: focusMode ? 0 : 1,
        pointerEvents: focusMode ? 'none' : 'auto',
        height: `${TOOLBAR_HEIGHT}px`,
        backgroundColor: 'var(--lb-surface-raised, #232736)',
        border: '1px solid var(--lb-border, #2E3347)',
        borderRadius: '12px',
        boxShadow: 'var(--lb-shadow-floating, 0 8px 24px rgba(0, 0, 0, 0.28))',
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0 4px',
        gap: isCompact ? '2px' : '4px',
        transition: `transform ${transitionDuration} cubic-bezier(0.2, 0, 0, 1), opacity ${transitionDuration} ease-out`,
        zIndex: 1000,
        userSelect: 'none',
      }}
    >
      {TOOLS.map((tool) => (
        <ToolButton
          key={tool.key}
          tool={tool}
          isActive={activeTool === tool.key}
          onClick={() => onSelectTool(tool.key)}
          compact={isCompact}
        />
      ))}
    </div>
  );
};
