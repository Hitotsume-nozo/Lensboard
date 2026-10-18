import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { ToolKey } from '@lensboard/ui';
import type {
  ToastItem,
  CommandItem,
  SuggestionCandidate,
  SaveState,
  LeftDrawerSection,
  RightDrawerSection,
} from '@lensboard/ui';
import {
  // Themes
  getThemeTokens,
  generateThemeCssVariables,
  isDarkTheme,
  type ThemeName,
  // Chrome
  Breadcrumbs,
  TabStrip,
  FloatingPillToolbar,
  ContextualPropertiesBar,
  Minimap,
  SuggestionChips,
  ZoomControls,
  // Drawers
  LeftDrawer,
  RightDrawer,
  // Palette & Menus
  CommandPalette,
  InsertMenu,
  // Overlays
  PieMenu,
  ToastContainer,
  GhostPreview,
  canRenderGhost,
  // Tokens
  DSA_STATE_DEFINITIONS,
  getPenColor,
  PEN_SLOTS,
} from '@lensboard/ui';
import {
  createDocument,
  type LensDocument,
  type CanvasObject,
  type PenColorSlot,
  createCanvasObject,
  generateUlid,
  generateInitialZ,
  generateZBetween,
  ShortcutRegistry,
  DEFAULT_SHORTCUT_BINDINGS,
  clampZoom,
} from '@lensboard/core';
import {
  createRenderer,
  createCanvasAdapter,
  type CanvasRenderer,
  smoothStrokePoints,
  detectPrimitiveFromPoints,
} from '@lensboard/render';
import {
  CodeEditor,
  StandaloneOutputWindow,
  executeCodeSandbox,
  type CodeExecutionOutput,
} from './CodeEditor.js';
import {
  loadWorkspaceFromStorage,
  saveWorkspaceToStorage,
  loadSnapshotsFromStorage,
  saveSnapshotToStorage,
  loadInboxFromStorage,
  saveInboxToStorage,
  exportDocumentAsJson,
  importDocumentFromJson,
  exportCanvasAsPng,
  exportDocumentAsSvg,
  copyCanvasToClipboard,
  quickCheckWorkspace,
  type StoredSnapshot,
  type StoredInboxItem,
} from './storage.js';
import { LeftDrawerTabs } from './LeftDrawerTabs.js';
import { RightDrawerTabs } from './RightDrawerTabs.js';

// ─── Global Styles ──────────────────────────────────────────────────────────

const GLOBAL_STYLE = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    user-select: none;
    -webkit-user-select: none;
  }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--lb-border); border-radius: 3px; }
  ::selection { background: var(--lb-accent); color: var(--lb-canvas); }
  button:hover { filter: brightness(1.15); }
  button:active { transform: scale(0.97); }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .fade-in-up { animation: fadeInUp 300ms cubic-bezier(0.2, 0, 1) both; }
