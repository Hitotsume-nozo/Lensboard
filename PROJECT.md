# Project: LENSBoard 2.0

## Architecture
LENSBoard 2.0 is an elevated, local-first visual canvas system built with a strict monorepo architecture, downward-only package layering, pure document mutations, durable SQLite storage, high-performance Canvas 2D dual-layer rendering, and a floating React 18 UI chrome powered by WCAG AA design tokens.

```
                  ┌───────────────────────────────┐
                  │          apps/desktop         │
                  │   (Electron Main + Preload)   │
                  └──────┬─────────────────┬──────┘
                         │                 │
                         ▼                 ▼
          ┌─────────────────────────┐   ┌─────────────────────────┐
          │       packages/ui       │   │    packages/storage     │
          │  (React 18, Floating    │   │ (SQLite WAL, Op-Log,    │
          │  Chrome, Design Tokens) │   │ Group Commits, Salvage) │
          └──────────────┬──────────┘   └────────────┬────────────┘
                         │                           │
                         ▼                           │
          ┌─────────────────────────┐                │
          │     packages/render     │                │
          │ (Dual-layer Canvas 2D,  │                │
          │  rbush, 1€ Ink Engine)  │                │
          └──────────────┬──────────┘                │
                         │                           │
                         ▼                           ▼
          ┌───────────────────────────────────────────────┐
          │                packages/core                  │
          │ (Pure Document Model, Commands, Inverses,     │
          │  History, Fractional Indexing, Shortcuts)     │
          └───────────────────────────────────────────────┘
```

- **Data Flow**: Input Events -> Command Dispatch -> Pure Core Reducer -> Op-Log Persist -> Canvas Render Update.
- **Layering Enforcement**: `ui` -> `render` -> `core`; `storage` -> `core`; `core` imports nothing else. ESLint boundary rules fail CI on any upward package import.
- **Canvas / UI Separation**: Canvas entities are never React nodes. The UI chrome floats over the dual-layer Canvas 2D surface.

---

