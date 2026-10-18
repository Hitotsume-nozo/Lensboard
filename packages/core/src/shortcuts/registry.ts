/**
 * @lensboard/core - Shortcut Registry
 * Central registry managing keyboard shortcuts, context isolation, and editor focus filtering.
 */

import { detectDuplicateBindings, normalizeShortcutKey } from './conflicts.js';
import type { ShortcutBinding, ShortcutContext } from './types.js';

export class ShortcutRegistry {
  private bindings: Map<string, ShortcutBinding> = new Map();

  constructor(initialBindings?: readonly ShortcutBinding[]) {
    if (initialBindings) {
      for (const b of initialBindings) {
        this.register(b);
      }
    }
  }

  /**
   * Registers a keyboard shortcut binding.
   * Throws an error if key string is empty.
   */
  register(binding: ShortcutBinding): void {
    if (!binding.keys || binding.keys.trim().length === 0) {
      throw new Error(`Cannot register shortcut "${binding.id}" with an empty key string`);
    }

    // Check conflict against current bindings within same context
    const existingInContext = Array.from(this.bindings.values()).filter(
      (b) => b.id !== binding.id
    );
    const conflicts = detectDuplicateBindings([...existingInContext, binding]);
    if (conflicts.length > 0) {
      throw new Error(conflicts[0]);
    }

    this.bindings.set(binding.id, { ...binding });
  }

  /**
   * Unregisters a keyboard shortcut by its unique ID.
   * Returns true if found and removed.
   */
  unregister(id: string): boolean {
    return this.bindings.delete(id);
  }

  /**
   * Retrieves a binding by its ID.
   */
  getBinding(id: string): ShortcutBinding | undefined {
    const b = this.bindings.get(id);
    return b ? { ...b } : undefined;
  }

  /**
   * Returns a copy of all registered bindings.
   */
  getAllBindings(): ShortcutBinding[] {
    return Array.from(this.bindings.values()).map((b) => ({ ...b }));
  }

  /**
   * Runs duplicate binding conflict detection across all registered shortcuts.
   */
  checkConflicts(): string[] {
    return detectDuplicateBindings(Array.from(this.bindings.values()));
  }

  /**
   * Determines if a shortcut binding is currently active.
   * Specification §14: Single-key tool shortcuts are inactive during text editor / overlay focus.
   */
  isShortcutActive(binding: ShortcutBinding, hasEditorFocus = false): boolean {
    if (hasEditorFocus && binding.context === 'canvas' && binding.keys.trim().length === 1) {
      return false;
    }
    return true;
  }

  /**
   * Finds a registered binding matching the given key event string and context.
   * Checks the specified context first, then falls back to 'global' if not in editor mode.
   */
  findMatch(
    keyString: string,
    context: ShortcutContext,
    hasEditorFocus = false
  ): ShortcutBinding | undefined {
    const normalizedTarget = normalizeShortcutKey(keyString);
    if (!normalizedTarget) return undefined;

    // Search exact context first
    for (const binding of this.bindings.values()) {
      if (binding.context === context && normalizeShortcutKey(binding.keys) === normalizedTarget) {
        if (this.isShortcutActive(binding, hasEditorFocus)) {
          return { ...binding };
        }
      }
    }

    // Fall back to 'global' context if searching from canvas or editor
    if (context !== 'global') {
      for (const binding of this.bindings.values()) {
        if (binding.context === 'global' && normalizeShortcutKey(binding.keys) === normalizedTarget) {
          if (this.isShortcutActive(binding, hasEditorFocus)) {
            return { ...binding };
          }
        }
      }
    }

    return undefined;
  }

  clear(): void {
    this.bindings.clear();
  }
}
