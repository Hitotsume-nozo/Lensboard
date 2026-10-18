import { describe, it, expect, vi } from 'vitest';
import {
  escapeRegex,
  safeSearch,
  fuzzyScore,
  fuzzySearchCommands,
  SMART_ENTITIES,
  type CommandItem,
} from './index.js';

describe('Feature 28: Command Palette & Smart Entities Unit Tests', () => {
  describe('Safe Regex Escaping & Searching (f28-b1)', () => {
    it('escapes all regex special characters safely', () => {
      const raw = '.*+?^${}()|[]\\';
      const escaped = escapeRegex(raw);
      expect(() => new RegExp(escaped)).not.toThrow();
    });

    it('safely matches queries containing brackets, pluses, parentheses', () => {
      expect(safeSearch('Ctrl+[', 'Toggle Left Drawer (Ctrl+[)')).toBe(true);
      expect(safeSearch('(1+1)', 'Preview Equation (1+1)')).toBe(true);
      expect(safeSearch('*bold*', 'Format *bold* text')).toBe(true);
      expect(safeSearch('not-matching', 'Hello World')).toBe(false);
    });
  });

  describe('Fuzzy Search Commands Engine (f28-1, f28-b2)', () => {
    const commands: CommandItem[] = [
      { id: 'toggle-snap', title: 'Toggle Snap', execute: vi.fn() },
      { id: 'focus-mode', title: 'Focus Mode', shortcut: 'Ctrl+.', recent: true, execute: vi.fn() },
      { id: 'export-pdf', title: 'Export PDF', starred: true, execute: vi.fn() },
      { id: 'undo', title: 'Undo Command', shortcut: 'Ctrl+Z', execute: vi.fn() },
      { id: 'redo', title: 'Redo Command', shortcut: 'Ctrl+Shift+Z', execute: vi.fn() },
    ];

    it('finds commands via substring search (f28-1)', () => {
      const results = fuzzySearchCommands(commands, 'focus');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('focus-mode');
    });

    it('empty query displays top recent and starred commands (f28-b2)', () => {
      const emptyResults = fuzzySearchCommands(commands, '');
      expect(emptyResults).toHaveLength(2);
      const ids = emptyResults.map((c) => c.id);
      expect(ids).toContain('focus-mode'); // recent
      expect(ids).toContain('export-pdf'); // starred
    });

    it('matches by shortcut key', () => {
      const results = fuzzySearchCommands(commands, 'Ctrl+Z');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('undo');
    });

    it('calculates fuzzy scores accurately', () => {
      expect(fuzzyScore('focus', 'Focus Mode')).toBeGreaterThan(fuzzyScore('focus', 'Unfocused'));
      expect(fuzzyScore('abc', 'xyz')).toBe(0);
    });
  });

  describe('Smart Entities Catalog (f28-2)', () => {
    it('defines smart entity templates for DSA and canvas modeling', () => {
      expect(SMART_ENTITIES.length).toBeGreaterThanOrEqual(10);
      const types = SMART_ENTITIES.map((e) => e.type);
      expect(types).toContain('dp-table');
      expect(types).toContain('tree');
      expect(types).toContain('graph');
      expect(types).toContain('nn-block');
      expect(types).toContain('array');
      expect(types).toContain('code');
      expect(types).toContain('equation');
    });
  });
});