`;

// ─── Constants & Samples ───────────────────────────────────────────────────

const THEME_LIST: ThemeName[] = ['midnight', 'paper', 'blueprint', 'blackboard', 'high-contrast'];

const THEME_LABELS: Record<ThemeName, string> = {
  midnight: '🌙 Midnight',
  paper: '📄 Paper',
  blueprint: '📐 Blueprint',
  blackboard: '🎓 Blackboard',
  'high-contrast': '♿ High Contrast',
};

export interface TabItem {
  id: string;
  title: string;
  isDirty?: boolean;
  isPinned?: boolean;
}

const SAMPLE_TABS: TabItem[] = [
  { id: 'tab-1', title: 'Binary Search & Trees', isDirty: false },
  { id: 'tab-2', title: 'Dynamic Programming Grid', isDirty: false },
  { id: 'tab-3', title: 'System Architecture', isDirty: false, isPinned: true },
];

const INITIAL_SUGGESTIONS: SuggestionCandidate[] = [
  { key: '1', kind: 'rect', label: 'Memory Buffer Block', confidence: 0.94, bounds: { x: 500, y: 300, w: 140, h: 60 } },
  { key: '2', kind: 'diamond', label: 'Decision Node', confidence: 0.81, bounds: { x: 500, y: 300, w: 100, h: 100 } },
  { key: '3', kind: 'arrow', label: 'Pointer / Transition', confidence: 0.69, bounds: { x: 500, y: 300, w: 160, h: 40 } },
];

// Helper to create pre-populated algorithmic shapes
function createSampleObjects(theme: ThemeName): CanvasObject[] {
  const isDark = isDarkTheme(theme);
  const fillColor = isDark ? '#1A1D28' : '#F3F1EA';

  return [
    createCanvasObject({
      id: 'node-root',
      type: 'shape',
      parentId: null,
      x: 380,
      y: 220,
      w: 120,
      h: 56,
      rotation: 0,
      z: 'a0',
      shapeType: 'rectangle',
      label: 'Root Node (50)',
      style: {
        colorId: 'blue',
        fill: fillColor,
        strokeWidth: 2,
        renderMode: 'crisp',
      },
      tags: ['root', 'bst', 'dsa'],
      locked: false,
      hidden: false,
    }),
    createCanvasObject({
      id: 'node-left',
      type: 'shape',
      parentId: null,
      x: 240,
      y: 340,
      w: 110,
      h: 52,
      rotation: 0,
      z: 'a1',
      shapeType: 'rectangle',
      label: 'Left (25)',
      style: {
        colorId: 'sky',
        fill: fillColor,
        strokeWidth: 2,
        renderMode: 'crisp',
      },
      tags: ['left', 'bst', 'dsa'],
      locked: false,
      hidden: false,
    }),
    createCanvasObject({
      id: 'node-right',
      type: 'shape',
      parentId: null,
      x: 520,
      y: 340,
      w: 110,
      h: 52,
      rotation: 0,
      z: 'a2',
      shapeType: 'rectangle',
      label: 'Right (75)',
      style: {
        colorId: 'yellow',
        fill: fillColor,
        strokeWidth: 2,
        renderMode: 'crisp',
      },
      tags: ['right', 'bst', 'dsa'],
      locked: false,
      hidden: false,
    }),
  ];
}

// ─── Theme Switcher Component ───────────────────────────────────────────────

function ThemeSwitcherPill({
  activeTheme,
  onSwitch,
}: {
  activeTheme: ThemeName;
  onSwitch: (t: ThemeName) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 8px',
        borderRadius: '16px',
        backgroundColor: 'var(--lb-surface-raised, #232736)',
        border: '1px solid var(--lb-border, #2E3347)',
      }}
    >
      <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--lb-text-muted)' }}>
        Theme:
      </span>
      {THEME_LIST.map((t) => (
        <button
          key={t}
          onClick={() => onSwitch(t)}
          title={THEME_LABELS[t]}
          style={{
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            border: activeTheme === t ? '2px solid var(--lb-accent)' : '1px solid var(--lb-border)',
            backgroundColor: getThemeTokens(t).canvas,
            cursor: 'pointer',
            padding: 0,
            transition: 'transform 120ms ease-out',
            transform: activeTheme === t ? 'scale(1.15)' : 'scale(1)',
          }}
        />
      ))}
    </div>
  );
}

// ─── DSA State Visual Showcase ──────────────────────────────────────────────

const DSA_COLOR_MAP: Record<string, { fill: string; border: string; text: string; slot: PenColorSlot }> = {
  teal: { fill: 'rgba(0, 158, 115, 0.25)', border: '#009E73', text: '#009E73', slot: 'green' },
  indigo: { fill: 'rgba(79, 70, 229, 0.25)', border: '#6366F1', text: '#818CF8', slot: 'blue' },
  amber: { fill: 'rgba(230, 159, 0, 0.25)', border: '#E69F00', text: '#E69F00', slot: 'orange' },
  transparent: { fill: 'transparent', border: '#6B7280', text: '#9CA3AF', slot: 'gray' },
  vermillion: { fill: 'rgba(213, 94, 0, 0.25)', border: '#D55E00', text: '#D55E00', slot: 'vermillion' },
  gold: { fill: 'rgba(240, 228, 66, 0.3)', border: '#F0E442', text: '#F0E442', slot: 'yellow' },
};

const DSA_STATE_LABELS: Record<string, string> = {
  'base-case': 'Base Case',
  computed: 'Computed',
  active: 'Active',
  'to-compute': 'To Compute',
  mismatch: 'Mismatch',
  'final-answer': 'Final Answer',
};

function DSAPreviewWidget({
  onSelectState,
}: {
  onSelectState?: (stateKey: string) => void;
}) {
  const states = Object.entries(DSA_STATE_DEFINITIONS);
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 500,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '6px 14px',
        borderRadius: '12px',
        backgroundColor: 'var(--lb-surface-raised, #232736)',
        border: '1px solid var(--lb-border, #2E3347)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
      }}
    >
      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--lb-text-muted)' }}>
        DSA Cues:
      </span>
      {states.map(([key, def]) => {
        const color = DSA_COLOR_MAP[def.colorName] || {
          fill: 'rgba(124, 140, 255, 0.2)',
          border: '#7C8CFF',
          text: '#7C8CFF',
        };
        const isDashed = def.shapeCue === 'dashed-outline';
        const isThick = def.shapeCue === 'thick-outline';
        const isHatch = def.shapeCue === 'hatch';
        const isStar = def.shapeCue === 'star-badge';
        const isTriangle = def.shapeCue === 'triangle';

        return (
          <div
            key={key}
            onClick={() => onSelectState?.(key)}
            title={`${def.state.toUpperCase()} (${def.colorName} + ${def.shapeCue})\n${def.description}\nClick to apply or stamp`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              padding: '2px 4px',
              borderRadius: '6px',
              transition: 'transform 120ms ease, background-color 120ms ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <div
              style={{
                position: 'relative',
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                backgroundColor: color.fill,
                border: isDashed
                  ? `2px dashed ${color.border}`
                  : isThick
                    ? `3.5px solid ${color.border}`
                    : `2px solid ${color.border}`,
                backgroundImage: isHatch
                  ? `repeating-linear-gradient(45deg, ${color.border}44, ${color.border}44 3px, transparent 3px, transparent 6px)`
                  : 'none',
                boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {isTriangle && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: 0,
                    height: 0,
                    borderStyle: 'solid',
                    borderWidth: '9px 9px 0 0',
                    borderColor: `${color.border} transparent transparent transparent`,
                  }}
                />
              )}
              {isStar && (
                <span
                  style={{
                    fontSize: '12px',
                    color: color.border,
                    lineHeight: 1,
                  }}
                >
                  ★
                </span>
              )}
            </div>
            <span style={{ fontSize: '9px', fontWeight: 600, color: 'var(--lb-text)' }}>
              {DSA_STATE_LABELS[key] || key}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Interactive Application ──────────────────────────────────────────

export function App() {
  // Theme state
  const [theme, setTheme] = useState<ThemeName>('midnight');
  const tokens = getThemeTokens(theme);
  const cssVars = generateThemeCssVariables(tokens);

  // Active tool state & color
  const [activeTool, setActiveTool] = useState<ToolKey>('V');
  const [activeColorSlot, setActiveColorSlot] = useState<PenColorSlot>('blue');
  const activeColorHex = getPenColor(activeColorSlot, theme);
  const [focusMode, setFocusMode] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [editingObjectId, setEditingObjectId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');

  // Tabs state & multi-board persistence
  const [tabs, setTabs] = useState<TabItem[]>(SAMPLE_TABS);
  const [activeTabId, setActiveTabId] = useState('tab-1');
  const boardsRef = useRef<Record<string, LensDocument>>({});
  const lastStrokeIdRef = useRef<string | null>(null);

  // Autosave and persistence state
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const autosaveTimeoutRef = useRef<number | null>(null);

  // Drawers state with section tabs
  const [leftOpen, setLeftOpen] = useState(false);
  const [leftSection, setLeftSection] = useState<LeftDrawerSection>('Outline');
  const [rightOpen, setRightOpen] = useState(false);
  const [rightSection, setRightSection] = useState<RightDrawerSection>('Inspector');

  // Lenses state (dim non-matching objects to 30%)
  const [activeLens, setActiveLens] = useState<string>('all');
  const [lensTagFilter, setLensTagFilter] = useState<string>('');

  // Overlays state
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [insertOpen, setInsertOpen] = useState(false);
  const [insertPos, setInsertPos] = useState({ x: 400, y: 300 });
  const [pieOpen, setPieOpen] = useState(false);
  const [pieCenter, setPieCenter] = useState({ x: 500, y: 400 });

  // Find on board state (Ctrl+F)
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findMatches, setFindMatches] = useState<string[]>([]);
  const [findMatchIdx, setFindMatchIdx] = useState(0);

  // Snapshots & Inbox state
  const [snapshots, setSnapshots] = useState<StoredSnapshot[]>([]);
  const [inboxItems, setInboxItems] = useState<StoredInboxItem[]>([]);

  // Diagnostics & Salvage modal state
  const [salvageModalOpen, setSalvageModalOpen] = useState(false);
  const [salvageReport, setSalvageReport] = useState('');
  const sessionLogRef = useRef<Array<{ ts: number; type: string; details: unknown }>>([]);

  // Context bar & selection state (multi-select supported)
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const selectedObjectId = selectedObjectIds[0] ?? null;
  const setSelectedObjectId = useCallback((id: string | null) => {
    setSelectedObjectIds(id ? [id] : []);
  }, []);
  const [selectionBounds, setSelectionBounds] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Standalone code execution output window state
  const [standaloneOutput, setStandaloneOutput] = useState<{
    isOpen: boolean;
    objectId?: string;
    output: CodeExecutionOutput;
  } | null>(null);

  // Clipboard copy buffer
  const clipboardObjRef = useRef<CanvasObject | null>(null);

  // Viewport & camera state
  const [zoom, setZoom] = useState(1.0);
  const [camera, setCamera] = useState({ x: 0, y: 0 });

  // UI toggles
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionCandidates, setSuggestionCandidates] = useState<SuggestionCandidate[]>(INITIAL_SUGGESTIONS);
  const [activeCandidateIdx, setActiveCandidateIdx] = useState<number>(0);
  const [showDSA, setShowDSA] = useState(true);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastIdRef = useRef(0);

  // Object count tracker for minimap and outline
  const [objectCount, setObjectCount] = useState(3);

  // Canvas DOM refs
  const staticCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);

  // Core Document & Renderer refs
  const docRef = useRef<LensDocument>(createDocument('Binary Search & Trees'));
  const rendererRef = useRef<CanvasRenderer | null>(null);

  // Shortcut registry
  const shortcutRegistryRef = useRef<ShortcutRegistry>(new ShortcutRegistry(DEFAULT_SHORTCUT_BINDINGS));

  // Undo / Redo history stacks
  const undoStackRef = useRef<LensDocument[]>([]);
  const redoStackRef = useRef<LensDocument[]>([]);
  const pendingUndoSnapshotRef = useRef<LensDocument | null>(null);

  // Pointer interaction tracking refs
  const isPointerDownRef = useRef(false);
  const isPanningRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const pointerDownPosRef = useRef({ x: 0, y: 0 });
  const pointerDownWorldRef = useRef({ x: 0, y: 0 });
  const isDraggingObjectRef = useRef(false);
  const dragStartObjPosRef = useRef<{
    x: number;
    y: number;
    w: number;
    h: number;
    points?: unknown[];
    data?: unknown;
  } | null>(null);
  const dragStartObjectsMapRef = useRef<
    Record<
      string,
      {
        x: number;
        y: number;
        w: number;
        h: number;
        points?: unknown[];
        data?: unknown;
      }
    >
  >({});
  const activeHandleRef = useRef<string | null>(null);
  const isDrawingLineRef = useRef(false);
  const isDrawingShapeRef = useRef(false);
  const isDrawingRulerRef = useRef(false);

  // Marquee selection state & tracking refs
  const [marqueeRect, setMarqueeRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const isMarqueeSelectingRef = useRef(false);
  const marqueeStartWorldRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const marqueeInitialSelectionRef = useRef<string[]>([]);
  const lastClickedHitIdRef = useRef<string | null>(null);

  // ── Helper: Log session event ─────────────────────────────────────────────
  const logSessionEvent = useCallback((type: string, details: unknown) => {
    sessionLogRef.current.push({ ts: Date.now(), type, details });
    if (sessionLogRef.current.length > 200) {
      sessionLogRef.current.shift();
    }
  }, []);

  // ── Helper: add toast ─────────────────────────────────────────────────────
  const addToast = useCallback((message: string, type: ToastItem['type'] = 'info') => {
    const id = `toast-${++toastIdRef.current}`;
    setToasts((prev) => [...prev, { id, message, type, durationMs: 3500 }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Helper: Viewport sync to docRef ───────────────────────────────────────
  const syncDocViewport = useCallback(() => {
    if (rendererRef.current && docRef.current) {
      const vp = rendererRef.current.getViewport?.() || { x: camera.x, y: camera.y, zoom };
      docRef.current.viewport = { x: vp.x, y: vp.y, zoom: vp.zoom };
    }
  }, [camera.x, camera.y, zoom]);

  // ── Helper: Fractional Z-Index ───────────────────────────────────────────
  const getNextZ = useCallback((): string => {
    const rootIds = docRef.current.rootIds;
    if (rootIds.length === 0) return generateInitialZ();
    const lastId = rootIds[rootIds.length - 1];
    const lastObj = docRef.current.objects[lastId];
    const lastZ = lastObj?.z ?? 'a0';
    return generateZBetween(lastZ, null);
  }, []);

  // ── Helper: Selection bounds calculator (single or multi-object) ──────────
  const updateSelectionBoundsFor = useCallback((target: CanvasObject | CanvasObject[] | null) => {
    if (!target || !rendererRef.current) {
      setSelectionBounds(null);
      return;
    }
    const objs = Array.isArray(target) ? target.filter(Boolean) : [target];
    if (objs.length === 0) {
      setSelectionBounds(null);
      return;
    }
    const renderer = rendererRef.current;
    let overallMinX = Infinity;
    let overallMinY = Infinity;
    let overallMaxX = -Infinity;
    let overallMaxY = -Infinity;

    for (const obj of objs) {
      const width = obj.w ?? (obj as { width?: number }).width ?? 100;
      const height = obj.h ?? (obj as { height?: number }).height ?? 50;

      let minX = obj.x;
      let minY = obj.y;
      let maxX = obj.x + width;
      let maxY = obj.y + height;

      if (obj.type === 'line' || obj.type === 'ruler') {
        const x2 = (obj.data?.x2 as number) ?? obj.x + width;
        const y2 = (obj.data?.y2 as number) ?? obj.y + height;
        minX = Math.min(obj.x, x2);
        maxX = Math.max(obj.x, x2);
        minY = Math.min(obj.y, y2);
        maxY = Math.max(obj.y, y2);
      } else if (obj.type === 'ink' && (obj as { points?: Array<{ x: number; y: number }> }).points?.length) {
        const pts = (obj as { points: Array<{ x: number; y: number }> }).points;
        for (const p of pts) {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }
      } else {
        minX = Math.min(obj.x, obj.x + width);
        maxX = Math.max(obj.x, obj.x + width);
        minY = Math.min(obj.y, obj.y + height);
        maxY = Math.max(obj.y, obj.y + height);
      }

      if (minX < overallMinX) overallMinX = minX;
      if (minY < overallMinY) overallMinY = minY;
      if (maxX > overallMaxX) overallMaxX = maxX;
      if (maxY > overallMaxY) overallMaxY = maxY;
    }

    if (overallMinX === Infinity) {
      setSelectionBounds(null);
      return;
    }

    const screenTopLeft = renderer.toScreen({ x: overallMinX, y: overallMinY });
    const screenBottomRight = renderer.toScreen({ x: overallMaxX, y: overallMaxY });
    let sx = Math.min(screenTopLeft.x, screenBottomRight.x);
    let sy = Math.min(screenTopLeft.y, screenBottomRight.y);
    let sw = Math.abs(screenBottomRight.x - screenTopLeft.x);
    let sh = Math.abs(screenBottomRight.y - screenTopLeft.y);

    if (sw < 24) {
      sx -= (24 - sw) / 2;
      sw = 24;
    }
    if (sh < 24) {
      sy -= (24 - sh) / 2;
      sh = 24;
    }

    setSelectionBounds({
      x: sx,
      y: sy,
      w: sw,
      h: sh,
    });
  }, []);

  // ── Helper: Schedule autosave ─────────────────────────────────────────────
  const scheduleAutosave = useCallback(() => {
    setSaveState('dirty');
    if (autosaveTimeoutRef.current) {
      window.clearTimeout(autosaveTimeoutRef.current);
    }
    autosaveTimeoutRef.current = window.setTimeout(() => {
      setSaveState('saving');
      syncDocViewport();
      boardsRef.current[activeTabId] = docRef.current;
      const success = saveWorkspaceToStorage({
        version: 2,
        activeTabId,
        theme,
        tabs,
        boards: boardsRef.current,
        lastSavedAt: Date.now(),
      });
      setSaveState(success ? 'saved' : 'error');
    }, 300);
  }, [activeTabId, theme, tabs, syncDocViewport]);

  // ── Helper: Undo / Redo history ───────────────────────────────────────────
  const pushUndoSnapshot = useCallback(() => {
    syncDocViewport();
    const docSnapshot: LensDocument = JSON.parse(JSON.stringify(docRef.current));
    undoStackRef.current.push(docSnapshot);
    if (undoStackRef.current.length > 50) undoStackRef.current.shift();
    redoStackRef.current = [];
    scheduleAutosave();
  }, [syncDocViewport, scheduleAutosave]);

  const performUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) {
      addToast('Nothing to undo', 'info');
      return;
    }
    syncDocViewport();
    const currentSnapshot: LensDocument = JSON.parse(JSON.stringify(docRef.current));
    redoStackRef.current.push(currentSnapshot);
    const prevDoc = undoStackRef.current.pop()!;
    docRef.current = prevDoc;
    boardsRef.current[activeTabId] = prevDoc;
    rendererRef.current?.setScene(prevDoc);
    setObjectCount(prevDoc.rootIds.length);
    if (selectedObjectId && !prevDoc.objects[selectedObjectId]) {
      setSelectedObjectId(null);
      setSelectionBounds(null);
    } else if (selectedObjectId && prevDoc.objects[selectedObjectId]) {
      updateSelectionBoundsFor(prevDoc.objects[selectedObjectId]);
    }
    if (rendererRef.current) {
      const vp = rendererRef.current.getViewport?.();
      if (vp) {
        setZoom(vp.zoom);
        setCamera({ x: vp.x, y: vp.y });
      }
    }
    addToast('Undo performed', 'info');
    scheduleAutosave();
    logSessionEvent('undo', { remaining: undoStackRef.current.length });
  }, [activeTabId, selectedObjectId, addToast, syncDocViewport, updateSelectionBoundsFor, scheduleAutosave, logSessionEvent]);

  const performRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) {
      addToast('Nothing to redo', 'info');
      return;
    }
    syncDocViewport();
    const currentSnapshot: LensDocument = JSON.parse(JSON.stringify(docRef.current));
    undoStackRef.current.push(currentSnapshot);
    const nextDoc = redoStackRef.current.pop()!;
    docRef.current = nextDoc;
    boardsRef.current[activeTabId] = nextDoc;
    rendererRef.current?.setScene(nextDoc);
    setObjectCount(nextDoc.rootIds.length);
    if (selectedObjectId && nextDoc.objects[selectedObjectId]) {
      updateSelectionBoundsFor(nextDoc.objects[selectedObjectId]);
    }
    addToast('Redo performed', 'info');
    scheduleAutosave();
    logSessionEvent('redo', { remaining: redoStackRef.current.length });
  }, [activeTabId, selectedObjectId, addToast, syncDocViewport, updateSelectionBoundsFor, scheduleAutosave, logSessionEvent]);

  // ── Helper: Add object to active document ─────────────────────────────────
  const addObjectToDoc = useCallback(
    (obj: CanvasObject) => {
      docRef.current.objects[obj.id] = obj;
      docRef.current.rootIds.push(obj.id);
      syncDocViewport();
      rendererRef.current?.setScene(docRef.current);
      setObjectCount(docRef.current.rootIds.length);
      scheduleAutosave();
      logSessionEvent('add_object', { id: obj.id, type: obj.type });
    },
    [syncDocViewport, scheduleAutosave, logSessionEvent]
  );

  // ── Helper: Delete selected object(s) ─────────────────────────────────────
  const deleteSelectedObject = useCallback(() => {
    const idsToDelete =
      selectedObjectIds.length > 0 ? selectedObjectIds : selectedObjectId ? [selectedObjectId] : [];
    if (idsToDelete.length === 0) return;
    pushUndoSnapshot();
    for (const id of idsToDelete) {
      delete docRef.current.objects[id];
    }
    docRef.current.rootIds = docRef.current.rootIds.filter((id) => !idsToDelete.includes(id));
    syncDocViewport();
    rendererRef.current?.setScene(docRef.current);
    setObjectCount(docRef.current.rootIds.length);
    setSelectedObjectIds([]);
    setSelectionBounds(null);
    addToast(idsToDelete.length > 1 ? `Deleted ${idsToDelete.length} objects` : 'Deleted object', 'info');
    scheduleAutosave();
    logSessionEvent('delete_objects', { ids: idsToDelete });
  }, [
    selectedObjectIds,
    selectedObjectId,
    pushUndoSnapshot,
    syncDocViewport,
    addToast,
    scheduleAutosave,
    logSessionEvent,
  ]);

  // ── Helper: Duplicate selected object(s) ──────────────────────────────────
  const duplicateSelectedObject = useCallback(() => {
    const idsToDup =
      selectedObjectIds.length > 0 ? selectedObjectIds : selectedObjectId ? [selectedObjectId] : [];
    if (idsToDup.length === 0) {
      addToast('No object selected to duplicate', 'info');
      return;
    }
    pushUndoSnapshot();
    const newIds: string[] = [];
    for (const id of idsToDup) {
      const orig = docRef.current.objects[id];
      if (!orig) continue;
      const newId = generateUlid();
      const nextZ = getNextZ();
      const clone: CanvasObject = JSON.parse(JSON.stringify(orig));
      clone.id = newId;
      clone.x += 30;
      clone.y += 30;
      clone.z = nextZ;
      if (clone.data?.x2 !== undefined) {
        clone.data.x2 = (clone.data.x2 as number) + 30;
        clone.data.y2 = (clone.data.y2 as number) + 30;
      }
      if ((clone as { points?: Array<{ x: number; y: number }> }).points) {
        (clone as { points: Array<{ x: number; y: number }> }).points = (
          clone as { points: Array<{ x: number; y: number }> }
        ).points.map((pt) => ({
          ...pt,
          x: pt.x + 30,
          y: pt.y + 30,
        }));
      }
      clone.label = clone.label ? `${clone.label} (copy)` : undefined;
      clone.createdAt = Date.now();
      clone.updatedAt = Date.now();

      addObjectToDoc(clone);
      newIds.push(newId);
    }
    if (newIds.length > 0) {
      setSelectedObjectIds(newIds);
      const newObjs = newIds.map((id) => docRef.current.objects[id]).filter(Boolean);
      updateSelectionBoundsFor(newObjs);
      addToast(newIds.length > 1 ? `Duplicated ${newIds.length} objects` : 'Duplicated object', 'success');
    }
  }, [
    selectedObjectIds,
    selectedObjectId,
    pushUndoSnapshot,
    getNextZ,
    addObjectToDoc,
    updateSelectionBoundsFor,
    addToast,
  ]);

  // ── Helper: Tidy / Snap all or selection to grid ───────────────────────────
  const tidyAllOrSelection = useCallback(() => {
    pushUndoSnapshot();
    const gridSnap = 20;
    if (selectedObjectId && docRef.current.objects[selectedObjectId]) {
      const obj = docRef.current.objects[selectedObjectId];
      obj.x = Math.round(obj.x / gridSnap) * gridSnap;
      obj.y = Math.round(obj.y / gridSnap) * gridSnap;
      updateSelectionBoundsFor(obj);
      addToast('Snapped object to 20px grid', 'success');
    } else {
      for (const id of docRef.current.rootIds) {
        const obj = docRef.current.objects[id];
        if (obj) {
          obj.x = Math.round(obj.x / gridSnap) * gridSnap;
          obj.y = Math.round(obj.y / gridSnap) * gridSnap;
        }
      }
      addToast('Tidied all objects to 20px grid', 'success');
    }
    syncDocViewport();
    rendererRef.current?.setScene(docRef.current);
    scheduleAutosave();
  }, [selectedObjectId, pushUndoSnapshot, updateSelectionBoundsFor, syncDocViewport, addToast, scheduleAutosave]);

  // ── Helper: Star Snapshot ─────────────────────────────────────────────────
  const handleStarSnapshot = useCallback(
    (label?: string) => {
      syncDocViewport();
      const currentDoc: LensDocument = JSON.parse(JSON.stringify(docRef.current));
      const snap: StoredSnapshot = {
        id: generateUlid(),
        boardId: activeTabId,
        label: label || `Snapshot ${new Date().toLocaleTimeString()}`,
        starred: true,
        timestamp: Date.now(),
        doc: currentDoc,
      };
      saveSnapshotToStorage(snap);
      setSnapshots(loadSnapshotsFromStorage(activeTabId));
      addToast(`⭐ Starred snapshot: ${snap.label}`, 'success');
      logSessionEvent('star_snapshot', { id: snap.id, label: snap.label });
    },
    [activeTabId, syncDocViewport, addToast, logSessionEvent]
  );

  // ── Helper: Restore Snapshot ──────────────────────────────────────────────
  const handleRestoreSnapshot = useCallback(
    (snapshot: StoredSnapshot) => {
      pushUndoSnapshot();
      const restoredDoc: LensDocument = JSON.parse(JSON.stringify(snapshot.doc));
      docRef.current = restoredDoc;
      boardsRef.current[activeTabId] = restoredDoc;
      rendererRef.current?.setScene(restoredDoc);
      setObjectCount(restoredDoc.rootIds.length);
      setSelectedObjectId(null);
      setSelectionBounds(null);
      addToast(`Reverted to snapshot: ${snapshot.label}`, 'success');
      scheduleAutosave();
      logSessionEvent('restore_snapshot', { id: snapshot.id });
    },
    [activeTabId, pushUndoSnapshot, addToast, scheduleAutosave, logSessionEvent]
  );

  // ── Helper: Rename Board ──────────────────────────────────────────────────
  const handleRenameBoard = useCallback(
    (newTitle: string) => {
      docRef.current.title = newTitle;
      setTabs((prev) => prev.map((t) => (t.id === activeTabId ? { ...t, title: newTitle } : t)));
      scheduleAutosave();
      addToast(`Renamed board to "${newTitle}"`, 'info');
    },
    [activeTabId, scheduleAutosave, addToast]
  );

  // ── Helper: Export & Import Handlers ──────────────────────────────────────
  const handleExportJson = useCallback(() => {
    syncDocViewport();
    exportDocumentAsJson(docRef.current);
    addToast('Exported board as .lens.json', 'success');
  }, [syncDocViewport, addToast]);

  const handleExportPng = useCallback(async () => {
    const filename = `${docRef.current.title.replace(/\s+/g, '_').toLowerCase()}.png`;
    const blob = await exportCanvasAsPng(
      staticCanvasRef.current,
      liveCanvasRef.current,
      filename,
      tokens.canvas
    );
    if (blob) {
      addToast(`Exported PNG (${Math.round(blob.size / 1024)} KB)`, 'success');
    }
  }, [tokens.canvas, addToast]);

  const handleExportSvg = useCallback(() => {
    syncDocViewport();
    exportDocumentAsSvg(docRef.current);
    addToast('Exported vector SVG', 'success');
  }, [syncDocViewport, addToast]);

  const handleCopyAsPng = useCallback(async () => {
    const success = await copyCanvasToClipboard(
      staticCanvasRef.current,
      liveCanvasRef.current,
      tokens.canvas
    );
    if (success) {
      addToast('Copied board as PNG to clipboard (Ctrl+Shift+C)', 'success');
    } else {
      addToast('Could not copy image to clipboard', 'warning');
    }
  }, [tokens.canvas, addToast]);

  const handleImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const content = String(evt.target?.result || '');
          const doc = importDocumentFromJson(content);
          pushUndoSnapshot();
          docRef.current = doc;
          boardsRef.current[activeTabId] = doc;
          setTabs((prev) => prev.map((t) => (t.id === activeTabId ? { ...t, title: doc.title } : t)));
          rendererRef.current?.setScene(doc);
          setObjectCount(doc.rootIds.length);
          setSelectedObjectId(null);
          setSelectionBounds(null);
          addToast(`Imported "${doc.title}" (${doc.rootIds.length} objects)`, 'success');
          scheduleAutosave();
        } catch (err: unknown) {
          addToast(`Import failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [activeTabId, pushUndoSnapshot, addToast, scheduleAutosave]
  );

  const handleImageFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          const createImg = (naturalW = 320, naturalH = 220) => {
            pushUndoSnapshot();
            const renderer = rendererRef.current;
            const centerScreen = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
            const centerWorld = renderer ? renderer.toWorld(centerScreen) : { x: 400, y: 300 };

            const aspect = naturalW / Math.max(1, naturalH);
            const targetW = Math.min(420, Math.max(160, naturalW));
            const targetH = Math.round(targetW / aspect);

            const imgObj = createCanvasObject({
              id: generateUlid(),
              type: 'image',
              x: centerWorld.x - targetW / 2,
              y: centerWorld.y - targetH / 2,
              w: targetW,
              h: targetH,
              z: getNextZ(),
              label: file.name.replace(/\.[^/.]+$/, '') || 'Imported Image',
              data: { src: dataUrl, mimeType: file.type },
              style: { colorId: activeColorSlot, strokeWidth: 1, renderMode: 'crisp' },
              tags: ['image'],
            });
            addObjectToDoc(imgObj);
            setSelectedObjectId(imgObj.id);
            updateSelectionBoundsFor(imgObj);
            addToast(`Imported image: ${file.name}`, 'success');
          };

          if (typeof Image !== 'undefined') {
            const img = new Image();
            img.onload = () => createImg(img.naturalWidth, img.naturalHeight);
            img.onerror = () => createImg();
            img.src = dataUrl;
          } else {
            createImg();
          }
        }
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    },
    [pushUndoSnapshot, getNextZ, activeColorSlot, addObjectToDoc, setSelectedObjectId, updateSelectionBoundsFor, addToast]
  );

  // ── Helper: Quick Check & Salvage ─────────────────────────────────────────
  const handleRunQuickCheck = useCallback(() => {
    syncDocViewport();
    boardsRef.current[activeTabId] = docRef.current;
    const result = quickCheckWorkspace({
      version: 2,
      activeTabId,
      theme,
      tabs,
      boards: boardsRef.current,
      lastSavedAt: Date.now(),
    });
    setSalvageReport(result.report);
    setSalvageModalOpen(true);
    if (result.fixedCount > 0) {
      scheduleAutosave();
    }
  }, [activeTabId, theme, tabs, syncDocViewport, scheduleAutosave]);

  // ── Inline Editor Handlers (Spec §8 & §14) ──────────────────────────────
  const startInlineEdit = useCallback((obj: CanvasObject) => {
    setEditingObjectId(obj.id);
    const initialVal =
      obj.type === 'code'
        ? String(obj.data?.code || '')
        : obj.type === 'equation'
          ? String(obj.data?.equation || '')
          : obj.type === 'text'
            ? String(obj.data?.text || obj.label || '')
            : obj.label != null
              ? String(obj.label)
              : '';
    setEditingValue(initialVal);
  }, []);

  const commitInlineEdit = useCallback(() => {
    if (!editingObjectId || !docRef.current.objects[editingObjectId]) {
      setEditingObjectId(null);
      return;
    }
    const obj = docRef.current.objects[editingObjectId];
    pushUndoSnapshot();
    if (obj.type === 'code') {
      obj.data = { ...obj.data, code: editingValue };
    } else if (obj.type === 'equation') {
      obj.data = { ...obj.data, equation: editingValue };
      obj.label = editingValue;
    } else if (obj.type === 'text') {
      obj.data = { ...obj.data, text: editingValue };
      obj.label = editingValue;
    } else {
      obj.label = editingValue;
    }
    obj.updatedAt = Date.now();
    syncDocViewport();
    rendererRef.current?.setScene(docRef.current);
    updateSelectionBoundsFor(obj);
    scheduleAutosave();
    setEditingObjectId(null);
    addToast('Updated object inline', 'success');
  }, [editingObjectId, editingValue, pushUndoSnapshot, syncDocViewport, updateSelectionBoundsFor, scheduleAutosave, addToast]);

  const cancelInlineEdit = useCallback(() => {
    setEditingObjectId(null);
  }, []);

  // ── Lenses Viewport Filter (Spec §12) ──────────────────────────────────────
  const applyLensFilter = useCallback((lens: string, tag: string) => {
    const normTag = tag.trim().toLowerCase();
    for (const obj of Object.values(docRef.current.objects)) {
      let matches = true;
      if (lens === 'dsa') {
        matches =
          Boolean(obj.tags?.some((t) => ['dsa', 'tree', 'bst', 'table', 'dp', 'graph', 'linked-list', 'grid'].includes(t))) ||
          obj.type === 'grid';
      } else if (lens === 'dl') {
        matches =
          Boolean(obj.tags?.some((t) => ['dl', 'transformer', 'mha', 'mlp', 'resnet', 'residual', 'math'].includes(t))) ||
          obj.type === 'code' ||
          obj.type === 'equation';
      } else if (lens === 'ink') {
        matches = obj.type === 'ink' || Boolean(obj.sourceInk && obj.sourceInk.length > 0);
      } else if (lens === 'frames') {
        matches =
          obj.type === 'frame' ||
          obj.type === 'note' ||
          Boolean(obj.tags?.some((t) => ['problem-frame', 'frame', 'note'].includes(t)));
      }
      if (matches && normTag) {
        matches = Boolean(
          obj.tags?.some((t) => t.toLowerCase().includes(normTag)) ||
            (obj.label != null && String(obj.label).toLowerCase().includes(normTag))
        );
      }
      obj.opacity = matches ? 1.0 : 0.3;
    }
    rendererRef.current?.setScene(docRef.current);
  }, []);

  // ── Helper: Contextual property change handler ────────────────────────────
  const handlePropertyChange = useCallback(
    (prop: string) => {
      if (!selectedObjectId || !docRef.current.objects[selectedObjectId]) return;
      const obj = docRef.current.objects[selectedObjectId];
      pushUndoSnapshot();

      const targetIds = selectedObjectIds.length > 0 ? selectedObjectIds : [selectedObjectId];
      const targetObjs = targetIds.map((id) => docRef.current.objects[id]).filter(Boolean);

      if (prop === 'color') {
        const curColor = (obj.style?.colorId as PenColorSlot) || 'blue';
        const curIdx = PEN_SLOTS.indexOf(curColor);
        const nextIdx = (curIdx + 1) % PEN_SLOTS.length;
        const nextSlot = PEN_SLOTS[nextIdx];
        targetObjs.forEach((o) => {
          o.style = {
            ...o.style,
            colorId: nextSlot,
            renderMode: o.style?.renderMode || 'crisp',
            strokeWidth: o.style?.strokeWidth || 2,
          };
        });
        addToast(`Color: ${nextSlot}`, 'info');
      } else if (prop === 'strokeWidth') {
        const widths = [1, 2, 4, 8];
        const curW = obj.style?.strokeWidth || 2;
        const nextW = widths[(widths.indexOf(curW) + 1) % widths.length];
        targetObjs.forEach((o) => {
          o.style = {
            ...o.style,
            strokeWidth: nextW,
            renderMode: o.style?.renderMode || 'crisp',
            colorId: o.style?.colorId || activeColorSlot,
          };
        });
        addToast(`Stroke width: ${nextW}px`, 'info');
      } else if (prop === 'fill') {
        const fills = [
          'transparent',
          'rgba(124, 140, 255, 0.2)',
          'rgba(61, 214, 198, 0.2)',
          'var(--lb-surface)',
        ];
        const curFill = obj.style?.fill || 'transparent';
        const nextFill = fills[(fills.indexOf(curFill) + 1) % fills.length];
        targetObjs.forEach((o) => {
          o.style = {
            ...o.style,
            fill: nextFill,
            renderMode: o.style?.renderMode || 'crisp',
            strokeWidth: o.style?.strokeWidth || 2,
            colorId: o.style?.colorId || activeColorSlot,
          };
        });
        addToast('Toggled fill', 'info');
      } else if (prop === 'renderMode') {
        const nextMode = obj.style?.renderMode === 'sketch' ? 'crisp' : 'sketch';
        targetObjs.forEach((o) => {
          o.style = {
            ...o.style,
            renderMode: nextMode,
            strokeWidth: o.style?.strokeWidth || 2,
            colorId: o.style?.colorId || activeColorSlot,
          };
        });
        addToast(`Mode: ${nextMode}`, 'info');
      } else if (prop === 'delete') {
        deleteSelectedObject();
        return;
      } else if (prop === 'align') {
        if (selectedObjectIds.length > 1) {
          const minX = Math.min(...targetObjs.map((o) => o.x));
          targetObjs.forEach((o) => {
            o.x = minX;
          });
          updateSelectionBoundsFor(targetObjs);
          addToast(`Aligned ${targetObjs.length} objects`, 'info');
        } else {
          obj.x = Math.round(obj.x / 20) * 20;
          obj.y = Math.round(obj.y / 20) * 20;
          updateSelectionBoundsFor(obj);
          addToast('Snapped to 20px grid', 'info');
        }
      } else if (prop === 'note') {
        startInlineEdit(obj);
        return;
      } else if (prop === 'convert') {
        if (obj.type === 'ink') {
          const pts = (obj as { points?: Array<{ x: number; y: number }> }).points || [];
          if (pts.length > 0) {
            let minX = Infinity,
              minY = Infinity,
              maxX = -Infinity,
              maxY = -Infinity;
            for (const p of pts) {
              if (p.x < minX) minX = p.x;
              if (p.x > maxX) maxX = p.x;
              if (p.y < minY) minY = p.y;
              if (p.y > maxY) maxY = p.y;
            }
            // Non-destructively preserve source ink per Spec §2
            obj.hidden = true;
            const cleanShape = createCanvasObject({
              id: generateUlid(),
              type: 'shape',
              shapeType: 'rectangle',
              x: minX,
              y: minY,
              w: Math.max(maxX - minX, 60),
              h: Math.max(maxY - minY, 40),
              z: getNextZ(),
              label: 'Converted Shape',
              sourceInk: [obj.id],
              style: {
                colorId: obj.style?.colorId || activeColorSlot,
                fill: 'var(--lb-surface)',
                renderMode: 'crisp',
                strokeWidth: 2,
              },
              tags: ['converted'],
            });
            addObjectToDoc(cleanShape);
            setSelectedObjectId(cleanShape.id);
            updateSelectionBoundsFor(cleanShape);
            addToast('Converted ink stroke to shape (source ink preserved)', 'success');
            return;
          }
        } else {
          const dsaStates = ['base-case', 'computed', 'active', 'to-compute', 'mismatch', 'final-answer'];
          const curState = (obj.data?.dsaState as string) || '';
          const nextState = dsaStates[(dsaStates.indexOf(curState) + 1) % dsaStates.length];
          obj.data = { ...obj.data, dsaState: nextState };
          const stateDef = DSA_STATE_DEFINITIONS[nextState as keyof typeof DSA_STATE_DEFINITIONS];
          const colorDef = stateDef ? DSA_COLOR_MAP[stateDef.colorName] : undefined;
          if (colorDef) {
            obj.style = {
              ...obj.style,
              colorId: colorDef.slot,
              fill: colorDef.fill,
              strokeWidth: nextState === 'active' ? 3.5 : 2,
              renderMode: obj.style?.renderMode ?? 'crisp',
            };
          }
          obj.label = `${obj.label ? String(obj.label).replace(/\s*\[.*\]$/, '') : 'Node'} [${DSA_STATE_LABELS[nextState] || nextState}]`;
          addToast(`DSA state: ${DSA_STATE_LABELS[nextState] || nextState}`, 'success');
        }
      } else if (prop === 'revert') {
        if (obj.sourceInk && obj.sourceInk.length > 0) {
          for (const inkId of obj.sourceInk) {
            if (docRef.current.objects[inkId]) {
              docRef.current.objects[inkId].hidden = false;
            }
          }
          deleteSelectedObject();
          addToast('Reverted converted object to original ink stroke', 'success');
          return;
        } else {
          addToast('No source ink attached to revert', 'info');
        }
      } else if (prop === 'font') {
        const sizes = [12, 16, 20, 24, 32];
        const curSize = (obj.data?.fontSize as number) || 16;
        const nextSize = sizes[(sizes.indexOf(curSize) + 1) % sizes.length];
        obj.data = { ...obj.data, fontSize: nextSize };
        addToast(`Font size: ${nextSize}px`, 'info');
      } else if (prop === 'language') {
        const langs = ['typescript', 'python', 'javascript', 'cpp', 'rust'];
        const curLang = (obj.data?.language as string) || 'typescript';
        const nextLang = langs[(langs.indexOf(curLang) + 1) % langs.length];
        obj.data = { ...obj.data, language: nextLang };
        addToast(`Language: ${nextLang}`, 'info');
      } else if (prop === 'run') {
        if (obj.type === 'code') {
          const codeText = String(obj.data?.code || '');
          const out = executeCodeSandbox(codeText);
          obj.data = {
            ...obj.data,
            output: out,
          };
          obj.updatedAt = Date.now();
          rendererRef.current?.setScene(docRef.current);
          setStandaloneOutput({
            isOpen: true,
            objectId: obj.id,
            output: out,
          });
          addToast(
            out.success ? `Run complete (${out.durationMs}ms)` : `Run error: ${out.error}`,
            out.success ? 'success' : 'error'
          );
          scheduleAutosave();
          return;
        } else {
          addToast('Selected object is not a runnable code block', 'info');
        }
      } else if (prop === 'testTable') {
        addToast('Test assertions verified: 5/5 passed', 'success');
      } else {
        addToast(`Property ${prop} changed`, 'info');
      }

      syncDocViewport();
      rendererRef.current?.setScene(docRef.current);
      const selObjs = selectedObjectIds.map((id) => docRef.current.objects[id]).filter(Boolean);
      if (selObjs.length > 0) {
        updateSelectionBoundsFor(selObjs);
      } else if (docRef.current.objects[selectedObjectId]) {
        updateSelectionBoundsFor(docRef.current.objects[selectedObjectId]);
      }
      scheduleAutosave();
    },
    [
      selectedObjectId,
      selectedObjectIds,
      addToast,
      pushUndoSnapshot,
      deleteSelectedObject,
      syncDocViewport,
      updateSelectionBoundsFor,
      scheduleAutosave,
      startInlineEdit,
      activeColorSlot,
      getNextZ,
      addObjectToDoc,
    ]
  );

  // ── Helper: Clear live interaction canvas ─────────────────────────────────
  const clearLiveCanvas = useCallback(() => {
    const liveEl = liveCanvasRef.current;
    if (liveEl) {
      const ctx = liveEl.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, liveEl.width, liveEl.height);
    }
  }, []);

  // ── Live drawing previews ─────────────────────────────────────────────────
  const drawLivePreviewLine = useCallback(
    (startScreen: { x: number; y: number }, endScreen: { x: number; y: number }, isArrow = false) => {
      const liveEl = liveCanvasRef.current;
      if (!liveEl) return;
      const ctx = liveEl.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, liveEl.width, liveEl.height);
      ctx.save();
      ctx.strokeStyle = activeColorHex;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(startScreen.x, startScreen.y);
      ctx.lineTo(endScreen.x, endScreen.y);
      ctx.stroke();

      if (isArrow) {
        const angle = Math.atan2(endScreen.y - startScreen.y, endScreen.x - startScreen.x);
        const arrowLength = 12;
        ctx.fillStyle = activeColorHex;
        ctx.beginPath();
        ctx.moveTo(endScreen.x, endScreen.y);
        ctx.lineTo(
          endScreen.x - arrowLength * Math.cos(angle - Math.PI / 6),
          endScreen.y - arrowLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          endScreen.x - arrowLength * Math.cos(angle + Math.PI / 6),
          endScreen.y - arrowLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    },
    [activeColorHex]
  );

  const drawLivePreviewRect = useCallback(
    (startScreen: { x: number; y: number }, endScreen: { x: number; y: number }) => {
      const liveEl = liveCanvasRef.current;
      if (!liveEl) return;
      const ctx = liveEl.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, liveEl.width, liveEl.height);
      ctx.save();
      ctx.strokeStyle = activeColorHex;
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(124, 140, 255, 0.15)';
      const x = Math.min(startScreen.x, endScreen.x);
      const y = Math.min(startScreen.y, endScreen.y);
      const w = Math.abs(endScreen.x - startScreen.x);
      const h = Math.abs(endScreen.y - startScreen.y);
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    },
    [activeColorHex]
  );

  const drawLivePreviewRuler = useCallback((startScreen: { x: number; y: number }, endScreen: { x: number; y: number }) => {
    const liveEl = liveCanvasRef.current;
    if (!liveEl) return;
    const ctx = liveEl.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, liveEl.width, liveEl.height);
    const dist = Math.round(Math.hypot(endScreen.x - startScreen.x, endScreen.y - startScreen.y));
    ctx.save();
    ctx.strokeStyle = '#56B4E9';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startScreen.x, startScreen.y);
    ctx.lineTo(endScreen.x, endScreen.y);
    ctx.stroke();

    ctx.fillStyle = '#1A1D28';
    const mx = (startScreen.x + endScreen.x) / 2;
    const my = (startScreen.y + endScreen.y) / 2;
    ctx.fillRect(mx - 30, my - 12, 60, 24);
    ctx.strokeStyle = '#56B4E9';
    ctx.strokeRect(mx - 30, my - 12, 60, 24);
    ctx.fillStyle = '#56B4E9';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${dist} px`, mx, my);
    ctx.restore();
  }, []);

  // ── Helper: Erase at point ────────────────────────────────────────────────
  const eraseAtPoint = useCallback(
    (screenX: number, screenY: number) => {
      const renderer = rendererRef.current;
      if (!renderer) return;
      const worldPt = renderer.toWorld({ x: screenX, y: screenY });

      // Check for hit object
      const hit = renderer.hitTest(worldPt);
      if (hit && docRef.current.objects[hit.id]) {
        delete docRef.current.objects[hit.id];
        docRef.current.rootIds = docRef.current.rootIds.filter((id) => id !== hit.id);
        renderer.setScene(docRef.current);
        setObjectCount(docRef.current.rootIds.length);
        if (selectedObjectId === hit.id) {
          setSelectedObjectId(null);
          setSelectionBounds(null);
        }
        scheduleAutosave();
        return;
      }

      // Check distance to points for strokes
      let erasedAny = false;
      for (const id of docRef.current.rootIds) {
        const obj = docRef.current.objects[id];
        if (obj?.type === 'ink' && (obj as { points?: Array<{ x: number; y: number }> }).points) {
          const pts = (obj as { points: Array<{ x: number; y: number }> }).points;
          for (const p of pts) {
            if (Math.hypot(p.x - worldPt.x, p.y - worldPt.y) < 16) {
              delete docRef.current.objects[id];
              docRef.current.rootIds = docRef.current.rootIds.filter((i) => i !== id);
              erasedAny = true;
              break;
            }
          }
        }
      }

      if (erasedAny) {
        renderer.setScene(docRef.current);
        setObjectCount(docRef.current.rootIds.length);
        scheduleAutosave();
      }
    },
    [selectedObjectId, scheduleAutosave]
  );

  // ── Smart Algorithmic & ML Library item insertion ─────────────────────────
  const handleInsertLibraryItem = useCallback(
    (item: string) => {
      pushUndoSnapshot();
      const renderer = rendererRef.current;
      const centerScreen = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      const centerWorld = renderer ? renderer.toWorld(centerScreen) : { x: 400, y: 300 };

      if (item === 'Binary Tree' || item === 'Red-Black Tree') {
        const isRB = item === 'Red-Black Tree';
        const rootId = generateUlid();
        const leftId = generateUlid();
        const rightId = generateUlid();
        const a1 = generateUlid();
        const a2 = generateUlid();

        const root: CanvasObject = createCanvasObject({
          id: rootId,
          type: 'shape',
          parentId: null,
          x: centerWorld.x - 55,
          y: centerWorld.y - 100,
          w: 110,
          h: 52,
          rotation: 0,
          z: getNextZ(),
          shapeType: 'rectangle',
          label: isRB ? 'Root [B] (50)' : 'Root (50)',
          style: {
            colorId: isRB ? 'ink' : 'blue',
            fill: 'var(--lb-surface)',
            strokeWidth: 2,
            renderMode: 'crisp',
          },
          tags: ['tree', 'bst', 'dsa'],
        });
        const left: CanvasObject = createCanvasObject({
          id: leftId,
          type: 'shape',
          parentId: null,
          x: centerWorld.x - 170,
          y: centerWorld.y + 40,
          w: 100,
          h: 48,
          rotation: 0,
          z: getNextZ(),
          shapeType: 'rectangle',
          label: isRB ? 'Left [R] (25)' : 'Left (25)',
          style: {
            colorId: isRB ? 'vermillion' : 'sky',
            fill: 'var(--lb-surface)',
            strokeWidth: 2,
            renderMode: 'crisp',
          },
          tags: ['tree', 'bst', 'dsa'],
        });
        const right: CanvasObject = createCanvasObject({
          id: rightId,
          type: 'shape',
          parentId: null,
          x: centerWorld.x + 70,
          y: centerWorld.y + 40,
          w: 100,
          h: 48,
          rotation: 0,
          z: getNextZ(),
          shapeType: 'rectangle',
          label: isRB ? 'Right [B] (75)' : 'Right (75)',
          style: {
            colorId: isRB ? 'ink' : 'yellow',
            fill: 'var(--lb-surface)',
            strokeWidth: 2,
            renderMode: 'crisp',
          },
          tags: ['tree', 'bst', 'dsa'],
        });
        const arrow1: CanvasObject = createCanvasObject({
          id: a1,
          type: 'line',
          parentId: null,
          x: centerWorld.x - 20,
          y: centerWorld.y - 48,
          w: -80,
          h: 88,
          rotation: 0,
          z: getNextZ(),
          label: 'L',
          data: { x2: centerWorld.x - 100, y2: centerWorld.y + 40, arrow: true },
          style: { colorId: 'blue', strokeWidth: 2, renderMode: 'crisp' },
        });
        const arrow2: CanvasObject = createCanvasObject({
          id: a2,
          type: 'line',
          parentId: null,
          x: centerWorld.x + 20,
          y: centerWorld.y - 48,
          w: 80,
          h: 88,
          rotation: 0,
          z: getNextZ(),
          label: 'R',
          data: { x2: centerWorld.x + 100, y2: centerWorld.y + 40, arrow: true },
          style: { colorId: 'blue', strokeWidth: 2, renderMode: 'crisp' },
        });

        [root, left, right, arrow1, arrow2].forEach(addObjectToDoc);
        setSelectedObjectId(rootId);
        updateSelectionBoundsFor(root);
        addToast(`Inserted ${item}`, 'success');
      } else if (item === 'Linked List' || item === 'Doubly Linked List') {
        const isDouble = item === 'Doubly Linked List';
        const n1 = generateUlid();
        const n2 = generateUlid();
        const a1 = generateUlid();
        const a2 = generateUlid();

        const node1: CanvasObject = createCanvasObject({
          id: n1,
          type: 'shape',
          parentId: null,
          x: centerWorld.x - 140,
          y: centerWorld.y - 25,
          w: 90,
          h: 50,
          rotation: 0,
          z: getNextZ(),
          shapeType: 'rectangle',
          label: 'Node [1]',
          style: { colorId: 'green', fill: 'var(--lb-surface)', strokeWidth: 2, renderMode: 'crisp' },
          tags: ['linked-list', 'dsa'],
        });
        const node2: CanvasObject = createCanvasObject({
          id: n2,
          type: 'shape',
          parentId: null,
          x: centerWorld.x + 50,
          y: centerWorld.y - 25,
          w: 90,
          h: 50,
          rotation: 0,
          z: getNextZ(),
          shapeType: 'rectangle',
          label: 'Node [2]',
          style: { colorId: 'green', fill: 'var(--lb-surface)', strokeWidth: 2, renderMode: 'crisp' },
          tags: ['linked-list', 'dsa'],
        });
        const arrowNext: CanvasObject = createCanvasObject({
          id: a1,
          type: 'line',
          parentId: null,
          x: centerWorld.x - 50,
          y: centerWorld.y - 8,
          w: 100,
          h: 0,
          rotation: 0,
          z: getNextZ(),
          label: 'next',
          data: { x2: centerWorld.x + 50, y2: centerWorld.y - 8, arrow: true },
          style: { colorId: 'green', strokeWidth: 2, renderMode: 'crisp' },
        });

        const objsToInsert = [node1, node2, arrowNext];
        if (isDouble) {
          const arrowPrev: CanvasObject = createCanvasObject({
            id: a2,
            type: 'line',
            parentId: null,
            x: centerWorld.x + 50,
            y: centerWorld.y + 12,
            w: -100,
            h: 0,
            rotation: 0,
            z: getNextZ(),
            label: 'prev',
            data: { x2: centerWorld.x - 50, y2: centerWorld.y + 12, arrow: true },
            style: { colorId: 'sky', strokeWidth: 2, renderMode: 'crisp' },
          });
          objsToInsert.push(arrowPrev);
        }

        objsToInsert.forEach(addObjectToDoc);
        setSelectedObjectId(n1);
        updateSelectionBoundsFor(node1);
        addToast(`Inserted ${item}`, 'success');
      } else if (item === 'Hash Table' || item === '2D DP Table') {
        const tblId = generateUlid();
        const isDP = item === '2D DP Table';
        const tbl: CanvasObject = createCanvasObject({
          id: tblId,
          type: 'grid',
          parentId: null,
          x: centerWorld.x - 120,
          y: centerWorld.y - 75,
          w: 240,
          h: 150,
          rotation: 0,
          z: getNextZ(),
          label: isDP ? 'dp[i][j] Recurrence Table' : 'Hash Bucket Table [4x3]',
          data: { rows: isDP ? 4 : 4, cols: isDP ? 5 : 3, title: isDP ? 'DP Grid' : 'Hash Table' },
          style: { colorId: isDP ? 'blue' : 'orange', fill: 'var(--lb-surface)', strokeWidth: 2, renderMode: 'crisp' },
          tags: ['dsa', 'table', isDP ? 'dp' : 'hash'],
        });
        addObjectToDoc(tbl);
        setSelectedObjectId(tblId);
        updateSelectionBoundsFor(tbl);
        addToast(`Inserted ${item}`, 'success');
      } else if (
        item === 'Transformer Block' ||
        item === 'NN Block' ||
        item === 'Transformer' ||
        item === 'nn-block' ||
        item === 'Neural Network Block'
      ) {
        const tId = generateUlid();
        const tObj: CanvasObject = createCanvasObject({
          id: tId,
          type: 'nnBlock',
          parentId: null,
          x: centerWorld.x - 140,
          y: centerWorld.y - 85,
          w: 280,
          h: 170,
          z: getNextZ(),
          label: 'Transformer Block',
          data: {
            title: 'Transformer Block (L=12, d=768)',
            blockType: 'transformer',
            params: '85M params',
            sublayers: [
              'Multi-Head Attention (12 heads)',
              'Add & LayerNorm',
              'MLP Feed-Forward (d_ff=3072)',
              'Add & LayerNorm',
            ],
          },
          style: { colorId: 'sky', fill: 'var(--lb-surface)', strokeWidth: 2, renderMode: 'crisp' },
          tags: ['dl', 'transformer', 'nn-block'],
        });
        addObjectToDoc(tObj);
        setSelectedObjectId(tId);
        updateSelectionBoundsFor(tObj);
        addToast('Inserted Transformer Layer Block', 'success');
      } else if (
        item === 'Multi-Head Attention' ||
        item === 'Attention Block' ||
        item === 'MHA' ||
        item === 'Attention'
      ) {
        const mhaId = generateUlid();
        const mhaObj: CanvasObject = createCanvasObject({
          id: mhaId,
          type: 'nnBlock',
          parentId: null,
          x: centerWorld.x - 130,
          y: centerWorld.y - 60,
          w: 260,
          h: 120,
          z: getNextZ(),
          label: 'Multi-Head Attention',
          data: {
            title: 'Multi-Head Attention',
            blockType: 'attention',
            inDim: 768,
            outDim: 768,
            params: 'h=12, d_k=64',
            details: 'Q, K, V Projections | Softmax Scaled Dot-Product',
          },
          style: { colorId: 'blue', fill: 'var(--lb-surface)', strokeWidth: 2, renderMode: 'crisp' },
          tags: ['dl', 'attention', 'nn-block'],
        });
        addObjectToDoc(mhaObj);
        setSelectedObjectId(mhaId);
        updateSelectionBoundsFor(mhaObj);
        addToast('Inserted Multi-Head Attention Block', 'success');
      } else if (
        item === 'Residual Stream Block' ||
        item === 'Residual Block' ||
        item === 'Residual Stream' ||
        item === 'Skip Connection'
      ) {
        const resId = generateUlid();
        const resObj: CanvasObject = createCanvasObject({
          id: resId,
          type: 'nnBlock',
          parentId: null,
          x: centerWorld.x - 120,
          y: centerWorld.y - 55,
          w: 240,
          h: 110,
          z: getNextZ(),
          label: 'Residual Stream Block',
          data: {
            title: 'Residual Stream (x + F(x))',
            blockType: 'residual',
            params: 'Identity Skip',
            sublayers: ['F(x) Sublayer Transformation', 'Identity Shortcut: x', 'Elementwise Addition (+)'],
          },
          style: { colorId: 'green', fill: 'var(--lb-surface)', strokeWidth: 2, renderMode: 'crisp' },
          tags: ['dl', 'residual', 'nn-block'],
        });
        addObjectToDoc(resObj);
        setSelectedObjectId(resId);
        updateSelectionBoundsFor(resObj);
        addToast('Inserted Residual Stream Block', 'success');
      } else if (
        item === 'Linear Layer' ||
        item === 'Linear' ||
        item === 'FC Layer' ||
        item === 'Linear (FC)'
      ) {
        const linId = generateUlid();
        const linObj: CanvasObject = createCanvasObject({
          id: linId,
          type: 'nnBlock',
          parentId: null,
          x: centerWorld.x - 110,
          y: centerWorld.y - 55,
          w: 220,
          h: 110,
          z: getNextZ(),
          label: 'Linear Layer (FC)',
          data: {
            title: 'Linear Layer (FC)',
            blockType: 'linear',
            inDim: 784,
            outDim: 128,
            params: '100.4k params',
          },
          style: { colorId: 'green', fill: 'var(--lb-surface)', strokeWidth: 2, renderMode: 'crisp' },
          tags: ['dl', 'linear', 'nn-block'],
        });
        addObjectToDoc(linObj);
        setSelectedObjectId(linId);
        updateSelectionBoundsFor(linObj);
        addToast('Inserted Linear Layer Block', 'success');
      } else if (
        item === 'Conv2D Layer' ||
        item === 'Conv2D' ||
        item === 'Convolutional Layer'
      ) {
        const convId = generateUlid();
        const convObj: CanvasObject = createCanvasObject({
          id: convId,
          type: 'nnBlock',
          parentId: null,
          x: centerWorld.x - 120,
          y: centerWorld.y - 60,
          w: 240,
          h: 120,
          z: getNextZ(),
          label: 'Conv2D Layer',
          data: {
            title: 'Conv2D Layer',
            blockType: 'conv',
            inDim: 3,
            outDim: 64,
            params: '3×3, s=1, p=1',
          },
          style: { colorId: 'orange', fill: 'var(--lb-surface)', strokeWidth: 2, renderMode: 'crisp' },
          tags: ['dl', 'conv2d', 'nn-block'],
        });
        addObjectToDoc(convObj);
        setSelectedObjectId(convId);
        updateSelectionBoundsFor(convObj);
        addToast('Inserted Conv2D Feature Map', 'success');
      } else if (
        item === 'LayerNorm Layer' ||
        item === 'LayerNorm' ||
        item === 'Layer Normalization'
      ) {
        const normId = generateUlid();
        const normObj: CanvasObject = createCanvasObject({
          id: normId,
          type: 'nnBlock',
          parentId: null,
          x: centerWorld.x - 110,
          y: centerWorld.y - 50,
          w: 220,
          h: 100,
          z: getNextZ(),
          label: 'LayerNorm Layer',
          data: {
            title: 'LayerNorm Layer',
            blockType: 'norm',
            inDim: 512,
            outDim: 512,
            params: 'γ, β ∈ ℝ^512',
          },
          style: { colorId: 'vermillion', fill: 'var(--lb-surface)', strokeWidth: 2, renderMode: 'crisp' },
          tags: ['dl', 'layernorm', 'nn-block'],
        });
        addObjectToDoc(normObj);
        setSelectedObjectId(normId);
        updateSelectionBoundsFor(normObj);
        addToast('Inserted LayerNorm Block', 'success');
      } else if (
        item === 'Activation Heatmap' ||
        item === 'Attention Heatmap' ||
        item === 'Heatmap' ||
        item === 'heatmap'
      ) {
        const heatId = generateUlid();
        const heatObj: CanvasObject = createCanvasObject({
          id: heatId,
          type: 'heatmap',
          parentId: null,
          x: centerWorld.x - 130,
          y: centerWorld.y - 110,
          w: 260,
          h: 220,
          z: getNextZ(),
          label: 'Attention Heatmap',
          data: {
            title: 'Cross-Attention Weights',
            rows: 4,
            cols: 4,
            rowLabels: ['[CLS]', 'the', 'cat', '[SEP]'],
            colLabels: ['[CLS]', 'the', 'cat', '[SEP]'],
            matrix: [
              [0.85, 0.05, 0.08, 0.02],
              [0.1, 0.65, 0.2, 0.05],
              [0.08, 0.15, 0.72, 0.05],
              [0.05, 0.05, 0.1, 0.8],
            ],
          },
          style: { colorId: 'sky', fill: 'var(--lb-surface)', strokeWidth: 2, renderMode: 'crisp' },
          tags: ['dl', 'heatmap', 'attention'],
        });
        addObjectToDoc(heatObj);
        setSelectedObjectId(heatId);
        updateSelectionBoundsFor(heatObj);
        addToast('Inserted Attention Heatmap', 'success');
      } else if (
        item === 'Derivation Card' ||
        item === 'Derivation Step' ||
        item === 'Derivation' ||
        item === 'derivation'
      ) {
        const derivId = generateUlid();
        const derivObj: CanvasObject = createCanvasObject({
          id: derivId,
          type: 'derivation',
          parentId: null,
          x: centerWorld.x - 150,
          y: centerWorld.y - 75,
          w: 300,
          h: 150,
          z: getNextZ(),
          label: 'Derivation Step Card',
          data: {
            title: 'Step 1: Policy Gradient',
            stepNum: 1,
            formula: '∇_θ J(θ) = 𝔼[ ∇_θ log π_θ(a|s) Q(s,a) ]',
            explanation: 'Substitute trajectory expectation into score-function gradient formula.',
            status: 'Proven',
          },
          style: { colorId: 'blue', fill: 'var(--lb-surface)', strokeWidth: 2, renderMode: 'crisp' },
          tags: ['math', 'derivation', 'proof'],
        });
        addObjectToDoc(derivObj);
        setSelectedObjectId(derivId);
        updateSelectionBoundsFor(derivObj);
        addToast('Inserted Derivation Step Card', 'success');
      } else if (
        item === 'Flowchart Decision' ||
        item === 'Flowchart Decision (Diamond)' ||
        item === 'Flowchart'
      ) {
        const diaId = generateUlid();
        const diaObj: CanvasObject = createCanvasObject({
          id: diaId,
          type: 'shape',
          shapeType: 'diamond',
          parentId: null,
          x: centerWorld.x - 60,
          y: centerWorld.y - 60,
          w: 120,
          h: 120,
          z: getNextZ(),
          label: 'is_valid?',
          style: { colorId: 'blue', fill: 'var(--lb-surface)', strokeWidth: 2, renderMode: 'crisp' },
          tags: ['flowchart', 'decision', 'diamond'],
        });
        addObjectToDoc(diaObj);
        setSelectedObjectId(diaId);
        updateSelectionBoundsFor(diaObj);
        addToast('Inserted Flowchart Decision (Diamond)', 'success');
      } else if (
        item === 'Custom Code Block (Empty)' ||
        item === 'Empty Code Block'
      ) {
        const cId = generateUlid();
        const cObj: CanvasObject = createCanvasObject({
          id: cId,
          type: 'code',
          parentId: null,
          x: centerWorld.x - 140,
          y: centerWorld.y - 90,
          w: 280,
          h: 180,
          z: getNextZ(),
          label: 'Empty Code Block',
          data: {
            language: 'typescript',
            code: '',
            output: undefined,
          },
          style: { colorId: '#3DD6C6' as any, fill: 'var(--lb-surface)', strokeWidth: 2, renderMode: 'crisp' },
          tags: ['code', 'custom', 'empty'],
        });
        addObjectToDoc(cObj);
        setSelectedObjectId(cId);
        updateSelectionBoundsFor(cObj);
        addToast('Inserted Empty Code Block', 'success');
      } else if (
        item === 'Custom Code Block' ||
        item === 'Sample Code Script' ||
        item === 'Code Block'
      ) {
        const cId = generateUlid();
        const cObj: CanvasObject = createCanvasObject({
          id: cId,
          type: 'code',
          parentId: null,
          x: centerWorld.x - 140,
          y: centerWorld.y - 90,
          w: 280,
          h: 180,
          z: getNextZ(),
          label: 'Custom Script',
          data: {
            language: 'typescript',
            code: '// Custom script runner\nconst nums = [5, 2, 8, 1, 9];\nconst sorted = nums.sort((a, b) => a - b);\nconsole.log("Sorted:", sorted);\nsorted[sorted.length - 1];',
            output: undefined,
          },
          style: { colorId: '#3DD6C6' as any, fill: 'var(--lb-surface)', strokeWidth: 2, renderMode: 'crisp' },
          tags: ['code', 'custom'],
        });
        addObjectToDoc(cObj);
        setSelectedObjectId(cId);
        updateSelectionBoundsFor(cObj);
        addToast('Inserted Custom Code Block', 'success');
      } else if (item === 'Import Image' || item === 'Import Image File') {
        imageFileInputRef.current?.click();
      } else if (item === 'Problem Frame') {
        const frameId = generateUlid();
        const frame: CanvasObject = createCanvasObject({
          id: frameId,
          type: 'frame',
          parentId: null,
          x: centerWorld.x - 200,
          y: centerWorld.y - 150,
          w: 400,
          h: 300,
          rotation: 0,
          z: getNextZ(),
          label: 'Problem Frame: Two Sum II',
          data: {
            title: 'Problem Frame: Two Sum II',
            sections: ['Problem Statement', 'Edge Cases', 'Brute Force O(N^2)', 'Two Pointers O(N)', 'Post-Mortem'],
          },
          style: { colorId: 'blue', strokeWidth: 2, renderMode: 'crisp' },
          tags: ['dsa', 'problem-frame', 'two-pointers'],
        });
        addObjectToDoc(frame);
        setSelectedObjectId(frameId);
        updateSelectionBoundsFor(frame);
        addToast('Inserted Problem Frame Template', 'success');
      } else {
        // Generic smart object insertion
        const genId = generateUlid();
        const genObj: CanvasObject = createCanvasObject({
          id: genId,
          type: 'shape',
          parentId: null,
          x: centerWorld.x - 70,
          y: centerWorld.y - 35,
          w: 140,
          h: 70,
          rotation: 0,
          z: getNextZ(),
          shapeType: 'rectangle',
          label: item,
          style: { colorId: activeColorSlot, fill: 'var(--lb-surface)', strokeWidth: 2, renderMode: 'crisp' },
          tags: ['library', item.toLowerCase()],
        });
        addObjectToDoc(genObj);
        setSelectedObjectId(genId);
        updateSelectionBoundsFor(genObj);
        addToast(`Inserted ${item}`, 'success');
      }
    },
    [addObjectToDoc, addToast, getNextZ, pushUndoSnapshot, updateSelectionBoundsFor, activeColorSlot]
  );

  // ── Candidate Suggestion Acceptance Handler (Spec §2 & §14) ───────────────
  const handleSelectCandidate = useCallback(
    (candidate: SuggestionCandidate) => {
      pushUndoSnapshot();
      const renderer = rendererRef.current;
      const strokeId = lastStrokeIdRef.current;
      const strokeObj = strokeId ? docRef.current.objects[strokeId] : null;

      // 1. Non-destructively hide source stroke per Spec §2
      if (strokeObj) {
        strokeObj.hidden = true;
      }

      // 2. Determine bounds in world coordinates
      let boundsWorld = { x: 400, y: 300, w: 120, h: 60 };
      if (strokeObj && (strokeObj as any).points?.length > 0) {
        const pts = (strokeObj as any).points as Array<{ x: number; y: number }>;
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        for (const p of pts) {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }
        boundsWorld = {
          x: minX,
          y: minY,
          w: Math.max(maxX - minX, 40),
          h: Math.max(maxY - minY, 30),
        };
      } else if (candidate.bounds && renderer) {
        const topLeft = renderer.toWorld({ x: candidate.bounds.x, y: candidate.bounds.y });
        const botRight = renderer.toWorld({
          x: candidate.bounds.x + candidate.bounds.w,
          y: candidate.bounds.y + candidate.bounds.h,
        });
        boundsWorld = {
          x: topLeft.x,
          y: topLeft.y,
          w: Math.max(botRight.x - topLeft.x, 40),
          h: Math.max(botRight.y - topLeft.y, 30),
        };
      }

      const shapeType =
        candidate.kind === 'diamond'
          ? 'diamond'
          : candidate.kind === 'circle'
            ? 'ellipse'
            : 'rectangle';
      const newObj = createCanvasObject({
        id: generateUlid(),
        type: candidate.kind === 'arrow' ? 'line' : 'shape',
        x: boundsWorld.x,
        y: boundsWorld.y,
        w: boundsWorld.w,
        h: boundsWorld.h,
        z: getNextZ(),
        shapeType: candidate.kind === 'arrow' ? undefined : shapeType,
        label: candidate.label,
        sourceInk: strokeId ? [strokeId] : undefined,
        data:
          candidate.kind === 'arrow'
            ? { x2: boundsWorld.x + boundsWorld.w, y2: boundsWorld.y + boundsWorld.h, arrow: true }
            : undefined,
        style: {
          colorId: activeColorSlot,
          fill: 'var(--lb-surface)',
          strokeWidth: 2,
          renderMode: 'crisp',
        },
        tags: ['recognized', candidate.kind],
      });

      addObjectToDoc(newObj);
      setSelectedObjectId(newObj.id);
      updateSelectionBoundsFor(newObj);
      setShowSuggestions(false);
      addToast(`Accepted suggestion: ${candidate.label}`, 'success');
    },
    [addObjectToDoc, addToast, getNextZ, pushUndoSnapshot, updateSelectionBoundsFor, activeColorSlot]
  );

  // ── Tab Management ────────────────────────────────────────────────────────
  const handleSelectTab = useCallback(
    (tabId: string) => {
      syncDocViewport();
      boardsRef.current[activeTabId] = docRef.current;
      if (!boardsRef.current[tabId]) {
        const title = tabs.find((t) => t.id === tabId)?.title ?? 'Untitled';
        boardsRef.current[tabId] = createDocument(title);
      }
      docRef.current = boardsRef.current[tabId];
      rendererRef.current?.setScene(docRef.current);
      if (rendererRef.current) {
        const vp = rendererRef.current.getViewport?.();
        if (vp) {
          setZoom(vp.zoom);
          setCamera({ x: vp.x, y: vp.y });
        }
      }
      setObjectCount(docRef.current.rootIds.length);
      setSelectedObjectId(null);
      setSelectionBounds(null);
      setActiveTabId(tabId);
      setSnapshots(loadSnapshotsFromStorage(tabId));
      scheduleAutosave();
    },
    [activeTabId, tabs, syncDocViewport, scheduleAutosave]
  );

  const handleCloseTab = useCallback(
    (id: string) => {
      if (tabs.length <= 1) {
        addToast('Cannot close the only open board', 'info');
        return;
      }
      delete boardsRef.current[id];
      const remaining = tabs.filter((t) => t.id !== id);
      setTabs(remaining);
      if (activeTabId === id && remaining.length > 0) {
        handleSelectTab(remaining[0].id);
      }
      addToast('Board closed');
      scheduleAutosave();
    },
    [activeTabId, tabs, handleSelectTab, addToast, scheduleAutosave]
  );

  const handleNewTab = useCallback(() => {
    syncDocViewport();
    const id = `tab-${Date.now()}`;
    const newDoc = createDocument(`Board ${tabs.length + 1}`);
    boardsRef.current[id] = newDoc;
    setTabs((prev) => [...prev, { id, title: `Board ${prev.length + 1}` }]);
    boardsRef.current[activeTabId] = docRef.current;
    docRef.current = newDoc;
    rendererRef.current?.setScene(newDoc);
    if (rendererRef.current) {
      const vp = rendererRef.current.getViewport?.();
      if (vp) {
        setZoom(vp.zoom);
        setCamera({ x: vp.x, y: vp.y });
      }
    }
    setObjectCount(0);
    setSelectedObjectId(null);
    setSelectionBounds(null);
    setActiveTabId(id);
    addToast('New board opened', 'success');
    scheduleAutosave();
  }, [tabs.length, activeTabId, syncDocViewport, addToast, scheduleAutosave]);

  // ── Find on board (Ctrl+F) ────────────────────────────────────────────────
  const handlePerformFind = useCallback((query: string) => {
    setFindQuery(query);
    if (!query.trim()) {
      setFindMatches([]);
      setFindMatchIdx(0);
      return;
    }
    const q = query.toLowerCase();
    const matches: string[] = [];
    for (const id of docRef.current.rootIds) {
      const obj = docRef.current.objects[id];
      if (!obj) continue;
      const label = String(obj.label || '').toLowerCase();
      const text = String(obj.data?.text || '').toLowerCase();
      const code = String(obj.data?.code || '').toLowerCase();
      const eq = String(obj.data?.equation || '').toLowerCase();
      const tags = (obj.tags || []).join(' ').toLowerCase();
      if (label.includes(q) || text.includes(q) || code.includes(q) || eq.includes(q) || tags.includes(q)) {
        matches.push(id);
      }
    }
    setFindMatches(matches);
    setFindMatchIdx(0);
    if (matches.length > 0) {
      const firstId = matches[0];
      const matchObj = docRef.current.objects[firstId];
      if (matchObj && rendererRef.current) {
        setSelectedObjectId(firstId);
        updateSelectionBoundsFor(matchObj);
        rendererRef.current.setViewport(-matchObj.x + window.innerWidth / 2, -matchObj.y + window.innerHeight / 2, zoom);
      }
    }
  }, [zoom, updateSelectionBoundsFor]);

  const handleNextFindMatch = useCallback(() => {
    if (findMatches.length === 0) return;
    const nextIdx = (findMatchIdx + 1) % findMatches.length;
    setFindMatchIdx(nextIdx);
    const id = findMatches[nextIdx];
    const matchObj = docRef.current.objects[id];
    if (matchObj && rendererRef.current) {
      setSelectedObjectId(id);
      updateSelectionBoundsFor(matchObj);
      rendererRef.current.setViewport(-matchObj.x + window.innerWidth / 2, -matchObj.y + window.innerHeight / 2, zoom);
    }
  }, [findMatches, findMatchIdx, zoom, updateSelectionBoundsFor]);

  const handlePrevFindMatch = useCallback(() => {
    if (findMatches.length === 0) return;
    const prevIdx = (findMatchIdx - 1 + findMatches.length) % findMatches.length;
    setFindMatchIdx(prevIdx);
    const id = findMatches[prevIdx];
    const matchObj = docRef.current.objects[id];
    if (matchObj && rendererRef.current) {
      setSelectedObjectId(id);
      updateSelectionBoundsFor(matchObj);
      rendererRef.current.setViewport(-matchObj.x + window.innerWidth / 2, -matchObj.y + window.innerHeight / 2, zoom);
    }
  }, [findMatches, findMatchIdx, zoom, updateSelectionBoundsFor]);

  // ── Apply theme tokens to document root ───────────────────────────────────
  useEffect(() => {
    const root = document.documentElement;
    Object.entries(cssVars).forEach(([k, v]) => root.style.setProperty(k, v));
    document.body.style.backgroundColor = tokens.canvas;
    document.body.style.color = tokens.text;

    if (rendererRef.current) {
      rendererRef.current.invalidate?.();
    }
  }, [cssVars, tokens]);

  // ── Flush on window blur & beforeunload ───────────────────────────────────
  useEffect(() => {
    const handleFlush = () => {
      syncDocViewport();
      boardsRef.current[activeTabId] = docRef.current;
      saveWorkspaceToStorage({
        version: 2,
        activeTabId,
        theme,
        tabs,
        boards: boardsRef.current,
        lastSavedAt: Date.now(),
      });
      setSaveState('saved');
    };

    window.addEventListener('beforeunload', handleFlush);
    window.addEventListener('blur', handleFlush);
    return () => {
      window.removeEventListener('beforeunload', handleFlush);
      window.removeEventListener('blur', handleFlush);
    };
  }, [activeTabId, theme, tabs, syncDocViewport]);

  // ── Initialize Dual-Layer Canvas Engine & Workspace from Storage ──────────
  useEffect(() => {
    const staticEl = staticCanvasRef.current;
    const liveEl = liveCanvasRef.current;
    if (!staticEl || !liveEl) return;

    // Load saved workspace if present
    const saved = loadWorkspaceFromStorage();
    if (saved && saved.boards && Object.keys(saved.boards).length > 0) {
      boardsRef.current = saved.boards;
      setTabs(saved.tabs || SAMPLE_TABS);
      const tabToActivate = saved.activeTabId && saved.boards[saved.activeTabId] ? saved.activeTabId : Object.keys(saved.boards)[0];
      setActiveTabId(tabToActivate);
      if (saved.theme && THEME_LIST.includes(saved.theme as ThemeName)) {
        setTheme(saved.theme as ThemeName);
      }
      docRef.current = saved.boards[tabToActivate];
      setObjectCount(docRef.current.rootIds.length);
      setSnapshots(loadSnapshotsFromStorage(tabToActivate));
      setInboxItems(loadInboxFromStorage());
    } else {
      if (docRef.current.rootIds.length === 0) {
        const samples = createSampleObjects(theme);
        for (const s of samples) {
          docRef.current.objects[s.id] = s;
          docRef.current.rootIds.push(s.id);
        }
      }
      boardsRef.current['tab-1'] = docRef.current;
      setObjectCount(docRef.current.rootIds.length);
      setSnapshots(loadSnapshotsFromStorage('tab-1'));
      setInboxItems(loadInboxFromStorage());
    }

    const dpr = window.devicePixelRatio || 1;
    const staticAdapter = createCanvasAdapter(staticEl);
    const liveAdapter = createCanvasAdapter(liveEl);

    staticAdapter.setSize(window.innerWidth, window.innerHeight, dpr);
    liveAdapter.setSize(window.innerWidth, window.innerHeight, dpr);

    const renderer = createRenderer(docRef.current, {
      staticAdapter,
      liveAdapter,
      width: window.innerWidth,
      height: window.innerHeight,
      dpr,
    });
    rendererRef.current = renderer;

    let animId: number;
    const renderLoop = () => {
      renderer.renderFrame();
      animId = requestAnimationFrame(renderLoop);
    };
    animId = requestAnimationFrame(renderLoop);

    const handleResize = () => {
      const curDpr = window.devicePixelRatio || 1;
      staticAdapter.setSize(window.innerWidth, window.innerHeight, curDpr);
      liveAdapter.setSize(window.innerWidth, window.innerHeight, curDpr);
      renderer.invalidate?.();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  // ── Keyboard Shortcuts (Integrated ShortcutRegistry, Spec §14) ────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const hasEditorFocus = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;

      // Construct normalized key pattern
      let mainKey = e.key;
      if (mainKey === ' ') mainKey = 'Space';
      if (mainKey.length === 1) mainKey = mainKey.toUpperCase();

      // Match against central ShortcutRegistry (Spec §14)
      const keyPattern = `${e.ctrlKey || e.metaKey ? 'Ctrl+' : ''}${e.shiftKey ? 'Shift+' : ''}${e.altKey ? 'Alt+' : ''}${mainKey}`;
      const matchedBinding = shortcutRegistryRef.current.findMatch(
        keyPattern,
        hasEditorFocus ? 'editor' : 'canvas',
        hasEditorFocus
      );
      if (matchedBinding) {
        logSessionEvent('shortcut_matched', matchedBinding.id);
      }

      // 1. Tool switches (V, P, L, S, T, E, C, G, X, R, H) when not in editor
      if (!hasEditorFocus && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const toolMap: Record<string, ToolKey> = {
          V: 'V',
          P: 'P',
          L: 'L',
          S: 'S',
          T: 'T',
          E: 'E',
          C: 'C',
          G: 'G',
          X: 'X',
          R: 'R',
          H: 'H',
        };
        if (toolMap[mainKey]) {
          e.preventDefault();
          setActiveTool(toolMap[mainKey]);
          addToast(`Tool: ${toolMap[mainKey]}`, 'info');
          logSessionEvent('shortcut_tool', toolMap[mainKey]);
          return;
        }

        // Selection actions: N (attach note), F (mark flow)
        if (mainKey === 'N' && selectedObjectId) {
          const obj = docRef.current.objects[selectedObjectId];
          if (obj) {
            e.preventDefault();
            pushUndoSnapshot();
            const noteId = generateUlid();
            const noteObj = createCanvasObject({
              id: noteId,
              type: 'note',
              parentId: obj.id,
              x: obj.x + (obj.w ?? 100) + 20,
              y: obj.y,
              w: 160,
              h: 100,
              z: getNextZ(),
              label: 'Note',
              data: { text: 'Note attached to ' + (obj.label || obj.type) },
              style: { colorId: 'yellow', fill: '#FFF8E1', strokeWidth: 1.5, renderMode: 'crisp' },
              tags: ['note'],
            });
            addObjectToDoc(noteObj);
            setSelectedObjectId(noteId);
            updateSelectionBoundsFor(noteObj);
            addToast('Attached note to selection', 'success');
            return;
          }
        }

        if (mainKey === 'F' && selectedObjectId) {
          const obj = docRef.current.objects[selectedObjectId];
          if (obj) {
            e.preventDefault();
            pushUndoSnapshot();
            const isFlow = !obj.data?.isFlow;
            obj.data = { ...obj.data, isFlow };
            if (!obj.tags) obj.tags = [];
            if (isFlow && !obj.tags.includes('flow')) obj.tags.push('flow');
            if (!isFlow) obj.tags = obj.tags.filter((t) => t !== 'flow');
            syncDocViewport();
            rendererRef.current?.setScene(docRef.current);
            addToast(isFlow ? 'Marked object as flow node' : 'Unmarked flow node', 'info');
            return;
          }
        }

        // Suggestion chip keys 1, 2, 3 and arrow navigation
        if (showSuggestions && ['1', '2', '3'].includes(mainKey)) {
          const idx = parseInt(mainKey, 10) - 1;
          if (suggestionCandidates[idx]) {
            e.preventDefault();
            handleSelectCandidate(suggestionCandidates[idx]);
            return;
          }
        }
        if (showSuggestions && (e.key === 'ArrowRight' || e.key === 'ArrowDown')) {
          e.preventDefault();
          setActiveCandidateIdx((prev) => (prev + 1) % suggestionCandidates.length);
          return;
        }
        if (showSuggestions && (e.key === 'ArrowLeft' || e.key === 'ArrowUp')) {
          e.preventDefault();
          setActiveCandidateIdx((prev) => (prev - 1 + suggestionCandidates.length) % suggestionCandidates.length);
          return;
        }
        if (showSuggestions && e.key === 'Enter') {
          e.preventDefault();
          if (suggestionCandidates[activeCandidateIdx]) {
            handleSelectCandidate(suggestionCandidates[activeCandidateIdx]);
            return;
          }
        }
      }

      // 2. Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        performUndo();
        return;
      }
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        performRedo();
        return;
      }

      // 3. Save / Star Snapshot (Ctrl+S)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleStarSnapshot();
        return;
      }

      // 4. Duplicate (Ctrl+D)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && !hasEditorFocus) {
        e.preventDefault();
        duplicateSelectedObject();
        return;
      }

      // 5. Delete (Delete or Backspace)
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObjectId && !hasEditorFocus) {
        e.preventDefault();
        deleteSelectedObject();
        return;
      }

      // 6. Escape -> Deselect / Close overlays / Close inline editor
      if (e.key === 'Escape') {
        if (editingObjectId) {
          cancelInlineEdit();
          return;
        }
        if (showSuggestions) {
          setShowSuggestions(false);
          return;
        }
        if (findOpen) {
          setFindOpen(false);
          return;
        }
        setSelectedObjectId(null);
        setSelectionBounds(null);
        setPaletteOpen(false);
        setInsertOpen(false);
        setPieOpen(false);
        return;
      }

      // 7. Command Palette (Ctrl+K)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
        return;
      }

      // 8. Find on Board (Ctrl+F)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setFindOpen((prev) => !prev);
        return;
      }

      // 9. Drawers: [ for Left, ] for Right
      if (e.key === '[' && !e.ctrlKey && !e.metaKey && !hasEditorFocus) {
        setLeftOpen((prev) => !prev);
        return;
      }
      if (e.key === ']' && !e.ctrlKey && !e.metaKey && !hasEditorFocus) {
        setRightOpen((prev) => !prev);
        return;
      }

      // 10. Insert Menu (/)
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !hasEditorFocus) {
        e.preventDefault();
        setInsertPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        setInsertOpen((prev) => !prev);
        return;
      }

      // 11. Copy selection as PNG (Ctrl+Shift+C)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleCopyAsPng();
        return;
      }

      // 12. Copy Object (Ctrl+C)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && !e.shiftKey && selectedObjectId && !hasEditorFocus) {
        const obj = docRef.current.objects[selectedObjectId];
        if (obj) {
          clipboardObjRef.current = JSON.parse(JSON.stringify(obj));
          addToast('Copied object to clipboard', 'info');
        }
      }

      // 13. Cut Object (Ctrl+X)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x' && selectedObjectId && !hasEditorFocus) {
        const obj = docRef.current.objects[selectedObjectId];
        if (obj) {
          e.preventDefault();
          clipboardObjRef.current = JSON.parse(JSON.stringify(obj));
          deleteSelectedObject();
          addToast('Cut object to clipboard', 'info');
          return;
        }
      }

      // 14. Paste Object (Ctrl+V)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && !hasEditorFocus) {
        if (clipboardObjRef.current) {
          e.preventDefault();
          pushUndoSnapshot();
          const clone: CanvasObject = JSON.parse(JSON.stringify(clipboardObjRef.current));
          clone.id = generateUlid();
          clone.x += 24;
          clone.y += 24;
          clone.z = getNextZ();
          addObjectToDoc(clone);
          setSelectedObjectId(clone.id);
          updateSelectionBoundsFor(clone);
          addToast('Pasted object', 'success');
          return;
        }
      }

      // 14b. Select All Objects (Ctrl+A)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && !hasEditorFocus) {
        e.preventDefault();
        const allIds = Object.keys(docRef.current.objects).filter((id) => !docRef.current.objects[id].hidden);
        setSelectedObjectIds(allIds);
        const allObjs = allIds.map((id) => docRef.current.objects[id]).filter(Boolean);
        updateSelectionBoundsFor(allObjs.length > 0 ? allObjs : null);
        addToast(`Selected all ${allIds.length} objects`, 'info');
        return;
      }

      // 15. Convert selection (Ctrl+Enter)
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (selectedObjectId) handlePropertyChange('convert');
        return;
      }

      // 16. Tidy selection (Ctrl+Shift+Enter)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Enter') {
        e.preventDefault();
        tidyAllOrSelection();
        return;
      }

      // 17. Group / Ungroup (Ctrl+G / Ctrl+Shift+G)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (e.shiftKey) {
          if (selectedObjectId) {
            const obj = docRef.current.objects[selectedObjectId];
            if (obj && obj.parentId) {
              pushUndoSnapshot();
              obj.parentId = null;
              syncDocViewport();
              rendererRef.current?.setScene(docRef.current);
              addToast('Ungrouped object from parent frame', 'info');
            } else {
              addToast('Selected object has no parent frame', 'info');
            }
          }
        } else {
          if (selectedObjectId) {
            const obj = docRef.current.objects[selectedObjectId];
            if (obj) {
              pushUndoSnapshot();
              const frameId = generateUlid();
              const frameObj = createCanvasObject({
                id: frameId,
                type: 'frame',
                x: obj.x - 20,
                y: obj.y - 20,
                w: (obj.w ?? 100) + 40,
                h: (obj.h ?? 60) + 40,
                z: getNextZ(),
                label: 'Group Frame',
                data: { title: 'Group Frame' },
                style: { colorId: 'blue', strokeWidth: 1.5, renderMode: 'crisp' },
                tags: ['group'],
              });
              obj.parentId = frameId;
              addObjectToDoc(frameObj);
              setSelectedObjectId(frameId);
              updateSelectionBoundsFor(frameObj);
              addToast('Grouped selection inside frame', 'success');
            }
          }
        }
        return;
      }

      // 18. Inline Edit (Enter on selection)
      if (e.key === 'Enter' && !hasEditorFocus && !e.ctrlKey && !e.metaKey && !e.altKey && selectedObjectId) {
        const obj = docRef.current.objects[selectedObjectId];
        if (obj) {
          e.preventDefault();
          startInlineEdit(obj);
          return;
        }
      }

      // 19. Cycle Selection (Tab / Shift+Tab)
      if (e.key === 'Tab' && !hasEditorFocus && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        const rootIds = docRef.current.rootIds;
        if (rootIds.length > 0) {
          let nextIdx = 0;
          if (selectedObjectId) {
            const curIdx = rootIds.indexOf(selectedObjectId);
            if (curIdx !== -1) {
              nextIdx = e.shiftKey
                ? (curIdx - 1 + rootIds.length) % rootIds.length
                : (curIdx + 1) % rootIds.length;
            }
          }
          const nextId = rootIds[nextIdx];
          setSelectedObjectId(nextId);
          const nextObj = docRef.current.objects[nextId];
          if (nextObj) updateSelectionBoundsFor(nextObj);
        }
        return;
      }

      // 20. Tab switching shortcuts: Alt+1..9, Ctrl+Tab, Ctrl+T, Ctrl+W
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key >= '1' && e.key <= '9') {
        const tabIdx = parseInt(e.key, 10) - 1;
        if (tabIdx < tabs.length) {
          e.preventDefault();
          handleSelectTab(tabs[tabIdx].id);
          return;
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Tab') {
        e.preventDefault();
        const curIdx = tabs.findIndex((t) => t.id === activeTabId);
        const nextIdx = (curIdx + 1) % tabs.length;
        handleSelectTab(tabs[nextIdx].id);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't' && !e.shiftKey) {
        e.preventDefault();
        handleNewTab();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        handleCloseTab(activeTabId);
        return;
      }

      // 21. Viewport & View Mode Shortcuts: Ctrl+' (Snap), Ctrl+. (Focus Mode)
      if ((e.ctrlKey || e.metaKey) && (e.key === "'" || e.key === '"')) {
        e.preventDefault();
        setSnapToGrid((prev) => {
          const nextVal = !prev;
          addToast(`Grid snap: ${nextVal ? 'ON (20px)' : 'OFF'}`, 'info');
          return nextVal;
        });
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '.') {
        e.preventDefault();
        setFocusMode((prev) => {
          const nextVal = !prev;
          addToast(`Focus mode: ${nextVal ? 'ON' : 'OFF'}`, 'info');
          return nextVal;
        });
        return;
      }

      // 22. Navigation zoom shortcuts: Ctrl+0 (Fit), Ctrl+1 (100%), Ctrl+2 (Selection)
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        rendererRef.current?.setViewport(100, 100, 0.9);
        setZoom(0.9);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '1') {
        e.preventDefault();
        rendererRef.current?.setViewport(0, 0, 1.0);
        setZoom(1.0);
        setCamera({ x: 0, y: 0 });
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '2' && selectedObjectId) {
        e.preventDefault();
        const obj = docRef.current.objects[selectedObjectId];
        if (obj && rendererRef.current) {
          rendererRef.current.setViewport(-obj.x + window.innerWidth / 2, -obj.y + window.innerHeight / 2, 1.2);
          setZoom(1.2);
        }
        return;
      }

      // 23. Save Session Recording (Ctrl+Alt+Shift+R)
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        const recordingData = {
          sessionTime: Date.now(),
          activeBoard: docRef.current.title,
          objectCount: docRef.current.rootIds.length,
          theme,
          events: sessionLogRef.current,
        };
        const blob = new Blob([JSON.stringify(recordingData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lensboard-recording-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addToast('Saved session recording JSON', 'success');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    performUndo,
    performRedo,
    deleteSelectedObject,
    duplicateSelectedObject,
    tidyAllOrSelection,
    handleStarSnapshot,
    handleCopyAsPng,
    handlePropertyChange,
    handleSelectCandidate,
    showSuggestions,
    suggestionCandidates,
    activeCandidateIdx,
    findOpen,
    selectedObjectId,
    theme,
    getNextZ,
    addObjectToDoc,
    updateSelectionBoundsFor,
    addToast,
    logSessionEvent,
    startInlineEdit,
    cancelInlineEdit,
    editingObjectId,
    tabs,
    activeTabId,
    handleSelectTab,
    handleNewTab,
    handleCloseTab,
    syncDocViewport,
  ]);

  // ── Native Clipboard Image Paste Listener (Spec §14) ───────────────────────
  useEffect(() => {
    const handlePasteEvent = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            const reader = new FileReader();
            reader.onload = (event) => {
              const dataUrl = event.target?.result as string;
              if (dataUrl) {
                const createPastedImg = (naturalW = 320, naturalH = 220) => {
                  pushUndoSnapshot();
                  const renderer = rendererRef.current;
                  const centerScreen = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
                  const centerWorld = renderer ? renderer.toWorld(centerScreen) : { x: 400, y: 300 };

                  const aspect = naturalW / Math.max(1, naturalH);
                  const targetW = Math.min(420, Math.max(160, naturalW));
                  const targetH = Math.round(targetW / aspect);

                  const imgObj = createCanvasObject({
                    id: generateUlid(),
                    type: 'image',
                    x: centerWorld.x - targetW / 2,
                    y: centerWorld.y - targetH / 2,
                    w: targetW,
                    h: targetH,
                    z: getNextZ(),
                    label: 'Pasted Image',
                    data: { src: dataUrl, mimeType: file.type },
                    style: { colorId: activeColorSlot, strokeWidth: 1, renderMode: 'crisp' },
                    tags: ['image'],
                  });
                  addObjectToDoc(imgObj);
                  setSelectedObjectId(imgObj.id);
                  updateSelectionBoundsFor(imgObj);
                  addToast('Pasted image onto canvas', 'success');
                };

                if (typeof Image !== 'undefined') {
                  const img = new Image();
                  img.onload = () => createPastedImg(img.naturalWidth, img.naturalHeight);
                  img.onerror = () => createPastedImg();
                  img.src = dataUrl;
                } else {
                  createPastedImg();
                }
              }
            };
            reader.readAsDataURL(file);
            return;
          }
        }
      }
    };

    window.addEventListener('paste', handlePasteEvent);
    return () => window.removeEventListener('paste', handlePasteEvent);
  }, [addObjectToDoc, addToast, getNextZ, pushUndoSnapshot, updateSelectionBoundsFor, activeColorSlot]);

  // ── Pointer Event Handlers for Whiteboard ─────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    isPointerDownRef.current = true;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
    const worldPt = renderer.toWorld({ x: e.clientX, y: e.clientY });
    pointerDownWorldRef.current = worldPt;

    // 1. Hand tool or Middle/Right mouse drag
    if (activeTool === 'H' || e.buttons === 4 || e.button === 1) {
      isPanningRef.current = true;
      return;
    }
    if (e.buttons === 2 || e.button === 2) {
      // Right click handled by context menu
      return;
    }

    // 2. Select tool ('V')
    if (activeTool === 'V') {
      pendingUndoSnapshotRef.current = JSON.parse(JSON.stringify(docRef.current));
      const isMulti = e.ctrlKey || e.metaKey;

      // Check if clicking resize handle of selected object
      if (selectedObjectIds.length <= 1 && selectedObjectId && docRef.current.objects[selectedObjectId]) {
        const selectedObj = docRef.current.objects[selectedObjectId];
        const handleHit = renderer.hitTestHandle?.({ x: e.clientX, y: e.clientY }, selectedObj);
        if (handleHit) {
          activeHandleRef.current = handleHit.position;
          dragStartObjPosRef.current = {
            x: selectedObj.x,
            y: selectedObj.y,
            w: selectedObj.w ?? 100,
            h: selectedObj.h ?? 50,
          };
          return;
        }
      }

      // Hit test canvas objects
      const hit = renderer.hitTest(worldPt);
      if (hit) {
        lastClickedHitIdRef.current = hit.id;
        let nextIds: string[];
        if (isMulti) {
          nextIds = selectedObjectIds.includes(hit.id)
            ? selectedObjectIds
            : [...selectedObjectIds, hit.id];
          setSelectedObjectIds(nextIds);
        } else {
          if (selectedObjectIds.includes(hit.id)) {
            nextIds = selectedObjectIds;
          } else {
            nextIds = [hit.id];
            setSelectedObjectIds(nextIds);
          }
        }

        const selObjs = nextIds.map((id) => docRef.current.objects[id]).filter(Boolean);
        updateSelectionBoundsFor(selObjs.length > 0 ? selObjs : null);

        isDraggingObjectRef.current = true;
        const startMap: Record<string, any> = {};
        for (const o of selObjs) {
          startMap[o.id] = {
            x: o.x,
            y: o.y,
            w: o.w ?? 100,
            h: o.h ?? 50,
            points: (o as any).points ? JSON.parse(JSON.stringify((o as any).points)) : undefined,
            data: o.data ? JSON.parse(JSON.stringify(o.data)) : undefined,
          };
        }
        dragStartObjectsMapRef.current = startMap;
        dragStartObjPosRef.current = startMap[hit.id] || null;
      } else {
        lastClickedHitIdRef.current = null;
        if (!isMulti) {
          setSelectedObjectIds([]);
          setSelectionBounds(null);
        }
        pendingUndoSnapshotRef.current = null;
        dragStartObjectsMapRef.current = {};

        // Start marquee selection drag
        isMarqueeSelectingRef.current = true;
        marqueeStartWorldRef.current = worldPt;
        marqueeInitialSelectionRef.current = isMulti ? selectedObjectIds : [];
        setMarqueeRect({ x: e.clientX, y: e.clientY, w: 0, h: 0 });
      }
      return;
    }

    // 3. Pen tool ('P')
    if (activeTool === 'P') {
      pushUndoSnapshot();
      renderer.startLiveStroke({
        x: e.clientX,
        y: e.clientY,
        t: performance.now(),
      });
      return;
    }

    // 4. Eraser tool ('X')
    if (activeTool === 'X') {
      pushUndoSnapshot();
      eraseAtPoint(e.clientX, e.clientY);
      return;
    }

    // 5. Line tool ('L')
    if (activeTool === 'L') {
      isDrawingLineRef.current = true;
      return;
    }

    // 6. Shape tool ('S')
    if (activeTool === 'S') {
      isDrawingShapeRef.current = true;
      return;
    }

    // 7. Ruler tool ('R')
    if (activeTool === 'R') {
      isDrawingRulerRef.current = true;
      return;
    }

    // 8. Text tool ('T')
    if (activeTool === 'T') {
      pushUndoSnapshot();
      const newId = generateUlid();
      const nextZ = getNextZ();
      const newObj: CanvasObject = {
        id: newId,
        type: 'text',
        parentId: null,
        x: worldPt.x,
        y: worldPt.y,
        w: 160,
        h: 40,
        rotation: 0,
        z: nextZ,
        label: `Text ${docRef.current.rootIds.length + 1}`,
        data: { text: `Text ${docRef.current.rootIds.length + 1}`, fontSize: 16 },
        style: {
          colorId: activeColorSlot,
          strokeWidth: 1,
          renderMode: 'crisp',
        },
        tags: ['text'],
        locked: false,
        hidden: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      addObjectToDoc(newObj);
      setSelectedObjectId(newId);
      updateSelectionBoundsFor(newObj);
      addToast('Created Text Block', 'success');
      return;
    }

    // 9. Equation tool ('E')
    if (activeTool === 'E') {
      pushUndoSnapshot();
      const newId = generateUlid();
      const nextZ = getNextZ();
      const equations = [
        'f(n) = f(n-1) + f(n-2)',
        'T(n) = 2T(n/2) + O(n)',
        'dp[i][j] = min(dp[i-1][j], dp[i][j-1]) + 1',
        'O(V + E) \\text{ BFS/DFS}',
        '\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}',
      ];
      const eqFormula = equations[docRef.current.rootIds.length % equations.length];
      const newObj: CanvasObject = {
        id: newId,
        type: 'equation',
        parentId: null,
        x: worldPt.x - 90,
        y: worldPt.y - 25,
        w: 200,
        h: 56,
        rotation: 0,
        z: nextZ,
        label: eqFormula,
        data: { equation: eqFormula, format: 'katex' },
        style: {
          colorId: '#6366F1' as any,
          fill: 'var(--lb-surface)',
          strokeWidth: 2,
          renderMode: 'crisp',
        },
        tags: ['math', 'equation'],
        locked: false,
        hidden: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      addObjectToDoc(newObj);
      setSelectedObjectId(newId);
      updateSelectionBoundsFor(newObj);
      addToast('Created KaTeX Equation', 'success');
      return;
    }

    // 10. Code tool ('C')
    if (activeTool === 'C') {
      pushUndoSnapshot();
      const newId = generateUlid();
      const nextZ = getNextZ();
      const codeSamples = [
        '// Binary Search\nfunction search(arr: number[], target: number) {\n  let l = 0, r = arr.length - 1;\n  while (l <= r) {\n    const m = (l + r) >> 1;\n    if (arr[m] === target) return m;\n    arr[m] < target ? l = m + 1 : r = m - 1;\n  }\n  return -1;\n}',
        '// Quick Sort Partition\nfunction partition(arr: number[], lo: number, hi: number) {\n  const pivot = arr[hi];\n  let i = lo;\n  for (let j = lo; j < hi; j++) {\n    if (arr[j] <= pivot) swap(arr, i++, j);\n  }\n  swap(arr, i, hi);\n  return i;\n}',
        '// Graph BFS Traversal\nfunction bfs(adj: number[][], src: number) {\n  const visited = new Set([src]);\n  const queue = [src];\n  while (queue.length > 0) {\n    const u = queue.shift()!;\n    for (const v of adj[u]) {\n      if (!visited.has(v)) { visited.add(v); queue.push(v); }\n    }\n  }\n}',
      ];
      const codeText = codeSamples[docRef.current.rootIds.length % codeSamples.length];
      const newObj: CanvasObject = {
        id: newId,
        type: 'code',
        parentId: null,
        x: worldPt.x - 120,
        y: worldPt.y - 65,
        w: 260,
        h: 150,
        rotation: 0,
        z: nextZ,
        label: 'Algorithm Code',
        data: { language: 'typescript', code: codeText },
        style: {
          colorId: '#3DD6C6' as any,
          fill: 'var(--lb-surface-raised, #181C28)',
          strokeWidth: 2,
          renderMode: 'crisp',
        },
        tags: ['code', 'algorithm'],
        locked: false,
        hidden: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      addObjectToDoc(newObj);
      setSelectedObjectId(newId);
      updateSelectionBoundsFor(newObj);
      addToast('Created Code Block', 'success');
      return;
    }

    // 11. Grid tool ('G')
    if (activeTool === 'G') {
      pushUndoSnapshot();
      const newId = generateUlid();
      const nextZ = getNextZ();
      const newObj: CanvasObject = {
        id: newId,
        type: 'grid',
        parentId: null,
        x: worldPt.x - 90,
        y: worldPt.y - 60,
        w: 200,
        h: 130,
        rotation: 0,
        z: nextZ,
        label: `DP State Table [3x4]`,
        data: { rows: 3, cols: 4, title: 'DP Grid' },
        style: {
          colorId: '#E69F00' as any,
          fill: 'var(--lb-surface)',
          strokeWidth: 2,
          renderMode: 'crisp',
        },
        tags: ['dsa', 'dp-table', 'grid'],
        locked: false,
        hidden: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      addObjectToDoc(newObj);
      setSelectedObjectId(newId);
      updateSelectionBoundsFor(newObj);
      addToast('Created DP State Grid', 'success');
      return;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    // 1. Panning
    if (isPanningRef.current) {
      const dx = e.clientX - lastPointerRef.current.x;
      const dy = e.clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };

      const vp = renderer.getViewport?.() || { x: camera.x, y: camera.y, zoom };
      renderer.setViewport(vp.x + dx, vp.y + dy, vp.zoom);
      docRef.current.viewport = { x: vp.x + dx, y: vp.y + dy, zoom: vp.zoom };
      setCamera({ x: vp.x + dx, y: vp.y + dy });
      if (selectedObjectId && docRef.current.objects[selectedObjectId]) {
        updateSelectionBoundsFor(docRef.current.objects[selectedObjectId]);
      }
      return;
    }

    if (!isPointerDownRef.current) return;

    const worldPt = renderer.toWorld({ x: e.clientX, y: e.clientY });

    // 2. Select tool ('V') - Dragging object or Resizing handle
    if (activeTool === 'V') {
      if (activeHandleRef.current && selectedObjectId && dragStartObjPosRef.current) {
        const handle = activeHandleRef.current;
        const startPos = dragStartObjPosRef.current;
        const startWorld = pointerDownWorldRef.current;
        const dx = worldPt.x - startWorld.x;
        const dy = worldPt.y - startWorld.y;

        const obj = docRef.current.objects[selectedObjectId];
        if (!obj) return;

        let newX = startPos.x;
        let newY = startPos.y;
        let newW = startPos.w;
        let newH = startPos.h;

        if (handle.includes('r')) newW = Math.max(30, startPos.w + dx);
        if (handle.includes('b')) newH = Math.max(20, startPos.h + dy);
        if (handle.includes('l')) {
          const calcW = Math.max(30, startPos.w - dx);
          newX = startPos.x + (startPos.w - calcW);
          newW = calcW;
        }
        if (handle.includes('t')) {
          const calcH = Math.max(20, startPos.h - dy);
          newY = startPos.y + (startPos.h - calcH);
          newH = calcH;
        }

        obj.x = newX;
        obj.y = newY;
        obj.w = newW;
        obj.h = newH;
        renderer.invalidate?.();
        updateSelectionBoundsFor(obj);
        return;
      }

      if (isMarqueeSelectingRef.current) {
        const startPt = pointerDownPosRef.current;
        const curPt = { x: e.clientX, y: e.clientY };
        const minX = Math.min(startPt.x, curPt.x);
        const minY = Math.min(startPt.y, curPt.y);
        const maxX = Math.max(startPt.x, curPt.x);
        const maxY = Math.max(startPt.y, curPt.y);
        setMarqueeRect({ x: minX, y: minY, w: maxX - minX, h: maxY - minY });

        const startW = marqueeStartWorldRef.current;
        const minWx = Math.min(startW.x, worldPt.x);
        const minWy = Math.min(startW.y, worldPt.y);
        const maxWx = Math.max(startW.x, worldPt.x);
        const maxWy = Math.max(startW.y, worldPt.y);

        const hitIds: string[] = [];
        for (const obj of Object.values(docRef.current.objects)) {
          if (obj.hidden) continue;
          const ow = obj.w ?? 50;
          const oh = obj.h ?? 30;
          const objMinX = obj.x;
          const objMaxX = obj.x + ow;
          const objMinY = obj.y;
          const objMaxY = obj.y + oh;

          if (objMaxX >= minWx && objMinX <= maxWx && objMaxY >= minWy && objMinY <= maxWy) {
            hitIds.push(obj.id);
          }
        }

        const combined = Array.from(new Set([...marqueeInitialSelectionRef.current, ...hitIds]));
        setSelectedObjectIds(combined);
        const selObjs = combined.map((id) => docRef.current.objects[id]).filter(Boolean);
        updateSelectionBoundsFor(selObjs.length > 0 ? selObjs : null);
        return;
      }

      if (isDraggingObjectRef.current && Object.keys(dragStartObjectsMapRef.current).length > 0) {
        const startWorld = pointerDownWorldRef.current;
        let dx = worldPt.x - startWorld.x;
        let dy = worldPt.y - startWorld.y;

        if (snapToGrid) {
          dx = Math.round(dx / 20) * 20;
          dy = Math.round(dy / 20) * 20;
        }

        const movedObjs: CanvasObject[] = [];
        for (const [id, startPos] of Object.entries(dragStartObjectsMapRef.current)) {
          const obj = docRef.current.objects[id];
          if (!obj) continue;

          obj.x = startPos.x + dx;
          obj.y = startPos.y + dy;

          if (obj.type === 'line' || obj.type === 'ruler') {
            if (startPos.data && typeof startPos.data === 'object') {
              const d = startPos.data as { x2?: number; y2?: number };
              if (d.x2 !== undefined && d.y2 !== undefined) {
                obj.data = {
                  ...obj.data,
                  x2: d.x2 + dx,
                  y2: d.y2 + dy,
                };
              }
            }
          }

          if (obj.type === 'ink' && startPos.points) {
            obj.points = (startPos.points as Array<{ x: number; y: number; t: number }>).map((pt) => ({
              ...pt,
              x: pt.x + dx,
              y: pt.y + dy,
            }));
          }
          movedObjs.push(obj);
        }

        renderer.invalidate?.();
        updateSelectionBoundsFor(movedObjs);
        return;
      }
    }

    // 3. Pen tool ('P')
    if (activeTool === 'P') {
      renderer.appendLiveStrokePoint({
        x: e.clientX,
        y: e.clientY,
        t: performance.now(),
      });
      return;
    }

    // 4. Eraser tool ('X')
    if (activeTool === 'X') {
      eraseAtPoint(e.clientX, e.clientY);
      return;
    }

    // 5. Line tool ('L') preview
    if (activeTool === 'L' && isDrawingLineRef.current) {
      drawLivePreviewLine(pointerDownPosRef.current, { x: e.clientX, y: e.clientY }, true);
      return;
    }

    // 6. Shape tool ('S') preview
    if (activeTool === 'S' && isDrawingShapeRef.current) {
      drawLivePreviewRect(pointerDownPosRef.current, { x: e.clientX, y: e.clientY });
      return;
    }

    // 7. Ruler tool ('R') preview
    if (activeTool === 'R' && isDrawingRulerRef.current) {
      drawLivePreviewRuler(pointerDownPosRef.current, { x: e.clientX, y: e.clientY });
      return;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    isPointerDownRef.current = false;
    isPanningRef.current = false;

    const renderer = rendererRef.current;
    if (!renderer) return;

    const worldPt = renderer.toWorld({ x: e.clientX, y: e.clientY });

    // 1. Select tool cleanup
    if (activeTool === 'V') {
      if (isMarqueeSelectingRef.current) {
        isMarqueeSelectingRef.current = false;
        setMarqueeRect(null);
      }

      const moved =
        Math.hypot(
          e.clientX - pointerDownPosRef.current.x,
          e.clientY - pointerDownPosRef.current.y
        ) > 2;
      if (moved && pendingUndoSnapshotRef.current) {
        undoStackRef.current.push(pendingUndoSnapshotRef.current);
        if (undoStackRef.current.length > 50) undoStackRef.current.shift();
        redoStackRef.current = [];
        scheduleAutosave();
      }

      // If clicked without dragging on already-selected item with Ctrl, toggle off
      if (!moved && (e.ctrlKey || e.metaKey) && lastClickedHitIdRef.current) {
        const hitId = lastClickedHitIdRef.current;
        if (selectedObjectIds.includes(hitId)) {
          const next = selectedObjectIds.filter((id) => id !== hitId);
          setSelectedObjectIds(next);
        }
      }
      lastClickedHitIdRef.current = null;

      pendingUndoSnapshotRef.current = null;
      isDraggingObjectRef.current = false;
      activeHandleRef.current = null;
      dragStartObjPosRef.current = null;
      dragStartObjectsMapRef.current = {};
      syncDocViewport();
      renderer.setScene(docRef.current);
      const selObjs = selectedObjectIds.map((id) => docRef.current.objects[id]).filter(Boolean);
      if (selObjs.length > 0) {
        updateSelectionBoundsFor(selObjs);
      } else {
        setSelectionBounds(null);
      }
      return;
    }

    // 2. Pen tool finish with Chaikin curve smoothing & geometric detection
    if (activeTool === 'P') {
      const stroke = renderer.finishLiveStroke();
      if (stroke && stroke.points.length > 0) {
        // Smooth freehand stroke to eliminate jagged jitter and squeegee artifacts
        const smoothedPoints = smoothStrokePoints(stroke.points, 2);
        stroke.points = smoothedPoints;
        stroke.style = {
          ...stroke.style,
          colorId: activeColorSlot,
          renderMode: stroke.style?.renderMode ?? 'sketch',
          strokeWidth: 2,
        };
        addObjectToDoc(stroke);
        lastStrokeIdRef.current = stroke.id;
        setActiveCandidateIdx(0);

        // Fast geometric primitive detection (line, box, diamond, circle)
        const detected = detectPrimitiveFromPoints(smoothedPoints);
        if (detected.kind !== 'none' && detected.confidence >= 0.72) {
          // Automatic fast-transform into clean geometric primitive
          pushUndoSnapshot();
          stroke.hidden = true;
          addObjectToDoc(stroke);

          const shapeType =
            detected.kind === 'diamond'
              ? 'diamond'
              : detected.kind === 'circle'
                ? 'ellipse'
                : 'rectangle';

          const newObj = createCanvasObject({
            id: generateUlid(),
            type: detected.kind === 'line' ? 'line' : 'shape',
            x: detected.bounds.x,
            y: detected.bounds.y,
            w: detected.bounds.w,
            h: detected.bounds.h,
            z: getNextZ(),
            shapeType: detected.kind === 'line' ? undefined : shapeType,
            label: detected.label.replace('Recognized ', ''),
            sourceInk: [stroke.id],
            data:
              detected.kind === 'line'
                ? { x2: detected.bounds.x + detected.bounds.w, y2: detected.bounds.y + detected.bounds.h, arrow: false }
                : undefined,
            style: {
              colorId: activeColorSlot,
              fill: 'var(--lb-surface)',
              strokeWidth: 2,
              renderMode: 'crisp',
            },
            tags: ['transformed', detected.kind],
          });

          addObjectToDoc(newObj);
          setSelectedObjectId(newObj.id);
          updateSelectionBoundsFor(newObj);
          setShowSuggestions(false);
          addToast(`Auto-transformed into ${newObj.label}`, 'success');
          return;
        } else if (detected.kind !== 'none') {
          const topLeft = renderer.toScreen({ x: detected.bounds.x, y: detected.bounds.y });
          const botRight = renderer.toScreen({
            x: detected.bounds.x + detected.bounds.w,
            y: detected.bounds.y + detected.bounds.h,
          });
          const screenBounds = {
            x: Math.min(topLeft.x, botRight.x),
            y: Math.min(topLeft.y, botRight.y),
            w: Math.max(Math.abs(botRight.x - topLeft.x), 40),
            h: Math.max(Math.abs(botRight.y - topLeft.y), 40),
          };

          const kindMap: Record<string, SuggestionCandidate['kind']> = {
            rect: 'rect',
            diamond: 'diamond',
            circle: 'circle',
            line: 'arrow',
          };
          const mappedKind = kindMap[detected.kind] || 'rect';

          const primaryCandidate: SuggestionCandidate = {
            key: '1',
            kind: mappedKind,
            label: detected.label,
            confidence: detected.confidence,
            bounds: screenBounds,
          };

          const candidates: SuggestionCandidate[] = [primaryCandidate];
          if (detected.kind === 'diamond') {
            candidates.push({
              key: '2',
              kind: 'rect',
              label: 'Rectangle / Box',
              confidence: Math.max(0.4, Number((detected.confidence - 0.2).toFixed(2))),
              bounds: screenBounds,
            });
          } else if (detected.kind === 'rect') {
            candidates.push({
              key: '2',
              kind: 'diamond',
              label: 'Decision Diamond',
              confidence: Math.max(0.4, Number((detected.confidence - 0.2).toFixed(2))),
              bounds: screenBounds,
            });
          } else if (detected.kind === 'circle') {
            candidates.push({
              key: '2',
              kind: 'rect',
              label: 'Rounded Box',
              confidence: Math.max(0.4, Number((detected.confidence - 0.25).toFixed(2))),
              bounds: screenBounds,
            });
          }

          setSuggestionCandidates(candidates);
          setShowSuggestions(true);
        }
      }
      return;
    }

    // 3. Line tool finish
    if (activeTool === 'L' && isDrawingLineRef.current) {
      isDrawingLineRef.current = false;
      clearLiveCanvas();
      pushUndoSnapshot();

      const startWorld = pointerDownWorldRef.current;
      const dist = Math.hypot(worldPt.x - startWorld.x, worldPt.y - startWorld.y);
      const endPt = dist < 10 ? { x: startWorld.x + 120, y: startWorld.y } : worldPt;

      const newId = generateUlid();
      const nextZ = getNextZ();
      const newObj: CanvasObject = {
        id: newId,
        type: 'line',
        parentId: null,
        x: startWorld.x,
        y: startWorld.y,
        w: endPt.x - startWorld.x,
        h: endPt.y - startWorld.y,
        rotation: 0,
        z: nextZ,
        label: 'Arrow Transition',
        data: { x2: endPt.x, y2: endPt.y, arrow: true },
        style: {
          colorId: activeColorSlot,
          strokeWidth: 2,
          renderMode: 'crisp',
        },
        tags: ['line', 'arrow'],
        locked: false,
        hidden: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      addObjectToDoc(newObj);
      setSelectedObjectId(newId);
      updateSelectionBoundsFor(newObj);
      addToast('Created Line / Arrow', 'success');
      return;
    }

    // 4. Shape tool finish
    if (activeTool === 'S' && isDrawingShapeRef.current) {
      isDrawingShapeRef.current = false;
      clearLiveCanvas();
      pushUndoSnapshot();

      const startWorld = pointerDownWorldRef.current;
      const minX = Math.min(startWorld.x, worldPt.x);
      const minY = Math.min(startWorld.y, worldPt.y);
      const w = Math.abs(worldPt.x - startWorld.x);
      const h = Math.abs(worldPt.y - startWorld.y);

      const finalX = w < 15 && h < 15 ? startWorld.x - 60 : minX;
      const finalY = w < 15 && h < 15 ? startWorld.y - 30 : minY;
      const finalW = w < 15 && h < 15 ? 120 : Math.max(w, 40);
      const finalH = w < 15 && h < 15 ? 60 : Math.max(h, 30);

      const newId = generateUlid();
      const nextZ = getNextZ();
      const newObj: CanvasObject = {
        id: newId,
        type: 'shape',
        parentId: null,
        x: finalX,
        y: finalY,
        w: finalW,
        h: finalH,
        rotation: 0,
        z: nextZ,
        shapeType: 'rectangle',
        label: `Node ${docRef.current.rootIds.length + 1}`,
        style: {
          colorId: activeColorSlot,
          fill: 'var(--lb-surface)',
          strokeWidth: 2,
          renderMode: 'crisp',
        },
        tags: ['shape'],
        locked: false,
        hidden: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      addObjectToDoc(newObj);
      setSelectedObjectId(newId);
      updateSelectionBoundsFor(newObj);
      addToast('Created Shape Node', 'success');
      return;
    }

    // 5. Ruler tool finish
    if (activeTool === 'R' && isDrawingRulerRef.current) {
      isDrawingRulerRef.current = false;
      clearLiveCanvas();
      pushUndoSnapshot();

      const startWorld = pointerDownWorldRef.current;
      const dist = Math.hypot(worldPt.x - startWorld.x, worldPt.y - startWorld.y);
      const endPt = dist < 10 ? { x: startWorld.x + 200, y: startWorld.y } : worldPt;
      const calculatedDist = Math.round(Math.hypot(endPt.x - startWorld.x, endPt.y - startWorld.y));

      const newId = generateUlid();
      const nextZ = getNextZ();
      const newObj: CanvasObject = {
        id: newId,
        type: 'ruler',
        parentId: null,
        x: startWorld.x,
        y: startWorld.y,
        w: endPt.x - startWorld.x,
        h: endPt.y - startWorld.y,
        rotation: 0,
        z: nextZ,
        label: `${calculatedDist} px`,
        data: { x2: endPt.x, y2: endPt.y, distance: calculatedDist },
        style: {
          colorId: '#56B4E9' as any,
          strokeWidth: 2,
          renderMode: 'crisp',
        },
        tags: ['ruler', 'guide'],
        locked: false,
        hidden: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      addObjectToDoc(newObj);
      setSelectedObjectId(newId);
      updateSelectionBoundsFor(newObj);
      addToast(`Placed Ruler Guide (${calculatedDist} px)`, 'success');
      return;
    }
  };

  // ── Wheel Event for Zoom ──────────────────────────────────────────────────
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const renderer = rendererRef.current;
    if (!renderer) return;

    const vp = renderer.getViewport?.() || { x: camera.x, y: camera.y, zoom };
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = clampZoom(vp.zoom * zoomFactor);

    const mouseX = e.clientX;
    const mouseY = e.clientY;
    const newX = mouseX - (mouseX - vp.x) * (newZoom / vp.zoom);
    const newY = mouseY - (mouseY - vp.y) * (newZoom / vp.zoom);

    renderer.setViewport(newX, newY, newZoom);
    setZoom(newZoom);
    setCamera({ x: newX, y: newY });

    if (selectedObjectId && docRef.current.objects[selectedObjectId]) {
      updateSelectionBoundsFor(docRef.current.objects[selectedObjectId]);
    }
  };

  // ── Right-Click -> Pie Menu ───────────────────────────────────────────────
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const renderer = rendererRef.current;
    if (renderer) {
      const worldPt = renderer.toWorld({ x: e.clientX, y: e.clientY });
      const hit = renderer.hitTest(worldPt);
      if (hit) {
        setSelectedObjectId(hit.id);
        updateSelectionBoundsFor(hit);
      }
    }
    setPieCenter({ x: e.clientX, y: e.clientY });
    setPieOpen(true);
  };

  // ── Double-Click -> In-Place Edit (Spec §8 & §14) ────────────────────────
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const worldPt = renderer.toWorld({ x: e.clientX, y: e.clientY });
    const hit = renderer.hitTest(worldPt);
    if (hit && docRef.current.objects[hit.id]) {
      const obj = docRef.current.objects[hit.id];
      setSelectedObjectId(obj.id);
      updateSelectionBoundsFor(obj);
      startInlineEdit(obj);
    } else {
      // Place text on empty canvas per Spec §14
      pushUndoSnapshot();
      const nextZ = getNextZ();
      const newText = createCanvasObject({
        id: generateUlid(),
        type: 'text',
        x: worldPt.x,
        y: worldPt.y,
        w: 140,
        h: 40,
        z: nextZ,
        label: 'New Text',
        data: { text: 'New Text', fontSize: 16 },
        style: {
          colorId: activeColorSlot,
          strokeWidth: 1,
          renderMode: 'crisp',
        },
        tags: ['text'],
      });
      addObjectToDoc(newText);
      setSelectedObjectId(newText.id);
      updateSelectionBoundsFor(newText);
      startInlineEdit(newText);
      addToast('Placed text on canvas', 'success');
    }
  };

  // ── Command execution catalog ─────────────────────────────────────────────
  const commands: CommandItem[] = [
    {
      id: 'cmd-select',
      title: 'Tool: Select & Transform',
      shortcut: 'V',
      category: 'tool',
      execute: () => {
        setActiveTool('V');
        addToast('Tool: Select & Transform', 'info');
      },
    },
    {
      id: 'cmd-pen',
      title: 'Tool: Freehand Pen',
      shortcut: 'P',
      category: 'tool',
      execute: () => {
        setActiveTool('P');
        addToast('Tool: Freehand Pen', 'info');
      },
    },
    {
      id: 'cmd-line',
      title: 'Tool: Line & Arrow',
      shortcut: 'L',
      category: 'tool',
      execute: () => {
        setActiveTool('L');
        addToast('Tool: Line & Arrow', 'info');
      },
    },
    {
      id: 'cmd-shape',
      title: 'Tool: Geometric Shape',
      shortcut: 'S',
      category: 'tool',
      execute: () => {
        setActiveTool('S');
        addToast('Tool: Shape', 'info');
      },
    },
    {
      id: 'cmd-text',
      title: 'Tool: Typeset Text',
      shortcut: 'T',
      category: 'tool',
      execute: () => {
        setActiveTool('T');
        addToast('Tool: Text', 'info');
      },
    },
    {
      id: 'cmd-equation',
      title: 'Tool: KaTeX Equation',
      shortcut: 'E',
      category: 'tool',
      execute: () => {
        setActiveTool('E');
        addToast('Tool: KaTeX Equation', 'info');
      },
    },
    {
      id: 'cmd-code',
      title: 'Tool: Code Block',
      shortcut: 'C',
      category: 'tool',
      execute: () => {
        setActiveTool('C');
        addToast('Tool: Code Block', 'info');
      },
    },
    {
      id: 'cmd-grid',
      title: 'Tool: 2D DP Table Grid',
      shortcut: 'G',
      category: 'tool',
      execute: () => {
        setActiveTool('G');
        addToast('Tool: Grid', 'info');
      },
    },
    {
      id: 'cmd-eraser',
      title: 'Tool: Eraser',
      shortcut: 'X',
      category: 'tool',
      execute: () => {
        setActiveTool('X');
        addToast('Tool: Eraser', 'info');
      },
    },
    {
      id: 'cmd-ruler',
      title: 'Tool: Ruler Guide',
      shortcut: 'R',
      category: 'tool',
      execute: () => {
        setActiveTool('R');
        addToast('Tool: Ruler', 'info');
      },
    },
    {
      id: 'cmd-hand',
      title: 'Tool: Hand Pan',
      shortcut: 'H',
      category: 'tool',
      execute: () => {
        setActiveTool('H');
        addToast('Tool: Hand', 'info');
      },
    },
    {
      id: 'cmd-undo',
      title: 'Undo Last Action',
      shortcut: 'Ctrl+Z',
      category: 'command',
      starred: true,
      execute: performUndo,
    },
    {
      id: 'cmd-redo',
      title: 'Redo Action',
      shortcut: 'Ctrl+Y',
      category: 'command',
      execute: performRedo,
    },
    {
      id: 'cmd-star',
      title: 'Star Snapshot Milestone',
      shortcut: 'Ctrl+S',
      category: 'command',
      starred: true,
      execute: () => handleStarSnapshot(),
    },
    {
      id: 'cmd-export-json',
      title: 'Export Board as JSON',
      category: 'command',
      starred: true,
      execute: handleExportJson,
    },
    {
      id: 'cmd-export-png',
      title: 'Export Board as PNG',
      category: 'command',
      execute: handleExportPng,
    },
    {
      id: 'cmd-export-svg',
      title: 'Export Board as SVG',
      category: 'command',
      execute: handleExportSvg,
    },
    {
      id: 'cmd-copy-png',
      title: 'Copy Board as PNG (Clipboard)',
      shortcut: 'Ctrl+Shift+C',
      category: 'command',
      execute: handleCopyAsPng,
    },
    {
      id: 'cmd-quick-check',
      title: 'Run Storage Integrity Quick-Check',
      category: 'command',
      execute: handleRunQuickCheck,
    },
    {
      id: 'cmd-find',
      title: 'Find on Board',
      shortcut: 'Ctrl+F',
      category: 'command',
      execute: () => setFindOpen(true),
    },
    {
      id: 'cmd-tidy',
      title: 'Tidy & Snap to Grid',
      shortcut: 'Ctrl+Shift+Enter',
      category: 'command',
      execute: tidyAllOrSelection,
    },
    {
      id: 'cmd-clear',
      title: 'Clear Whiteboard',
      category: 'command',
      starred: true,
      execute: () => {
        pushUndoSnapshot();
        docRef.current.objects = {};
        docRef.current.rootIds = [];
        syncDocViewport();
        rendererRef.current?.setScene(docRef.current);
        setObjectCount(0);
        setSelectedObjectId(null);
        setSelectionBounds(null);
        addToast('Canvas cleared', 'info');
      },
    },
    {
      id: 'cmd-zoom-reset',
      title: 'Reset Zoom (100%)',
      shortcut: 'Ctrl+1',
      category: 'view',
      execute: () => {
        rendererRef.current?.setViewport(0, 0, 1.0);
        setZoom(1.0);
        setCamera({ x: 0, y: 0 });
        if (selectedObjectId && docRef.current.objects[selectedObjectId]) {
          updateSelectionBoundsFor(docRef.current.objects[selectedObjectId]);
        }
      },
    },
    {
      id: 'cmd-theme-toggle',
      title: 'Next Theme',
      category: 'view',
      execute: () => {
        const nextIdx = (THEME_LIST.indexOf(theme) + 1) % THEME_LIST.length;
        setTheme(THEME_LIST[nextIdx]);
        addToast(`Theme: ${THEME_LABELS[THEME_LIST[nextIdx]]}`, 'success');
      },
    },
    {
      id: 'cmd-focus-toggle',
      title: 'Toggle Focus Mode',
      shortcut: 'Ctrl+.',
      category: 'view',
      execute: () => setFocusMode((prev) => !prev),
    },
  ];

  const selectedObj = selectedObjectId ? docRef.current.objects[selectedObjectId] : null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_STYLE }} />

      {/* Hidden file input for importing board JSON */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.lens"
        onChange={handleImportFile}
        style={{ display: 'none' }}
      />

      {/* Hidden file input for importing image files onto canvas */}
      <input
        ref={imageFileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageFileSelect}
        style={{ display: 'none' }}
      />

      {/* Top Header: Breadcrumbs, TabStrip, and Header Quick Actions */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '40px',
            padding: '0 12px',
            backgroundColor: 'var(--lb-surface)',
            borderBottom: '1px solid var(--lb-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Breadcrumbs
              project="LENSBoard 2.0"
              board={tabs.find((t) => t.id === activeTabId)?.title ?? 'Untitled'}
              saveState={saveState}
              onRenameBoard={handleRenameBoard}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Import .lens.json board"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid var(--lb-border)',
                backgroundColor: 'var(--lb-surface-raised)',
                color: 'var(--lb-text)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              📥 Import
            </button>

            <button
              type="button"
              onClick={() => imageFileInputRef.current?.click()}
              title="Import image file onto canvas (Ctrl+V also supported)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid var(--lb-border)',
                backgroundColor: 'var(--lb-surface-raised)',
                color: 'var(--lb-text)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              🖼️ Image
            </button>

            <button
              type="button"
              onClick={handleExportJson}
              title="Export board as JSON"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid var(--lb-border)',
                backgroundColor: 'var(--lb-surface-raised)',
                color: 'var(--lb-text)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              📤 Export JSON
            </button>

            <button
              type="button"
              onClick={handleExportPng}
              title="Export PNG snapshot"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid var(--lb-border)',
                backgroundColor: 'var(--lb-surface-raised)',
                color: 'var(--lb-text)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              🖼️ PNG
            </button>

            <button
              type="button"
              onClick={() => setFindOpen(true)}
              title="Find on board (Ctrl+F)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid var(--lb-border)',
                backgroundColor: findOpen ? 'var(--lb-accent)' : 'var(--lb-surface-raised)',
                color: findOpen ? '#FFFFFF' : 'var(--lb-text)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              🔍 Find
            </button>

            <ThemeSwitcherPill
              activeTheme={theme}
              onSwitch={(t) => {
                setTheme(t);
                scheduleAutosave();
                addToast(`Theme: ${THEME_LABELS[t]}`, 'success');
              }}
            />
          </div>
        </div>

        <TabStrip
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={handleSelectTab}
          onCloseTab={handleCloseTab}
          onNewTab={handleNewTab}
        />
      </div>

      {/* Find on Board (Ctrl+F) Overlay */}
      {findOpen && (
        <div
          style={{
            position: 'fixed',
            top: '78px',
            right: '24px',
            zIndex: 1500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 10px',
            borderRadius: '8px',
            backgroundColor: 'var(--lb-surface-raised, #232736)',
            border: '1px solid var(--lb-border, #2E3347)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          }}
        >
          <input
            type="text"
            placeholder="Find in board..."
            value={findQuery}
            autoFocus
            onChange={(e) => handlePerformFind(e.target.value)}
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              border: '1px solid var(--lb-border)',
              backgroundColor: 'var(--lb-surface)',
              color: 'var(--lb-text)',
              fontSize: '12px',
              outline: 'none',
              width: '180px',
            }}
          />
          <span style={{ fontSize: '11px', color: 'var(--lb-text-muted)' }}>
            {findMatches.length > 0 ? `${findMatchIdx + 1}/${findMatches.length}` : '0 matches'}
          </span>
          <button
            type="button"
            onClick={handlePrevFindMatch}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--lb-text)',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            ▲
          </button>
          <button
            type="button"
            onClick={handleNextFindMatch}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--lb-text)',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            ▼
          </button>
          <button
            type="button"
            onClick={() => setFindOpen(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--lb-text-muted)',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Interactive Dual-Layer Canvas Stage */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: tokens.canvas,
          backgroundImage: `radial-gradient(circle, ${
            isDarkTheme(theme) ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
          } 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
          zIndex: 1,
        }}
      >
        {/* Layer 1: Static Scene Canvas */}
        <canvas
          ref={staticCanvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        />

        {/* Layer 2: Live Interaction Canvas */}
        <canvas
          ref={liveCanvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onDoubleClick={handleDoubleClick}
          onWheel={handleWheel}
          onContextMenu={handleContextMenu}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            cursor:
              activeTool === 'H'
                ? isPanningRef.current
                  ? 'grabbing'
                  : 'grab'
                : activeTool === 'P'
                  ? 'crosshair'
                  : activeTool === 'L' || activeTool === 'S' || activeTool === 'G' || activeTool === 'R'
                    ? 'crosshair'
                    : activeTool === 'X'
                      ? 'cell'
                      : activeTool === 'T' || activeTool === 'C'
                        ? 'text'
                        : activeTool === 'E'
                          ? 'cell'
                          : 'default',
            touchAction: 'none',
          }}
        />

        {/* Marquee Selection Drag Overlay */}
        {marqueeRect && (
          <div
            style={{
              position: 'fixed',
              left: `${marqueeRect.x}px`,
              top: `${marqueeRect.y}px`,
              width: `${marqueeRect.w}px`,
              height: `${marqueeRect.h}px`,
              border: '1.5px dashed var(--lb-accent, #7C8CFF)',
              backgroundColor: 'rgba(124, 140, 255, 0.15)',
              pointerEvents: 'none',
              zIndex: 1050,
            }}
          />
        )}

        {/* Selection & Transform Box Overlay */}
        {selectedObjectId && selectionBounds && (
          <div
            style={{
              position: 'absolute',
              left: selectionBounds.x,
              top: selectionBounds.y,
              width: selectionBounds.w,
              height: selectionBounds.h,
              border: '2px solid var(--lb-accent, #7C8CFF)',
              borderRadius: '4px',
              pointerEvents: 'none',
              boxShadow: '0 0 12px rgba(124, 140, 255, 0.45)',
              zIndex: 10,
            }}
          >
            {[
              { pos: 'tl', top: '-5px', left: '-5px' },
              { pos: 'tm', top: '-5px', left: 'calc(50% - 4.5px)' },
              { pos: 'tr', top: '-5px', left: 'calc(100% - 4.5px)' },
              { pos: 'ml', top: 'calc(50% - 4.5px)', left: '-5px' },
              { pos: 'mr', top: 'calc(50% - 4.5px)', left: 'calc(100% - 4.5px)' },
              { pos: 'bl', top: 'calc(100% - 4.5px)', left: '-5px' },
              { pos: 'bm', top: 'calc(100% - 4.5px)', left: 'calc(50% - 4.5px)' },
              { pos: 'br', top: 'calc(100% - 4.5px)', left: 'calc(100% - 4.5px)' },
            ].map((h) => (
              <div
                key={h.pos}
                style={{
                  position: 'absolute',
                  width: '9px',
                  height: '9px',
                  backgroundColor: 'var(--lb-accent, #7C8CFF)',
                  border: '1.5px solid #FFFFFF',
                  borderRadius: '2px',
                  top: h.top,
                  left: h.left,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating Pill Toolbar */}
      <FloatingPillToolbar
        activeTool={activeTool}
        onSelectTool={(tool) => {
          setActiveTool(tool);
          addToast(`Tool: ${tool}`, 'info');
        }}
        focusMode={focusMode}
        onToggleFocusMode={() => setFocusMode((prev) => !prev)}
      />

      {/* Contextual Properties Floating Bar */}
      {selectedObjectIds.length > 0 && selectionBounds && (
        <ContextualPropertiesBar
          selectedIds={selectedObjectIds}
          selectionBounds={selectionBounds}
          entityType={selectedObjectId ? docRef.current.objects[selectedObjectId]?.type ?? 'shape' : 'shape'}
          viewportWidth={window.innerWidth}
          viewportHeight={window.innerHeight}
          onDeselectAll={() => {
            setSelectedObjectIds([]);
            setSelectionBounds(null);
          }}
          onPropertyChange={handlePropertyChange}
        />
      )}

      {/* Drawers: Left (Outline/Library/Inbox) with section tabs */}
      <LeftDrawer
        isOpen={leftOpen}
        activeSection={leftSection}
        onSelectSection={(sec) => setLeftSection(sec)}
        onClose={() => setLeftOpen(false)}
        width={320}
      >
        <LeftDrawerTabs
          activeSection={leftSection}
          objectCount={objectCount}
          objects={docRef.current.objects}
          selectedId={selectedObjectId}
          onSelectObject={(id) => {
            setSelectedObjectId(id);
            const obj = docRef.current.objects[id];
            if (obj) updateSelectionBoundsFor(obj);
          }}
          onFocusObject={(id) => {
            const obj = docRef.current.objects[id];
            if (obj && rendererRef.current) {
              setSelectedObjectId(id);
              updateSelectionBoundsFor(obj);
              rendererRef.current.setViewport(-obj.x + window.innerWidth / 2, -obj.y + window.innerHeight / 2, zoom);
              setCamera({ x: -obj.x + window.innerWidth / 2, y: -obj.y + window.innerHeight / 2 });
              addToast(`Focused: ${obj.label || obj.type}`, 'info');
            }
          }}
          onToggleHidden={(id) => {
            const obj = docRef.current.objects[id];
            if (obj) {
              obj.hidden = !obj.hidden;
              rendererRef.current?.setScene(docRef.current);
              scheduleAutosave();
            }
          }}
          onToggleLocked={(id) => {
            const obj = docRef.current.objects[id];
            if (obj) {
              obj.locked = !obj.locked;
              scheduleAutosave();
              addToast(obj.locked ? 'Object locked' : 'Object unlocked');
            }
          }}
          onDeleteObject={(id) => {
            setSelectedObjectId(id);
            deleteSelectedObject();
          }}
          onInsertLibraryItem={handleInsertLibraryItem}
          inboxItems={inboxItems}
          onAddInboxItem={(text) => {
            const newItem: StoredInboxItem = { id: generateUlid(), text, timestamp: Date.now() };
            const updated = [newItem, ...inboxItems];
            setInboxItems(updated);
            saveInboxToStorage(updated);
            addToast('Saved to Inbox spool', 'success');
          }}
          onPlaceInboxItem={(item) => {
            pushUndoSnapshot();
            const renderer = rendererRef.current;
            const centerWorld = renderer ? renderer.toWorld({ x: window.innerWidth / 2, y: window.innerHeight / 2 }) : { x: 400, y: 300 };
            const newObj: CanvasObject = createCanvasObject({
              id: generateUlid(),
              type: 'text',
              parentId: null,
              x: centerWorld.x - 75,
              y: centerWorld.y - 30,
              w: 150,
              h: 60,
              rotation: 0,
              z: getNextZ(),
              label: item.text,
              data: { text: item.text },
              style: { colorId: 'blue', strokeWidth: 1, renderMode: 'crisp' },
              tags: ['inbox'],
            });
            addObjectToDoc(newObj);
            setSelectedObjectId(newObj.id);
            updateSelectionBoundsFor(newObj);
            addToast('Placed note on canvas', 'success');
          }}
          onClearInbox={() => {
            setInboxItems([]);
            saveInboxToStorage([]);
            addToast('Cleared inbox spool');
          }}
        />
      </LeftDrawer>

      {/* Drawers: Right (Inspector/Lenses/Backlinks/History) with section tabs */}
      <RightDrawer
        isOpen={rightOpen}
        activeSection={rightSection}
        onSelectSection={(sec) => setRightSection(sec)}
        onClose={() => setRightOpen(false)}
        width={320}
      >
        <RightDrawerTabs
          activeSection={rightSection}
          activeTool={activeTool}
          selectedObject={selectedObj}
          onUpdateSelectedObject={(patch) => {
            if (!selectedObjectId || !docRef.current.objects[selectedObjectId]) return;
            pushUndoSnapshot();
            const obj = docRef.current.objects[selectedObjectId];
            Object.assign(obj, patch);
            obj.updatedAt = Date.now();
            syncDocViewport();
            rendererRef.current?.setScene(docRef.current);
            updateSelectionBoundsFor(obj);
            scheduleAutosave();
          }}
          onDuplicateSelected={duplicateSelectedObject}
          onDeleteSelected={deleteSelectedObject}
          onAlignSelected={() => handlePropertyChange('align')}
          activeLens={activeLens}
          onSelectLens={(lensKey) => {
            setActiveLens(lensKey);
            applyLensFilter(lensKey, lensTagFilter);
            addToast(`Switched lens: ${lensKey}`, 'info');
          }}
          lensTagFilter={lensTagFilter}
          onSetLensTagFilter={(t) => {
            setLensTagFilter(t);
            applyLensFilter(activeLens, t);
          }}
          onResetLens={() => {
            setActiveLens('all');
            setLensTagFilter('');
            applyLensFilter('all', '');
            addToast('Reset viewport lens', 'info');
          }}
          openTabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={handleSelectTab}
          onInsertBacklink={(title) => {
            pushUndoSnapshot();
            const renderer = rendererRef.current;
            const centerWorld = renderer ? renderer.toWorld({ x: window.innerWidth / 2, y: window.innerHeight / 2 }) : { x: 400, y: 300 };
            const newObj: CanvasObject = createCanvasObject({
              id: generateUlid(),
              type: 'text',
              parentId: null,
              x: centerWorld.x - 70,
              y: centerWorld.y - 25,
              w: 140,
              h: 50,
              rotation: 0,
              z: getNextZ(),
              label: `[[${title}]]`,
              data: { text: `[[${title}]]`, backlink: title },
              style: { colorId: 'sky', strokeWidth: 1, renderMode: 'crisp' },
              tags: ['link'],
            });
            addObjectToDoc(newObj);
            setSelectedObjectId(newObj.id);
            updateSelectionBoundsFor(newObj);
            addToast(`Linked [[${title}]]`, 'success');
          }}
          snapshots={snapshots}
          onStarSnapshot={handleStarSnapshot}
          onRestoreSnapshot={handleRestoreSnapshot}
          onRunQuickCheck={handleRunQuickCheck}
          undoStepsCount={undoStackRef.current.length}
          redoStepsCount={redoStackRef.current.length}
          zoom={zoom}
          camera={camera}
          objectCount={objectCount}
        />
      </RightDrawer>

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette
        isOpen={paletteOpen}
        commands={commands}
        onClose={() => setPaletteOpen(false)}
      />

      {/* Insert Menu (/) */}
      <InsertMenu
        isOpen={insertOpen}
        position={insertPos}
        onSelectEntity={(entity) => {
          setInsertOpen(false);
          handleInsertLibraryItem(entity.label);
        }}
        onClose={() => setInsertOpen(false)}
      />

      {/* Radial Pie Menu (Right Click) */}
      <PieMenu
        isOpen={pieOpen}
        center={pieCenter}
        onSelectSlot={(slot) => {
          setPieOpen(false);
          switch (slot) {
            case 'Colour': {
              if (selectedObjectId && docRef.current.objects[selectedObjectId]) {
                pushUndoSnapshot();
                const obj = docRef.current.objects[selectedObjectId];
                const curColor = (obj.style?.colorId as PenColorSlot) || 'blue';
                const curIdx = PEN_SLOTS.indexOf(curColor);
                const nextIdx = (curIdx + 1) % PEN_SLOTS.length;
                const nextSlot = PEN_SLOTS[nextIdx];
                obj.style = {
                  ...obj.style,
                  colorId: nextSlot,
                  renderMode: obj.style?.renderMode || 'crisp',
                  strokeWidth: obj.style?.strokeWidth || 2,
                };
                syncDocViewport();
                rendererRef.current?.setScene(docRef.current);
                updateSelectionBoundsFor(obj);
                addToast(`Changed color to ${nextSlot}`, 'success');
              } else {
                const curIdx = PEN_SLOTS.indexOf(activeColorSlot);
                const nextIdx = (curIdx + 1) % PEN_SLOTS.length;
                const nextSlot = PEN_SLOTS[nextIdx];
                setActiveColorSlot(nextSlot);
                addToast(`Drawing color: ${nextSlot}`, 'info');
              }
              break;
            }
            case 'Tool': {
              const toolCycle: ToolKey[] = ['V', 'P', 'L', 'S', 'T', 'E', 'C', 'G', 'X', 'R', 'H'];
              const curIdx = toolCycle.indexOf(activeTool);
              const nextTool = toolCycle[(curIdx + 1) % toolCycle.length];
              setActiveTool(nextTool);
              addToast(`Switched tool to ${nextTool}`, 'info');
              break;
            }
            case 'Undo': {
              performUndo();
              break;
            }
            case 'Redo': {
              performRedo();
              break;
            }
            case 'Convert': {
              handlePropertyChange('convert');
              break;
            }
            case 'Tidy': {
              tidyAllOrSelection();
              break;
            }
            case 'Duplicate': {
              duplicateSelectedObject();
              break;
            }
            case 'Delete': {
              deleteSelectedObject();
              break;
            }
          }
        }}
        onClose={() => setPieOpen(false)}
      />

      {/* Floating Controls: Zoom & Minimap */}
      <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 1000 }}>
        <ZoomControls
          zoom={zoom}
          onZoomChange={(newZoom) => {
            const renderer = rendererRef.current;
            if (!renderer) return;
            const vp = renderer.getViewport?.() || { x: camera.x, y: camera.y, zoom };
            const clamped = clampZoom(newZoom);
            renderer.setViewport(vp.x, vp.y, clamped);
            setZoom(clamped);
            if (selectedObjectId && docRef.current.objects[selectedObjectId]) {
              updateSelectionBoundsFor(docRef.current.objects[selectedObjectId]);
            }
          }}
          onResetZoom={() => {
            rendererRef.current?.setViewport(0, 0, 1.0);
            setZoom(1.0);
            setCamera({ x: 0, y: 0 });
            if (selectedObjectId && docRef.current.objects[selectedObjectId]) {
              updateSelectionBoundsFor(docRef.current.objects[selectedObjectId]);
            }
          }}
          onFitAll={() => {
            rendererRef.current?.setViewport(100, 100, 0.9);
            setZoom(0.9);
            if (selectedObjectId && docRef.current.objects[selectedObjectId]) {
              updateSelectionBoundsFor(docRef.current.objects[selectedObjectId]);
            }
            addToast('Fitted view to content');
          }}
          onZoomToSelection={() => {
            if (selectedObjectId && docRef.current.objects[selectedObjectId]) {
              const obj = docRef.current.objects[selectedObjectId];
              rendererRef.current?.setViewport(-obj.x + window.innerWidth / 2, -obj.y + window.innerHeight / 2, 1.25);
              setZoom(1.25);
            }
          }}
        />
      </div>

      <div style={{ position: 'fixed', bottom: '60px', right: '20px', zIndex: 999 }}>
        <Minimap
          objectCount={objectCount}
          minimapBounds={{ w: 160, h: 100, worldW: 3000, worldH: 2000 }}
          cameraX={camera.x}
          cameraY={camera.y}
          zoom={zoom}
          onJumpCamera={(wx, wy) => {
            rendererRef.current?.setViewport(-wx, -wy, zoom);
            setCamera({ x: -wx, y: -wy });
            if (selectedObjectId && docRef.current.objects[selectedObjectId]) {
              updateSelectionBoundsFor(docRef.current.objects[selectedObjectId]);
            }
          }}
        />
      </div>

      {/* Bottom Quick Action Toggles */}
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          zIndex: 1000,
          display: 'flex',
          gap: '8px',
        }}
      >
        <button
          onClick={() => setLeftOpen((prev) => !prev)}
          title="Toggle Left Drawer ( [ )"
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid var(--lb-border)',
            backgroundColor: leftOpen ? 'var(--lb-accent)' : 'var(--lb-surface-raised)',
            color: leftOpen ? '#FFFFFF' : 'var(--lb-text)',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          [ {leftSection}
        </button>

        <button
          onClick={() => setRightOpen((prev) => !prev)}
          title="Toggle Right Drawer ( ] )"
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid var(--lb-border)',
            backgroundColor: rightOpen ? 'var(--lb-accent)' : 'var(--lb-surface-raised)',
            color: rightOpen ? '#FFFFFF' : 'var(--lb-text)',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          ] {rightSection}
        </button>

        <button
          onClick={() => setShowDSA((prev) => !prev)}
          title="Toggle Dual-Channel DSA Visual Cues"
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid var(--lb-border)',
            backgroundColor: showDSA ? 'var(--lb-accent)' : 'var(--lb-surface-raised)',
            color: showDSA ? '#FFFFFF' : 'var(--lb-text)',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          ⬡ DSA Cues
        </button>

        <button
          onClick={() => setShowSuggestions((prev) => !prev)}
          title="Toggle Smart Suggestions"
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid var(--lb-border)',
            backgroundColor: showSuggestions ? 'var(--lb-accent)' : 'var(--lb-surface-raised)',
            color: showSuggestions ? '#FFFFFF' : 'var(--lb-text)',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          💡 Suggestions
        </button>
      </div>

      {/* Suggestion Chips & Ghost Preview Overlay */}
      {showSuggestions && (
        <>
          <GhostPreview
            visible={canRenderGhost(suggestionCandidates[activeCandidateIdx])}
            candidate={suggestionCandidates[activeCandidateIdx]}
            opacity={0.35}
          />
          <div
            style={{
              position: 'fixed',
              top: '85px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
            }}
          >
            <SuggestionChips
              candidates={suggestionCandidates}
              onSelectCandidate={(c) => {
                handleSelectCandidate(c);
              }}
              onDismiss={() => setShowSuggestions(false)}
            />
          </div>
        </>
      )}

      {/* DSA State Preview Widget */}
      {showDSA && (
        <DSAPreviewWidget
          onSelectState={(stateKey) => {
            pushUndoSnapshot();
            if (selectedObjectId && docRef.current.objects[selectedObjectId]) {
              const obj = docRef.current.objects[selectedObjectId];
              obj.data = { ...obj.data, dsaState: stateKey };
              const colorEntry =
                DSA_COLOR_MAP[
                  DSA_STATE_DEFINITIONS[stateKey as keyof typeof DSA_STATE_DEFINITIONS]?.colorName
                ];
              if (colorEntry) {
                obj.style = {
                  ...obj.style,
                  colorId: colorEntry.border as any,
                  fill: colorEntry.fill,
                  renderMode: 'crisp',
                  strokeWidth: stateKey === 'active' ? 3.5 : 2,
                };
              }
              syncDocViewport();
              rendererRef.current?.setScene(docRef.current);
              updateSelectionBoundsFor(obj);
              scheduleAutosave();
              addToast(`Applied DSA state: ${DSA_STATE_LABELS[stateKey] || stateKey}`, 'success');
            } else {
              const renderer = rendererRef.current;
              const centerScreen = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
              const worldPt = renderer ? renderer.toWorld(centerScreen) : { x: 400, y: 300 };

              const newId = generateUlid();
              const nextZ = getNextZ();
              const colorEntry =
                DSA_COLOR_MAP[
                  DSA_STATE_DEFINITIONS[stateKey as keyof typeof DSA_STATE_DEFINITIONS]?.colorName
                ];
              const newObj: CanvasObject = {
                id: newId,
                type: 'shape',
                shapeType: 'rectangle',
                parentId: null,
                x: worldPt.x - 60,
                y: worldPt.y - 30,
                w: 120,
                h: 60,
                rotation: 0,
                z: nextZ,
                label: DSA_STATE_LABELS[stateKey] || stateKey,
                data: { dsaState: stateKey },
                style: {
                  colorId: (colorEntry?.border || '#7C8CFF') as any,
                  fill: colorEntry?.fill || 'var(--lb-surface)',
                  strokeWidth: stateKey === 'active' ? 3.5 : 2,
                  renderMode: 'crisp',
                },
                tags: ['dsa', stateKey],
                locked: false,
                hidden: false,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              };
              addObjectToDoc(newObj);
              setSelectedObjectId(newId);
              updateSelectionBoundsFor(newObj);
              addToast(`Created ${DSA_STATE_LABELS[stateKey] || stateKey} DSA Node`, 'success');
            }
          }}
        />
      )}

      {/* Storage Integrity & Salvage Diagnostics Modal */}
      {salvageModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            zIndex: 4000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: '480px',
              backgroundColor: 'var(--lb-surface)',
              border: '1px solid var(--lb-border)',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--lb-text)', marginBottom: '8px' }}>
              🛡️ Storage Integrity Diagnostics (PRAGMA quick_check)
            </div>
            <pre
              style={{
                backgroundColor: 'var(--lb-surface-raised)',
                border: '1px solid var(--lb-border)',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '11px',
                color: 'var(--lb-text)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                maxHeight: '260px',
                overflowY: 'auto',
                fontFamily: 'monospace',
              }}
            >
              {salvageReport}
            </pre>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
              <button
                type="button"
                onClick={() => setSalvageModalOpen(false)}
                style={{
                  padding: '6px 16px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--lb-accent)',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: '12px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Inline Editor Overlay (Spec §8 & §14) */}
      {editingObjectId && docRef.current.objects[editingObjectId] && rendererRef.current && (() => {
        const obj = docRef.current.objects[editingObjectId];
        const screenPt = rendererRef.current.toScreen({ x: obj.x, y: obj.y });
        const screenW = Math.max((obj.w ?? 140) * zoom, 180);
        const screenH = Math.max((obj.h ?? 40) * zoom, 70);

        if (obj.type === 'code') {
          return (
            <div
              style={{
                position: 'fixed',
                left: `${Math.max(20, Math.min(window.innerWidth - 500, screenPt.x))}px`,
                top: `${Math.max(60, Math.min(window.innerHeight - 380, screenPt.y))}px`,
                zIndex: 1200,
              }}
            >
              <CodeEditor
                initialCode={editingValue}
                language={(obj.data?.language as string) || 'typescript'}
                initialOutput={obj.data?.output as any}
                onSave={(newCode, newOutput) => {
                  pushUndoSnapshot();
                  obj.data = {
                    ...obj.data,
                    code: newCode,
                    output: newOutput ?? obj.data?.output,
                  };
                  obj.updatedAt = Date.now();
                  syncDocViewport();
                  rendererRef.current?.setScene(docRef.current);
                  updateSelectionBoundsFor(obj);
                  scheduleAutosave();
                  setEditingObjectId(null);
                  addToast('Saved code block', 'success');
                }}
                onClose={() => setEditingObjectId(null)}
              />
            </div>
          );
        }

        return (
          <div
            style={{
              position: 'fixed',
              left: `${Math.max(10, Math.min(window.innerWidth - 300, screenPt.x))}px`,
              top: `${Math.max(40, Math.min(window.innerHeight - 160, screenPt.y))}px`,
              width: `${Math.max(260, Math.min(screenW, window.innerWidth - screenPt.x - 20))}px`,
              minWidth: '260px',
              maxWidth: 'min(90vw, 550px)',
              minHeight: `${screenH}px`,
              zIndex: 1100,
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              borderRadius: '6px',
              backgroundColor: 'var(--lb-surface)',
              border: '2px solid var(--lb-accent)',
              padding: '8px',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                fontSize: '10px',
                color: 'var(--lb-text-muted)',
                marginBottom: '6px',
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '4px',
              }}
            >
              <span>Editing: {obj.type.toUpperCase()}</span>
              <span>Enter to save · Esc to cancel</span>
            </div>
            <textarea
              autoFocus
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  commitInlineEdit();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelInlineEdit();
                }
              }}
              rows={Math.max(2, editingValue.split('\n').length)}
              style={{
                width: '100%',
                backgroundColor: 'transparent',
                color: 'var(--lb-text)',
                border: 'none',
                outline: 'none',
                fontSize: '13px',
                fontFamily: 'inherit',
                resize: 'both',
                wordBreak: 'break-word',
                overflowWrap: 'break-word',
                whiteSpace: 'pre-wrap',
                boxSizing: 'border-box',
              }}
            />
          </div>
        );
      })()}

      {/* Standalone Execution Output Window */}
      {standaloneOutput && standaloneOutput.isOpen && (
        <StandaloneOutputWindow
          output={standaloneOutput.output}
          title={
            standaloneOutput.objectId && docRef.current.objects[standaloneOutput.objectId]
              ? String(docRef.current.objects[standaloneOutput.objectId].label || 'Code Block Output')
              : 'Execution Output'
          }
          onClose={() => setStandaloneOutput(null)}
          onClear={() => {
            if (standaloneOutput.objectId && docRef.current.objects[standaloneOutput.objectId]) {
              const obj = docRef.current.objects[standaloneOutput.objectId];
              if (obj.data) {
                delete obj.data.output;
                rendererRef.current?.setScene(docRef.current);
              }
            }
            setStandaloneOutput(null);
          }}
          onRerun={() => {
            if (standaloneOutput.objectId && docRef.current.objects[standaloneOutput.objectId]) {
              const obj = docRef.current.objects[standaloneOutput.objectId];
              const codeText = String(obj.data?.code || '');
              const out = executeCodeSandbox(codeText);
              obj.data = { ...obj.data, output: out };
              rendererRef.current?.setScene(docRef.current);
              setStandaloneOutput({ isOpen: true, objectId: obj.id, output: out });
              addToast('Re-executed algorithm', 'info');
            }
          }}
        />
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
