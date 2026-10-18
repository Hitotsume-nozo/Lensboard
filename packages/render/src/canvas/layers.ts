/**
 * Dual-Layer Canvas 2D Pipeline Manager.
 * Authoritative: Spec §8, Features 18.
 * - Stacked DPR canvases: static scene layer + live interaction rAF layer.
 * - Redraw static layer ONLY on scene or viewport mutation; pointer moves during live stroke do NOT touch static layer.
 * - Redraw live layer per frame during active pointer interaction.
 * - Live layer clears immediately on interaction finish and commits to static scene.
 * - Viewport culling queries spatial index with visible bounds and renders in fractional z order.
 */

import type { LensDocument } from '@lensboard/core';
import type { CanvasAdapter, ViewportTransform, GhostCursor } from '../types.js';
import { getVisibleWorldBounds } from '../viewport/transform.js';
import type { SpatialIndex } from '../spatial/index.js';
import { renderCanvasObject } from '../shapes/renderer.js';
import type { SmartObjectCache } from './cache.js';

export interface LayerManagerOptions {
  staticAdapter: CanvasAdapter;
  liveAdapter: CanvasAdapter;
  cache?: SmartObjectCache;
}

export class DualLayerManager {
  private staticAdapter: CanvasAdapter;
  private liveAdapter: CanvasAdapter;
  private cache?: SmartObjectCache;

  private staticDirty = true;
  private liveDirty = false;

  private staticRedrawCount = 0;
  private liveRedrawCount = 0;

  constructor(options: LayerManagerOptions) {
    this.staticAdapter = options.staticAdapter;
    this.liveAdapter = options.liveAdapter;
    this.cache = options.cache;

    // Context loss recovery triggers
    this.staticAdapter.onContextLost?.(() => {
      this.staticDirty = true;
    });
    this.liveAdapter.onContextLost?.(() => {
      this.liveDirty = true;
    });
  }

  getStaticAdapter(): CanvasAdapter {
    return this.staticAdapter;
  }

  getLiveAdapter(): CanvasAdapter {
    return this.liveAdapter;
  }

  markStaticDirty(): void {
    this.staticDirty = true;
  }

  markLiveDirty(): void {
    this.liveDirty = true;
  }

  isStaticDirty(): boolean {
    return this.staticDirty;
  }

  isLiveDirty(): boolean {
    return this.liveDirty;
  }

  getStaticRedrawCount(): number {
    return this.staticRedrawCount;
  }

  getLiveRedrawCount(): number {
    return this.liveRedrawCount;
  }

  resize(width: number, height: number, dpr?: number): void {
    this.staticAdapter.setSize(width, height, dpr);
    this.liveAdapter.setSize(width, height, dpr);
    this.staticDirty = true;
    this.liveDirty = true;
  }

  /**
   * Renders the static scene layer.
   * Redraws ONLY when staticDirty is true (scene mutation, viewport pan/zoom, or resize).
   */
  renderStaticLayer(
    doc: LensDocument,
    viewport: ViewportTransform,
    spatialIndex: SpatialIndex
  ): void {
    if (!this.staticDirty) return;

    const ctx = this.staticAdapter.getContext();
    if (!ctx) return;

    this.staticRedrawCount++;
    this.staticAdapter.clear();

    const dpr = this.staticAdapter.getDpr();
    const width = this.staticAdapter.getWidth();
    const height = this.staticAdapter.getHeight();

    // Setup viewport transform matrix scaled by DPR
    ctx.save();
    ctx.setTransform(
      dpr * viewport.zoom,
      0,
      0,
      dpr * viewport.zoom,
      dpr * viewport.x,
      dpr * viewport.y
    );

    // Viewport culling query: find only visible candidate entities
    const visibleWorldBox = getVisibleWorldBounds(viewport, width, height);
    const visibleCandidates = spatialIndex.search(visibleWorldBox);
    const visibleIdSet = new Set(visibleCandidates.map((c) => c.id));

    // Render visible objects in rootIds order (fractional z-stack order)
    for (let i = 0; i < doc.rootIds.length; i++) {
      const id = doc.rootIds[i];
      if (!visibleIdSet.has(id)) continue;

      const obj = doc.objects[id];
      if (!obj || obj.hidden) continue;

      renderCanvasObject(ctx, obj, viewport.zoom, this.cache);
    }

    ctx.restore();
    this.staticDirty = false;
  }

  /**
   * Renders the live interaction layer (in-flight stroke, ghost cursor, handles).
   */
  renderLiveLayer(
    liveOutlineVertices: number[][],
    ghostCursor?: GhostCursor | null,
    strokeColor = '#1C1E26'
  ): void {
    const ctx = this.liveAdapter.getContext();
    if (!ctx) return;

    this.liveRedrawCount++;
    this.liveAdapter.clear();

    const dpr = this.liveAdapter.getDpr();

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 1. Draw in-flight live stroke outline
    if (liveOutlineVertices.length > 0) {
      ctx.fillStyle = strokeColor;
      ctx.beginPath();
      const [firstX, firstY] = liveOutlineVertices[0];
      ctx.moveTo(firstX, firstY);

      for (let i = 1; i < liveOutlineVertices.length; i++) {
        const [x, y] = liveOutlineVertices[i];
        ctx.lineTo(x, y);
      }

      ctx.closePath();
      ctx.fill();
    }

    // 2. Draw ghost cursor (Ctrl precision mode)
    if (ghostCursor && ghostCursor.visible) {
      ctx.save();
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(ghostCursor.x, ghostCursor.y, 8, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#3B82F6';
      ctx.beginPath();
      ctx.arc(ghostCursor.x, ghostCursor.y, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
    this.liveDirty = false;
  }

  /**
   * Clears the live interaction layer immediately upon stroke finish or interaction cancel.
   */
  clearLiveLayer(): void {
    this.liveAdapter.clear();
    this.liveDirty = false;
  }
}
