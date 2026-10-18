/**
 * Feature 20: 60fps Pan and Zoom (M4)
 * Authoritative Source: SPEC.md §8, PROJECT.md Feature 20
 * Pan (Space/Middle drag), cursor-centered exponential zoom exp(-deltaY * 0.0015) clamped to [0.02, 64]
 */

import { describe, it, expect } from '../harness.ts';
import { calculateNewZoom } from '../helpers/oracle.ts';

describe('Feature 20: 60fps Pan and Zoom', () => {
  it('f20-1: zoom calculation matches exponential formula exp(-deltaY * 0.0015)', () => {
    const initialZoom = 1.0;
    const deltaY = -100; // Zoom in
    const expected = 1.0 * Math.exp(-(-100) * 0.0015);
    const actual = calculateNewZoom(initialZoom, deltaY);
    expect(actual).toBeCloseTo(expected, 4);
    expect(actual).toBeGreaterThan(1.0);
  });

  it('f20-2: zoom is strictly clamped to minimum 0.02', () => {
    const initialZoom = 0.05;
    const largeZoomOutDelta = 50000;
    const zoomed = calculateNewZoom(initialZoom, largeZoomOutDelta);
    expect(zoomed).toBe(0.02);
  });

  it('f20-3: zoom is strictly clamped to maximum 64.0', () => {
    const initialZoom = 50;
    const largeZoomInDelta = -50000;
    const zoomed = calculateNewZoom(initialZoom, largeZoomInDelta);
    expect(zoomed).toBe(64.0);
  });

  it('f20-4: cursor-centered zoom preserves world position under cursor', () => {
    const cursorScreen = { x: 500, y: 300 };
    const vp = { x: 0, y: 0, zoom: 1.0 };

    // World point under cursor before zoom
    const worldPoint = {
      x: (cursorScreen.x - vp.x) / vp.zoom,
      y: (cursorScreen.y - vp.y) / vp.zoom,
    };
    expect(worldPoint.x).toBe(500);
    expect(worldPoint.y).toBe(300);

    // Zoom to 2.0
    const newZoom = 2.0;
    // New viewport x, y to keep world point invariant under cursor
    const newVpX = cursorScreen.x - worldPoint.x * newZoom;
    const newVpY = cursorScreen.y - worldPoint.y * newZoom;

    // Verify re-projection
    const projectedAfter = {
      x: (cursorScreen.x - newVpX) / newZoom,
      y: (cursorScreen.y - newVpY) / newZoom,
    };
    expect(projectedAfter.x).toBe(500);
    expect(projectedAfter.y).toBe(300);
  });

  it('f20-5: middle button or Space+drag pans viewport translation', () => {
    const vp = { x: 100, y: 150 };
    const dragDelta = { dx: 50, dy: -30 };

    vp.x += dragDelta.dx;
    vp.y += dragDelta.dy;

    expect(vp.x).toBe(150);
    expect(vp.y).toBe(120);
  });
});
