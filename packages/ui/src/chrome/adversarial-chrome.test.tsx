/**
 * Adversarial Stress Test Suite for Floating Canvas Chrome (Milestone 5)
 * Empirical Challenger Verification Harness
 */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

import {
  SaveIndicatorDot,
  SAVE_STATE_COLORS,
  SAVE_STATE_TOOLTIPS,
} from './breadcrumbs/SaveIndicatorDot.js';

import {
  Breadcrumbs,
  formatTitle,
  formatBreadcrumb,
} from './breadcrumbs/Breadcrumbs.js';

import {
  TabStrip,
  truncateTabTitle,
  switchTabByIndex,
  handleTabCloseWithFallback,
} from './breadcrumbs/TabStrip.js';
import type { BoardTabItem, SaveState } from './breadcrumbs/types.js';

import {
  FloatingPillToolbar,
  TOOLBAR_HEIGHT,
  BUTTON_SIZE,
  TOOLS,
  TOOL_KEYS,
  isValidTool,
  nextSlot,
  prevSlot,
  resolveToolbarMode,
  shouldSuppressToolShortcut,
} from './toolbar/index.js';

import {
  ContextualPropertiesBar,
  getPropertiesForType,
} from './context-bar/ContextualPropertiesBar.js';

import {
  CONTEXT_BAR_HEIGHT,
  CONTEXT_BAR_OFFSET,
  computeContextBarPosition,
  computeBarX,
  clampToScreen,
  computeContextBarPositionWithClamp,
  computeFullContextBarPlacement,
  computeUnionBounds,
} from './context-bar/useContextBarPlacement.js';
import type { RectBounds } from './context-bar/types.js';

import {
  Minimap,
  MINIMAP_WIDTH,
  MINIMAP_HEIGHT,
  computeMinimapScale,
  projectMinimapClickToWorld,
  clampCameraWorld,
} from './minimap/Minimap.js';

import {
  ZoomControls,
  MIN_ZOOM,
  MAX_ZOOM,
  clampZoomValue,
} from './minimap/ZoomControls.js';

import {
  SuggestionChips,
  selectCandidate,
} from './minimap/SuggestionChips.js';
import type { SuggestionCandidate } from './minimap/types.js';

import {
  GhostPreview,
  canRenderGhost,
} from './minimap/GhostPreview.js';

