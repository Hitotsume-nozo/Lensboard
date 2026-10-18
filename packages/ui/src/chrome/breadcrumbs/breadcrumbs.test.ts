import { describe, it, expect } from 'vitest';
import {
  formatTitle,
  formatBreadcrumb,
  truncateTabTitle,
  switchTabByIndex,
  handleTabCloseWithFallback,
  SAVE_STATE_COLORS,
  SAVE_STATE_TOOLTIPS,
  type SaveState,
  type BoardTabItem,
} from './index.js';

describe('Feature 24: Breadcrumbs & Tab Strip Unit Tests', () => {
  describe('formatTitle & formatBreadcrumb', () => {
    it('formats Project / Board hierarchy correctly', () => {
      const formatted = formatBreadcrumb('Algorithms', 'Dynamic Programming');
      expect(formatted).toBe('Algorithms / Dynamic Programming');
    });

    it('falls back to Untitled for undefined, empty, or whitespace-only inputs', () => {
      expect(formatTitle('')).toBe('Untitled');
      expect(formatTitle('   ')).toBe('Untitled');
      expect(formatTitle(undefined)).toBe('Untitled');
      expect(formatBreadcrumb('', '')).toBe('Untitled / Untitled');
      expect(formatBreadcrumb('My Project', '   ')).toBe('My Project / Untitled');
    });

    it('trims leading and trailing whitespace from titles', () => {
      expect(formatTitle('  Graph Theory  ')).toBe('Graph Theory');
      expect(formatBreadcrumb('  Stanford  ', '  CS106B  ')).toBe('Stanford / CS106B');
    });
  });

  describe('truncateTabTitle', () => {
    it('retains titles <= 24 characters without truncation', () => {
      expect(truncateTabTitle('Short Title')).toBe('Short Title');
      const exact24 = '123456789012345678901234';
      expect(truncateTabTitle(exact24)).toBe(exact24);
    });

    it('truncates titles > 24 characters with an ellipsis at character 24', () => {
      const longTitle = 'A'.repeat(200);
      const truncated = truncateTabTitle(longTitle);
      expect(truncated).toHaveLength(24);
      expect(truncated.endsWith('…')).toBe(true);
      expect(truncated).toBe('A'.repeat(23) + '…');
    });

    it('supports custom maxLen parameter', () => {
      expect(truncateTabTitle('Hello World', 5)).toBe('Hell…');
    });
  });

  describe('switchTabByIndex', () => {
    const tabs: BoardTabItem[] = [
      { id: 'tab-1', title: 'Board 1' },
      { id: 'tab-2', title: 'Board 2' },
      { id: 'tab-3', title: 'Board 3' },
    ];

    it('switches tab using 1-based index (Alt+1, Alt+2, etc.)', () => {
      expect(switchTabByIndex(tabs, 1)?.id).toBe('tab-1');
      expect(switchTabByIndex(tabs, 2)?.id).toBe('tab-2');
      expect(switchTabByIndex(tabs, 3)?.id).toBe('tab-3');
    });

    it('safely returns null for out-of-range index (e.g. Alt+9 when only 3 tabs exist)', () => {
      expect(switchTabByIndex(tabs, 0)).toBeNull();
      expect(switchTabByIndex(tabs, 4)).toBeNull();
      expect(switchTabByIndex(tabs, 9)).toBeNull();
      expect(switchTabByIndex(tabs, -1)).toBeNull();
    });

    it('works with plain string arrays', () => {
      const stringTabs = ['Alpha', 'Beta', 'Gamma'];
      expect(switchTabByIndex(stringTabs, 1)).toBe('Alpha');
      expect(switchTabByIndex(stringTabs, 2)).toBe('Beta');
      expect(switchTabByIndex(stringTabs, 5)).toBeNull();
    });
  });

  describe('handleTabCloseWithFallback', () => {
    it('removes closing tab from tabs array when other tabs remain', () => {
      const initialTabs: BoardTabItem[] = [
        { id: 'b1', title: 'Board 1' },
        { id: 'b2', title: 'Board 2' },
      ];
      const result = handleTabCloseWithFallback(initialTabs, 'b1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('b2');
    });

    it('opens system Inbox board when closing the last remaining board tab (f24-b2)', () => {
      const initialTabs: BoardTabItem[] = [{ id: 'b1', title: 'Only Board' }];
      const result = handleTabCloseWithFallback(initialTabs, 'b1');
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Inbox');
      expect(result[0].id).toBeDefined();
    });
  });

  describe('Save Dot States & Colors', () => {
    const validStates: SaveState[] = ['saved', 'saving', 'dirty', 'error'];

    it('supports all 4 persistent disk save states', () => {
      for (const state of validStates) {
        expect(SAVE_STATE_COLORS[state]).toBeDefined();
        expect(SAVE_STATE_TOOLTIPS[state]).toBeDefined();
      }
    });

    it('saved state uses accent-2 and indicates persistent disk save', () => {
      expect(SAVE_STATE_COLORS.saved).toContain('--lb-accent-2');
      expect(SAVE_STATE_TOOLTIPS.saved).toContain('saved to disk');
    });

    it('error state uses danger and indicates failure', () => {
      expect(SAVE_STATE_COLORS.error).toContain('--lb-danger');
      expect(SAVE_STATE_TOOLTIPS.error).toContain('Save failed');
    });
  });
});
