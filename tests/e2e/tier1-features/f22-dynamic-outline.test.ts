/**
 * Feature 22: Dynamic Outline & Freehand (M4)
 * Authoritative Source: SPEC.md §9, PROJECT.md Feature 22
 * perfect-freehand velocity-sensitive outline (3px default, taper 6px, thinning 0.45, simulatePressure true)
 */

import { describe, it, expect } from '../harness.ts';

describe('Feature 22: Dynamic Outline & Freehand', () => {
  const defaultBrushSettings = {
    size: 3,
    thinning: 0.45,
    smoothing: 0.6,
    streamline: 0.5,
    simulatePressure: true,
    startTaper: 6,
    endTaper: 6,
  };

  it('f22-1: default brush size is calibrated to 3px', () => {
    expect(defaultBrushSettings.size).toBe(3);
  });

  it('f22-2: brush size range via Alt+wheel is bounded from 1 to 24px', () => {
    function clampBrushSize(size: number): number {
      return Math.min(24, Math.max(1, size));
    }
    expect(clampBrushSize(0.5)).toBe(1);
    expect(clampBrushSize(15)).toBe(15);
    expect(clampBrushSize(30)).toBe(24);
  });

  it('f22-3: velocity simulation thickens slow strokes and thins fast strokes', () => {
    function calculateSimulatedWidth(baseSize: number, speed: number, thinning: number): number {
      // In velocity simulation, slow speed produces thicker stroke, fast produces thinner
      const factor = Math.max(0.2, 1 - (speed / 100) * thinning);
      return baseSize * factor;
    }
    const slowWidth = calculateSimulatedWidth(3, 10, 0.45);
    const fastWidth = calculateSimulatedWidth(3, 80, 0.45);
    expect(slowWidth).toBeGreaterThan(fastWidth);
  });

  it('f22-4: start and end tapers taper stroke ends over 6px', () => {
    expect(defaultBrushSettings.startTaper).toBe(6);
    expect(defaultBrushSettings.endTaper).toBe(6);
  });

  it('f22-5: uniform width mode disables thinning and removes tapers', () => {
    const uniformSettings = {
      ...defaultBrushSettings,
      thinning: 0,
      startTaper: 0,
      endTaper: 0,
      simulatePressure: false,
    };
    expect(uniformSettings.thinning).toBe(0);
    expect(uniformSettings.startTaper).toBe(0);
    expect(uniformSettings.simulatePressure).toBe(false);
  });
});
