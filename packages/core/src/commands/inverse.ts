/**
 * @lensboard/core - Command Inverse Utilities
 * Provides standalone inverse extraction and verification.
 */

import type { LensDocument } from '../model/entities.js';
import { apply } from './apply.js';
import type { Command } from './types.js';

/**
 * Computes the inverse command for a given command applied to doc without mutating doc.
 */
export function computeInverse(doc: LensDocument, command: Command): Command {
  const result = apply(doc, command);
  return result.inverse;
}
