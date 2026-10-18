/**
 * @lensboard/core - Command Types & Interfaces
 * Pure serializable mutation command contracts.
 */

import type { LensDocument } from '../model/entities.js';

export type CommandType =
  | 'create'
  | 'update'
  | 'delete'
  | 'move'
  | 'resize'
  | 'setStyle'
  | 'reorder'
  | 'group'
  | 'ungroup'
  | 'convertInk'
  | 'revertConversion'
  | 'batch'
  | 'setViewport'
  // Legacy aliases for backward compatibility
  | 'create_object'
  | 'delete_object'
  | 'set_viewport';

export interface Command {
  id: string; // ULID
  type: CommandType | string;
  timestamp: number; // UTC epoch ms
  targets: string[]; // affected entity IDs
  payload: Record<string, any>;
}

export interface CommandResult {
  doc: LensDocument;
  inverse: Command;
}
