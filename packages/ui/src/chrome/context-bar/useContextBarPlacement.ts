import { useState, useCallback, useEffect } from 'react';
import type { RectBounds } from './types.js';

export const CONTEXT_BAR_HEIGHT = 40;
export const CONTEXT_BAR_OFFSET = 8;

export function computeContextBarPosition(
  selectionBounds: RectBounds,
  barHeight = CONTEXT_BAR_HEIGHT,
  offset = CONTEXT_BAR_OFFSET
): { x: number; y: number } {
  return {
    x: selectionBounds.x + selectionBounds.w / 2,
    y: selectionBounds.y - barHeight - offset,
  };
}

export function computeBarX(
  selectionX: number,
  selectionW: number,
  viewportW = 1920
): number {
  const mid = selectionX + selectionW / 2;
  return Math.max(100, Math.min(viewportW - 100, mid));
}

export function clampToScreen(naturalY: number, screenH = 1080): number {
  return Math.max(60, Math.min(screenH - 60, naturalY));
}

export function computeContextBarPositionWithClamp(
  selectionY: number,
  barHeight = CONTEXT_BAR_HEIGHT,
  offset = CONTEXT_BAR_OFFSET,
  viewportMinY = 10
): number {
  const naturalY = selectionY - barHeight - offset;
  return naturalY < viewportMinY ? selectionY + 60 : naturalY;
}

export function computeFullContextBarPlacement(
  bounds: RectBounds,
  viewportW = 1920,
  viewportH = 1080,
  barHeight = CONTEXT_BAR_HEIGHT,
  offset = CONTEXT_BAR_OFFSET
): { x: number; y: number } {
  const clampedX = computeBarX(bounds.x, bounds.w, viewportW);
  const naturalY = bounds.y - barHeight - offset;
  const flippedY = naturalY < 60 ? bounds.y + bounds.h + offset : naturalY;
  const clampedY = clampToScreen(flippedY, viewportH);

  return { x: clampedX, y: clampedY };
}

export function computeUnionBounds(boundsList: RectBounds[]): RectBounds {
  if (boundsList.length === 0) {
    return { x: 0, y: 0, w: 0, h: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const b of boundsList) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }

  return {
    x: minX,
    y: minY,
    w: Math.max(0, maxX - minX),
    h: Math.max(0, maxY - minY),
  };
}

export function useContextBarPlacement(
  bounds: RectBounds | null,
  viewportW = 1920,
  viewportH = 1080
) {
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (!bounds) return;
    const pos = computeFullContextBarPlacement(bounds, viewportW, viewportH);
    setPosition(pos);
  }, [bounds, viewportW, viewportH]);

  const onViewportPan = useCallback((dx: number, dy: number) => {
    setPosition((prev) => ({
      x: prev.x + dx,
      y: prev.y + dy,
    }));
  }, []);

  return {
    position,
    onViewportPan,
  };
}
