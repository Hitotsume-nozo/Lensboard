/**
 * @lensboard/render
 * Canonical types and interfaces for the Canvas 2D dual-layer rendering pipeline and ink engine.
 */

import type { LensDocument, CanvasObject, StrokeObject, StrokePoint } from '@lensboard/core';

export interface Point {
  x: number;
  y: number;
}

export interface TimedPoint extends Point {
  t: number;
}

export type { StrokePoint, StrokeObject };

export interface ViewportTransform {
  x: number;
  y: number;
  zoom: number;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface SpatialItem extends BoundingBox {
  id: string;
}

export type LODLevel = 'full' | 'summary' | 'title';

export interface StrokeBrushOptions {
  size: number;
  thinning: number;
  smoothing: number;
  streamline: number;
  simulatePressure: boolean;
  startTaper: number;
  endTaper: number;
}

export interface GhostCursor {
  x: number;
  y: number;
  visible: boolean;
}

export interface HandleHit {
  type: 'handle';
  position: 'tl' | 'tr' | 'bl' | 'br' | 'tm' | 'bm' | 'ml' | 'mr' | 'rot';
  point: Point;
  size: number;
}

export interface CanvasAdapter {
  getWidth(): number;
  getHeight(): number;
  getDpr(): number;
  setSize(width: number, height: number, dpr?: number): void;
  getContext(): CanvasRenderingContext2D | null;
  clear(): void;
  onContextLost?(callback: () => void): () => void;
  isContextLost?(): boolean;
  getCanvasElement?(): HTMLCanvasElement | OffscreenCanvas | null;
}

export interface CanvasRenderer {
  setScene(doc: LensDocument): void;
  setViewport(x: number, y: number, zoom: number): void;
  toWorld(screenPoint: Point): Point;
  toScreen(worldPoint: Point): Point;
  hitTest(worldPoint: Point): CanvasObject | null;
  hitTestHandle?(screenPoint: Point, selectedObject: CanvasObject): HandleHit | null;
  startLiveStroke(point: TimedPoint): void;
  appendLiveStrokePoint(point: TimedPoint): void;
  finishLiveStroke(): StrokeObject;
  renderFrame(): void;
  dispose(): void;

  // Extended capabilities
  invalidate?(rect?: BoundingBox): void;
  capture?(rect?: BoundingBox, scale?: number): string | null;
  getViewport?(): ViewportTransform;
  getSpatialIndexCount?(): number;
  isStaticDirty?(): boolean;
  isLiveDirty?(): boolean;
}

export interface RendererOptions {
  staticAdapter?: CanvasAdapter;
  liveAdapter?: CanvasAdapter;
  width?: number;
  height?: number;
  dpr?: number;
  stabilizerPercent?: number; // 0 to 100
  brushOptions?: Partial<StrokeBrushOptions>;
  uniformMode?: boolean;
}
