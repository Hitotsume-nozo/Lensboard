import { describe, it, expect } from 'vitest';
import {
  calculateZoomBucket,
  createCacheKey,
  SmartObjectCache,
} from './cache.js';

describe('SmartObjectCache', () => {
  it('calculates zoom buckets as powers of 2', () => {
    expect(calculateZoomBucket(1.0)).toBe(1);
    expect(calculateZoomBucket(1.5)).toBe(1);
    expect(calculateZoomBucket(1.99)).toBe(1);
    expect(calculateZoomBucket(2.0)).toBe(2);
    expect(calculateZoomBucket(3.5)).toBe(2);
    expect(calculateZoomBucket(4.0)).toBe(4);
    expect(calculateZoomBucket(0.5)).toBe(0.5);
    expect(calculateZoomBucket(0.7)).toBe(0.5);
    expect(calculateZoomBucket(0.25)).toBe(0.25);
  });

  it('generates consistent cache keys from objectId, version, and zoomBucket', () => {
    const key = createCacheKey('obj1', 3, 2);
    expect(key).toBe('obj1:3:2');
  });

  it('stores and retrieves rasterized bitmaps from cache', () => {
    const cache = new SmartObjectCache(50);
    expect(cache.get('obj1', 1, 1.0)).toBeNull();

    let renderCalls = 0;
    const renderFn = (ctx: CanvasRenderingContext2D) => {
      renderCalls++;
      ctx.fillRect(0, 0, 100, 100);
    };

    const entry = cache.set('obj1', 1, 1.0, 100, 100, renderFn);
    expect(entry).not.toBeNull();
    expect(renderCalls).toBe(1);

    // Cache hit: same zoom bucket (zoom 1.2 falls in bucket 1)
    const hit = cache.get('obj1', 1, 1.2);
    expect(hit).not.toBeNull();
    expect(hit?.objectId).toBe('obj1');
    expect(hit?.zoomBucket).toBe(1);

    // Cache miss: different zoom bucket (zoom 2.5 falls in bucket 2)
    const miss = cache.get('obj1', 1, 2.5);
    expect(miss).toBeNull();
  });

  it('invalidates entries by objectId', () => {
    const cache = new SmartObjectCache(50);
    cache.set('eq1', 1, 1.0, 50, 50, () => {});
    cache.set('eq1', 1, 2.0, 50, 50, () => {});
    cache.set('tbl1', 1, 1.0, 50, 50, () => {});

    expect(cache.size()).toBe(3);
    cache.invalidate('eq1');
    expect(cache.size()).toBe(1);
    expect(cache.get('tbl1', 1, 1.0)).not.toBeNull();
  });

  it('evicts oldest entries when capacity limit is reached', () => {
    const cache = new SmartObjectCache(3);
    cache.set('o1', 1, 1.0, 10, 10, () => {});
    cache.set('o2', 1, 1.0, 10, 10, () => {});
    cache.set('o3', 1, 1.0, 10, 10, () => {});
    expect(cache.size()).toBe(3);

    // Adding 4th entry evicts oldest
    cache.set('o4', 1, 1.0, 10, 10, () => {});
    expect(cache.size()).toBe(3);
  });
});
