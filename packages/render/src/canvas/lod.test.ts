import { describe, it, expect } from 'vitest';
import {
  getFrameLODLevel,
  LOD_SUMMARY_THRESHOLD,
  LOD_TITLE_ONLY_THRESHOLD,
  renderFrameTitleOnly,
  renderFrameSummaryCard,
} from './lod.js';
import { HeadlessCanvasAdapter } from './adapter.js';

describe('Level of Detail (LOD)', () => {
  it('correctly maps zoom levels to LOD levels per Spec §8', () => {
    expect(LOD_SUMMARY_THRESHOLD).toBe(0.25);
    expect(LOD_TITLE_ONLY_THRESHOLD).toBe(0.08);

    // Zoom < 0.08 -> title only
    expect(getFrameLODLevel(0.01)).toBe('title');
    expect(getFrameLODLevel(0.079)).toBe('title');

    // 0.08 <= Zoom < 0.25 -> summary card
    expect(getFrameLODLevel(0.08)).toBe('summary');
    expect(getFrameLODLevel(0.15)).toBe('summary');
    expect(getFrameLODLevel(0.249)).toBe('summary');

    expect(LOD_TITLE_ONLY_THRESHOLD).toBe(0.08);
    expect(LOD_SUMMARY_THRESHOLD).toBe(0.25);

    // Zoom >= 0.25 -> full frame
    expect(getFrameLODLevel(0.25)).toBe('full');
    expect(getFrameLODLevel(1.0)).toBe('full');
    expect(getFrameLODLevel(10.0)).toBe('full');
  });

  it('renders title only without error', () => {
    const adapter = new HeadlessCanvasAdapter(400, 300);
    const ctx = adapter.getContext()!;
    const frame = {
      id: 'f1',
      type: 'frame' as const,
      parentId: null,
      x: 50,
      y: 50,
      w: 300,
      h: 200,
      rotation: 0,
      z: 'a0',
      style: { colorId: 'ink' as const, strokeWidth: 1, renderMode: 'crisp' as const },
      tags: [],
      locked: false,
      hidden: false,
      createdAt: 0,
      updatedAt: 0,
    };

    renderFrameTitleOnly(ctx, frame, 'My Test Frame');
  });

  it('renders summary card with metadata without error', () => {
    const adapter = new HeadlessCanvasAdapter(400, 300);
    const ctx = adapter.getContext()!;
    const frame = {
      id: 'f1',
      type: 'frame' as const,
      parentId: null,
      x: 50,
      y: 50,
      w: 300,
      h: 200,
      rotation: 0,
      z: 'a0',
      style: { colorId: 'ink' as const, strokeWidth: 1, renderMode: 'crisp' as const },
      tags: ['algorithms', 'dp'],
      locked: false,
      hidden: false,
      createdAt: 0,
      updatedAt: 0,
    };

    renderFrameSummaryCard(ctx, frame, {
      title: 'Knapsack DP',
      childCount: 12,
      tags: ['dp', 'algo'],
    });
  });
});
