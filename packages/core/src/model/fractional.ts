/**
 * @lensboard/core - Fractional Indexing & ULID Generator
 * Uses 'ulidx' for 26-character Crockford Base32 IDs and 'fractional-indexing' for Z-order keys.
 */

import { ulid } from 'ulidx';
import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';
import type { CanvasObject, LensDocument } from './entities.js';
import { SCHEMA_VERSION } from './entities.js';

/**
 * Generates a standard 26-character ULID string.
 */
export function generateUlid(seedTime?: number): string {
  return ulid(seedTime);
}

/**
 * Generates the canonical initial fractional index Z key.
 */
export function generateInitialZ(): string {
  return generateKeyBetween(null, null); // returns 'a0'
}

/**
 * Generates a fractional index Z key strictly between two existing keys.
 */
export function generateZBetween(
  prev: string | null | undefined,
  next: string | null | undefined
): string {
  return generateKeyBetween(prev ?? null, next ?? null);
}

/**
 * Generates N fractional index Z keys strictly between two existing keys.
 */
export function generateNZBetween(
  prev: string | null | undefined,
  next: string | null | undefined,
  n: number
): string[] {
  return generateNKeysBetween(prev ?? null, next ?? null, n);
}

/**
 * Sorts root IDs array lexicographically by object fractional index Z key.
 */
export function sortRootIdsByZ(
  rootIds: string[],
  objects: Record<string, CanvasObject>
): string[] {
  return [...rootIds].sort((idA, idB) => {
    const zA = objects[idA]?.z ?? '';
    const zB = objects[idB]?.z ?? '';
    if (zA < zB) return -1;
    if (zA > zB) return 1;
    return idA.localeCompare(idB);
  });
}

/**
 * Inserts a root ID in order into an array of root IDs based on fractional index Z key.
 */
export function insertRootIdInOrder(
  rootIds: string[],
  objects: Record<string, CanvasObject>,
  targetId: string
): string[] {
  if (rootIds.includes(targetId)) {
    return sortRootIdsByZ(rootIds, objects);
  }
  return sortRootIdsByZ([...rootIds, targetId], objects);
}

/**
 * Creates a valid, empty LensDocument conforming to specification §6.
 */
export function createDocument(title = 'Untitled Board', customId?: string): LensDocument {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: customId ?? generateUlid(),
    title,
    objects: {},
    rootIds: [],
    viewport: { x: 0, y: 0, zoom: 1.0 },
  };
}
