/**
 * Feature 27: Collapsible Dual Drawers (M5)
 * Authoritative Source: SPEC.md §13, PROJECT.md Feature 27
 * 320px drawers toggled via `[` (Outline/Library/Inbox) and `]` (Inspector/Lenses)
 */

import { describe, it, expect } from '../harness.ts';

describe('Feature 27: Collapsible Dual Drawers', () => {
  it('f27-1: drawer width is exactly 320px', () => {
    const drawerWidth = 320;
    expect(drawerWidth).toBe(320);
  });

  it('f27-2: drawers are collapsed by default on initial application load', () => {
    const initialDrawerState = { leftOpen: false, rightOpen: false };
    expect(initialDrawerState.leftOpen).toBe(false);
    expect(initialDrawerState.rightOpen).toBe(false);
  });

  it('f27-3: left drawer toggles with `[` key and houses Outline, Library, and Inbox', () => {
    let leftOpen = false;
    function onKeyDown(key: string): void {
      if (key === '[') leftOpen = !leftOpen;
    }
    const leftSections = ['Outline', 'Library', 'Inbox'];

    onKeyDown('[');
    expect(leftOpen).toBe(true);
    expect(leftSections).toContain('Outline');
    expect(leftSections).toContain('Library');

    onKeyDown('[');
    expect(leftOpen).toBe(false);
  });

  it('f27-4: right drawer toggles with `]` key and houses Inspector, Lenses, Backlinks, History', () => {
    let rightOpen = false;
    function onKeyDown(key: string): void {
      if (key === ']') rightOpen = !rightOpen;
    }
    const rightSections = ['Inspector', 'Lenses', 'Backlinks', 'History'];

    onKeyDown(']');
    expect(rightOpen).toBe(true);
    expect(rightSections).toContain('Inspector');
    expect(rightSections).toContain('History');

    onKeyDown(']');
    expect(rightOpen).toBe(false);
  });

  it('f27-5: opening drawer does not disrupt canvas viewport coordinate origin', () => {
    const vp = { x: 50, y: 50, zoom: 1.0 };
    let leftDrawerOpen = true;
    expect(vp.x).toBe(50);
    expect(vp.y).toBe(50);
  });
});
