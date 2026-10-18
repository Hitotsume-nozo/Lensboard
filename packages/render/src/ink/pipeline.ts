/**
 * In-Flight Ink Stroke Pipeline.
 * Chains:
 * 1. Precision Damping (Ctrl mode -> 40% speed)
 * 2. Lazy-String Leash Stabilizer (r = percent * 0.4px)
 * 3. One-Euro Low-Pass Filter (minCutoff 1.0, beta 0.007, dCutoff 1.0)
 * 4. Shift-Snap (45° angle snapping from anchor)
 * 5. perfect-freehand outline polygon generation
 * 6. Final StrokeObject serialization with world coordinates
 */

import { generateUlid, generateInitialZ } from '@lensboard/core';
import type { StrokeObject, StrokePoint } from '@lensboard/core';
import type {
  Point,
  TimedPoint,
  ViewportTransform,
  StrokeBrushOptions,
  GhostCursor,
} from '../types.js';
import { LazyStringStabilizer } from './stabilizer.js';
import { OneEuroFilter2D } from './filter.js';
import { applyShiftSnap, PrecisionModeTracker } from './modifiers.js';
import {
  DEFAULT_BRUSH_OPTIONS,
  UNIFORM_BRUSH_OPTIONS,
  generateStrokeOutline,
} from './outline.js';
import { screenToWorld } from '../viewport/transform.js';

export interface InkPipelineOptions {
  stabilizerPercent?: number;
  brushOptions?: Partial<StrokeBrushOptions>;
  uniformMode?: boolean;
  colorId?: string;
  strokeWidth?: number;
}

export class InkPipeline {
  private stabilizer: LazyStringStabilizer;
  private filter: OneEuroFilter2D;
  private precisionTracker: PrecisionModeTracker;
  private brushOptions: StrokeBrushOptions;
  private uniformMode = false;
  private colorId = 'ink';

  private anchorScreenPoint: Point | null = null;
  private rawScreenPoints: TimedPoint[] = [];
  private processedWorldPoints: StrokePoint[] = [];
  private currentGhostCursor: GhostCursor = { x: 0, y: 0, visible: false };

  constructor(options: InkPipelineOptions = {}) {
    this.stabilizer = new LazyStringStabilizer(options.stabilizerPercent ?? 0);
    this.filter = new OneEuroFilter2D();
    this.precisionTracker = new PrecisionModeTracker();
    this.uniformMode = options.uniformMode ?? false;
    this.colorId = options.colorId ?? 'ink';
    this.brushOptions = this.uniformMode
      ? { ...UNIFORM_BRUSH_OPTIONS, ...options.brushOptions }
      : { ...DEFAULT_BRUSH_OPTIONS, ...options.brushOptions };
  }

  setColorId(colorId: string): void {
    this.colorId = colorId;
  }

  getColorId(): string {
    return this.colorId;
  }

  setStabilizerPercent(percent: number): void {
    this.stabilizer.setPercent(percent);
  }

  setBrushOptions(options: Partial<StrokeBrushOptions>): void {
    this.brushOptions = { ...this.brushOptions, ...options };
  }

  setUniformMode(uniform: boolean): void {
    this.uniformMode = uniform;
    if (uniform) {
      this.brushOptions = {
        ...this.brushOptions,
        ...UNIFORM_BRUSH_OPTIONS,
      };
    } else {
      this.brushOptions = {
        ...this.brushOptions,
        thinning: DEFAULT_BRUSH_OPTIONS.thinning,
        startTaper: DEFAULT_BRUSH_OPTIONS.startTaper,
        endTaper: DEFAULT_BRUSH_OPTIONS.endTaper,
        simulatePressure: true,
      };
    }
  }

