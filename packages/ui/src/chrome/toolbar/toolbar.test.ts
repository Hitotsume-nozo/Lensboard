import { describe, it, expect } from 'vitest';
import {
  TOOLBAR_HEIGHT,
  BUTTON_SIZE,
  TOOLS,
  TOOL_KEYS,
  isValidTool,
  nextSlot,
  prevSlot,
  resolveToolbarMode,
  shouldSuppressToolShortcut,
} from './index.js';

describe('Feature 25: Floating Pill Toolbar Unit Tests', () => {
  describe('Geometry & Tool Specification', () => {
    it('toolbar height is exactly 48px and button size is 40px', () => {
      expect(TOOLBAR_HEIGHT).toBe(48);
      expect(BUTTON_SIZE).toBe(40);
    });

    it('contains exactly 11 specification tool slots in correct order', () => {
      expect(TOOLS).toHaveLength(11);
      expect(TOOL_KEYS).toHaveLength(11);
      expect(TOOL_KEYS).toEqual(['V', 'P', 'L', 'S', 'T', 'E', 'C', 'G', 'X', 'R', 'H']);
    });

    it('identifies valid tools and rejects invalid ones', () => {
      expect(isValidTool('V')).toBe(true);
      expect(isValidTool('P')).toBe(true);
      expect(isValidTool('H')).toBe(true);
      expect(isValidTool('Z')).toBe(false);
      expect(isValidTool('A')).toBe(false);
      expect(isValidTool('')).toBe(false);
    });
  });

  describe('Circular Keyboard Navigation', () => {
    it('wraps forward from last slot (H, 10) back to first (V, 0)', () => {
      expect(nextSlot(0)).toBe(1);
      expect(nextSlot(9)).toBe(10);
      expect(nextSlot(10)).toBe(0);
    });

    it('wraps backwards from first slot (V, 0) to last (H, 10)', () => {
      expect(prevSlot(1)).toBe(0);
      expect(prevSlot(10)).toBe(9);
      expect(prevSlot(0)).toBe(10);
    });
  });

  describe('Responsive Mode & Viewport Width', () => {
    it('switches to compact mode when viewport width is narrower than 600px', () => {
      expect(resolveToolbarMode(480)).toBe('compact');
      expect(resolveToolbarMode(599)).toBe('compact');
    });

    it('uses expanded mode when viewport width is >= 600px', () => {
      expect(resolveToolbarMode(600)).toBe('expanded');
      expect(resolveToolbarMode(1024)).toBe('expanded');
      expect(resolveToolbarMode(1920)).toBe('expanded');
    });
  });

  describe('Input Suppression Guard', () => {
    it('suppresses tool shortcuts when focused in input or textarea', () => {
      const inputEl = document.createElement('input');
      const textareaEl = document.createElement('textarea');
      const selectEl = document.createElement('select');
      const contentEditable = document.createElement('div');
      contentEditable.contentEditable = 'true';

      expect(shouldSuppressToolShortcut(inputEl)).toBe(true);
      expect(shouldSuppressToolShortcut(textareaEl)).toBe(true);
      expect(shouldSuppressToolShortcut(selectEl)).toBe(true);
      expect(shouldSuppressToolShortcut(contentEditable)).toBe(true);
    });

    it('allows tool shortcuts when focused on canvas or regular container', () => {
      const canvasEl = document.createElement('canvas');
      const divEl = document.createElement('div');

      expect(shouldSuppressToolShortcut(canvasEl)).toBe(false);
      expect(shouldSuppressToolShortcut(divEl)).toBe(false);
      expect(shouldSuppressToolShortcut(null)).toBe(false);
    });

    it('suppresses tool shortcuts within CodeMirror or KaTeX containers', () => {
      const cmParent = document.createElement('div');
      cmParent.className = 'cm-editor';
      const cmChild = document.createElement('span');
      cmParent.appendChild(cmChild);

      expect(shouldSuppressToolShortcut(cmChild)).toBe(true);
    });
  });
});
