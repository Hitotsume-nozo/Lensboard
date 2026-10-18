/**
 * Complete CanvasRenderer Implementation.
 * Conforms to PROJECT.md § Interface Contract 3.
 * Integrates:
 * - Dual-layer Canvas 2D pipeline (static + live rAF)
 * - R*-Tree spatial indexing & viewport culling (rbush)
 * - 60fps pan & cursor-pinned exponential zoom
 * - Ink engine pipeline (Lazy-String, One-Euro filter, perfect-freehand outline)
 * - Ink modifiers (Shift-snap 45°, Ctrl precision, whole-stroke eraser, dwell detection)
 * - Crisp & Rough.js sketch rendering
 */

import type { LensDocument, CanvasObject, StrokeObject } from '@lensboard/core';
import { generateZBetween } from '@lensboard/core';
import type {
  Point,
  TimedPoint,
  ViewportTransform,
  BoundingBox,
  CanvasRenderer,
  RendererOptions,
  HandleHit,
} from './types.js';
import { createCanvasAdapter } from './canvas/adapter.js';
import { DualLayerManager } from './canvas/layers.js';
import { SmartObjectCache } from './canvas/cache.js';
import { SpatialIndex } from './spatial/index.js';
import { computeBoundingBox } from './spatial/bounds.js';
import { hitTestDocument, hitTestObjectHandles } from './spatial/hit-test.js';
import { screenToWorld, worldToScreen } from './viewport/transform.js';
import { ViewportController } from './viewport/controller.js';
import { InkPipeline } from './ink/pipeline.js';
import { DwellDetector, TemporaryToolSwitcher } from './ink/modifiers.js';
import { findObjectsToErase, createEraseCommand } from './ink/eraser.js';

export class FullCanvasRenderer implements CanvasRenderer {
  private doc: LensDocument;
  private viewportController: ViewportController;
  private spatialIndex: SpatialIndex;
  private layerManager: DualLayerManager;
  private cache: SmartObjectCache;
  private inkPipeline: InkPipeline;
  private dwellDetector: DwellDetector;
  private toolSwitcher: TemporaryToolSwitcher;

  private isLiveStrokeActive = false;
  private activeModifiers: { shift: boolean; ctrl: boolean } = {
    shift: false,
    ctrl: false,
  };

  constructor(initialDoc: LensDocument, options: RendererOptions = {}) {
    this.doc = initialDoc;
    this.viewportController = new ViewportController(initialDoc.viewport);
    this.spatialIndex = new SpatialIndex();
    this.cache = new SmartObjectCache();

    const staticAdapter =
      options.staticAdapter ??
      createCanvasAdapter({
        width: options.width ?? 1920,
        height: options.height ?? 1080,
        dpr: options.dpr ?? 1,
      });

    const liveAdapter =
      options.liveAdapter ??
      createCanvasAdapter({
        width: options.width ?? 1920,
        height: options.height ?? 1080,
        dpr: options.dpr ?? 1,
      });

    this.layerManager = new DualLayerManager({
      staticAdapter,
      liveAdapter,
      cache: this.cache,
    });

    this.inkPipeline = new InkPipeline({
      stabilizerPercent: options.stabilizerPercent ?? 0,
      brushOptions: options.brushOptions,
      uniformMode: options.uniformMode ?? false,
    });

    this.dwellDetector = new DwellDetector();
    this.toolSwitcher = new TemporaryToolSwitcher('pen');

    // Subscribe to viewport changes: viewport updates dirty the static layer
    this.viewportController.subscribe(() => {
      this.layerManager.markStaticDirty();
    });

    // Populate initial spatial index
    this.syncSpatialIndex();
  }

  setScene(newDoc: LensDocument): void {
    this.doc = newDoc;
    if (newDoc.viewport) {
      this.viewportController.setViewport(
        newDoc.viewport.x,
        newDoc.viewport.y,
        newDoc.viewport.zoom
      );
    }
    this.syncSpatialIndex();
    this.layerManager.markStaticDirty();
  }

  setViewport(x: number, y: number, zoom: number): void {
    this.viewportController.setViewport(x, y, zoom);
  }

  getViewport(): ViewportTransform {
    return this.viewportController.getViewport();
  }

  toWorld(screenPoint: Point): Point {
    return screenToWorld(screenPoint, this.viewportController.getViewport());
  }

  toScreen(worldPoint: Point): Point {
    return worldToScreen(worldPoint, this.viewportController.getViewport());
  }

  hitTest(worldPoint: Point): CanvasObject | null {
    return hitTestDocument(
      worldPoint,
      this.doc,
      this.spatialIndex,
      this.viewportController.getViewport()
    );
  }

  hitTestHandle(screenPoint: Point, selectedObject: CanvasObject): HandleHit | null {
    return hitTestObjectHandles(
      screenPoint,
      selectedObject,
      this.viewportController.getViewport()
    );
  }

