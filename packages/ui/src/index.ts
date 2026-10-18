/**
 * @lensboard/ui
 * React 18 floating chrome, design token matrix, and elevated UI style system.
 * Layer Invariants: Imports downward ONLY to @lensboard/render and @lensboard/core.
 * NEVER imports @lensboard/storage or @lensboard/desktop.
 */

import type { LensDocument } from '@lensboard/core';
import type { CanvasRenderer } from '@lensboard/render';
import type { ThemeName } from './tokens/themes.js';

// ============================================================================
// 1. Theme Matrix & Tokens (Milestone 2)
// ============================================================================
export {
  type ThemeName,
  type ThemeTokens,
  THEMES,
  getThemeTokens,
  isDarkTheme,
  generateThemeCssVariables,
  themeToCssString,
} from './tokens/themes.js';

// 2. WCAG Contrast
export {
  normalizeHex,
  hexToRgb,
  relativeLuminance,
  calculateContrastRatio,
  verifyWcagAA,
} from './tokens/contrast.js';

// 3. Pen Palette Hardening
export {
  type PenColorSlot,
  PEN_SLOTS,
  OKABE_ITO_PALETTE,
  OKABE_ITO_DARK_THEME_ADJUSTMENTS,
  getPenColor,
  clampStrokeWidth,
} from './tokens/palette.js';

// 4. Micro-Interactions System
export {
  MOTION_CURVE,
  MOTION_DURATIONS,
  resolveMotionDuration,
  clampTransitionDuration,
  resolveEasing,
} from './tokens/motion.js';

// 5. Dual-Channel DSA Visual Coding
export {
  type DSACellState,
  type DSAShapeCue,
  type DSACodingDefinition,
  type DSAGeometryCue,
  DSA_STATE_DEFINITIONS,
  resolveDSACellState,
  getDSACellGeometry,
} from './tokens/dsa.js';

// 6. Typography & Surfaces
export {
  TYPOGRAPHY,
  type FontFamilyKey,
  type FontSizeKey,
} from './tokens/typography.js';

export { SURFACES } from './tokens/surfaces.js';

// 7. UI Chrome Bridge (for desktop shell integration)
export interface UIChromeBridge {
  document: LensDocument | null;
  renderer: CanvasRenderer | null;
  activeTheme: ThemeName;
}

// ============================================================================
// Milestone 5: Floating Canvas Chrome & Interactive Controls (R3)
// ============================================================================

// Feature 24: Breadcrumbs & Tab Strip
export {
  type SaveState,
  type BoardTabItem,
  type BreadcrumbProps,
  type SaveIndicatorDotProps,
  type TabStripProps,
  SAVE_STATE_COLORS,
  SAVE_STATE_TOOLTIPS,
  SaveIndicatorDot,
  formatTitle,
  formatBreadcrumb,
  Breadcrumbs,
  truncateTabTitle,
  switchTabByIndex,
  handleTabCloseWithFallback,
  TabStrip,
} from './chrome/breadcrumbs/index.js';

// Feature 25: Floating Pill Toolbar
export {
  type ToolKey,
  type ToolDefinition,
  type FloatingPillToolbarProps,
  type ToolButtonProps,
  TOOLBAR_HEIGHT,
  BUTTON_SIZE,
  TOOLS,
  TOOL_KEYS,
  isValidTool,
  nextSlot,
  prevSlot,
  resolveToolbarMode,
  shouldSuppressToolShortcut,
  ToolButton,
  FloatingPillToolbar,
} from './chrome/toolbar/index.js';

// Feature 26: Contextual Properties Bar
export {
  type RectBounds,
  type PropertyItemKey,
  type ContextualPropertiesBarProps,
  CONTEXT_BAR_HEIGHT,
  CONTEXT_BAR_OFFSET,
  computeContextBarPosition,
  computeBarX,
  clampToScreen,
  computeContextBarPositionWithClamp,
  computeFullContextBarPlacement,
  computeUnionBounds,
  useContextBarPlacement,
  getPropertiesForType,
  ContextualPropertiesBar,
} from './chrome/context-bar/index.js';

// Feature 29: Suggestion Chips & Minimap
export {
  type SuggestionCandidate,
  type SuggestionChipsProps,
  type GhostPreviewProps,
  type MinimapBounds,
  type MinimapProps,
  type ZoomControlsProps,
  canRenderGhost,
  GhostPreview,
  selectCandidate,
  SuggestionChips,
  MINIMAP_WIDTH,
  MINIMAP_HEIGHT,
  clampCameraWorld,
  computeMinimapScale,
  projectMinimapClickToWorld,
  Minimap,
  MIN_ZOOM,
  MAX_ZOOM,
  clampZoomValue,
  ZoomControls,
} from './chrome/minimap/index.js';

// Feature 27: Collapsible Dual Drawers
export {
  type LeftDrawerSection,
  type RightDrawerSection,
  type DrawerState,
  type DrawerContainerProps,
  type LeftDrawerProps,
  type RightDrawerProps,
  DRAWER_WIDTH,
  MIN_DRAWER_WIDTH,
  MAX_DRAWER_WIDTH,
  LEFT_DRAWER_SECTIONS,
  RIGHT_DRAWER_SECTIONS,
  clampDrawerWidth,
  createInitialDrawerState,
  useDrawerState,
  DrawerContainer,
  LeftDrawer,
  RightDrawer,
} from './drawers/index.js';

// Feature 28: Command Palette & Menus
export {
  type CommandItem,
  type CommandPaletteProps,
  type SmartEntityOption,
  type InsertMenuProps,
  escapeRegex,
  safeSearch,
  fuzzyScore,
  fuzzySearchCommands,
  SMART_ENTITIES,
  CommandPalette,
  InsertMenu,
} from './palette/index.js';

// Feature 28 & §13 Overlays: Pie Menu & Toasts
export {
  type PieSlotName,
  type PieMenuProps,
  type ToastType,
  type ToastItem,
  type ToastContainerProps,
  PIE_SLOTS,
  PIE_MENU_CONFIG,
  resolvePieSlot,
  clampPieCenter,
  clampPiePosition,
  PieMenu,
  Toast,
  ToastContainer,
} from './overlays/index.js';
