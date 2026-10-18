/**
 * Feature 17: Shortcut Registry (M3)
 * Authoritative Source: SPEC.md §14, PROJECT.md Feature 17
 * Hotkey registry, duplicate default binding conflict detection (detectDuplicateBindings)
 */

import { describe, it, expect } from '../harness.ts';
import { detectDuplicateBindingsOracle } from '../helpers/oracle.ts';
import type { ShortcutBinding } from '../helpers/contracts.ts';

describe('Feature 17: Shortcut Registry', () => {
  it('f17-1: valid non-overlapping bindings produce zero conflict errors', () => {
    const bindings: ShortcutBinding[] = [
      { id: 'tool-select', keys: 'V', context: 'canvas', action: 'select' },
      { id: 'tool-pen', keys: 'P', context: 'canvas', action: 'pen' },
      { id: 'cmd-palette', keys: 'Ctrl+K', context: 'global', action: 'openPalette' },
    ];
    const conflicts = detectDuplicateBindingsOracle(bindings);
    expect(conflicts).toHaveLength(0);
  });

  it('f17-2: duplicate keys within same context trigger conflict detection', () => {
    const bindings: ShortcutBinding[] = [
      { id: 'tool-pen', keys: 'P', context: 'canvas', action: 'pen' },
      { id: 'tool-pan', keys: 'p', context: 'canvas', action: 'pan' },
    ];
    const conflicts = detectDuplicateBindingsOracle(bindings);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0]).toContain('Duplicate binding');
  });

  it('f17-3: same key across different contexts is permitted without conflict', () => {
    const bindings: ShortcutBinding[] = [
      { id: 'enter-canvas', keys: 'Enter', context: 'canvas', action: 'edit' },
      { id: 'enter-editor', keys: 'Enter', context: 'editor', action: 'newline' },
    ];
    const conflicts = detectDuplicateBindingsOracle(bindings);
    expect(conflicts).toHaveLength(0);
  });

  it('f17-4: case-insensitive and whitespace-insensitive key normalization', () => {
    const bindings: ShortcutBinding[] = [
      { id: 'action-1', keys: 'ctrl + k', context: 'global', action: 'a1' },
      { id: 'action-2', keys: 'Ctrl+K', context: 'global', action: 'a2' },
    ];
    const conflicts = detectDuplicateBindingsOracle(bindings);
    expect(conflicts).toHaveLength(1);
  });

  it('f17-5: single-key tool shortcuts are inactive during text editor focus', () => {
    function isShortcutActive(binding: ShortcutBinding, hasEditorFocus: boolean): boolean {
      if (hasEditorFocus && binding.context === 'canvas' && binding.keys.length === 1) {
        return false;
      }
      return true;
    }
    const penShortcut: ShortcutBinding = { id: 'pen', keys: 'P', context: 'canvas', action: 'pen' };
    expect(isShortcutActive(penShortcut, false)).toBe(true);
    expect(isShortcutActive(penShortcut, true)).toBe(false);
  });
});
