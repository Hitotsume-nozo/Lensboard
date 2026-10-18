import { describe, it, expect } from 'vitest';
import { createDocument } from '@lensboard/core';
import { createRenderer, FullCanvasRenderer } from './renderer.js';

describe('CanvasRenderer Contract Integration', () => {
  it('implements full CanvasRenderer contract from PROJECT.md Interface Contract 3', () => {
    const doc = createDocument('Full Test');
    doc.objects['b1'] = {
      id: 'b1',
      type: 'rect' as any,
      parentId: null,
      x: 50,
      y: 50,
      w: 100,
      h: 80,
      rotation: 0,
      z: 'a0',
      style: { colorId: 'blue', strokeWidth: 2, renderMode: 'crisp' },
      tags: [],
      locked: false,
      hidden: false,
      createdAt: 0,
      updatedAt: 0,
    };
    doc.rootIds = ['b1'];

    const renderer = createRenderer(doc);
    expect(renderer).toBeDefined();

    // 1. setViewport
    renderer.setViewport(10, 20, 2.0);
    const vp = renderer.getViewport?.();
    expect(vp?.x).toBe(10);
    expect(vp?.y).toBe(20);
    expect(vp?.zoom).toBe(2.0);

    // 2. toWorld & toScreen
    const worldPt = renderer.toWorld({ x: 210, y: 220 });
    expect(worldPt.x).toBe(100); // (210 - 10) / 2
    expect(worldPt.y).toBe(100); // (220 - 20) / 2

    const screenPt = renderer.toScreen(worldPt);
    expect(screenPt.x).toBe(210);
    expect(screenPt.y).toBe(220);

    // 3. hitTest
    const hit = renderer.hitTest({ x: 75, y: 75 });
    expect(hit).not.toBeNull();
    expect(hit?.id).toBe('b1');

    const miss = renderer.hitTest({ x: 200, y: 200 });
    expect(miss).toBeNull();

    // 4. hitTestHandle
    const handleHit = renderer.hitTestHandle?.({ x: 110, y: 120 }, doc.objects['b1']);
    // top-left handle at world (50, 50) -> screen (110, 120)
    expect(handleHit).not.toBeNull();
    expect(handleHit?.type).toBe('handle');
    expect(handleHit?.position).toBe('tl');

    // 5. Live stroke lifecycle
    renderer.startLiveStroke({ x: 100, y: 100, t: 1000 });
    renderer.appendLiveStrokePoint({ x: 120, y: 120, t: 1016 });
    renderer.appendLiveStrokePoint({ x: 140, y: 140, t: 1032 });

    // renderFrame during active stroke
    renderer.renderFrame();

    const finished = renderer.finishLiveStroke();
    expect(finished.type).toBe('ink');
    expect(finished.points.length).toBe(3);

    // renderFrame after stroke committed
    renderer.renderFrame();

    // 6. Erase
    const fullRenderer = renderer as FullCanvasRenderer;
    const eraseRes = fullRenderer.eraseAt({ x: 110, y: 120 }, 8);
    expect(eraseRes).toBeDefined();

    // 7. Dispose
    renderer.dispose();
  });

  it('setScene updates document, rebuilds spatial index, and dirties static layer', () => {
    const doc1 = createDocument('Board A');
    const renderer = createRenderer(doc1);
    expect(renderer.getSpatialIndexCount?.()).toBe(0);

    const doc2 = createDocument('Board B');
    doc2.objects['o1'] = {
      id: 'o1',
      type: 'shape',
      parentId: null,
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      rotation: 0,
      z: 'a0',
      style: { colorId: 'ink', strokeWidth: 1, renderMode: 'crisp' },
      tags: [],
      locked: false,
      hidden: false,
      createdAt: 0,
      updatedAt: 0,
    };
    doc2.rootIds = ['o1'];

    renderer.setScene(doc2);
    expect(renderer.getSpatialIndexCount?.()).toBe(1);
    expect(renderer.isStaticDirty?.()).toBe(true);

    renderer.renderFrame();
    expect(renderer.isStaticDirty?.()).toBe(false);
  });
});
