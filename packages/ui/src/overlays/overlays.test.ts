import { describe, it, expect } from 'vitest';
import {
  PIE_SLOTS,
  PIE_MENU_CONFIG,
  resolvePieSlot,
  clampPieCenter,
  clampPiePosition,
} from './index.js';

describe('Feature 28 & §13 Overlays: Pie Menu & Toasts Unit Tests', () => {
  describe('Pie Menu Specification & Slots (f28-3)', () => {
    it('contains exactly 8 functional directional slots', () => {
      expect(PIE_SLOTS).toHaveLength(8);
      expect(PIE_SLOTS).toContain('Colour');
      expect(PIE_SLOTS).toContain('Tool');
      expect(PIE_SLOTS).toContain('Undo');
      expect(PIE_SLOTS).toContain('Redo');
      expect(PIE_SLOTS).toContain('Convert');
      expect(PIE_SLOTS).toContain('Tidy');
      expect(PIE_SLOTS).toContain('Duplicate');
      expect(PIE_SLOTS).toContain('Delete');
    });

    it('operates with 120px radius and 24px dead zone (f28-4)', () => {
      expect(PIE_MENU_CONFIG.radius).toBe(120);
      expect(PIE_MENU_CONFIG.deadZone).toBe(24);
    });
  });

  describe('Pie Menu Angular Resolution & Dead Zone (f28-4, f28-b3)', () => {
    it('returns null when pointer is inside 24px inner dead zone', () => {
      expect(resolvePieSlot(0, 0)).toBeNull();
      expect(resolvePieSlot(5, 5)).toBeNull();
      expect(resolvePieSlot(15, 10)).toBeNull(); // dist ≈ 18 < 24
    });

    it('resolves valid directional slot when pointer is beyond dead zone', () => {
      const rightFlick = resolvePieSlot(50, 0);
      expect(rightFlick).toBe(0);

      const downFlick = resolvePieSlot(0, 50);
      expect(downFlick).toBe(2); // 90 degrees
    });

    it('flick exactly on 45° boundary cleanly resolves to adjacent slot (f28-b3)', () => {
      const angle = Math.PI / 4; // Exactly 45 degrees
      const dx = Math.cos(angle) * 60;
      const dy = Math.sin(angle) * 60;
      const slot = resolvePieSlot(dx, dy);

      expect(slot).not.toBeNull();
      expect(slot).toBeGreaterThanOrEqual(0);
      expect(slot).toBeLessThan(8);
    });
  });

  describe('Screen Edge Clamping (f28-b4)', () => {
    it('clamps pie menu center when right-clicked near screen boundaries', () => {
      const clampedX = clampPieCenter(1910, 120, 1920);
      expect(clampedX).toBe(1920 - 120);

      const leftClamped = clampPieCenter(10, 120, 1920);
      expect(leftClamped).toBe(120);
    });

    it('clamps 2D position within window margins', () => {
      const pos = clampPiePosition(1950, 10, 120, 1920, 1080);
      expect(pos.x).toBe(1920 - 120);
      expect(pos.y).toBe(120);
    });
  });
});
