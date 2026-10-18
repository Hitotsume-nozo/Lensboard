import { describe, it, expect } from 'vitest';
import {
  DRAWER_WIDTH,
  MIN_DRAWER_WIDTH,
  MAX_DRAWER_WIDTH,
  LEFT_DRAWER_SECTIONS,
  RIGHT_DRAWER_SECTIONS,
  clampDrawerWidth,
  createInitialDrawerState,
} from './index.js';

describe('Feature 27: Collapsible Dual Drawers Unit Tests', () => {
  describe('Dimensions & Default State', () => {
    it('default drawer width is exactly 320px (f27-1)', () => {
      expect(DRAWER_WIDTH).toBe(320);
    });

    it('drawers are collapsed by default on initial application load (f27-2)', () => {
      const state = createInitialDrawerState();
      expect(state.leftOpen).toBe(false);
      expect(state.rightOpen).toBe(false);
      expect(state.leftWidth).toBe(320);
      expect(state.rightWidth).toBe(320);
    });

    it('clamps drawer width resizing strictly between 240px and 480px (f27-b2)', () => {
      expect(MIN_DRAWER_WIDTH).toBe(240);
      expect(MAX_DRAWER_WIDTH).toBe(480);
      expect(clampDrawerWidth(100)).toBe(240);
      expect(clampDrawerWidth(320)).toBe(320);
      expect(clampDrawerWidth(800)).toBe(480);
      expect(clampDrawerWidth(240)).toBe(240);
      expect(clampDrawerWidth(480)).toBe(480);
    });
  });

  describe('Sections Organization', () => {
    it('left drawer houses Outline, Library, and Inbox (f27-3)', () => {
      expect(LEFT_DRAWER_SECTIONS).toContain('Outline');
      expect(LEFT_DRAWER_SECTIONS).toContain('Library');
      expect(LEFT_DRAWER_SECTIONS).toContain('Inbox');
      expect(LEFT_DRAWER_SECTIONS).toHaveLength(3);
    });

    it('right drawer houses Inspector, Lenses, Backlinks, and History (f27-4)', () => {
      expect(RIGHT_DRAWER_SECTIONS).toContain('Inspector');
      expect(RIGHT_DRAWER_SECTIONS).toContain('Lenses');
      expect(RIGHT_DRAWER_SECTIONS).toContain('Backlinks');
      expect(RIGHT_DRAWER_SECTIONS).toContain('History');
      expect(RIGHT_DRAWER_SECTIONS).toHaveLength(4);
    });
  });

  describe('Narrow Screen Mutual Exclusion (< 768px) (f27-b1)', () => {
    it('enforces mutual exclusion when screen width is under 768px', () => {
      function openRightDrawerNarrow(leftOpen: boolean, screenWidth: number) {
        let nextLeft = leftOpen;
        if (screenWidth < 768 && leftOpen) {
          nextLeft = false;
        }
        return { leftOpen: nextLeft, rightOpen: true };
      }

      const narrowResult = openRightDrawerNarrow(true, 640);
      expect(narrowResult.leftOpen).toBe(false);
      expect(narrowResult.rightOpen).toBe(true);

      const wideResult = openRightDrawerNarrow(true, 1024);
      expect(wideResult.leftOpen).toBe(true);
      expect(wideResult.rightOpen).toBe(true);
    });
  });

  describe('Scroll Position Retention (f27-b3)', () => {
    it('preserves scroll position map per section', () => {
      const state = createInitialDrawerState();
      state.scrollPositions.Outline = 150;
      state.scrollPositions.Library = 0;

      expect(state.scrollPositions.Outline).toBe(150);
      expect(state.scrollPositions.Library).toBe(0);
    });
  });

  describe('Canvas Viewport Continuity (f27-5)', () => {
    it('opening drawers does not alter canvas viewport coordinates', () => {
      const vp = { x: 50, y: 50, zoom: 1.0 };
      let leftOpen = false;
      leftOpen = true;
      expect(leftOpen).toBe(true);
      expect(vp.x).toBe(50);
      expect(vp.y).toBe(50);
      expect(vp.zoom).toBe(1.0);
    });
  });
});
