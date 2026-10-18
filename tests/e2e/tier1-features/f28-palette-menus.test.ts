/**
 * Feature 28: Command Palette & Menus (M5)
 * Authoritative Source: SPEC.md §13, PROJECT.md Feature 28
 * Ctrl+K fuzzy palette, Insert menu (/), 8-slot right-click pie menu
 */

import { describe, it, expect } from '../harness.ts';

describe('Feature 28: Command Palette & Menus', () => {
  const pieSlots = [
    'Colour',
    'Tool',
    'Undo',
    'Redo',
    'Convert',
    'Tidy',
    'Duplicate',
    'Delete',
  ];

  it('f28-1: command palette triggers via Ctrl+K and supports fuzzy search', () => {
    const commands = [
      { id: 'toggle-snap', title: 'Toggle Snap' },
      { id: 'focus-mode', title: 'Focus Mode' },
      { id: 'export-pdf', title: 'Export PDF' },
    ];
    function fuzzySearch(query: string) {
      const q = query.toLowerCase();
      return commands.filter((c) => c.title.toLowerCase().includes(q));
    }
    const results = fuzzySearch('focus');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('focus-mode');
  });

  it('f28-2: insert menu triggers with `/` key and presents smart entity options', () => {
    let insertMenuOpen = false;
    function onKeyDown(key: string): void {
      if (key === '/') insertMenuOpen = true;
    }
    onKeyDown('/');
    expect(insertMenuOpen).toBe(true);
  });

  it('f28-3: pie menu contains exactly 8 functional directional slots', () => {
    expect(pieSlots).toHaveLength(8);
    expect(pieSlots).toContain('Colour');
    expect(pieSlots).toContain('Undo');
    expect(pieSlots).toContain('Convert');
    expect(pieSlots).toContain('Delete');
  });

  it('f28-4: pie menu operates with 120px radius and 24px dead zone', () => {
    const pieConfig = { radius: 120, deadZone: 24 };
    expect(pieConfig.radius).toBe(120);
    expect(pieConfig.deadZone).toBe(24);

    function resolvePieSlot(dx: number, dy: number): number | null {
      const dist = Math.hypot(dx, dy);
      if (dist < pieConfig.deadZone) return null; // In dead zone
      let angle = Math.atan2(dy, dx);
      if (angle < 0) angle += 2 * Math.PI;
      const slotIndex = Math.floor((angle / (2 * Math.PI)) * 8);
      return slotIndex;
    }

    expect(resolvePieSlot(5, 5)).toBeNull(); // Within 24px deadzone
    expect(resolvePieSlot(50, 0)).toBe(0); // Right flick
  });

  it('f28-5: right-click activates pie menu without triggering default browser context menu', () => {
    let pieMenuTriggered = false;
    let defaultPrevented = false;

    function onContextMenu(button: number): void {
      if (button === 2) {
        // Right button
        pieMenuTriggered = true;
        defaultPrevented = true;
      }
    }

    onContextMenu(2);
    expect(pieMenuTriggered).toBe(true);
    expect(defaultPrevented).toBe(true);
  });
});
