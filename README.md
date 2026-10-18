# 📐 LENSBoard 2.0

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18.3.1-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8.3.4-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-387%20Passed-729B1B?style=for-the-badge&logo=vitest&logoColor=white)
![E2E](https://img.shields.io/badge/E2E%20Tests-345%20Passed-success?style=for-the-badge&logo=checkmarx&logoColor=white)
![Architecture](https://img.shields.io/badge/Architecture-Strict%20Monorepo-orange?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

**A high-performance, local-first visual canvas system built for algorithm study, mathematical derivations, software architecture diagramming, and interactive code exploration.**

[Architecture](#-architecture--downward-layering) •
[Core Features](#-core-features) •
[Shortcuts Matrix](#-shortcuts-matrix) •
[Quickstart](#-quickstart) •
[Testing & Verification](#-testing--verification) •
[Repository Layout](#-repository-layout)

</div>

---

## 🌟 Overview

**LENSBoard 2.0** reimagines digital canvas workflows by combining high-speed native Canvas 2D dual-layer rendering with a floating React 18 UI chrome, durable SQLite WAL op-log persistence, dual-channel DSA state indicators, mathematical KaTeX derivations, and an integrated TypeScript/JavaScript code runner with full **Neovim modal editing**.

Built with a zero-compromise architectural discipline, canvas entities are never DOM or React nodes; instead, high-frequency gestures, smooth freehand inking, and camera pan/zoom operate at a locked 60 FPS on dedicated canvas layers while non-destructive command inversion guarantees lossless undo/redo history.

---

## 🏛️ Architecture & Downward Layering

LENSBoard enforces a strict **downward-only dependency rule** verified on every build by custom ESLint boundary rules and automated AST tests. Upward and sideways imports between sibling packages are strictly forbidden at compile time.

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

### Key Architectural Tenets

1. **Pure Document Model (`@lensboard/core`)**: Document state is an immutable schema of 21 entity types keyed by ULID identifiers, ordered by fractional index keys (`z`). Core has zero external internal dependencies.
2. **Typed Command Inversion (`@lensboard/core`)**: Every user action is an explicit command (`apply(doc, cmd)`) that returns the transformed document and its exact inverse command, enabling reversible history stacks.
3. **Dual-Layer Canvas Pipeline (`@lensboard/render`)**:
   - **Static Scene Canvas**: Renders all committed canvas objects using an R-tree spatial index (`rbush`) for viewport culling.
   - **Live Interaction Canvas**: High-frequency rAF overlay for active pen strokes, box selections, drag previews, and ghost cursors.
4. **Durable Local-First Storage (`@lensboard/storage`)**: Dual-write SQLite database with write-ahead logging (WAL), 100ms debounced group commits, snapshot compaction every 500 ops, and automatic salvage recovery mode.
5. **Floating Accessible UI Chrome (`@lensboard/ui`)**: React 18 interface that floats above the canvas surface without introducing DOM overhead into the rendering loop.

---

## ✨ Core Features

### 🖌️ Advanced Ink Stabilization Pipeline
- **One-Euro Filter**: Velocity-adaptive low-pass filtering eliminates hand tremor at low speeds while preventing phase lag during rapid gestures.
- **Lazy-String Stabilizer**: Virtual drag string ($r = \text{percent} \times 0.4\text{px}$) eliminates jittery corners and produces clean mathematical curves.
- **Dynamic Velocity-Sensitive Outline**: Powered by `perfect-freehand` with velocity-scaled pressure and 6px smooth tapering.
- **Modifier Modes**:
  - `Shift`: 45-degree angle snapping for perfectly straight lines and axes.
  - `Ctrl` / `Cmd`: Precision Mode dampens pointer speed to 40% with a visual ghost cursor guide.
  - Whole-stroke eraser with spatial bounding-box hit testing.
- **Non-Destructive Ink Intelligence**: Smart geometric shape conversion preserves raw ink strokes under `hidden: true`, allowing one-click reversal back to natural hand-drawn strokes.

### 🎨 5 Semantic WCAG AA Themes
LENSBoard features 5 fully articulated color schemes satisfying WCAG AA contrast (≥ 4.5:1 text/surface, ≥ 3:1 pen strokes):
- 🌙 **Midnight**: Dark OLED theme with deep carbon surfaces and vibrant neon accents.
- 📄 **Paper**: Warm editorial light theme inspired by drafting paper and archival ink.
- 📐 **Blueprint**: Technical cyan grid layout with deep indigo engineering surfaces.
- 🎓 **Blackboard**: Matte blackboard slate theme with chalk-textured pastels.
- 👁️ **High-Contrast**: Maximum-legibility black & pure white palette with vivid warning borders.

Includes an **Okabe-Ito 10-slot Pen Palette** (ink, muted gray, 7 colorblind-safe primary hues, and custom hex slots).

### ⚡ Integrated Code Runner with Neovim Modal Editing
A dedicated code execution environment built right into the visual canvas:
- **Sandboxed Execution Engine**: Direct in-browser JavaScript & TypeScript evaluation sandbox with trailing expression evaluation, custom `print()` aliases, and execution duration benchmarks (ms).
- **Console Interception**: Captures `console.log`, `console.warn`, `console.error`, and `console.info` with structured JSON formatting.
- **Neovim Modes**:
  - `NORMAL Mode`: Navigate with `h`, `j`, `k`, `l`, jump lines with `0`, `$`, `gg`, `G`, delete with `dd`, `x`, copy/paste with `yy`, `p`, `P`, and undo with `u`.
  - `INSERT Mode`: Fluid code typing with auto-indent, 2-space tab expansion, syntax highlighting tokenization, and bracket pairing.
  - `COMMAND Mode`: Vim command-line execution supporting `:w` (save), `:q` (close), `:wq` (save & quit), and `:run` (execute).
- **Standalone & Docked Windows**: Run code directly inside floating canvas cards or pop out into a dedicated movable output terminal.

### 🔬 Dual-Channel DSA Visual Coding
Engineered for computer science education and technical interviews:
- **Dual-Channel Accessibility**: Algorithms are represented not just by color, but by paired geometric shape cues (corner triangles, dashed borders, cross-hatching, and star badges).
- **Pre-built Algorithm Templates**:
  - Binary Search arrays with low/mid/high pointer tracking.
  - Quick Sort partition stepping.
  - Graph BFS & DFS traversal queues and visited sets.
  - Dynamic Programming 0/1 Knapsack & Grid Memoization tables.

### 🧮 Mathematical Equations & KaTeX Derivations
- Instant KaTeX/LaTeX mathematical formula rendering.
- Dedicated semantic tags for `math`, `equation`, `derivation`, and `proof`.
- Crisp render mode preserving ultra-sharp vector glyphs across all zoom levels ($0.1\times$ to $5.0\times$).

### 🎛️ Floating Canvas Chrome
- **Floating Pill Toolbar**: 48px height, 11 primary tool modes (`V` Select, `P` Pen, `L` Line, `S` Shape, `T` Text, `E` Eraser, `C` Code, `G` Group, `X` Equation, `R` Runner, `H` Hand).
- **Contextual Properties Bar**: 40px bar positioned 8px above active selections, providing live stroke, color, font, fill, and layering controls.
- **Collapsible Dual Drawers**:
  - `[` **Left Drawer**: Document Outline, Shape Library, Inbox, and Specialized Lenses (DSA, DL Architecture, Math).
  - `]` **Right Drawer**: Entity Inspector, SQLite Snapshots, and Export Engine (PNG, SVG, JSON).
- **Command Palette & Menus**: Fuzzy search with `Ctrl+K`, instant entity insert with `/`, and 8-slot directional right-click pie menu.

---

## ⌨️ Shortcuts Matrix

LENSBoard includes a centralized shortcut registry (`@lensboard/core`) with built-in duplicate binding collision detection:

| Shortcut | Scope | Action |
|---|---|---|
| <kbd>V</kbd> | Canvas | Select / Pointer tool |
| <kbd>P</kbd> | Canvas | Freehand Pen tool |
| <kbd>L</kbd> | Canvas | Line / Connector tool |
| <kbd>S</kbd> | Canvas | Rectangle / Geometric Shape tool |
| <kbd>T</kbd> | Canvas | Text label tool |
| <kbd>E</kbd> | Canvas | Whole-stroke Eraser tool |
| <kbd>C</kbd> | Canvas | Interactive Code Block tool |
| <kbd>G</kbd> | Canvas | Group / Container tool |
| <kbd>X</kbd> | Canvas | Mathematical Equation (KaTeX) |
| <kbd>R</kbd> | Canvas | Standalone Code Runner |
| <kbd>H</kbd> / <kbd>Space + Drag</kbd> | Canvas | Hand / Pan canvas view |
| <kbd>Ctrl</kbd> + <kbd>K</kbd> | Global | Open Fuzzy Command Palette |
| <kbd>/</kbd> | Canvas | Quick Insert Menu |
| <kbd>[</kbd> | Global | Toggle Left Drawer (Outline / Library) |
| <kbd>]</kbd> | Global | Toggle Right Drawer (Inspector / Snapshots) |
| <kbd>Ctrl</kbd> + <kbd>Z</kbd> | Global | Undo last command |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd> / <kbd>Ctrl</kbd> + <kbd>Y</kbd> | Global | Redo last command |
| <kbd>Delete</kbd> / <kbd>Backspace</kbd> | Canvas | Delete selected entities |
| <kbd>Ctrl</kbd> + <kbd>A</kbd> | Canvas | Select all objects |
| <kbd>Ctrl</kbd> + <kbd>Enter</kbd> | Code Editor | Execute code sandbox |
| <kbd>Ctrl</kbd> + <kbd>S</kbd> | Code Editor | Save and close editor |
| <kbd>Escape</kbd> | Global | Deselect / Return to Select tool / Exit mode |

---

## 🚀 Quickstart

### Prerequisites
- [Node.js](https://nodejs.org/) (version `20.x` or `22.x+` recommended)
- [pnpm](https://pnpm.io/) (`>= 9.0.0` or `12.x`)

### Installation

```bash
# Clone the repository
git clone https://github.com/Hitotsume-nozo/Lensboard.git
cd Lensboard

# Install all monorepo dependencies
pnpm install
```

### Launching the Interactive Showcase

Start the full interactive visual canvas web app with hot module reloading:

```bash
pnpm showcase
# Or run the startup script:
./start.sh
```

Open your browser at `http://localhost:5173` to explore the canvas.

### Desktop Application (Electron)

```bash
pnpm dev
```

---

## 🧪 Testing & Verification

The codebase is protected by **732 automated tests** across 5 distinct testing tiers:

```bash
# 1. Run full Vitest suite (387 unit & integration tests)
pnpm test

# 2. Run Comprehensive 4-Tier E2E test suite (345 tests)
pnpm test:e2e

# 3. Verify Downward-Only Architectural Boundaries (ESLint AST check)
pnpm test:boundaries

# 4. Check TypeScript types across all workspace packages
pnpm typecheck

# 5. Lint entire codebase
pnpm lint

# 6. Run complete verification gate (build, typecheck, lint, vitest)
pnpm verify
```

### Test Suite Structure

| Tier | Category | Description | Count |
|---|---|---|---|
| **Tier 1** | Feature Coverage | Exhaustive unit tests for all 30 core platform features | 150 tests |
| **Tier 2** | Boundary & Adversarial | Extreme inputs, zero-dimensions, fuzzy payloads, memory limits | 150 tests |
| **Tier 3** | Cross-Feature Interactions | Pairwise integration between canvas, storage, UI, and tokens | 30 tests |
| **Tier 4** | Real-World User Scenarios | E2E user journeys (Knapsack DSA, Transformer block, DB crash recovery) | 15 tests |
| **Tier 5** | Vitest Packages & Boundaries | Structural monorepo purity, spatial indexing, smoothing math | 387 tests |
| **Total** | **Comprehensive Suite** | **100% Green Automated Coverage** | **732 Tests** |

---

## 📁 Repository Layout

```
Lensboard/
├── packages/
│   ├── core/           # Pure immutable document model, typed commands & history
│   ├── render/         # Dual-layer Canvas 2D, rbush spatial index, 1€ ink filter
│   ├── storage/        # SQLite WAL persistence, atomic op-log, snapshots & salvage
│   └── ui/             # React 18 floating chrome, 5 themes, WCAG AA design tokens
├── apps/
│   └── desktop/        # Electron main process, preload script, and desktop shell
├── showcase/           # Interactive Vite application with CodeEditor & live canvas
├── tests/              # 4-tier E2E testing harness, fixtures, and boundary tests
├── scripts/            # Boundary verification and architectural lint utilities
├── eslint.config.mjs   # Strict downward-only package boundary rules
├── vitest.config.ts    # Workspace test runner configuration
├── pnpm-workspace.yaml # Monorepo workspace definition
└── package.json        # Workspace scripts and root tooling
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
