/**
 * Offscreen Smart Object Bitmap Cache.
 * Authoritative: Spec §8.
 * - Keyed by (object id, version, zoom bucket).
 * - Zoom buckets are powers of 2 (zoomBucket = 2^floor(log2(zoom))).
 * - Caches equations, code, tables, charts and smart objects to avoid repeated expensive rasterization.
 * - Re-rasterised only when the key changes.
 */

import type { CanvasAdapter } from '../types.js';
import { HeadlessCanvasAdapter } from './adapter.js';

export function calculateZoomBucket(zoom: number): number {
  const safeZoom = Math.max(0.001, zoom);
  return Math.pow(2, Math.floor(Math.log2(safeZoom)));
}

export function createCacheKey(
  objectId: string,
  version: number,
  zoomBucket: number
): string {
  return `${objectId}:${version}:${zoomBucket}`;
}

export interface CachedBitmap {
  key: string;
  objectId: string;
  version: number;
  zoomBucket: number;
  width: number;
  height: number;
  adapter: CanvasAdapter;
  lastUsed: number;
}

export class SmartObjectCache {
  private cache: Map<string, CachedBitmap> = new Map();
  private maxEntries: number;

  constructor(maxEntries = 250) {
    this.maxEntries = maxEntries;
  }

  get(
    objectId: string,
    version: number,
    zoom: number
  ): CachedBitmap | null {
    const bucket = calculateZoomBucket(zoom);
    const key = createCacheKey(objectId, version, bucket);
    const entry = this.cache.get(key);
    if (entry) {
      entry.lastUsed = Date.now();
      return entry;
    }
    return null;
  }

  set(
    objectId: string,
    version: number,
    zoom: number,
    width: number,
    height: number,
    renderFn: (ctx: CanvasRenderingContext2D, width: number, height: number, scale: number) => void
  ): CachedBitmap | null {
    const bucket = calculateZoomBucket(zoom);
    const key = createCacheKey(objectId, version, bucket);

    // Evict oldest if capacity exceeded
    if (this.cache.size >= this.maxEntries) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (const [k, v] of this.cache.entries()) {
        if (v.lastUsed < oldestTime) {
          oldestTime = v.lastUsed;
          oldestKey = k;
        }
      }
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const pixelW = Math.max(1, Math.round(width * bucket));
    const pixelH = Math.max(1, Math.round(height * bucket));

    const adapter = new HeadlessCanvasAdapter(pixelW, pixelH, 1);
    const ctx = adapter.getContext();
    if (!ctx) return null;

    ctx.save();
    ctx.scale(bucket, bucket);
    renderFn(ctx, width, height, bucket);
    ctx.restore();

    const entry: CachedBitmap = {
      key,
      objectId,
      version,
      zoomBucket: bucket,
      width: pixelW,
      height: pixelH,
      adapter,
      lastUsed: Date.now(),
    };

    this.cache.set(key, entry);
    return entry;
  }

  invalidate(objectId: string): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.objectId === objectId) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}
