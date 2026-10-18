/**
 * Ambient type declarations for third-party modules lacking bundled TypeScript types.
 */

declare module 'rbush' {
  export interface BBox {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }

  export default class RBush<T extends BBox> {
    constructor(maxEntries?: number);
    insert(item: T): this;
    load(items: readonly T[]): this;
    remove(item: T, equals?: (a: T, b: T) => boolean): this;
    clear(): this;
    search(bbox: BBox): T[];
    all(): T[];
    collides(bbox: BBox): boolean;
    toJSON(): unknown;
    fromJSON(data: unknown): this;
  }
}
