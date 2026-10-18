import { describe, it, expect } from 'vitest';
import {
  clampDimension,
  HeadlessCanvasAdapter,
  createCanvasAdapter,
} from './adapter.js';

describe('CanvasAdapter', () => {
  it('clamps 0 or negative dimensions to minimum 1x1', () => {
    expect(clampDimension(0)).toBe(1);
    expect(clampDimension(-50)).toBe(1);
    expect(clampDimension(100)).toBe(100);
  });

  it('accurately computes pixel dimensions based on DPR and rounds fractional DPR', () => {
    const adapter = new HeadlessCanvasAdapter(1000, 500, 1.5);
    expect(adapter.getWidth()).toBe(1000);
    expect(adapter.getHeight()).toBe(500);
    expect(adapter.getDpr()).toBe(1.5);
    expect(adapter.getPixelWidth()).toBe(1500);
    expect(adapter.getPixelHeight()).toBe(750);
  });

  it('provides a functioning mock 2D context that executes drawing methods without error', () => {
    const adapter = new HeadlessCanvasAdapter(800, 600, 2);
    const ctx = adapter.getContext();
    expect(ctx).toBeDefined();

    ctx?.save();
    ctx?.translate(10, 20);
    ctx?.scale(2, 2);
    ctx?.beginPath();
    ctx?.rect(0, 0, 50, 50);
    ctx?.fill();
    ctx?.stroke();
    ctx?.restore();
  });

  it('handles context loss and notifies subscribers', () => {
    const adapter = new HeadlessCanvasAdapter(800, 600, 1);
    let notified = false;
    adapter.onContextLost(() => {
      notified = true;
    });

    expect(adapter.isContextLost()).toBe(false);
    expect(adapter.getContext()).not.toBeNull();

    adapter.triggerContextLost();
    expect(adapter.isContextLost()).toBe(true);
    expect(adapter.getContext()).toBeNull();
    expect(notified).toBe(true);

    adapter.restoreContext();
    expect(adapter.isContextLost()).toBe(false);
    expect(adapter.getContext()).not.toBeNull();
  });

  it('createCanvasAdapter returns HeadlessCanvasAdapter in Node environment', () => {
    const adapter = createCanvasAdapter({ width: 640, height: 480, dpr: 2 });
    expect(adapter.getWidth()).toBe(640);
    expect(adapter.getHeight()).toBe(480);
    expect(adapter.getDpr()).toBe(2);
  });
});
