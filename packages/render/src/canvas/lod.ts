/**
 * Level of Detail (LOD) Rendering for Frames.
 * Authoritative: Spec §8.
 * - Zoom >= 0.25: Full frame contents rendered
 * - 0.08 <= Zoom < 0.25: Titled summary card (title, tags, object counts, first line of text)
 * - Zoom < 0.08: Only frame title drawn
 */

import type { CanvasObject } from '@lensboard/core';
import type { LODLevel } from '../types.js';

export const LOD_SUMMARY_THRESHOLD = 0.25;
export const LOD_TITLE_ONLY_THRESHOLD = 0.08;

/**
 * Determines LOD level based on active zoom factor.
 */
export function getFrameLODLevel(zoom: number): LODLevel {
  if (zoom < LOD_TITLE_ONLY_THRESHOLD) {
    return 'title';
  }
  if (zoom < LOD_SUMMARY_THRESHOLD) {
    return 'summary';
  }
  return 'full';
}

export interface FrameMetadata {
  title?: string;
  tags?: string[];
  childCount?: number;
  previewText?: string;
}

/**
 * Renders a frame as a title only (zoom < 0.08).
 */
export function renderFrameTitleOnly(
  ctx: CanvasRenderingContext2D,
  frame: CanvasObject,
  title = 'Untitled Frame'
): void {
  ctx.save();
  ctx.font = 'bold 14px sans-serif';
  ctx.fillStyle = '#64748B';
  ctx.fillText(title, frame.x, frame.y - 6);
  ctx.restore();
}

/**
 * Renders a frame as a titled summary card (0.08 <= zoom < 0.25).
 */
export function renderFrameSummaryCard(
  ctx: CanvasRenderingContext2D,
  frame: CanvasObject,
  meta: FrameMetadata = {}
): void {
  const width = frame.w ?? (frame as { width?: number }).width ?? 200;
  const height = frame.h ?? (frame as { height?: number }).height ?? 150;
  const title = meta.title ?? (frame.data?.title as string) ?? 'Frame';
  const childCount = meta.childCount ?? 0;
  const tags = meta.tags ?? frame.tags ?? [];

  ctx.save();

  // Card background
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(frame.x, frame.y, width, height);

  // Border
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.strokeRect(frame.x, frame.y, width, height);

  // Title
  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = '#F8FAFC';
  ctx.fillText(title, frame.x + 10, frame.y + 20);

  // Object count & tags
  ctx.font = '10px sans-serif';
  ctx.fillStyle = '#94A3B8';
  const info = `${childCount} object${childCount === 1 ? '' : 's'}${tags.length ? ` • ${tags.join(', ')}` : ''}`;
  ctx.fillText(info, frame.x + 10, frame.y + 36);

  ctx.restore();
}
