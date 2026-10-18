/**
 * @lensboard/core - HistoryManager
 * Multi-level undo/redo manager with 5,000 capacity clamp, 300ms coalescing,
 * and offline serialization.
 */

import { apply } from '../commands/apply.js';
import { coalesceCommands, shouldCoalesce } from '../commands/coalescing.js';
import type { Command, CommandResult } from '../commands/types.js';
import type { LensDocument } from '../model/entities.js';

export const MAX_HISTORY_CAPACITY = 5000;

export interface HistoryEntry {
  command: Command;
  inverse: Command;
}

export interface SerializedHistory {
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
}

export class HistoryManager {
  private doc: LensDocument;
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private readonly maxCapacity: number;

  constructor(initialDoc: LensDocument, maxCapacity = MAX_HISTORY_CAPACITY) {
    this.doc = initialDoc;
    this.maxCapacity = maxCapacity;
  }

  /**
   * Returns current active document.
   */
  getDocument(): LensDocument {
    return this.doc;
  }

  /**
   * Replaces current document reference.
   */
  setDocument(doc: LensDocument): void {
    this.doc = doc;
  }

  /**
   * Applies a mutation command, handling coalescing, undo stack pushing, and redo stack clearing.
   */
  apply(command: Command): CommandResult {
    const lastEntry = this.undoStack[this.undoStack.length - 1];

    if (lastEntry && shouldCoalesce(lastEntry.command, command)) {
      // Coalesce: apply the command forward, but keep original pre-drag inverse!
      const result = apply(this.doc, command);
      const coalesced = coalesceCommands(lastEntry.command, command, lastEntry.inverse);
      this.undoStack[this.undoStack.length - 1] = {
        command: coalesced.command,
        inverse: coalesced.inverse,
      };
      this.doc = result.doc;
      // Redo stack is still cleared on user interaction
      this.redoStack = [];
      return {
        doc: this.doc,
        inverse: coalesced.inverse,
      };
    }

    // Normal non-coalesced command application
    const result = apply(this.doc, command);
    this.undoStack.push({
      command,
      inverse: result.inverse,
    });

    // Enforce 5,000 commands capacity clamp (FIFO purge from bottom)
    if (this.undoStack.length > this.maxCapacity) {
      this.undoStack.shift();
    }

    // Any new user action invalidates redo stack
    this.redoStack = [];
    this.doc = result.doc;

    return result;
  }

  /**
   * Undoes the most recent command on the undo stack.
   * Safe no-op returning null if undo stack is empty.
   */
  undo(): CommandResult | null {
    if (this.undoStack.length === 0) {
      return null;
    }

    const entry = this.undoStack.pop();
    if (!entry) return null;

    // Apply the inverse command to restore previous document state
    const result = apply(this.doc, entry.inverse);
    this.doc = result.doc;

    // Push the original forward entry to redo stack
    this.redoStack.push(entry);

    return result;
  }

  /**
   * Redoes the most recently undone command on the redo stack.
   * Safe no-op returning null if redo stack is empty.
   */
  redo(): CommandResult | null {
    if (this.redoStack.length === 0) {
      return null;
    }

    const entry = this.redoStack.pop();
    if (!entry) return null;

    // Re-apply the forward command
    const result = apply(this.doc, entry.command);
    this.doc = result.doc;

    // Push back to undo stack
    this.undoStack.push({
      command: entry.command,
      inverse: result.inverse,
    });

    if (this.undoStack.length > this.maxCapacity) {
      this.undoStack.shift();
    }

    return result;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  getUndoStack(): readonly HistoryEntry[] {
    return this.undoStack;
  }

  getRedoStack(): readonly HistoryEntry[] {
    return this.redoStack;
  }

  /**
   * Serializes history stacks for offline persistence across restarts.
   */
  serialize(): SerializedHistory {
    return {
      undoStack: JSON.parse(JSON.stringify(this.undoStack)),
      redoStack: JSON.parse(JSON.stringify(this.redoStack)),
    };
  }

  /**
   * Deserializes history stacks restored from persistent storage.
   */
  deserialize(data: Partial<SerializedHistory>): void {
    this.undoStack = (data.undoStack ? JSON.parse(JSON.stringify(data.undoStack)) : []).slice(
      -this.maxCapacity
    );
    this.redoStack = data.redoStack ? JSON.parse(JSON.stringify(data.redoStack)) : [];
  }
}