  setModifiers(modifiers: { shift?: boolean; ctrl?: boolean }): void {
    if (modifiers.shift !== undefined) this.activeModifiers.shift = modifiers.shift;
    if (modifiers.ctrl !== undefined) this.activeModifiers.ctrl = modifiers.ctrl;
  }

  startLiveStroke(point: TimedPoint): void {
    this.isLiveStrokeActive = true;
    this.inkPipeline.start(
      point,
      this.viewportController.getViewport(),
      this.activeModifiers
    );
    this.dwellDetector.onPointerDown(point, point.t);
    this.layerManager.markLiveDirty();
  }

  appendLiveStrokePoint(point: TimedPoint): void {
    if (!this.isLiveStrokeActive) {
      this.startLiveStroke(point);
      return;
    }
    this.inkPipeline.append(
      point,
      this.viewportController.getViewport(),
      this.activeModifiers
    );
    this.dwellDetector.onPointerMove(point, point.t);
    this.layerManager.markLiveDirty();
  }

  finishLiveStroke(): StrokeObject {
    this.isLiveStrokeActive = false;
    this.dwellDetector.onPointerUp();

    // Determine z-order
    const lastId = this.doc.rootIds[this.doc.rootIds.length - 1];
    const lastZ = lastId ? this.doc.objects[lastId]?.z : null;
    const nextZ = lastZ ? generateZBetween(lastZ, null) : 'a0';

    const stroke = this.inkPipeline.finish(nextZ);

    // Commit to spatial index and clear live layer
    const bbox = computeBoundingBox(stroke);
    this.spatialIndex.insert({ ...bbox, id: stroke.id });
    this.layerManager.clearLiveLayer();
    this.layerManager.markStaticDirty();

    return stroke;
  }

  renderFrame(): void {
    const vp = this.viewportController.getViewport();

    // 1. Static layer renders ONLY if marked dirty
    this.layerManager.renderStaticLayer(this.doc, vp, this.spatialIndex);

    // 2. Live layer renders if active pointer interaction in progress
    if (this.isLiveStrokeActive || this.layerManager.isLiveDirty()) {
      const outline = this.inkPipeline.getLiveOutlineVertices(vp);
      const ghost = this.inkPipeline.getGhostCursor();
      this.layerManager.renderLiveLayer(outline, ghost);
    }
  }

  eraseAt(screenPoint: Point, radiusScreenPx = 8.0) {
    const worldPoint = this.toWorld(screenPoint);
    const hitObjects = findObjectsToErase(
      worldPoint,
      this.doc,
      this.spatialIndex,
      this.viewportController.getViewport(),
      radiusScreenPx
    );

    const cmd = createEraseCommand(hitObjects);
    return { hitObjects, command: cmd };
  }

  getToolSwitcher(): TemporaryToolSwitcher {
    return this.toolSwitcher;
  }

  getDwellDetector(): DwellDetector {
    return this.dwellDetector;
  }

  invalidate(_rect?: BoundingBox): void {
    this.layerManager.markStaticDirty();
  }

  capture(_rect?: BoundingBox, _scale = 1.0): string | null {
    // Canvas bitmap capture
    const staticCanvas = this.layerManager.getStaticAdapter().getCanvasElement?.();
    if (staticCanvas && 'toDataURL' in staticCanvas) {
      return (staticCanvas as HTMLCanvasElement).toDataURL('image/png');
    }
    return null;
  }

  getSpatialIndexCount(): number {
    return this.spatialIndex.count();
  }

  isStaticDirty(): boolean {
    return this.layerManager.isStaticDirty();
  }

  isLiveDirty(): boolean {
    return this.layerManager.isLiveDirty();
  }

  getStaticRedrawCount(): number {
    return this.layerManager.getStaticRedrawCount();
  }

  getLiveRedrawCount(): number {
    return this.layerManager.getLiveRedrawCount();
  }

  dispose(): void {
    this.spatialIndex.clear();
    this.cache.clear();
    this.inkPipeline.reset();
    this.dwellDetector.reset();
    this.isLiveStrokeActive = false;
  }

  private syncSpatialIndex(): void {
    this.spatialIndex.clear();
    for (const id of this.doc.rootIds) {
      const obj = this.doc.objects[id];
      if (!obj) continue;
      const bbox = computeBoundingBox(obj);
      this.spatialIndex.insert({ ...bbox, id: obj.id });
    }
  }
}

/**
 * Factory creating a CanvasRenderer instance adhering to PROJECT.md Contract 3.
 */
export function createRenderer(
  initialDoc: LensDocument,
  options?: RendererOptions
): CanvasRenderer {
  return new FullCanvasRenderer(initialDoc, options);
}
