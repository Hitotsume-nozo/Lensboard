import { describe, it, expect } from 'vitest';
import {
  screenToWorld,
  worldToScreen,
  getVisibleWorldBounds,
} from './transform.js';
import {
  MIN_ZOOM,
  MAX_ZOOM,
  calculateNewZoom,
  zoomAtScreenPoint,
  panViewport,
  panHorizontalWheel,
  normalizeWheelDelta,
  ViewportController,
} from './controller.js';

describe('Viewport Kinematics and Pan/Zoom', () => {
  it('correctly maps between screen and world coordinates', () => {
    const vp = { x: 200, y: 150, zoom: 2.5 };
    const screenPt = { x: 450, y: 400 };

    const worldPt = screenToWorld(screenPt, vp);
    expect(worldPt.x).toBe(100);
    expect(worldPt.y).toBe(100);

    const backToScreen = worldToScreen(worldPt, vp);
    expect(backToScreen.x).toBe(screenPt.x);
    expect(backToScreen.y).toBe(screenPt.y);
  });

  it('computes visible world bounds for spatial culling', () => {
    const vp = { x: 100, y: 50, zoom: 2.0 };
    const bounds = getVisibleWorldBounds(vp, 800, 600);

    expect(bounds.minX).toBe(-50); // -100 / 2
    expect(bounds.minY).toBe(-25); // -50 / 2
    expect(bounds.maxX).toBe(350); // (800 - 100) / 2
    expect(bounds.maxY).toBe(275); // (600 - 50) / 2
  });

  it('matches exponential zoom formula exp(-deltaY * 0.0015) (f20-1)', () => {
    const current = 1.0;
    const deltaY = -100; // Zoom in
    const expected = current * Math.exp(-(-100) * 0.0015);
    const actual = calculateNewZoom(current, deltaY);
    expect(actual).toBeCloseTo(expected, 4);
  });

  it('clamps zoom strictly to [0.02, 64.0] (f20-2, f20-3, f20-b2, f20-b3)', () => {
    expect(calculateNewZoom(0.05, 50000)).toBe(MIN_ZOOM);
    expect(calculateNewZoom(1.0, 1000000)).toBe(0.02);

    expect(calculateNewZoom(50, -50000)).toBe(MAX_ZOOM);
    expect(calculateNewZoom(1.0, -1000000)).toBe(64.0);
  });

  it('wheel delta 0 leaves zoom unchanged (f20-b1)', () => {
    const current = 1.75;
    expect(calculateNewZoom(current, 0)).toBeCloseTo(1.75, 4);
  });

  it('cursor-centered zoom preserves world point under cursor (cursor invariance, f20-4)', () => {
    const cursor = { x: 600, y: 400 };
    const vp = { x: 50, y: 80, zoom: 1.5 };

    const worldBefore = screenToWorld(cursor, vp);
    const newVp = zoomAtScreenPoint(vp, cursor, -120);

    const worldAfter = screenToWorld(cursor, newVp);
    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 4);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 4);
  });

  it('extreme world coordinates project without NaN or overflow (f20-b5)', () => {
    const extremeWorld = { x: 1000000, y: 1000000 };
    const vp = { x: 0, y: 0, zoom: 0.5 };
    const screen = worldToScreen(extremeWorld, vp);
    expect(screen.x).toBe(500000);
    expect(screen.y).toBe(500000);
    expect(Number.isFinite(screen.x)).toBe(true);
  });

  it('pans viewport translation for drag and horizontal wheel (f20-5)', () => {
    const vp = { x: 100, y: 200, zoom: 1.0 };
    const panned = panViewport(vp, 50, -30);
    expect(panned.x).toBe(150);
    expect(panned.y).toBe(170);

    const horizPanned = panHorizontalWheel(vp, 40, 0);
    expect(horizPanned.x).toBe(60);
  });

  it('normalizes wheel deltas based on deltaMode', () => {
    expect(normalizeWheelDelta(10, 0)).toBe(10); // Pixel
    expect(normalizeWheelDelta(2, 1)).toBe(32); // Line (2 * 16)
    expect(normalizeWheelDelta(1, 2)).toBe(800); // Page (1 * 800)
  });

  it('ViewportController manages subscriptions and camera mutations', () => {
    const controller = new ViewportController({ x: 0, y: 0, zoom: 1 });
    let notifyCount = 0;
    const unsub = controller.subscribe(() => {
      notifyCount++;
    });

    controller.pan(10, 20);
    expect(notifyCount).toBe(1);
    expect(controller.getViewport().x).toBe(10);
    expect(controller.getViewport().y).toBe(20);

    controller.zoomAt({ x: 100, y: 100 }, -50);
    expect(notifyCount).toBe(2);

    unsub();
    controller.pan(5, 5);
    expect(notifyCount).toBe(2); // Unsubscribed
  });
});