  start(
    screenPoint: TimedPoint,
    viewport: ViewportTransform,
    modifiers: { shift?: boolean; ctrl?: boolean } = {}
  ): void {
    this.rawScreenPoints = [{ ...screenPoint }];
    this.processedWorldPoints = [];
    this.anchorScreenPoint = { x: screenPoint.x, y: screenPoint.y };

    this.stabilizer.reset(screenPoint);
    this.filter.reset();
    this.precisionTracker.reset(screenPoint);

    // Initial point processing
    const { penPoint, ghostCursor } = this.precisionTracker.update(
      screenPoint,
      !!modifiers.ctrl
    );
    this.currentGhostCursor = ghostCursor;

    const stabilized = this.stabilizer.update(penPoint);
    const filtered = this.filter.filterTimed({ ...stabilized, t: screenPoint.t });

    let finalScreen = filtered;
    if (modifiers.shift && this.anchorScreenPoint) {
      finalScreen = {
        ...applyShiftSnap(this.anchorScreenPoint, filtered),
        t: screenPoint.t,
      };
    }

    const worldPt = screenToWorld(finalScreen, viewport);
    this.processedWorldPoints.push({
      x: worldPt.x,
      y: worldPt.y,
      t: screenPoint.t,
    });
  }

  append(
    screenPoint: TimedPoint,
    viewport: ViewportTransform,
    modifiers: { shift?: boolean; ctrl?: boolean } = {}
  ): void {
    this.rawScreenPoints.push({ ...screenPoint });

    // Step 1: Precision Damping (Ctrl)
    const { penPoint, ghostCursor } = this.precisionTracker.update(
      screenPoint,
      !!modifiers.ctrl
    );
    this.currentGhostCursor = ghostCursor;

    // Step 2: Lazy-String Leash Stabilizer
    const stabilized = this.stabilizer.update(penPoint);

    // Step 3: One-Euro Low-Pass Filter
    const filtered = this.filter.filterTimed({ ...stabilized, t: screenPoint.t });

    // Step 4: Angle Snapping (Shift)
    let finalScreen = filtered;
    if (modifiers.shift && this.anchorScreenPoint) {
      finalScreen = {
        ...applyShiftSnap(this.anchorScreenPoint, filtered),
        t: screenPoint.t,
      };
    }

    // Step 5: Screen to World
    const worldPt = screenToWorld(finalScreen, viewport);
    this.processedWorldPoints.push({
      x: worldPt.x,
      y: worldPt.y,
      t: screenPoint.t,
    });
  }

  getGhostCursor(): GhostCursor {
    return this.currentGhostCursor;
  }

  getWorldPoints(): StrokePoint[] {
    return [...this.processedWorldPoints];
  }

  /**
   * Generates live outline polygon vertices in screen coordinates for immediate rAF rendering.
   */
  getLiveOutlineVertices(viewport: ViewportTransform): number[][] {
    if (this.processedWorldPoints.length === 0) return [];

    // Map world points to screen points for outline generation
    const screenPts = this.processedWorldPoints.map((pt) => ({
      x: pt.x * viewport.zoom + viewport.x,
      y: pt.y * viewport.zoom + viewport.y,
    }));

    return generateStrokeOutline(screenPts, this.brushOptions);
  }

  /**
   * Finalizes the in-flight stroke and returns an immutable StrokeObject.
   */
  finish(z = generateInitialZ()): StrokeObject {
    const points = [...this.processedWorldPoints];
    const first = points[0] ?? { x: 0, y: 0, t: Date.now() };

    const stroke: StrokeObject = {
      id: generateUlid(),
      type: 'ink',
      parentId: null,
      x: first.x,
      y: first.y,
      w: 0,
      h: 0,
      rotation: 0,
      z,
      style: {
        colorId: (this.colorId as any) ?? 'ink',
        strokeWidth: this.brushOptions.size,
        renderMode: 'crisp',
      },
      tags: [],
      locked: false,
      hidden: false,
      createdAt: first.t,
      updatedAt: points[points.length - 1]?.t ?? first.t,
      points,
    };

    // Calculate dimensions
    if (points.length > 0) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      stroke.x = minX;
      stroke.y = minY;
      stroke.w = maxX - minX;
      stroke.h = maxY - minY;
    }

    this.reset();
    return stroke;
  }

  reset(): void {
    this.rawScreenPoints = [];
    this.processedWorldPoints = [];
    this.anchorScreenPoint = null;
    this.stabilizer.reset();
    this.filter.reset();
    this.precisionTracker.reset();
    this.currentGhostCursor = { x: 0, y: 0, visible: false };
  }
}
