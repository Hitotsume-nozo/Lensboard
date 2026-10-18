import { describe, it, expect } from 'vitest';
import { createDocument } from '@lensboard/core';
import { DualLayerManager } from './layers.js';
import { HeadlessCanvasAdapter } from './adapter.js';
import { SpatialIndex } from '../spatial/index.js';

describe('DualLayerManager', () => {
  it('manages stacked static and live layers independently', () => {
    const staticAdapter = new HeadlessCanvasAdapter(800, 600, 2);
    const liveAdapter = new HeadlessCanvasAdapter(800, 600, 2);

    const manager = new DualLayerManager({ staticAdapter, liveAdapter });
    expect(manager.getStaticAdapter()).toBe(staticAdapter);
    expect(manager.getLiveAdapter()).toBe(liveAdapter);
  });

  it('static layer redraws only when staticDirty is true and marks clean afterwards', () => {
    const staticAdapter = new HeadlessCanvasAdapter(800, 600, 1);
    const liveAdapter = new HeadlessCanvasAdapter(800, 600, 1);
    const manager = new DualLayerManager({ staticAdapter, liveAdapter });

    const doc = createDocument('Board 1');
    const spatialIndex = new SpatialIndex();
    const vp = { x: 0, y: 0, zoom: 1.0 };

    expect(manager.isStaticDirty()).toBe(true);
    expect(manager.getStaticRedrawCount()).toBe(0);

    // Initial render
    manager.renderStaticLayer(doc, vp, spatialIndex);
    expect(manager.getStaticRedrawCount()).toBe(1);
    expect(manager.isStaticDirty()).toBe(false);

    // Calling render again without dirty flag skips redraw
    manager.renderStaticLayer(doc, vp, spatialIndex);
    expect(manager.getStaticRedrawCount()).toBe(1);

    // Marking dirty causes redraw
    manager.markStaticDirty();
    expect(manager.isStaticDirty()).toBe(true);
    manager.renderStaticLayer(doc, vp, spatialIndex);
    expect(manager.getStaticRedrawCount()).toBe(2);
  });

  it('live layer renders per active interaction frame and clears immediately on finish', () => {
    const staticAdapter = new HeadlessCanvasAdapter(800, 600, 1);
    const liveAdapter = new HeadlessCanvasAdapter(800, 600, 1);
    const manager = new DualLayerManager({ staticAdapter, liveAdapter });

    expect(manager.getLiveRedrawCount()).toBe(0);
    manager.renderLiveLayer([[10, 10], [20, 20], [30, 30]]);
    expect(manager.getLiveRedrawCount()).toBe(1);

    manager.renderLiveLayer([[10, 10], [20, 20], [30, 30], [40, 40]]);
    expect(manager.getLiveRedrawCount()).toBe(2);

    // Finish stroke clears live layer
    manager.clearLiveLayer();
    expect(manager.isLiveDirty()).toBe(false);
  });

  it('resizing updates dimensions of both stacked layers and marks dirty', () => {
    const staticAdapter = new HeadlessCanvasAdapter(800, 600, 1);
    const liveAdapter = new HeadlessCanvasAdapter(800, 600, 1);
    const manager = new DualLayerManager({ staticAdapter, liveAdapter });

    manager.resize(1920, 1080, 2);
    expect(staticAdapter.getWidth()).toBe(1920);
    expect(staticAdapter.getHeight()).toBe(1080);
    expect(liveAdapter.getWidth()).toBe(1920);
    expect(liveAdapter.getHeight()).toBe(1080);
    expect(manager.isStaticDirty()).toBe(true);
    expect(manager.isLiveDirty()).toBe(true);
  });
});
