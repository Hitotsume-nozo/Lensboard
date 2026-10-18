/**
 * @lensboard/core - Command Coalescing
 * Coalesces rapid property mutations within 300ms window to the same target entity,
 * preserving the initial pre-drag inverse state.
 */

import type { Command } from './types.js';

export const COALESCE_WINDOW_MS = 300;

/**
 * Predicate checking whether two successive commands qualify for coalescing.
 */
export function shouldCoalesce(
  prevCmd: Command,
  nextCmd: Command,
  windowMs: number = COALESCE_WINDOW_MS
): boolean {
  if (prevCmd.type !== nextCmd.type) return false;
  if (!prevCmd.targets || !nextCmd.targets) return false;
  if (prevCmd.targets.length !== 1 || nextCmd.targets.length !== 1) return false;
  if (prevCmd.targets[0] !== nextCmd.targets[0]) return false;

  const timeDiff = nextCmd.timestamp - prevCmd.timestamp;
  return timeDiff <= windowMs && timeDiff >= 0;
}

/**
 * Coalesces two commands, keeping nextCmd's latest forward state and prevInverse's original state.
 */
export function coalesceCommands(
  prevCmd: Command,
  nextCmd: Command,
  prevInverse: Command
): { command: Command; inverse: Command } {
  const mergedCommand: Command = {
    id: nextCmd.id,
    type: nextCmd.type,
    timestamp: nextCmd.timestamp,
    targets: [...nextCmd.targets],
    payload: {
      ...prevCmd.payload,
      ...nextCmd.payload,
    },
  };

  // Keep original pre-drag inverse state so undo restores the initial state before drag began
  const mergedInverse: Command = {
    ...prevInverse,
    timestamp: nextCmd.timestamp,
  };

  return {
    command: mergedCommand,
    inverse: mergedInverse,
  };
}
