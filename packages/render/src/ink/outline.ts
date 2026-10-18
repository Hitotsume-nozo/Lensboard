/**
 * Dynamic Outline Generation via perfect-freehand.
 * Authoritative: Spec §9, Feature 22.
 * - Calibrated default options: size 3px, thinning 0.45, smoothing 0.6, streamline 0.5, simulatePressure true, start/end taper 6px.
 * - Alt+wheel brush size clamping: [1, 24]px.
 * - Velocity-sensitive dynamic width: slow movement is thicker, fast is thinner.
 * - Uniform width mode: thinning 0, tapers 0, simulatePressure false.
 * - Single point dot outline, duplicate point stability, dense stroke scale.
 */

import { getStroke } from 'perfect-freehand';
import type { Point, StrokeBrushOptions } from '../types.js';

export const DEFAULT_BRUSH_OPTIONS: StrokeBrushOptions = {
  size: 3,
  thinning: 0.45,
  smoothing: 0.6,
  streamline: 0.5,
  simulatePressure: true,
  startTaper: 6,
  endTaper: 6,
};

export const UNIFORM_BRUSH_OPTIONS: StrokeBrushOptions = {
  ...DEFAULT_BRUSH_OPTIONS,
  thinning: 0,
  startTaper: 0,
  endTaper: 0,
  simulatePressure: false,
};

/**
 * Clamps brush size strictly to [1, 24] px per Spec §9 & f22-2.
 */
export function clampBrushSize(size: number): number {
  return Math.min(24, Math.max(1, size));
}

/**
 * Adapts StrokeBrushOptions to perfect-freehand StrokeOptions.
 */
function toPerfectFreehandOptions(options: StrokeBrushOptions) {
  return {
    size: clampBrushSize(options.size),
    thinning: options.thinning,
    smoothing: options.smoothing,
    streamline: options.streamline,
    simulatePressure: options.simulatePressure,
    start: {
      taper: options.startTaper,
      cap: true,
    },
    end: {
      taper: options.endTaper,
      cap: true,
    },
  };
}

/**
 * Generates closed 2D polygon outline vertices from input stroke points.
 */
export function generateStrokeOutline(
  points: Array<Point | { x: number; y: number; pressure?: number }>,
  options: StrokeBrushOptions = DEFAULT_BRUSH_OPTIONS
): number[][] {
  if (points.length === 0) return [];

  // Single-point dot outline per f22-b1 & Spec §9
  if (points.length === 1) {
    const pt = points[0];
    const size = clampBrushSize(options.size);
    const radius = size / 2;
    const dotVertices: number[][] = [];
    const segments = 16;
    for (let i = 0; i < segments; i++) {
      const angle = (i * 2 * Math.PI) / segments;
      dotVertices.push([
        pt.x + radius * Math.cos(angle),
        pt.y + radius * Math.sin(angle),
      ]);
    }
    return dotVertices;
  }

  // Sanitize consecutive duplicate points to guard against zero-length normal vectors (f22-b2)
  const sanitized: Array<{ x: number; y: number; pressure?: number }> = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = sanitized[sanitized.length - 1];
    const curr = points[i];
    const dist = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    if (dist > 0.0001 || i === points.length - 1) {
      sanitized.push(curr);
    }
  }

  const pfOptions = toPerfectFreehandOptions(options);
  return getStroke(sanitized, pfOptions);
}

/**
 * Converts outline vertices into an SVG path string for rendering or export.
 */
export function getSvgPathFromStroke(stroke: number[][]): string {
  if (stroke.length === 0) return '';

  const d: string[] = [];
  const [firstX, firstY] = stroke[0];
  d.push(`M ${firstX.toFixed(2)} ${firstY.toFixed(2)}`);

  for (let i = 1; i < stroke.length; i++) {
    const [x, y] = stroke[i];
    d.push(`L ${x.toFixed(2)} ${y.toFixed(2)}`);
  }

  d.push('Z');
  return d.join(' ');
}

/**
 * Draws the stroke outline directly onto a CanvasRenderingContext2D.
 */
export function drawStrokeToContext(
  ctx: CanvasRenderingContext2D,
  outlineVertices: number[][],
  fillColor = '#000000'
): void {
  if (outlineVertices.length === 0) return;

  ctx.fillStyle = fillColor;
  ctx.beginPath();
  const [firstX, firstY] = outlineVertices[0];
  ctx.moveTo(firstX, firstY);

  for (let i = 1; i < outlineVertices.length; i++) {
    const [x, y] = outlineVertices[i];
    ctx.lineTo(x, y);
  }

  ctx.closePath();
  ctx.fill();
}
