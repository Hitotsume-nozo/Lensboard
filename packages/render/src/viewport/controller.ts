/**
 * 60fps Viewport Controller: Pan and Zoom kinematics.
 * Authoritative: Spec §8, §14.
 * - Exponential cursor-centered zoom: zoom' = zoom * exp(-deltaY * 0.0015)
 * - Strict zoom clamping: [0.02, 64.0]
 * - Cursor invariance: world point under cursor remains pinned after zoom
 * - Pan via Space+drag, Middle mouse drag, Shift+wheel horizontal pan
 */

import type { Point, ViewportTransform } from '../types.js';

export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 64.0;
export const ZOOM_EXP_FACTOR = 0.0015;

/**
 * Normalizes wheel delta based on standard DOM deltaMode.
 * 0 = DOM_DELTA_PIXEL (raw pixels)
 * 1 = DOM_DELTA_LINE (16px per line)
 * 2 = DOM_DELTA_PAGE (800px per page)
 */
export function normalizeWheelDelta(deltaY: number, deltaMode = 0): number {
  if (deltaMode === 1) {
    return deltaY * 16;
  }
  if (deltaMode === 2) {
    return deltaY * 800;
  }
  return deltaY;
}

/**
 * Pure calculation of exponential zoom update.
 * zoom' = clamp(currentZoom * exp(-deltaY * 0.0015), 0.02, 64.0)
 */
export function calculateNewZoom(currentZoom: number, deltaY: number): number {
  if (deltaY === 0) {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, currentZoom));
  }
  const factor = Math.exp(-deltaY * ZOOM_EXP_FACTOR);
  const unconstrained = currentZoom * factor;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, unconstrained));
}

/**
 * Computes a new viewport that zooms about a given screen cursor position,
 * preserving cursor invariance (the world coordinate under cursor remains pinned).
 */
export function zoomAtScreenPoint(
  viewport: ViewportTransform,
  cursor: Point,
  deltaY: number,
  deltaMode = 0
): ViewportTransform {
  const normDelta = normalizeWheelDelta(deltaY, deltaMode);
  const newZoom = calculateNewZoom(viewport.zoom, normDelta);

  if (newZoom === viewport.zoom) {
    return { ...viewport };
  }

  // World point under cursor before zoom
  const worldX = (cursor.x - viewport.x) / viewport.zoom;
  const worldY = (cursor.y - viewport.y) / viewport.zoom;

  // New viewport translation to pin world coordinate under cursor
  const newVx = cursor.x - worldX * newZoom;
  const newVy = cursor.y - worldY * newZoom;

  return {
    x: Number.isFinite(newVx) ? newVx : viewport.x,
    y: Number.isFinite(newVy) ? newVy : viewport.y,
    zoom: newZoom,
  };
}

/**
 * Applies panning displacement (in screen pixels) to viewport.
 */
export function panViewport(
  viewport: ViewportTransform,
  dx: number,
  dy: number
): ViewportTransform {
  return {
    x: viewport.x + dx,
    y: viewport.y + dy,
    zoom: viewport.zoom,
  };
}

/**
 * Applies horizontal pan from Shift+wheel.
 */
export function panHorizontalWheel(
  viewport: ViewportTransform,
  deltaY: number,
  deltaMode = 0
): ViewportTransform {
  const normDelta = normalizeWheelDelta(deltaY, deltaMode);
  return {
    x: viewport.x - normDelta,
    y: viewport.y,
    zoom: viewport.zoom,
  };
}

/**
 * Stateful ViewportController managing camera transformations.
 */
export class ViewportController {
  private viewport: ViewportTransform;
  private onChangeCallbacks: Set<(vp: ViewportTransform) => void> = new Set();

  constructor(initialViewport: ViewportTransform = { x: 0, y: 0, zoom: 1.0 }) {
    this.viewport = {
      x: initialViewport.x,
      y: initialViewport.y,
      zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, initialViewport.zoom)),
    };
  }

  getViewport(): ViewportTransform {
    return { ...this.viewport };
  }

  setViewport(x: number, y: number, zoom: number): void {
    const clampedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
    if (
      this.viewport.x !== x ||
      this.viewport.y !== y ||
      this.viewport.zoom !== clampedZoom
    ) {
      this.viewport = { x, y, zoom: clampedZoom };
      this.notify();
    }
  }

  pan(dx: number, dy: number): void {
    if (dx === 0 && dy === 0) return;
    this.viewport = panViewport(this.viewport, dx, dy);
    this.notify();
  }

  panHorizontal(deltaY: number, deltaMode = 0): void {
    const prevX = this.viewport.x;
    this.viewport = panHorizontalWheel(this.viewport, deltaY, deltaMode);
    if (this.viewport.x !== prevX) {
      this.notify();
    }
  }

  zoomAt(cursor: Point, deltaY: number, deltaMode = 0): void {
    const next = zoomAtScreenPoint(this.viewport, cursor, deltaY, deltaMode);
    if (
      next.x !== this.viewport.x ||
      next.y !== this.viewport.y ||
      next.zoom !== this.viewport.zoom
    ) {
      this.viewport = next;
      this.notify();
    }
  }

  subscribe(callback: (vp: ViewportTransform) => void): () => void {
    this.onChangeCallbacks.add(callback);
    return () => this.onChangeCallbacks.delete(callback);
  }

  private notify(): void {
    const current = this.getViewport();
    for (const cb of this.onChangeCallbacks) {
      cb(current);
    }
  }
}