## Feature Inventory

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Monorepo Structure | Scaffold pnpm workspace with packages/core, render, storage, ui, apps/desktop | M1 | Spec §5 |
| 2 | Downward Dependency Rule | ESLint boundaries enforcing downward-only imports; core imports nothing in repo | M1 | Spec §5, AC |
| 3 | Workspace Build & Verify | Root build, typecheck, lint, and verify scripts running across all packages | M1 | Spec §5, AC |
| 4 | Token Matrix & 5 Themes | Semantic tokens (Midnight, Paper, Blueprint, Blackboard, High-Contrast) | M2 | Spec §13, AC |
| 5 | WCAG AA Contrast Compliance | Text/surface contrast >= 4.5:1, dark pen palette >= 3:1 | M2 | Spec §13, AC |
| 6 | Pen Palette Hardening | 10 semantic pen slots (ink, gray, Okabe-Ito 7 colors, custom) | M2 | Spec §13 |
| 7 | Micro-Interactions System | 120-180ms ease-out transitions, reduced-motion instant bypass | M2 | Spec §13 |
| 8 | Dual-Channel DSA Visual Coding | Fills + geometric shape cues (corner triangle, dashed stroke, hatch, star badge) | M2 | Spec §13, AC |
| 9 | Pure Document Schema | 21 entity types, ULID IDs, fractional indexing `z`, pure immutable doc state | M3 | Spec §6 |
| 10 | Typed Command Inversion | Serializable mutations (create, update, delete, move, resize, etc.) with exact inverses | M3 | Spec §6, AC |
| 11 | Command Coalescing & History | 300ms coalescing of rapid property edits, multi-level undo/redo stacks | M3 | Spec §6, AC |
| 12 | Source Ink Preservation | Non-destructive conversion preserving source strokes (`hidden: true`, revertible) | M3 | Spec §6 |
| 13 | SQLite WAL Mode & Schema | Schema DDL (meta, projects, boards, objects, ops, snapshots), PRAGMA WAL | M3 | Spec §7, AC |
| 14 | Atomic Dual-Write & Op-Log | Atomic transaction appending to `ops` and updating `objects` | M3 | Spec §7 |
| 15 | Group Commits & Flush | 100ms debounced group commits, immediate flush on blur/quit | M3 | Spec §7 |
| 16 | Snapshots & Salvage Mode | Snapshots every 500 ops / 5 min, PRAGMA quick_check, salvage recovery without overwrite | M3 | Spec §7 |
| 17 | Shortcut Registry | Centralized hotkey registry with duplicate default binding conflict detection | M3 | Spec §14, AC |
| 18 | Dual-Layer Canvas 2D Pipeline | Stacked DPR canvases: static scene layer + live interaction rAF layer | M4 | Spec §8, AC |
| 19 | Spatial Indexing & Culling | rbush bounding box index for viewport culling and hit testing (6px stroke, 24px handle) | M4 | Spec §8 |
| 20 | 60fps Pan and Zoom | Pan (Space/Middle drag), cursor-centered exponential zoom `exp(-deltaY * 0.0015)` | M4 | Spec §8, AC |
| 21 | Ink Stabilization Pipeline | Lazy-String stabilizer ($r = \text{percent} \times 0.4\text{px}$) + One-Euro low-pass filter | M4 | Spec §9 |
| 22 | Dynamic Outline & Freehand | `perfect-freehand` velocity-sensitive outline (3px default, taper 6px) | M4 | Spec §9, AC |
| 23 | Ink Modifier Modes | Shift-snap 45° straight lines, Ctrl precision mode (40% speed + ghost cursor), whole-stroke eraser | M4 | Spec §9 |
| 24 | Breadcrumbs & Tab Strip | Top chrome breadcrumb (Project / Board) with save dot and slim board tab strip | M5 | Spec §13, AC |
| 25 | Floating Pill Toolbar | 48px height, 11 tool buttons (V, P, L, S, T, E, C, G, X, R, H), focus mode collapse | M5 | Spec §13, AC |
| 26 | Contextual Properties Bar | 40px height, 8px dynamically positioned above selection, adapts to entity type | M5 | Spec §13, AC |
| 27 | Collapsible Dual Drawers | 320px drawers toggled via `[` (Outline/Library/Inbox) and `]` (Inspector/Lenses) | M5 | Spec §13, AC |
| 28 | Command Palette & Menus | Ctrl+K fuzzy palette, Insert menu (/), 8-slot right-click pie menu | M5 | Spec §13, AC |
| 29 | Suggestion Chips & Minimap | Ghost preview suggestion chips, 160x100px click-to-jump minimap, zoom controls | M5 | Spec §13 |
| 30 | Comprehensive Automated Verification | >=90% test coverage, fast-check 1,000 runs command reversibility, pnpm verify zero errors | M6 | Spec §15, AC |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Monorepo & Package Layering (R1) | Scaffold pnpm monorepo, strict TS project refs, downward ESLint import boundary rules, root build/lint/test scripts | none | DONE |
| M2 | UI Style System & Design Tokens (R2) | 5 themes, WCAG AA compliance, semantic pen palette, micro-interactions, dual-channel DSA state indicators | M1 | PLANNED |
| M3 | Core Engine & SQLite Storage (R4) | Pure doc schema, typed invertible commands, coalescing, undo/redo, shortcut registry with conflict detection, SQLite WAL storage | M1 | PLANNED |
| M4 | Canvas 2D Pipeline & Ink Engine (R4) | Dual-layer canvas 2D, rbush spatial indexing, 60fps pan/zoom, One-Euro filter + perfect-freehand ink engine, precision modes | M1, M3 | PLANNED |
| M5 | Floating Canvas Chrome & Controls (R3) | Floating pill toolbar (11 tools), contextual bar, drawers (`[`/`]`), command palette, pie menu, tab strip, minimap | M2, M4 | PLANNED |
| M6 | Final Verification & Adversarial Hardening (R5) | Phase 1: 100% E2E test pass (Tiers 1-4). Phase 2: Adversarial coverage hardening (Tier 5). | M1-M5, TEST_READY | PLANNED |

