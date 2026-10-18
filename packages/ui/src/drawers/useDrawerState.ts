import { useState, useCallback, useEffect } from 'react';
import type {
  DrawerState,
  LeftDrawerSection,
  RightDrawerSection,
} from './types.js';
import { shouldSuppressToolShortcut } from '../chrome/toolbar/FloatingPillToolbar.js';

export const DRAWER_WIDTH = 320;
export const MIN_DRAWER_WIDTH = 240;
export const MAX_DRAWER_WIDTH = 480;

export const LEFT_DRAWER_SECTIONS: readonly LeftDrawerSection[] = [
  'Outline',
  'Library',
  'Inbox',
] as const;

export const RIGHT_DRAWER_SECTIONS: readonly RightDrawerSection[] = [
  'Inspector',
  'Lenses',
  'Backlinks',
  'History',
] as const;

export function clampDrawerWidth(w: number): number {
  return Math.max(MIN_DRAWER_WIDTH, Math.min(MAX_DRAWER_WIDTH, w));
}

export function createInitialDrawerState(): DrawerState {
  return {
    leftOpen: false,
    rightOpen: false,
    leftSection: 'Outline',
    rightSection: 'Inspector',
    leftWidth: DRAWER_WIDTH,
    rightWidth: DRAWER_WIDTH,
    pinned: false,
    scrollPositions: { Outline: 0, Library: 0, Inbox: 0, Inspector: 0, Lenses: 0, Backlinks: 0, History: 0 },
  };
}

export function useDrawerState(screenWidth = 1920) {
  const [state, setState] = useState<DrawerState>(createInitialDrawerState);

  const toggleLeftDrawer = useCallback(
    (customScreenWidth = screenWidth) => {
      setState((prev) => {
        const nextLeft = !prev.leftOpen;
        let nextRight = prev.rightOpen;
        // Narrow screen (< 768px) mutual exclusion
        if (customScreenWidth < 768 && nextLeft && prev.rightOpen) {
          nextRight = false;
        }
        return {
          ...prev,
          leftOpen: nextLeft,
          rightOpen: nextRight,
        };
      });
    },
    [screenWidth]
  );

  const toggleRightDrawer = useCallback(
    (customScreenWidth = screenWidth) => {
      setState((prev) => {
        const nextRight = !prev.rightOpen;
        let nextLeft = prev.leftOpen;
        // Narrow screen (< 768px) mutual exclusion
        if (customScreenWidth < 768 && nextRight && prev.leftOpen) {
          nextLeft = false;
        }
        return {
          ...prev,
          leftOpen: nextLeft,
          rightOpen: nextRight,
        };
      });
    },
    [screenWidth]
  );

  const openLeftDrawer = useCallback(
    (customScreenWidth = screenWidth) => {
      setState((prev) => ({
        ...prev,
        leftOpen: true,
        rightOpen: customScreenWidth < 768 ? false : prev.rightOpen,
      }));
    },
    [screenWidth]
  );

  const openRightDrawer = useCallback(
    (customScreenWidth = screenWidth) => {
      setState((prev) => ({
        ...prev,
        rightOpen: true,
        leftOpen: customScreenWidth < 768 ? false : prev.leftOpen,
      }));
    },
    [screenWidth]
  );

  const closeLeftDrawer = useCallback(() => {
    setState((prev) => ({ ...prev, leftOpen: false }));
  }, []);

  const closeRightDrawer = useCallback(() => {
    setState((prev) => ({ ...prev, rightOpen: false }));
  }, []);

  const closeBothDrawers = useCallback(() => {
    setState((prev) => ({ ...prev, leftOpen: false, rightOpen: false }));
  }, []);

  const setLeftWidth = useCallback((w: number) => {
    setState((prev) => ({ ...prev, leftWidth: clampDrawerWidth(w) }));
  }, []);

  const setRightWidth = useCallback((w: number) => {
    setState((prev) => ({ ...prev, rightWidth: clampDrawerWidth(w) }));
  }, []);

  const setLeftSection = useCallback((sec: LeftDrawerSection) => {
    setState((prev) => ({ ...prev, leftSection: sec }));
  }, []);

  const setRightSection = useCallback((sec: RightDrawerSection) => {
    setState((prev) => ({ ...prev, rightSection: sec }));
  }, []);

  const setPinned = useCallback((pinned: boolean) => {
    setState((prev) => ({ ...prev, pinned }));
  }, []);

  const onCanvasClick = useCallback(
    (pinned = state.pinned) => {
      if (!pinned) {
        closeBothDrawers();
      }
    },
    [state.pinned, closeBothDrawers]
  );

  const setSectionScroll = useCallback((section: string, offset: number) => {
    setState((prev) => ({
      ...prev,
      scrollPositions: {
        ...prev.scrollPositions,
        [section]: offset,
      },
    }));
  }, []);

  // Keyboard shortcut listener for `[` and `]`
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (shouldSuppressToolShortcut(e.target)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === '[') {
        e.preventDefault();
        toggleLeftDrawer();
      } else if (e.key === ']') {
        e.preventDefault();
        toggleRightDrawer();
      } else if (e.key === 'Escape' && (state.leftOpen || state.rightOpen)) {
        e.preventDefault();
        closeBothDrawers();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.leftOpen, state.rightOpen, toggleLeftDrawer, toggleRightDrawer, closeBothDrawers]);

  return {
    state,
    toggleLeftDrawer,
    toggleRightDrawer,
    openLeftDrawer,
    openRightDrawer,
    closeLeftDrawer,
    closeRightDrawer,
    closeBothDrawers,
    setLeftWidth,
    setRightWidth,
    setLeftSection,
    setRightSection,
    setPinned,
    onCanvasClick,
    setSectionScroll,
  };
}
