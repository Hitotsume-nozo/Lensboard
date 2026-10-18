import { describe, it, expect } from 'vitest';
import { createDocument } from '@lensboard/core';
import {
  createRenderer,
  screenToWorld,
  worldToScreen,
  type CanvasRenderer,
} from './index.js';

describe('@lensboard/render smoke test', () => {
  it('correctly calculates screenToWorld and worldToScreen transforms', () => {
    const viewport = { x: 100, y: 50, zoom: 2 };
    const screenPt = { x: 300, y: 250 };

    const worldPt = screenToWorld(screenPt, viewport);
    expect(worldPt.x).toBe(100);
    expect(worldPt.y).toBe(100);

    const roundTrip = worldToScreen(worldPt, viewport);
    expect(roundTrip.x).toBe(screenPt.x);
    expect(roundTrip.y).toBe(screenPt.y);
  });

  it('instantiates CanvasRenderer with core document integration', () => {
    const doc = createDocument('Test Board');
    doc.objects['box1'] = {
      id: 'box1',
      type: 'rect',
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      z: 'a0',
    };
    doc.rootIds = ['box1'];

    const renderer: CanvasRenderer = createRenderer(doc);
    expect(renderer).toBeDefined();

    // Hit test within object bounds
    const hit = renderer.hitTest({ x: 25, y: 25 });
    expect(hit).toBeDefined();
    expect(hit?.id).toBe('box1');

    // Hit test outside object bounds
    const miss = renderer.hitTest({ x: 100, y: 100 });
    expect(miss).toBeNull();

    // Live stroke lifecycle
    renderer.startLiveStroke({ x: 0, y: 0, t: 1000 });
    renderer.appendLiveStrokePoint({ x: 10, y: 10, t: 1016 });
    const stroke = renderer.finishLiveStroke();
    expect(['stroke', 'ink']).toContain(stroke.type);
    expect(stroke.points.length).toBe(2);
  });
});