---

## Interface Contracts

### 1. `packages/core` ↔ All Layers
- **Document Model**:
  ```ts
  export interface LensDocument {
    schemaVersion: number;
    id: string; // ULID
    title: string;
    objects: Record<string, CanvasObject>;
    rootIds: string[]; // sorted by fractional index z
    viewport: { x: number; y: number; zoom: number };
  }
  ```
- **Command & Inversion**:
  ```ts
  export interface Command {
    id: string;
    type: string;
    timestamp: number;
    targets: string[];
    payload: unknown;
  }
  export function apply(doc: LensDocument, command: Command): { doc: LensDocument; inverse: Command };
  ```
- **Shortcut Registry**:
  ```ts
  export interface ShortcutBinding {
    id: string;
    keys: string; // e.g. "Ctrl+K", "v", "["
    context: 'global' | 'canvas' | 'editor';
    action: string;
  }
  export function detectDuplicateBindings(bindings: ShortcutBinding[]): string[]; // returns error list
  ```

### 2. `packages/storage` ↔ `packages/core`
- **Storage Service**:
  ```ts
  export interface StorageService {
    open(path: string): Promise<void>;
    persistOp(command: Command, docSnapshot?: LensDocument): Promise<void>;
    loadLatestSnapshot(): Promise<{ doc: LensDocument; opsSince: Command[] }>;
    quickCheck(): Promise<boolean>;
    salvage(): Promise<LensDocument>;
    flush(): Promise<void>;
    close(): Promise<void>;
  }
  ```

### 3. `packages/render` ↔ `packages/core` & `packages/ui`
- **Renderer Contract**:
  ```ts
  export interface CanvasRenderer {
    setScene(doc: LensDocument): void;
    setViewport(x: number, y: number, zoom: number): void;
    toWorld(screenPoint: { x: number; y: number }): { x: number; y: number };
    toScreen(worldPoint: { x: number; y: number }): { x: number; y: number };
    hitTest(worldPoint: { x: number; y: number }): CanvasObject | null;
    startLiveStroke(point: { x: number; y: number; t: number }): void;
    appendLiveStrokePoint(point: { x: number; y: number; t: number }): void;
    finishLiveStroke(): StrokeObject;
    renderFrame(): void;
    dispose(): void;
  }
  ```

### 4. `packages/ui` ↔ `packages/core` & `packages/render`
- **Theme Contract**:
  ```ts
  export type ThemeName = 'midnight' | 'paper' | 'blueprint' | 'blackboard' | 'high-contrast';
  export interface ThemeTokens {
    canvas: string;
    surface: string;
    surfaceRaised: string;
    border: string;
    text: string;
    textMuted: string;
    accent: string;
    accent2: string;
    warning: string;
    danger: string;
  }
  ```

---

## Code Layout

```
/home/sparsh/Lensboard/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── eslint.config.mjs
├── vitest.config.ts
├── packages/
│   ├── core/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── model/
│   │       ├── commands/
│   │       ├── history/
│   │       ├── shortcuts/
│   │       └── index.ts
│   ├── storage/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── sqlite/
│   │       ├── oplog/
│   │       ├── recovery/
│   │       └── index.ts
│   ├── render/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── canvas/
│   │       ├── spatial/
│   │       ├── ink/
│   │       ├── viewport/
│   │       └── index.ts
│   └── ui/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── tokens/
│           ├── chrome/
│           ├── drawers/
│           ├── palette/
│           ├── overlays/
│           └── index.ts
├── apps/
│   └── desktop/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── main/
│           ├── preload/
│           └── renderer/
└── tests/
    ├── e2e/
    └── fixtures/
```
