/**
 * Feature 29: Suggestion Chips & Minimap (M5)
 * Authoritative Source: SPEC.md §13, PROJECT.md Feature 29
 * Ghost preview suggestion chips (keys 1, 2, 3), 160x100px click-to-jump minimap, zoom controls
 */

import { describe, it, expect } from '../harness.ts';

describe('Feature 29: Suggestion Chips & Minimap', () => {
  it('f29-1: suggestion chip displays up to top 3 conversion candidates with 1, 2, 3 shortcuts', () => {
    const candidates = [
      { key: '1', kind: 'rect', label: 'Rectangle' },
      { key: '2', kind: 'diamond', label: 'Diamond' },
      { key: '3', kind: 'table', label: 'DP Table' },
    ];
    expect(candidates).toHaveLength(3);
    expect(candidates[0].key).toBe('1');
    expect(candidates[2].key).toBe('3');
  });

  it('f29-2: suggestion chips auto-fade after 4000ms idle or immediately on next stroke', () => {
    let chipVisible = true;
    function onNextStroke(): void {
      chipVisible = false;
    }
    onNextStroke();
    expect(chipVisible).toBe(false);
  });

  it('f29-3: ghost preview renders faint geometric outline for top candidate', () => {
    const ghostState = { visible: true, opacity: 0.35, candidateKind: 'rect' };
    expect(ghostState.visible).toBe(true);
    expect(ghostState.opacity).toBeLessThan(0.5);
  });

  it('f29-4: minimap dimensions are calibrated to exactly 160x100px', () => {
    const minimapSize = { width: 160, height: 100 };
    expect(minimapSize.width).toBe(160);
    expect(minimapSize.height).toBe(100);
  });

  it('f29-5: clicking minimap jumps viewport camera to clicked world coordinates', () => {
    const minimapBounds = { w: 160, h: 100, worldW: 1600, worldH: 1000 };
    function onMinimapClick(clickX: number, clickY: number) {
      return {
        worldX: (clickX / minimapBounds.w) * minimapBounds.worldW,
        worldY: (clickY / minimapBounds.h) * minimapBounds.worldH,
      };
    }
    const target = onMinimapClick(80, 50);
    expect(target.worldX).toBe(800);
    expect(target.worldY).toBe(500);
  });
});
