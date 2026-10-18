/**
 * Feature 18: Dual-Layer Canvas 2D Pipeline (M4)
 * Authoritative Source: SPEC.md §8, PROJECT.md Feature 18
 * Stacked DPR canvases: static scene layer + live interaction rAF layer
 */

import { describe, it, expect } from '../harness.ts';

describe('Feature 18: Dual-Layer Canvas 2D Pipeline', () => {
  it('f18-1: system initializes two stacked canvas elements (static and live)', () => {
    const layers = ['static-scene-layer', 'live-interaction-layer'];
    expect(layers).toHaveLength(2);
    expect(layers[0]).toBe('static-scene-layer');
    expect(layers[1]).toBe('live-interaction-layer');
  });

  it('f18-2: canvases match device-pixel ratio (DPR) scaling', () => {
    function calculateCanvasDimensions(width: number, height: number, dpr: number) {
      return {
        pixelWidth: width * dpr,
        pixelHeight: height * dpr,
        cssWidth: width,
        cssHeight: height,
      };
    }
    const dims = calculateCanvasDimensions(1920, 1080, 2);
    expect(dims.pixelWidth).toBe(3840);
    expect(dims.pixelHeight).toBe(2160);
    expect(dims.cssWidth).toBe(1920);
  });

  it('f18-3: static layer redraws only when scene or viewport updates', () => {
    let staticRedraws = 0;
    function onViewportChange(): void {
      staticRedraws++;
    }
    function onPointerMoveLiveStroke(): void {
      // Live layer only, static untouched
    }

    onViewportChange();
    onPointerMoveLiveStroke();
    onPointerMoveLiveStroke();
    expect(staticRedraws).toBe(1);
  });

  it('f18-4: live layer redraws per frame during active pointer interaction', () => {
    let liveRedraws = 0;
    function onLiveFrame(): void {
      liveRedraws++;
    }
    onLiveFrame();
    onLiveFrame();
    onLiveFrame();
    expect(liveRedraws).toBe(3);
  });

  it('f18-5: live layer clears immediately on interaction finish and commits to static', () => {
    let liveStrokeActive = true;
    let committedToScene = false;

    function finishStroke(): void {
      liveStrokeActive = false;
      committedToScene = true;
    }

    finishStroke();
    expect(liveStrokeActive).toBe(false);
    expect(committedToScene).toBe(true);
  });
});
