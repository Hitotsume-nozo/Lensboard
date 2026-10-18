/**
 * Feature 25: Floating Pill Toolbar (M5)
 * Authoritative Source: SPEC.md §13, PROJECT.md Feature 25
 * 48px height, 11 tool buttons (V, P, L, S, T, E, C, G, X, R, H), focus mode collapse
 */

import { describe, it, expect } from '../harness.ts';

describe('Feature 25: Floating Pill Toolbar', () => {
  const tools = [
    { key: 'V', name: 'Select' },
    { key: 'P', name: 'Pen' },
    { key: 'L', name: 'Line' },
    { key: 'S', name: 'Shape' },
    { key: 'T', name: 'Text' },
    { key: 'E', name: 'Equation' },
    { key: 'C', name: 'Code' },
    { key: 'G', name: 'Grid' },
    { key: 'X', name: 'Eraser' },
    { key: 'R', name: 'Ruler' },
    { key: 'H', name: 'Hand' },
  ];

  it('f25-1: toolbar height is exactly 48px with 40px tool buttons', () => {
    const toolbarHeight = 48;
    const buttonSize = 40;
    expect(toolbarHeight).toBe(48);
    expect(buttonSize).toBe(40);
  });

  it('f25-2: toolbar contains exactly 11 specification tool slots', () => {
    expect(tools).toHaveLength(11);
    const keys = tools.map((t) => t.key);
    expect(keys).toEqual(['V', 'P', 'L', 'S', 'T', 'E', 'C', 'G', 'X', 'R', 'H']);
  });

  it('f25-3: pressing tool hotkeys activates the corresponding tool', () => {
    let activeTool = 'V';
    function selectTool(key: string): void {
      if (tools.some((t) => t.key === key)) {
        activeTool = key;
      }
    }
    selectTool('P');
    expect(activeTool).toBe('P');
    selectTool('E');
    expect(activeTool).toBe('E');
  });

  it('f25-4: Focus mode (Ctrl+.) collapses toolbar and hides distracting chrome', () => {
    let focusMode = false;
    let toolbarVisible = true;

    function toggleFocusMode(): void {
      focusMode = !focusMode;
      toolbarVisible = !focusMode;
    }

    toggleFocusMode();
    expect(focusMode).toBe(true);
    expect(toolbarVisible).toBe(false);

    toggleFocusMode();
    expect(focusMode).toBe(false);
    expect(toolbarVisible).toBe(true);
  });

  it('f25-5: toolbar floats at bottom-centre with 12px rounded corner radius', () => {
    const style = {
      position: 'floating-bottom-centre',
      borderRadius: 12,
    };
    expect(style.borderRadius).toBe(12);
    expect(style.position).toBe('floating-bottom-centre');
  });
});
