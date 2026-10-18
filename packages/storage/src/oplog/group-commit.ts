/**
 * @lensboard/storage - Group Commits & Debounced Flusher
 * 100ms debounced group commits with immediate flush on blur/quit/crash.
 */

import type { Command, LensDocument } from '@lensboard/core';

export type SaveState = 'saved' | 'saving' | 'dirty' | 'error';

export interface PendingOp {
  boardId: string;
  command: Command;
  docSnapshot?: LensDocument;
  resolve: () => void;
  reject: (err: unknown) => void;
}

export class GroupCommitFlusher {
  private queue: PendingOp[] = [];
  private timer: NodeJS.Timeout | null = null;
  private state: SaveState = 'saved';
  private stateListeners: Set<(state: SaveState) => void> = new Set();
  private isProcessing = false;

  constructor(
    private readonly commitBatchFn: (batch: PendingOp[]) => Promise<void> | void,
    private readonly debounceIntervalMs = 100
  ) {}

  getState(): SaveState {
    return this.state;
  }

  onStateChange(listener: (state: SaveState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  private setState(next: SaveState): void {
    if (this.state !== next) {
      this.state = next;
      for (const listener of this.stateListeners) {
        listener(next);
      }
    }
  }

  enqueue(boardId: string, command: Command, docSnapshot?: LensDocument): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push({ boardId, command, docSnapshot, resolve, reject });
      this.setState('dirty');

      if (!this.timer) {
        this.timer = setTimeout(() => {
          this.timer = null;
          this.flush().catch((err) => {
            console.error('[GroupCommitFlusher] Error during background commit:', err);
          });
        }, this.debounceIntervalMs);
      }
    });
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.queue.length === 0 || this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    const batch = this.queue.splice(0);
    this.setState('saving');

    try {
      await this.commitBatchFn(batch);
      for (const op of batch) {
        op.resolve();
      }
      this.setState('saved');
    } catch (err) {
      // On disk error, restore items to queue or reject and enter error state
      for (const op of batch) {
        op.reject(err);
      }
      this.setState('error');
      throw err;
    } finally {
      this.isProcessing = false;
    }
  }

  getPendingCount(): number {
    return this.queue.length;
  }
}
