import { describe, it, expect } from 'vitest';
import { smoothStrokePoints, detectPrimitiveFromPoints } from './smoothing.js';
import type { StrokePoint } from '@lensboard/core';

describe('Ink Smoothing and Geometric Fitting', () => {
  it('smooths jagged stroke points and eliminates micro-jitter', () => {
    const rawPoints: StrokePoint[] = [
      { x: 0, y: 0, t: 1000 },
      { x: 0.5, y: 0.5, t: 1005 }, // jitter
      { x: 10, y: 20, t: 1010 },
      { x: 20, y: 15, t: 1020 },
      { x: 30, y: 35, t: 1030 },
      { x: 40, y: 40, t: 1040 },
    ];

    const smoothed = smoothStrokePoints(rawPoints, 2);
    expect(smoothed.length).toBeGreaterThan(rawPoints.length);
    // Start and end points preserved
    expect(smoothed[0].x).toBe(0);
    expect(smoothed[0].y).toBe(0);
    expect(smoothed[smoothed.length - 1].x).toBe(40);
    expect(smoothed[smoothed.length - 1].y).toBe(40);
  });

  it('detects straight lines with high confidence', () => {
    const linePoints: StrokePoint[] = [];
    for (let i = 0; i <= 20; i++) {
      linePoints.push({ x: i * 10, y: 100 + (i % 2 === 0 ? 1 : -1), t: 1000 + i * 10 });
    }

    const detected = detectPrimitiveFromPoints(linePoints);
    expect(detected.kind).toBe('line');
    expect(detected.confidence).toBeGreaterThan(0.85);
  });

  it('detects circles from closed strokes with uniform radius', () => {
    const circlePoints: StrokePoint[] = [];
    const r = 50;
    const cx = 200;
    const cy = 200;
    for (let i = 0; i <= 32; i++) {
      const theta = (i / 32) * Math.PI * 2;
      circlePoints.push({
        x: cx + r * Math.cos(theta),
        y: cy + r * Math.sin(theta),
        t: 1000 + i * 15,
      });
    }

    const detected = detectPrimitiveFromPoints(circlePoints);
    expect(detected.kind).toBe('circle');
    expect(detected.confidence).toBeGreaterThan(0.8);
  });

  it('detects diamonds from rhombus corner sequences', () => {
    const diamondPoints: StrokePoint[] = [];
    // 4 corners: (150, 100), (200, 150), (150, 200), (100, 150)
    const corners = [
      { x: 150, y: 100 },
      { x: 200, y: 150 },
      { x: 150, y: 200 },
      { x: 100, y: 150 },
      { x: 150, y: 100 },
    ];
    let t = 1000;
    for (let s = 0; s < 4; s++) {
      const a = corners[s];
      const b = corners[s + 1];
      for (let step = 0; step < 8; step++) {
        const frac = step / 8;
        diamondPoints.push({
          x: a.x + frac * (b.x - a.x),
          y: a.y + frac * (b.y - a.y),
          t: t++,
        });
      }
    }

    const detected = detectPrimitiveFromPoints(diamondPoints);
    expect(detected.kind).toBe('diamond');
    expect(detected.confidence).toBeGreaterThan(0.75);
  });
});
