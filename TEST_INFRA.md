# LENSBoard 2.0 — End-to-End Test Infrastructure (TEST_INFRA.md)

## 1. Test Architecture & Philosophy

The LENSBoard 2.0 automated testing infrastructure is built upon the following non-negotiable principles:

1. **Opaque-Box Requirement-Driven Testing**: Tests are formulated strictly against the authoritative requirements in `ORIGINAL_REQUEST.md`, `PROJECT.md`, and `LENSBoard 2.0 — Build Prompt for a Coding Model.md` (`SPEC.md`). Tests exercise visible interface contracts, outputs, behaviors, and invariants without relying on internal private state.
2. **Deterministic Output Derivation**: Every test derives its expected outputs from authoritative mathematical formulations and specification tables:
   - Relative Luminance & WCAG AA contrast formulas ($L = 0.2126R + 0.7152G + 0.0722B$).
   - Cursor-centered exponential zoom formula ($\text{zoom}' = \text{zoom} \times \exp(-\Delta Y \times 0.0015)$ clamped to $[0.02, 64]$).
   - One-Euro filter velocity cutoffs and Lazy-String trailing radius ($r = \text{percent} \times 0.4\text{px}$).
   - Command invertibility: $\text{apply}(\text{apply}(D, C), C^{-1}) \equiv D$.
   - SQLite WAL schema invariants, PRAGMAs, and atomic dual-write operations.
3. **No Facade Tests**: Tests verify authentic business logic, data models, state transitions, and edge cases. Tests that pass trivially without asserting genuine system behavior are strictly prohibited.
4. **Adversarial & Fault Tolerance Hardening**: Edge cases, boundary stress, extreme zooms, out-of-bounds coordinates, corrupted structures, duplicate hotkeys, and rapid concurrent mutations are systematically probed.
5. **Progressive Testability**: The test suite is organized into 4 distinct tiers and 6 milestones so that as packages are implemented (from Milestone M1 through M6), the test runner yields clear, unambiguous pass/fail signals.

---

## 2. Test Runner Invocation

The test infrastructure is dual-compatible: it runs under both the workspace **Vitest** runner and Node.js native test runner (`node:test`) with zero external dependency friction.

### A. Primary Workspace Vitest Runner
```bash
# Run all E2E test suites
pnpm test:e2e

# Or invoke directly via Vitest
pnpm vitest run tests/e2e

# Run a specific tier
pnpm vitest run tests/e2e/tier1-features/
pnpm vitest run tests/e2e/tier2-boundaries/
pnpm vitest run tests/e2e/tier3-cross-feature/
pnpm vitest run tests/e2e/tier4-scenarios/

# Run a specific feature suite
pnpm vitest run tests/e2e/tier1-features/f09-doc-schema.test.ts
```

### B. Native Node.js Test Runner (Zero-Dependency Fallback)
```bash
# Run all tests natively via Node 26 test runner
node --test tests/e2e/**/*.test.ts

# Run custom runner script with tier and milestone summary
node tests/e2e/runner.ts

# Run with milestone filter
node tests/e2e/runner.ts --milestone=M1
node tests/e2e/runner.ts --tier=1
```

---

## 3. Test Suite Organization (Tiers 1–4)

```
tests/e2e/
├── harness.ts                         # Dual-compatible test framework adapter (Vitest / node:test)
├── runner.ts                          # Comprehensive test suite orchestrator & reporter
├── helpers/
│   ├── contracts.ts                   # Canonical interface contracts & schema definitions
│   ├── oracle.ts                      # Authoritative mathematical engines & verification oracles
│   ├── document-builder.ts            # Deterministic fixtures, document generator & command builder
│   └── module-loader.ts               # Dynamic package inspection & loader
├── tier1-features/                    # TIER 1: Feature Coverage (>=5 tests per feature for F01..F30)
│   ├── f01-monorepo.test.ts           # F01: Monorepo Structure & Package Manifests
│   ├── f02-boundaries.test.ts         # F02: Downward Dependency Enforcement
│   ├── f03-build-verify.test.ts       # F03: Workspace Build & Verify Pipelines
│   ├── f04-token-matrix.test.ts       # F04: Token Matrix & 5 Themes
│   ├── f05-wcag-contrast.test.ts      # F05: WCAG AA Contrast Compliance
│   ├── f06-pen-palette.test.ts        # F06: Pen Palette Hardening (10 slots)
│   ├── f07-micro-interactions.test.ts # F07: Micro-Interactions System (120-180ms)
│   ├── f08-dsa-coding.test.ts         # F08: Dual-Channel DSA Visual Coding
│   ├── f09-doc-schema.test.ts         # F09: Pure Document Schema (21 entity types)
│   ├── f10-cmd-inversion.test.ts      # F10: Typed Command Inversion & Reducer
│   ├── f11-cmd-coalescing.test.ts     # F11: Command Coalescing & Undo/Redo Stacks
│   ├── f12-source-ink.test.ts         # F12: Source Ink Non-Destructive Preservation
│   ├── f13-sqlite-wal.test.ts         # F13: SQLite WAL Mode & Storage DDL Schema
│   ├── f14-atomic-dual-write.test.ts  # F14: Atomic Dual-Write & Op-Log Transaction
│   ├── f15-group-commits.test.ts      # F15: Group Commits & Debounced Flush
│   ├── f16-snapshots-salvage.test.ts  # F16: Snapshots & Salvage Recovery Mode
│   ├── f17-shortcut-registry.test.ts  # F17: Shortcut Registry & Conflict Detection
│   ├── f18-dual-layer-canvas.test.ts  # F18: Dual-Layer Canvas 2D Pipeline
│   ├── f19-spatial-index.test.ts      # F19: Spatial Indexing & Viewport Culling
│   ├── f20-pan-zoom.test.ts           # F20: 60fps Pan and Exponential Zoom
│   ├── f21-ink-stabilizer.test.ts     # F21: Ink Stabilization Pipeline (Lazy + 1€)
│   ├── f22-dynamic-outline.test.ts    # F22: Dynamic Outline & Velocity Freehand
│   ├── f23-ink-modifiers.test.ts      # F23: Ink Modifier Modes (Shift, Ctrl, Eraser)
│   ├── f24-breadcrumbs-tabs.test.ts   # F24: Breadcrumbs & Board Tab Strip
│   ├── f25-pill-toolbar.test.ts       # F25: Floating Pill Toolbar (11 slots)
│   ├── f26-context-bar.test.ts        # F26: Contextual Properties Bar
│   ├── f27-drawers.test.ts            # F27: Collapsible Dual Drawers ([ and ])
│   ├── f28-palette-menus.test.ts      # F28: Command Palette & 8-Slot Pie Menu
│   ├── f29-chips-minimap.test.ts      # F29: Suggestion Chips & Click Minimap
│   └── f30-automated-verification.test.ts # F30: Automated Verification Gate
├── tier2-boundaries/                  # TIER 2: Boundary & Corner Cases (>=5 tests per feature)
│   ├── f01-boundary.test.ts to f30-boundary.test.ts
├── tier3-cross-feature/               # TIER 3: Cross-Feature Interactions (>=30 pairwise tests)
│   └── cross-feature-combinations.test.ts
└── tier4-scenarios/                   # TIER 4: Real-World Application Scenarios (>=15 workflows)
    └── real-world-scenarios.test.ts
```

---

## 4. Feature Coverage Mapping Matrix

| Feature # | Feature Name | Tier 1 Tests | Tier 2 Tests | Tier 3 Pairwise Tests | Tier 4 Workflows | Milestone |
|---|---|---|---|---|---|---|
| F01 | Monorepo Structure | >= 5 | >= 5 | F01 x F02, F01 x F03 | Monorepo Workspace Init | M1 |
| F02 | Downward Dependency Rule | >= 5 | >= 5 | F02 x F01 | Strict Layering Audit | M1 |
| F03 | Workspace Build & Verify | >= 5 | >= 5 | F03 x F01 | Full CI Verification | M1 |
| F04 | Token Matrix & 5 Themes | >= 5 | >= 5 | F04 x F06, F04 x F05 | Theme Switch Workflow | M2 |
| F05 | WCAG AA Contrast Compliance | >= 5 | >= 5 | F05 x F04, F05 x F08 | Accessibility Audit | M2 |
| F06 | Pen Palette Hardening | >= 5 | >= 5 | F06 x F04, F06 x F22 | Ink Color Switching | M2 |
| F07 | Micro-Interactions System | >= 5 | >= 5 | F07 x F25, F07 x F27 | UI Motion & Reduced Motion | M2 |
| F08 | Dual-Channel DSA Visual Coding | >= 5 | >= 5 | F08 x F05, F08 x F09 | DSA DP Table Study Session | M2 |
| F09 | Pure Document Schema | >= 5 | >= 5 | F09 x F10, F09 x F18 | Document Lifecycle | M3 |
| F10 | Typed Command Inversion | >= 5 | >= 5 | F10 x F11, F10 x F14 | Undo/Redo Inversion | M3 |
| F11 | Command Coalescing & History | >= 5 | >= 5 | F11 x F10, F11 x F15 | Rapid Dragging & Coalesce | M3 |
| F12 | Source Ink Preservation | >= 5 | >= 5 | F12 x F10, F12 x F22 | Ink Auto-Convert & Revert | M3 |
| F13 | SQLite WAL Mode & Schema | >= 5 | >= 5 | F13 x F14, F13 x F16 | Crash Recovery Simulation | M3 |
| F14 | Atomic Dual-Write & Op-Log | >= 5 | >= 5 | F14 x F13, F14 x F10 | Durable Mutation Pipeline | M3 |
| F15 | Group Commits & Flush | >= 5 | >= 5 | F15 x F14, F15 x F13 | Rapid Edits & Quit Flush | M3 |
| F16 | Snapshots & Salvage Mode | >= 5 | >= 5 | F16 x F13, F16 x F14 | Corrupted DB Salvage | M3 |
| F17 | Shortcut Registry | >= 5 | >= 5 | F17 x F25, F17 x F28 | Hotkey Conflict Refusal | M3 |
| F18 | Dual-Layer Canvas 2D Pipeline | >= 5 | >= 5 | F18 x F19, F18 x F20 | High-Volume Rendering | M4 |
| F19 | Spatial Indexing & Culling | >= 5 | >= 5 | F19 x F18, F19 x F20 | 10k Object Viewport Culling | M4 |
| F20 | 60fps Pan and Zoom | >= 5 | >= 5 | F20 x F18, F20 x F19 | Canvas Pan/Zoom Exploration | M4 |
| F21 | Ink Stabilization Pipeline | >= 5 | >= 5 | F21 x F22, F21 x F23 | Mouse Stroke Smoothing | M4 |
| F22 | Dynamic Outline & Freehand | >= 5 | >= 5 | F22 x F21, F22 x F06 | Velocity Ink Rendering | M4 |
| F23 | Ink Modifier Modes | >= 5 | >= 5 | F23 x F21, F23 x F22 | Shift 45° Snap & Eraser | M4 |
| F24 | Breadcrumbs & Tab Strip | >= 5 | >= 5 | F24 x F25, F24 x F13 | Multi-Board Tab Navigation | M5 |
| F25 | Floating Pill Toolbar | >= 5 | >= 5 | F25 x F26, F25 x F27 | Toolbar Focus Mode | M5 |
| F26 | Contextual Properties Bar | >= 5 | >= 5 | F26 x F25, F26 x F09 | Dynamic Selection Property | M5 |
| F27 | Collapsible Dual Drawers | >= 5 | >= 5 | F27 x F25, F27 x F17 | Dual Drawer Hotkey Toggle | M5 |
| F28 | Command Palette & Menus | >= 5 | >= 5 | F28 x F17, F28 x F25 | Command Palette & Pie Menu | M5 |
| F29 | Suggestion Chips & Minimap | >= 5 | >= 5 | F29 x F20, F29 x F12 | Chip Preview & Minimap Jump | M5 |
| F30 | Comprehensive Automated Verification | >= 5 | >= 5 | F30 x F10, F30 x F03 | 1,000 Run Fast-Check Verification | M6 |
| **Totals** | **30 Features** | **150 Tests** | **150 Tests** | **30 Tests** | **15 Tests** | **345 Total Tests** |

---

## 5. Progressive Testability Lifecycle

During development across Milestones M1 through M6:
- Milestone M1 tests (`f01`, `f02`, `f03`) transition to green as package manifests and boundary configurations are completed.
- Milestone M2 tests (`f04` through `f08`) verify design tokens, contrast ratios, pen palettes, and DSA state definitions.
- Milestone M3 tests (`f09` through `f17`) verify document purity, command inversion, history coalescing, SQLite storage schemas, and hotkey registries.
- Milestone M4 tests (`f18` through `f23`) verify dual-layer canvas architecture, spatial indexing, pan/zoom mathematical bounds, and ink stabilization.
- Milestone M5 tests (`f24` through `f29`) verify the floating chrome, drawers, toolbar, palette, and minimap.
- Milestone M6 tests (`f30` and Tiers 3-4) verify end-to-end user workflows, 1,000-run mathematical command reversibility, and full CI gate validation.
