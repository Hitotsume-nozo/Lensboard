/**
 * @lensboard/core - Shortcut Conflicts Detection & Normalization
 * Detects duplicate hotkey conflicts within the same context with case/whitespace tolerance.
 */

import type { ShortcutBinding } from './types.js';

/**
 * Normalizes hotkey strings to a canonical format.
 * Lowercases, strips whitespace, and standardizes modifier ordering (ctrl, alt, shift, meta).
 */
export function normalizeShortcutKey(rawKeys: string): string {
  if (!rawKeys) return '';
  const cleaned = rawKeys.trim().toLowerCase().replace(/\s+/g, '');
  if (!cleaned.includes('+')) return cleaned;

  const parts = cleaned.split('+');
  const modifiers: string[] = [];
  const normalKeys: string[] = [];

  for (const part of parts) {
    if (part === 'ctrl' || part === 'control') modifiers.push('ctrl');
    else if (part === 'alt' || part === 'option') modifiers.push('alt');
    else if (part === 'shift') modifiers.push('shift');
    else if (part === 'meta' || part === 'cmd' || part === 'command') modifiers.push('meta');
    else normalKeys.push(part);
  }

  // Canonical sort: ctrl, alt, shift, meta
  const order: Record<string, number> = { ctrl: 1, alt: 2, shift: 3, meta: 4 };
  modifiers.sort((a, b) => (order[a] ?? 99) - (order[b] ?? 99));

  return [...modifiers, ...normalKeys].join('+');
}

/**
 * Detects duplicate shortcut key combinations within the same context.
 * Identical hotkeys in different contexts (e.g. 'canvas' vs 'editor') are strictly permitted.
 */
export function detectDuplicateBindings(bindings: ShortcutBinding[]): string[] {
  const seen = new Map<string, string>();
  const conflicts: string[] = [];

  for (const b of bindings) {
    if (!b.keys || b.keys.trim().length === 0) {
      conflicts.push(`Invalid empty key binding for id "${b.id}"`);
      continue;
    }

    const normalizedKey = normalizeShortcutKey(b.keys);
    const contextKey = `${b.context}:${normalizedKey}`;

    if (seen.has(contextKey)) {
      conflicts.push(
        `Conflict detected: Duplicate binding for "${b.keys}" in context "${b.context}": conflict between "${seen.get(contextKey)}" and "${b.id}"`
      );
    } else {
      seen.set(contextKey, b.id);
    }
  }

  return conflicts;
}
