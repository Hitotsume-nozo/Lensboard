/**
 * @lensboard/core - Shortcut Types and Default Bindings
 * Authoritative keyboard binding specifications conforming to §14.
 */

export type ShortcutContext = 'global' | 'canvas' | 'editor';

export interface ShortcutBinding {
  id: string;
  keys: string; // e.g. "Ctrl+K", "v", "["
  context: ShortcutContext;
  action: string;
  description?: string;
}

/**
 * Specification §14 Canonical Default Shortcut Bindings
 */
export const DEFAULT_SHORTCUT_BINDINGS: readonly ShortcutBinding[] = [
  // 1. Canvas Tools (Context: 'canvas')
  { id: 'tool-select', keys: 'V', context: 'canvas', action: 'select', description: 'Select tool' },
  { id: 'tool-pen', keys: 'P', context: 'canvas', action: 'pen', description: 'Pen tool' },
  { id: 'tool-line', keys: 'L', context: 'canvas', action: 'line', description: 'Line / Arrow tool' },
  { id: 'tool-shape', keys: 'S', context: 'canvas', action: 'shape', description: 'Shape tool' },
  { id: 'tool-text', keys: 'T', context: 'canvas', action: 'text', description: 'Text tool' },
  { id: 'tool-equation', keys: 'E', context: 'canvas', action: 'equation', description: 'Equation tool' },
  { id: 'tool-code', keys: 'C', context: 'canvas', action: 'code', description: 'Code block tool' },
  { id: 'tool-grid', keys: 'G', context: 'canvas', action: 'grid', description: 'Grid / Table tool' },
  { id: 'tool-eraser', keys: 'X', context: 'canvas', action: 'eraser', description: 'Eraser tool' },
  { id: 'tool-ruler', keys: 'R', context: 'canvas', action: 'ruler', description: 'Ruler tool' },
  { id: 'tool-hand', keys: 'H', context: 'canvas', action: 'hand', description: 'Hand (pan) tool' },

  // 2. Selection Actions (Context: 'canvas')
  { id: 'action-attach-note', keys: 'N', context: 'canvas', action: 'attachNote', description: 'Attach note' },
  { id: 'action-mark-flow', keys: 'F', context: 'canvas', action: 'markFlow', description: 'Mark flow step' },
  { id: 'action-convert-selection', keys: 'Ctrl+Enter', context: 'canvas', action: 'convertSelection', description: 'Convert selection' },
  { id: 'action-tidy-selection', keys: 'Ctrl+Shift+Enter', context: 'canvas', action: 'tidySelection', description: 'Tidy selection' },
  { id: 'action-duplicate', keys: 'Ctrl+D', context: 'canvas', action: 'duplicate', description: 'Duplicate selection' },
  { id: 'action-group', keys: 'Ctrl+G', context: 'canvas', action: 'group', description: 'Group selection' },
  { id: 'action-ungroup', keys: 'Ctrl+Shift+G', context: 'canvas', action: 'ungroup', description: 'Ungroup selection' },
  { id: 'action-delete', keys: 'Delete', context: 'canvas', action: 'deleteSelection', description: 'Delete selection' },
  { id: 'action-backspace', keys: 'Backspace', context: 'canvas', action: 'deleteSelection', description: 'Delete selection' },
  { id: 'action-edit', keys: 'Enter', context: 'canvas', action: 'editObject', description: 'Edit object' },
  { id: 'action-next-object', keys: 'Tab', context: 'canvas', action: 'nextObject', description: 'Next object' },
  { id: 'action-prev-object', keys: 'Shift+Tab', context: 'canvas', action: 'prevObject', description: 'Previous object' },
  { id: 'action-cancel', keys: 'Escape', context: 'canvas', action: 'cancel', description: 'Cancel / deselect' },

  // 3. History & Versioning (Context: 'global')
  { id: 'history-undo', keys: 'Ctrl+Z', context: 'global', action: 'undo', description: 'Undo' },
  { id: 'history-redo', keys: 'Ctrl+Shift+Z', context: 'global', action: 'redo', description: 'Redo' },
  { id: 'history-star-snapshot', keys: 'Ctrl+S', context: 'global', action: 'starSnapshot', description: 'Star snapshot' },

  // 4. Navigation & Zoom (Context: 'global')
  { id: 'nav-fit-all', keys: 'Ctrl+0', context: 'global', action: 'fitAll', description: 'Fit all' },
  { id: 'nav-zoom-100', keys: 'Ctrl+1', context: 'global', action: 'zoom100', description: '100% zoom' },
  { id: 'nav-zoom-selection', keys: 'Ctrl+2', context: 'global', action: 'zoomSelection', description: 'Zoom to selection' },
  { id: 'nav-next-tab', keys: 'Ctrl+Tab', context: 'global', action: 'nextTab', description: 'Next board tab' },
  { id: 'nav-new-tab', keys: 'Ctrl+T', context: 'global', action: 'newTab', description: 'New board tab' },
  { id: 'nav-close-tab', keys: 'Ctrl+W', context: 'global', action: 'closeTab', description: 'Close board tab' },
  { id: 'nav-toggle-left-drawer', keys: '[', context: 'global', action: 'toggleLeftDrawer', description: 'Toggle left drawer' },
  { id: 'nav-toggle-right-drawer', keys: ']', context: 'global', action: 'toggleRightDrawer', description: 'Toggle right drawer' },

  // 5. Palette & Insert (Context: 'global')
  { id: 'ui-insert-menu', keys: '/', context: 'global', action: 'insertMenu', description: 'Insert menu' },
  { id: 'ui-cmd-palette', keys: 'Ctrl+K', context: 'global', action: 'commandPalette', description: 'Command palette' },
  { id: 'ui-find-board', keys: 'Ctrl+F', context: 'global', action: 'findOnBoard', description: 'Find on board' },

  // 6. Clipboard & View (Context: 'global')
  { id: 'clip-copy', keys: 'Ctrl+C', context: 'global', action: 'copy', description: 'Copy' },
  { id: 'clip-cut', keys: 'Ctrl+X', context: 'global', action: 'cut', description: 'Cut' },
  { id: 'clip-paste', keys: 'Ctrl+V', context: 'global', action: 'paste', description: 'Paste' },
  { id: 'clip-copy-png', keys: 'Ctrl+Shift+C', context: 'global', action: 'copyAsPng', description: 'Copy selection as PNG' },
  { id: 'view-grid-snap', keys: "Ctrl+'", context: 'global', action: 'toggleGridSnap', description: 'Toggle grid snap' },
  { id: 'view-focus-mode', keys: 'Ctrl+.', context: 'global', action: 'toggleFocusMode', description: 'Toggle focus mode' },
  { id: 'view-session-recording', keys: 'Ctrl+Alt+Shift+R', context: 'global', action: 'saveRecording', description: 'Save session recording' },
] as const;
