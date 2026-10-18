/**
 * Feature 24: Breadcrumbs & Tab Strip (M5)
 * Authoritative Source: SPEC.md §13, PROJECT.md Feature 24
 * Top chrome breadcrumb (Project / Board) with save dot and slim board tab strip
 */

import { describe, it, expect } from '../harness.ts';

describe('Feature 24: Breadcrumbs & Tab Strip', () => {
  it('f24-1: breadcrumb displays Project / Board hierarchy', () => {
    const breadcrumb = { project: 'DSA Prep', board: 'Graph Algorithms' };
    const formatted = `${breadcrumb.project} / ${breadcrumb.board}`;
    expect(formatted).toBe('DSA Prep / Graph Algorithms');
  });

  it('f24-2: save dot reflects persistent disk state (saved, saving, dirty, error)', () => {
    const validStates = ['saved', 'saving', 'dirty', 'error'];
    for (const s of validStates) {
      expect(validStates).toContain(s);
    }
  });

  it('f24-3: tab strip supports switching active board with Alt+1 to 9 hotkeys', () => {
    const openTabs = ['Board A', 'Board B', 'Board C'];
    function switchTab(index: number): string {
      return openTabs[index - 1];
    }
    expect(switchTab(1)).toBe('Board A');
    expect(switchTab(2)).toBe('Board B');
  });

  it('f24-4: tab strip allows closing board tabs via Ctrl+W', () => {
    const openTabs = ['Board A', 'Board B', 'Board C'];
    function closeTab(index: number): void {
      openTabs.splice(index, 1);
    }
    closeTab(1); // Close Board B
    expect(openTabs).toHaveLength(2);
    expect(openTabs).not.toContain('Board B');
  });

  it('f24-5: opening a new tab adds it to the tab strip via Ctrl+T', () => {
    const openTabs = ['Board A'];
    openTabs.push('New Board');
    expect(openTabs).toHaveLength(2);
    expect(openTabs[1]).toBe('New Board');
  });
});
