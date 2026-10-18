/**
 * R*-Tree Spatial Indexing using rbush.
 * Indexes all document entities by 2D bounding box for high-performance:
 * - Viewport culling during rendering passes
 * - Broadphase candidate gathering for distance-based hit testing
 */

import RBush from 'rbush';
import type { SpatialItem, BoundingBox } from '../types.js';

export class SpatialIndex {
  private tree: RBush<SpatialItem>;
  private itemMap: Map<string, SpatialItem> = new Map();

  constructor(maxEntries = 9) {
    this.tree = new RBush<SpatialItem>(maxEntries);
  }

  /**
   * Inserts or replaces a spatial item in the index.
   */
  insert(item: SpatialItem): void {
    const existing = this.itemMap.get(item.id);
    if (existing) {
      this.tree.remove(existing, (a, b) => a.id === b.id);
    }
    this.itemMap.set(item.id, item);
    this.tree.insert(item);
  }

  /**
   * Bulk loads a collection of spatial items.
   */
  load(items: SpatialItem[]): void {
    for (const item of items) {
      this.itemMap.set(item.id, item);
    }
    this.tree.load(items);
  }

  /**
   * Removes an entity from the spatial index by its ID.
   */
  remove(id: string): void {
    const existing = this.itemMap.get(id);
    if (existing) {
      this.tree.remove(existing, (a, b) => a.id === b.id);
      this.itemMap.delete(id);
    }
  }

  /**
   * Updates an entity's bounding box in the index.
   */
  update(item: SpatialItem): void {
    this.insert(item);
  }

  /**
   * Queries the spatial index for all items intersecting the search bounding box.
   */
  search(bbox: BoundingBox): SpatialItem[] {
    return this.tree.search(bbox);
  }

  /**
   * Clears the entire spatial index.
   */
  clear(): void {
    this.tree.clear();
    this.itemMap.clear();
  }

  /**
   * Returns all items currently in the spatial index.
   */
  all(): SpatialItem[] {
    return this.tree.all();
  }

  /**
   * Returns an item by its ID.
   */
  get(id: string): SpatialItem | undefined {
    return this.itemMap.get(id);
  }

  /**
   * Returns total count of indexed entities.
   */
  count(): number {
    return this.itemMap.size;
  }
}
