import { describe, it, expect } from 'vitest';
import {
  MINIMAP_WIDTH,
  MINIMAP_HEIGHT,
  computeMinimapScale,
  projectMinimapClickToWorld,
  clampCameraWorld,
  selectCandidate,
  canRenderGhost,
  clampZoomValue,
  MIN_ZOOM,
  MAX_ZOOM,
  type SuggestionCandidate,
} from './index.js';

describe('Feature 29: Suggestion Chips & Minimap Unit Tests', () => {
  describe('Minimap Dimensions & Projection', () => {
    it('calibrated to exactly 160x100px (f29-4)', () => {
      expect(MINIMAP_WIDTH).toBe(160);
      expect(MINIMAP_HEIGHT).toBe(100);
    });

    it('zero-object document renders without NaN (f29-b3)', () => {
      const scale = computeMinimapScale(0);
      expect(Number.isFinite(scale)).toBe(true);
      expect(scale).toBe(1.0);
    });

    it('finite scale for populated document', () => {
      const scale = computeMinimapScale(25);
      expect(Number.isFinite(scale)).toBe(true);
      expect(scale).toBe(4.0);
    });

    it('projects minimap click coordinates to world coordinates (f29-5)', () => {
      const bounds = { w: 160, h: 100, worldW: 1600, worldH: 1000 };
      const target = projectMinimapClickToWorld(80, 50, bounds);
      expect(target.worldX).toBe(800);
      expect(target.worldY).toBe(500);
    });

    it('clamps camera world coordinates outside active content to [-50000, 50000] (f29-b4)', () => {
      const clamped = clampCameraWorld(100000, -100000);
      expect(clamped.x).toBe(50000);
      expect(clamped.y).toBe(-50000);

      const within = clampCameraWorld(1200, 800);
      expect(within.x).toBe(1200);
      expect(within.y).toBe(800);
    });
  });

  describe('Suggestion Chips & Candidate Selection', () => {
    const candidates: SuggestionCandidate[] = [
      { key: '1', kind: 'rect', label: 'Rectangle' },
      { key: '2', kind: 'diamond', label: 'Diamond' },
    ];

    it('selects existing candidate by key 1 or 2', () => {
      expect(selectCandidate(candidates, '1')?.kind).toBe('rect');
      expect(selectCandidate(candidates, '2')?.kind).toBe('diamond');
    });

    it('pressing candidate hotkey 3 when only 2 candidates exist is a safe no-op (f29-b1)', () => {
      const result = selectCandidate(candidates, '3');
      expect(result).toBeNull();
    });
  });

  describe('Ghost Preview Bounds Safety', () => {
    it('validates bounds before rendering ghost preview (f29-b2)', () => {
      expect(canRenderGhost(undefined)).toBe(false);
      expect(canRenderGhost({})).toBe(false);
      expect(canRenderGhost({ bounds: { w: 0, h: 50 } })).toBe(false);
      expect(canRenderGhost({ bounds: { w: -10, h: 50 } })).toBe(false);
      expect(canRenderGhost({ bounds: { w: 100, h: 50 } })).toBe(true);
    });
  });

  describe('Zoom Controls Clamping', () => {
    it('clamps zoom scale strictly between 0.02 and 64.0', () => {
      expect(clampZoomValue(0.01)).toBe(MIN_ZOOM);
      expect(clampZoomValue(100)).toBe(MAX_ZOOM);
      expect(clampZoomValue(1.5)).toBe(1.5);
    });
  });
});