// DOM test helper
function createTestContainer(): { container: HTMLDivElement; root: ReturnType<typeof createRoot>; cleanup: () => void } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  return {
    container,
    root,
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('Adversarial Chrome Challenge Suite (M5)', () => {
  beforeEach(() => {
    // @ts-expect-error setting React act environment
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  // =========================================================================
  // Challenge 1: Save Indicator Dot States & Resiliency
  // =========================================================================
  describe('Challenge 1: Save Indicator Dot States', () => {
    const states: readonly SaveState[] = ['saved', 'saving', 'dirty', 'error'] as const;

    it('renders exact 4 states with WCAG-compliant design token variables', () => {
      expect(SAVE_STATE_COLORS.saved).toBe('var(--lb-accent-2, #3DD6C6)');
      expect(SAVE_STATE_COLORS.saving).toBe('var(--lb-warning, #FFC857)');
      expect(SAVE_STATE_COLORS.dirty).toBe('var(--lb-warning, #FFC857)');
      expect(SAVE_STATE_COLORS.error).toBe('var(--lb-danger, #FF6B7A)');
    });

    it('sets correct accessibility attributes and tooltips for all states', () => {
      for (const state of states) {
        const { container, root, cleanup } = createTestContainer();
        act(() => {
          root.render(<SaveIndicatorDot state={state} />);
        });

        const dot = container.querySelector('.lb-save-dot') as HTMLElement;
        expect(dot).not.toBeNull();
        expect(dot.getAttribute('role')).toBe('status');
        expect(dot.getAttribute('aria-label')).toBe(SAVE_STATE_TOOLTIPS[state]);
        expect(dot.getAttribute('title')).toBe(SAVE_STATE_TOOLTIPS[state]);

        cleanup();
      }
    });

    it('enables pulse animation exclusively when saving', () => {
      for (const state of states) {
        const { container, root, cleanup } = createTestContainer();
        act(() => {
          root.render(<SaveIndicatorDot state={state} />);
        });

        const dot = container.querySelector('.lb-save-dot') as HTMLElement;
        if (state === 'saving') {
          expect(dot.style.animation).toBe('lb-pulse 1000ms infinite ease-in-out');
        } else {
          expect(dot.style.animation).toBe('none');
        }

        cleanup();
      }
    });

    it('gracefully falls back on unexpected/invalid state without crashing', () => {
      const { container, root, cleanup } = createTestContainer();
      act(() => {
        // @ts-expect-error Testing invalid runtime state
        root.render(<SaveIndicatorDot state="corrupted_state" />);
      });

      const dot = container.querySelector('.lb-save-dot') as HTMLElement;
      expect(dot).not.toBeNull();
      expect(dot.style.backgroundColor).toBe(SAVE_STATE_COLORS.saved);
      expect(dot.getAttribute('aria-label')).toBe('Disk state');

      cleanup();
    });

    it('supports custom size while maintaining circular aspect ratio', () => {
      const { container, root, cleanup } = createTestContainer();
      act(() => {
        root.render(<SaveIndicatorDot state="saved" size={16} />);
      });

      const dot = container.querySelector('.lb-save-dot') as HTMLElement;
      expect(dot.style.width).toBe('16px');
      expect(dot.style.height).toBe('16px');
      expect(dot.style.borderRadius).toBe('50%');

      cleanup();
    });
  });

  // =========================================================================
  // Challenge 2: Tab Strip Shortcuts, Truncation & Fallbacks
  // =========================================================================
  describe('Challenge 2: Tab Strip & Breadcrumbs Boundary Behaviors', () => {
    it('truncation boundary: lengths 23, 24, 25 and extreme lengths', () => {
      const title23 = '12345678901234567890123';
      const title24 = '123456789012345678901234';
      const title25 = '1234567890123456789012345';
      const extreme = 'X'.repeat(5000);

      expect(truncateTabTitle(title23)).toBe(title23);
      expect(truncateTabTitle(title23)).toHaveLength(23);

      expect(truncateTabTitle(title24)).toBe(title24);
      expect(truncateTabTitle(title24)).toHaveLength(24);

      const res25 = truncateTabTitle(title25);
      expect(res25).toHaveLength(24);
      expect(res25).toBe('12345678901234567890123…');
      expect(res25.endsWith('…')).toBe(true);

      const resExtreme = truncateTabTitle(extreme);
      expect(resExtreme).toHaveLength(24);
      expect(resExtreme).toBe('X'.repeat(23) + '…');
    });

    it('property-test: truncateTabTitle never exceeds maxLen for arbitrary inputs', () => {
      fc.assert(
        fc.property(fc.string(), fc.integer({ min: 1, max: 100 }), (title, maxLen) => {
          const truncated = truncateTabTitle(title, maxLen);
          expect(truncated.length).toBeLessThanOrEqual(maxLen);
        }),
        { numRuns: 200 }
      );
    });

    it('switchTabByIndex bounds: safely handles indices 0, negative, > length, and > 9', () => {
      const tabs = [{ id: 't1', title: 'T1' }, { id: 't2', title: 'T2' }];
      expect(switchTabByIndex(tabs, 0)).toBeNull();
      expect(switchTabByIndex(tabs, -5)).toBeNull();
      expect(switchTabByIndex(tabs, 3)).toBeNull();
      expect(switchTabByIndex(tabs, 9)).toBeNull();
      expect(switchTabByIndex(tabs, 100)).toBeNull();
      expect(switchTabByIndex([], 1)).toBeNull();
      expect(switchTabByIndex(tabs, 1)?.id).toBe('t1');
      expect(switchTabByIndex(tabs, 2)?.id).toBe('t2');
    });

    it('handleTabCloseWithFallback: closing last remaining tab fallback to Inbox', () => {
      const oneTab: BoardTabItem[] = [{ id: 'board-alpha', title: 'My Work' }];
      const result = handleTabCloseWithFallback(oneTab, 'board-alpha');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('inbox-default');
      expect(result[0].title).toBe('Inbox');

      // Closing with custom fallback title
      const customResult = handleTabCloseWithFallback(oneTab, 'board-alpha', 'Archive');
      expect(customResult[0].title).toBe('Archive');

      // Closing non-existent ID does not corrupt
      const unchanged = handleTabCloseWithFallback(oneTab, 'non-existent-id');
      expect(unchanged).toHaveLength(1);
      expect(unchanged[0].id).toBe('board-alpha');

      // Closing on empty array returns fallback
      const emptyResult = handleTabCloseWithFallback([], 'any-id');
      expect(emptyResult).toHaveLength(1);
      expect(emptyResult[0].title).toBe('Inbox');
    });

    it('TabStrip DOM: Alt+1..9, Ctrl+W, Ctrl+T keyboard interactions', () => {
      const onSelectTab = vi.fn();
      const onCloseTab = vi.fn();
      const onNewTab = vi.fn();

      const tabs: BoardTabItem[] = [
        { id: 't1', title: 'Board 1' },
        { id: 't2', title: 'Board 2' },
        { id: 't3', title: 'Board 3' },
      ];

      const { container, root, cleanup } = createTestContainer();
      act(() => {
        root.render(
          <TabStrip
            tabs={tabs}
            activeTabId="t1"
            onSelectTab={onSelectTab}
            onCloseTab={onCloseTab}
            onNewTab={onNewTab}
          />
        );
      });

      expect(container.querySelector('.lb-tab-strip')).not.toBeNull();

      // Alt+2 -> switches to t2
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: '2', altKey: true, bubbles: true })
      );
      expect(onSelectTab).toHaveBeenCalledWith('t2');

      // Alt+9 -> out of range, no call
      onSelectTab.mockClear();
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: '9', altKey: true, bubbles: true })
      );
      expect(onSelectTab).not.toHaveBeenCalled();

      // Ctrl+W -> closes active tab
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'w', ctrlKey: true, bubbles: true })
      );
      expect(onCloseTab).toHaveBeenCalledWith('t1');

      // Ctrl+T -> opens new tab
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 't', ctrlKey: true, bubbles: true })
      );
      expect(onNewTab).toHaveBeenCalled();

      cleanup();
    });

    it('Breadcrumbs formatting and component rendering', () => {
      expect(formatTitle('')).toBe('Untitled');
      expect(formatTitle('   \t\n  ')).toBe('Untitled');
      expect(formatTitle(undefined)).toBe('Untitled');
      expect(formatBreadcrumb('', '')).toBe('Untitled / Untitled');
      expect(formatBreadcrumb('Algorithms', ' ')).toBe('Algorithms / Untitled');
      expect(formatBreadcrumb('  Stanford CS  ', '  Binary Trees  ')).toBe('Stanford CS / Binary Trees');

      const { container, root, cleanup } = createTestContainer();
      act(() => {
        root.render(
          <Breadcrumbs
            project="Algorithms"
            board="Dynamic Programming"
            saveState="saved"
          />
        );
      });

      expect(container.textContent).toContain('Algorithms');
      expect(container.textContent).toContain('Dynamic Programming');
      expect(container.querySelector('.lb-save-dot')).not.toBeNull();

      cleanup();
    });
  });

  // =========================================================================
  // Challenge 3: Floating Pill Toolbar (48px, 11 tools, focus mode, traversal)
  // =========================================================================
  describe('Challenge 3: Floating Pill Toolbar & Input Suppression', () => {
    it('verifies exact 11 tool slots and 48px/40px specification constants', () => {
      expect(TOOLBAR_HEIGHT).toBe(48);
      expect(BUTTON_SIZE).toBe(40);
      expect(TOOL_KEYS).toHaveLength(11);
      expect(TOOLS).toHaveLength(11);
      expect(TOOL_KEYS).toEqual(['V', 'P', 'L', 'S', 'T', 'E', 'C', 'G', 'X', 'R', 'H']);
    });

    it('circular tool traversal forward and backward', () => {
      // Forward: V(0) -> P(1) -> ... -> H(10) -> V(0)
      for (let i = 0; i < 10; i++) {
        expect(nextSlot(i)).toBe(i + 1);
      }
      expect(nextSlot(10)).toBe(0);

      // Backward: V(0) -> H(10) -> R(9) -> ...
      expect(prevSlot(0)).toBe(10);
      for (let i = 10; i > 0; i--) {
        expect(prevSlot(i)).toBe(i - 1);
      }
    });

    it('validates single-letter tool hotkeys and rejects invalid ones', () => {
      expect(isValidTool('V')).toBe(true);
      expect(isValidTool('P')).toBe(true);
      expect(isValidTool('L')).toBe(true);
      expect(isValidTool('S')).toBe(true);
      expect(isValidTool('T')).toBe(true);
      expect(isValidTool('E')).toBe(true);
      expect(isValidTool('C')).toBe(true);
      expect(isValidTool('G')).toBe(true);
      expect(isValidTool('X')).toBe(true);
      expect(isValidTool('R')).toBe(true);
      expect(isValidTool('H')).toBe(true);

      // Invalid tools
      expect(isValidTool('Z')).toBe(false);
      expect(isValidTool('A')).toBe(false);
      expect(isValidTool('1')).toBe(false);
      expect(isValidTool(' ')).toBe(false);
      expect(isValidTool('')).toBe(false);
    });

    it('focus mode toggle (Ctrl+.) and collapse styling', () => {
      const onToggleFocusMode = vi.fn();
      const onSelectTool = vi.fn();

      const { container, root, cleanup } = createTestContainer();
      act(() => {
        root.render(
          <FloatingPillToolbar
            activeTool="V"
            onSelectTool={onSelectTool}
            focusMode={false}
            onToggleFocusMode={onToggleFocusMode}
          />
        );
      });

      // Press Ctrl+.
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: '.', ctrlKey: true, bubbles: true })
      );
      expect(onToggleFocusMode).toHaveBeenCalledTimes(1);

      // Re-render in focus mode
      act(() => {
        root.render(
          <FloatingPillToolbar
            activeTool="V"
            onSelectTool={onSelectTool}
            focusMode={true}
            onToggleFocusMode={onToggleFocusMode}
          />
        );
      });

      const toolbar = container.querySelector('[data-testid="floating-pill-toolbar"]') as HTMLElement;
      expect(toolbar.style.opacity).toBe('0');
      expect(toolbar.style.pointerEvents).toBe('none');
      expect(toolbar.style.transform).toBe('translate(-50%, 80px)');

      cleanup();
    });

    it('reduced motion 0ms vs default 150ms ease-out transitions', () => {
      const { container, root, cleanup } = createTestContainer();

      // Default (reducedMotion = false)
      act(() => {
        root.render(
          <FloatingPillToolbar
            activeTool="V"
            onSelectTool={() => {}}
            reducedMotion={false}
          />
        );
      });
      let toolbar = container.querySelector('[data-testid="floating-pill-toolbar"]') as HTMLElement;
      expect(toolbar.style.transition).toContain('150ms');

      // Reduced motion = true
      act(() => {
        root.render(
          <FloatingPillToolbar
            activeTool="V"
            onSelectTool={() => {}}
            reducedMotion={true}
          />
        );
      });
      toolbar = container.querySelector('[data-testid="floating-pill-toolbar"]') as HTMLElement;
      expect(toolbar.style.transition).toContain('0ms');

      cleanup();
    });

    it('input suppression: suppresses single-key tool activation inside input contexts', () => {
      // 1. Text inputs
      const input = document.createElement('input');
      expect(shouldSuppressToolShortcut(input)).toBe(true);

      const textarea = document.createElement('textarea');
      expect(shouldSuppressToolShortcut(textarea)).toBe(true);

      const select = document.createElement('select');
      expect(shouldSuppressToolShortcut(select)).toBe(true);

      // 2. contenteditable elements
      const ceDiv = document.createElement('div');
      ceDiv.setAttribute('contenteditable', 'true');
      expect(shouldSuppressToolShortcut(ceDiv)).toBe(true);

      const ceEmpty = document.createElement('div');
      ceEmpty.setAttribute('contenteditable', '');
      expect(shouldSuppressToolShortcut(ceEmpty)).toBe(true);

      // 3. CodeMirror & KaTeX containers
      const cmWrapper = document.createElement('div');
      cmWrapper.className = 'cm-editor';
      const cmToken = document.createElement('span');
      cmWrapper.appendChild(cmToken);
      expect(shouldSuppressToolShortcut(cmToken)).toBe(true);

      const katexWrapper = document.createElement('div');
      katexWrapper.className = 'katex-input';
      const katexChild = document.createElement('span');
      katexWrapper.appendChild(katexChild);
      expect(shouldSuppressToolShortcut(katexChild)).toBe(true);

      // 4. Regular canvas or generic div allows shortcuts
      const canvas = document.createElement('canvas');
      expect(shouldSuppressToolShortcut(canvas)).toBe(false);

      const normalDiv = document.createElement('div');
      expect(shouldSuppressToolShortcut(normalDiv)).toBe(false);
      expect(shouldSuppressToolShortcut(null)).toBe(false);
    });

    it('responsive compact mode below 600px', () => {
      expect(resolveToolbarMode(599)).toBe('compact');
      expect(resolveToolbarMode(320)).toBe('compact');
      expect(resolveToolbarMode(600)).toBe('expanded');
      expect(resolveToolbarMode(1440)).toBe('expanded');
    });
  });

  // =========================================================================
  // Challenge 4: Contextual Properties Bar Kinematics & Property Adaptation
  // =========================================================================
  describe('Challenge 4: Contextual Properties Bar Kinematics & Properties', () => {
    it('verifies 40px height and 8px offset positioning', () => {
      expect(CONTEXT_BAR_HEIGHT).toBe(40);
      expect(CONTEXT_BAR_OFFSET).toBe(8);

      const bounds = { x: 300, y: 400, w: 200, h: 100 };
      const pos = computeContextBarPosition(bounds);
      expect(pos.x).toBe(400); // 300 + 100
      expect(pos.y).toBe(352); // 400 - 40 - 8
    });

    it('top-edge viewport flip: flips below selection when natural Y < 60px', () => {
      // Natural Y: 100 - 48 = 52 (< 60) -> flips below
      const boundsAtTop: RectBounds = { x: 200, y: 100, w: 100, h: 80 };
      const placementFlipped = computeFullContextBarPlacement(boundsAtTop, 1920, 1080);
      // flippedY = bounds.y + bounds.h + 8 = 100 + 80 + 8 = 188
      expect(placementFlipped.y).toBe(188);

      // Natural Y: 120 - 48 = 72 (>= 60) -> stays above
      const boundsNormal: RectBounds = { x: 200, y: 120, w: 100, h: 80 };
      const placementNormal = computeFullContextBarPlacement(boundsNormal, 1920, 1080);
      expect(placementNormal.y).toBe(72);

      // Helper function computeContextBarPositionWithClamp
      expect(computeContextBarPositionWithClamp(20)).toBe(80);
      expect(computeContextBarPositionWithClamp(200)).toBe(152);
    });

    it('horizontal centering and clamping within [100, viewportW - 100]', () => {
      // Center of viewport (1920)
      expect(computeBarX(800, 320, 1920)).toBe(960);

      // Extreme left: clamped to 100
      expect(computeBarX(-500, 50, 1920)).toBe(100);
      expect(computeBarX(10, 20, 1920)).toBe(100);

      // Extreme right: clamped to 1820
      expect(computeBarX(1900, 100, 1920)).toBe(1820);
      expect(computeBarX(5000, 100, 1920)).toBe(1820);
    });

    it('offscreen selection vertical docking within [60, screenH - 60]', () => {
      expect(clampToScreen(-1000, 1080)).toBe(60);
      expect(clampToScreen(5000, 1080)).toBe(1020);
      expect(clampToScreen(500, 1080)).toBe(500);
    });

    it('multi-selection union bounds enclosing all selections', () => {
      const b1: RectBounds = { x: 10, y: 20, w: 30, h: 40 };
      const b2: RectBounds = { x: 100, y: 200, w: 50, h: 60 };
      const b3: RectBounds = { x: -20, y: -10, w: 15, h: 15 };

      const union = computeUnionBounds([b1, b2, b3]);
      expect(union.x).toBe(-20);
      expect(union.y).toBe(-10);
      expect(union.w).toBe(170); // from -20 to 150
      expect(union.h).toBe(270); // from -10 to 260

      expect(computeUnionBounds([])).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    });

    it('property-test: computeUnionBounds always encloses all input rects', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              x: fc.integer({ min: -1000, max: 1000 }),
              y: fc.integer({ min: -1000, max: 1000 }),
              w: fc.integer({ min: 1, max: 500 }),
              h: fc.integer({ min: 1, max: 500 }),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (rects) => {
            const union = computeUnionBounds(rects);
            for (const r of rects) {
              expect(union.x).toBeLessThanOrEqual(r.x);
              expect(union.y).toBeLessThanOrEqual(r.y);
              expect(union.x + union.w).toBeGreaterThanOrEqual(r.x + r.w);
              expect(union.y + union.h).toBeGreaterThanOrEqual(r.y + r.h);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('property adaptation: heterogeneous types show common properties and exclude fill', () => {
      const heterProps = getPropertiesForType(['shape', 'text']);
      expect(heterProps).toEqual(['color', 'align', 'delete']);
      expect(heterProps).not.toContain('fill');

      const shapeProps = getPropertiesForType('shape');
      expect(shapeProps).toContain('fill');
      expect(shapeProps).toContain('strokeWidth');

      const inkProps = getPropertiesForType('ink');
      expect(inkProps).toContain('convert');
      expect(inkProps).not.toContain('fill');

      const codeProps = getPropertiesForType('code');
      expect(codeProps).toContain('run');
      expect(codeProps).toContain('testTable');

      const textProps = getPropertiesForType('text');
      expect(textProps).toContain('font');
      expect(textProps).toContain('delete');

      expect(getPropertiesForType([])).toEqual([]);
      expect(getPropertiesForType(['shape'])).toEqual(shapeProps);
    });

    it('Escape key synchronously triggers onDeselectAll', () => {
      const onDeselectAll = vi.fn();
      const bounds: RectBounds = { x: 200, y: 300, w: 100, h: 50 };

      const { container, root, cleanup } = createTestContainer();
      act(() => {
        root.render(
          <ContextualPropertiesBar
            selectedIds={['obj-1']}
            selectionBounds={bounds}
            onDeselectAll={onDeselectAll}
          />
        );
      });

      expect(container.querySelector('[data-testid="contextual-properties-bar"]')).not.toBeNull();

      // Press Escape
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      );
      expect(onDeselectAll).toHaveBeenCalledTimes(1);

      cleanup();
    });

    it('returns null (not mounted) when selectedIds is empty or selectionBounds is null', () => {
      const { container, root, cleanup } = createTestContainer();

      act(() => {
        root.render(
          <ContextualPropertiesBar
            selectedIds={[]}
            selectionBounds={{ x: 100, y: 100, w: 50, h: 50 }}
          />
        );
      });
      expect(container.querySelector('[data-testid="contextual-properties-bar"]')).toBeNull();

      act(() => {
        root.render(
          <ContextualPropertiesBar
            selectedIds={['obj-1']}
            selectionBounds={null}
          />
        );
      });
      expect(container.querySelector('[data-testid="contextual-properties-bar"]')).toBeNull();

      cleanup();
    });
  });

  // =========================================================================
  // Challenge 5: Minimap Projection, Zero-Object Safety & Zoom Clamping
  // =========================================================================
  describe('Challenge 5: Minimap & Zoom Controls Boundary Behaviors', () => {
    it('calibrated to exact 160x100px dimensions', () => {
      expect(MINIMAP_WIDTH).toBe(160);
      expect(MINIMAP_HEIGHT).toBe(100);
    });

    it('zero-object document scale safety prevents NaN and returns finite 1.0', () => {
      const scaleZero = computeMinimapScale(0);
      expect(Number.isFinite(scaleZero)).toBe(true);
      expect(Number.isNaN(scaleZero)).toBe(false);
      expect(scaleZero).toBe(1.0);

      const scalePopulated = computeMinimapScale(50);
      expect(Number.isFinite(scalePopulated)).toBe(true);
      expect(scalePopulated).toBe(2.0);
    });

    it('projects click-to-jump camera coordinates correctly', () => {
      const bounds = { w: 160, h: 100, worldW: 3200, worldH: 2000, worldMinX: 0, worldMinY: 0 };
      const target = projectMinimapClickToWorld(80, 50, bounds);
      expect(target.worldX).toBe(1600);
      expect(target.worldY).toBe(1000);
    });

    it('camera coordinate clamping strictly bounds to [-50000, 50000]', () => {
      const extreme = clampCameraWorld(999999, -999999);
      expect(extreme.x).toBe(50000);
      expect(extreme.y).toBe(-50000);

      const inside = clampCameraWorld(1500, -2500);
      expect(inside.x).toBe(1500);
      expect(inside.y).toBe(-2500);
    });

    it('property-test: clampCameraWorld always produces coordinates within [-50000, 50000]', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1000000, max: 1000000 }),
          fc.integer({ min: -1000000, max: 1000000 }),
          (x, y) => {
            const clamped = clampCameraWorld(x, y);
            expect(clamped.x).toBeGreaterThanOrEqual(-50000);
            expect(clamped.x).toBeLessThanOrEqual(50000);
            expect(clamped.y).toBeGreaterThanOrEqual(-50000);
            expect(clamped.y).toBeLessThanOrEqual(50000);
          }
        ),
        { numRuns: 200 }
      );
    });

    it('Minimap DOM rendering for empty and populated states', () => {
      const onJumpCamera = vi.fn();
      const { container, root, cleanup } = createTestContainer();

      act(() => {
        root.render(
          <Minimap
            objectCount={0}
            onJumpCamera={onJumpCamera}
          />
        );
      });

      expect(container.textContent).toContain('Empty board');
      const minimap = container.querySelector('[data-testid="canvas-minimap"]') as HTMLElement;
      expect(minimap).not.toBeNull();
      expect(minimap.style.width).toBe('160px');
      expect(minimap.style.height).toBe('100px');

      cleanup();
    });

    it('ZoomControls clamps zoom strictly between [0.02, 64]', () => {
      expect(MIN_ZOOM).toBe(0.02);
      expect(MAX_ZOOM).toBe(64.0);

      expect(clampZoomValue(0.0001)).toBe(0.02);
      expect(clampZoomValue(9999)).toBe(64.0);
      expect(clampZoomValue(1.0)).toBe(1.0);
    });

    it('ZoomControls keyboard shortcuts: Ctrl+0 (Fit), Ctrl+1 (Reset), Ctrl+2 (Selection)', () => {
      const onFitAll = vi.fn();
      const onResetZoom = vi.fn();
      const onZoomToSelection = vi.fn();
      const onZoomChange = vi.fn();

      const { container, root, cleanup } = createTestContainer();
      act(() => {
        root.render(
          <ZoomControls
            zoom={1.5}
            onZoomChange={onZoomChange}
            onFitAll={onFitAll}
            onResetZoom={onResetZoom}
            onZoomToSelection={onZoomToSelection}
          />
        );
      });

      expect(container.querySelector('[data-testid="zoom-controls"]')).not.toBeNull();

      // Ctrl+0
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: '0', ctrlKey: true, bubbles: true })
      );
      expect(onFitAll).toHaveBeenCalledTimes(1);

      // Ctrl+1
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: '1', ctrlKey: true, bubbles: true })
      );
      expect(onResetZoom).toHaveBeenCalledTimes(1);

      // Ctrl+2
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: '2', ctrlKey: true, bubbles: true })
      );
      expect(onZoomToSelection).toHaveBeenCalledTimes(1);

      cleanup();
    });
  });

  // =========================================================================
  // Challenge 6: Suggestion Chips, Ghost Preview & Auto-Fade
  // =========================================================================
  describe('Challenge 6: Suggestion Chips & Ghost Preview', () => {
    const candidates: SuggestionCandidate[] = [
      { key: '1', kind: 'rect', label: 'Rectangle', confidence: 0.92, bounds: { x: 50, y: 50, w: 120, h: 80 } },
      { key: '2', kind: 'diamond', label: 'Diamond', confidence: 0.74, bounds: { x: 50, y: 50, w: 100, h: 100 } },
    ];

    it('keys 1, 2 select candidates; key 3 is safe no-op when index out of bounds', () => {
      expect(selectCandidate(candidates, '1')?.kind).toBe('rect');
      expect(selectCandidate(candidates, '2')?.kind).toBe('diamond');
      expect(selectCandidate(candidates, '3')).toBeNull();

      const onSelectCandidate = vi.fn();
      const onDismiss = vi.fn();

      const { container, root, cleanup } = createTestContainer();
      act(() => {
        root.render(
          <SuggestionChips
            candidates={candidates}
            onSelectCandidate={onSelectCandidate}
            onDismiss={onDismiss}
            autoFadeMs={4000}
          />
        );
      });

      expect(container.querySelector('[data-testid="suggestion-chips"]')).not.toBeNull();

      // Press key '1'
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: '1', bubbles: true })
      );
      expect(onSelectCandidate).toHaveBeenCalledWith(candidates[0]);

      // Press key '2'
      onSelectCandidate.mockClear();
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: '2', bubbles: true })
      );
      expect(onSelectCandidate).toHaveBeenCalledWith(candidates[1]);

      // Press key '3' (out of range, only 2 candidates) -> safe no-op!
      onSelectCandidate.mockClear();
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: '3', bubbles: true })
      );
      expect(onSelectCandidate).not.toHaveBeenCalled();

      cleanup();
    });

    it('auto-fades after 4000ms idle timer', () => {
      const onDismiss = vi.fn();

      const { container, root, cleanup } = createTestContainer();
      act(() => {
        root.render(
          <SuggestionChips
            candidates={candidates}
            onSelectCandidate={() => {}}
            onDismiss={onDismiss}
            autoFadeMs={4000}
          />
        );
      });

      expect(container.querySelector('[data-testid="suggestion-chips"]')).not.toBeNull();
      expect(onDismiss).not.toHaveBeenCalled();

      // Advance by 3999ms
      act(() => {
        vi.advanceTimersByTime(3999);
      });
      expect(onDismiss).not.toHaveBeenCalled();

      // Advance 1ms more -> 4000ms reached
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(onDismiss).toHaveBeenCalledTimes(1);

      cleanup();
    });

    it('unmounting SuggestionChips clears auto-fade timer without leaks', () => {
      const onDismiss = vi.fn();

      const { root, cleanup } = createTestContainer();
      act(() => {
        root.render(
          <SuggestionChips
            candidates={candidates}
            onSelectCandidate={() => {}}
            onDismiss={onDismiss}
            autoFadeMs={4000}
          />
        );
      });

      // Unmount before 4000ms
      cleanup();

      // Advance time
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(onDismiss).not.toHaveBeenCalled();
    });

    it('Ghost preview bounds safety: prevents crash on malformed or empty bounds', () => {
      expect(canRenderGhost(undefined)).toBe(false);
      expect(canRenderGhost({})).toBe(false);
      expect(canRenderGhost({ bounds: undefined })).toBe(false);
      expect(canRenderGhost({ bounds: { w: 0, h: 50 } })).toBe(false);
      expect(canRenderGhost({ bounds: { w: 50, h: 0 } })).toBe(false);
      expect(canRenderGhost({ bounds: { w: -10, h: 50 } })).toBe(false);
      expect(canRenderGhost({ bounds: { w: 100, h: 80 } })).toBe(true);
    });

    it('Ghost preview renders with 0.35 opacity and pointer-events none', () => {
      const { container, root, cleanup } = createTestContainer();
      act(() => {
        root.render(
          <GhostPreview
            visible={true}
            candidate={candidates[0]}
            opacity={0.35}
          />
        );
      });

      const preview = container.querySelector('[data-testid="ghost-preview"]') as HTMLElement;
      expect(preview).not.toBeNull();
      expect(preview.style.opacity).toBe('0.35');
      expect(preview.style.pointerEvents).toBe('none');
      expect(preview.style.width).toBe('120px');
      expect(preview.style.height).toBe('80px');

      cleanup();
    });
  });
});
