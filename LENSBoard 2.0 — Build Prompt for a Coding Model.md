# LENSBoard 2.0 — Build Prompt for a Coding Model

Oct 12, 2026 · @Sparsh

A complete, phase-gated prompt set for building LENSBoard with a coding model: save Part 1 as SPEC.md, run the Kickoff prompt once, then feed one Phase prompt at a time.

## How to use this document

1. Create an empty repository and save **Part 1** as `SPEC.md` at its root. If you use Claude Code, also add a short `CLAUDE.md` saying: read SPEC.md before every task, follow its working rules, and never change a requirement without recording it in DECISIONS.md.
2. Paste the **Kickoff prompt** (Part 2) once. It makes the model read the spec, write a plan and scaffold the repository, with no feature code.
3. Paste **one Phase prompt** (Part 3) at a time. Start the next phase only after the previous exit gate is green and you have used the app yourself for the stated period.
4. After each phase, paste the **Review prompt** (Part 4) in a fresh session, so the work is audited against the spec by a reader who did not write it.

Why gated phases: asking one session for the whole app is where quality collapses. Context fills up, early decisions are forgotten, tests get skipped and stubs creep in. Gates keep every task small enough to be built, tested and verified completely.

The numbers in the spec (recognition thresholds, filter constants, latency budgets) are starting values. The model should tune them against the labelled test corpus, and the corpus gates, not the model's own judgement, decide when recognition is good enough.

## PART 1 — SPEC.md

### §1 Mission and priorities

You are building **LENSBoard**: a local-first, Linux-first, infinite-canvas whiteboard for one power user who solves DSA problems (dynamic programming, trees, graphs) and does deep-learning and mechanistic-interpretability research. Input is mouse and keyboard only; there is no stylus and no touch.

Priorities in strict order: (1) never lose data and never need debugging in daily use; (2) ink intelligence: rough mouse drawing and typing auto-convert into clean, organised, structured objects; (3) visual and interaction quality; (4) breadth of features. When two conflict, the lower number wins. If a feature cannot be built to the quality bar, do not ship a degraded version: cut it and record why in `DECISIONS.md`.

### §2 Principles (non-negotiable)

1. **Ink is sacred.** Raw strokes are never destroyed. Conversions are non-destructive: source ink is hidden, linked and kept in the file, and one action restores it.
2. **Never lose a stroke.** Every edit is durable within about 100 ms; crash recovery is automatic.
3. **Convert by default, undo instantly.** Auto-convert is on from the first run. Confident results apply when the stroke ends, with a 200 ms morph; uncertain results get a suggestion chip; Ctrl+Z always returns the ink.
4. **Canvas first.** UI floats and recedes. Objects on the canvas are never DOM elements.
5. **Boring core, bold edges.** The core uses well-understood techniques. Recognition, code execution and optional AI run isolated, abortable and with timeouts; their failure degrades one feature, never the board.
6. **Every bug becomes a test once.** A built-in session recorder produces replayable regression tests.
7. **Local-first.** No telemetry, no network calls in the core app, no auto-update. Anything networked (cloud recognition, BibTeX lookup) is opt-in, off by default and isolated behind a provider interface.

### §3 Working rules for you, the model

- Read all of SPEC.md before writing code. At the start of each task, restate the scope and acceptance criteria in your own words and list what you will not do.
- **Complete or cut.** No stubs, no `TODO` in shipped paths, no mock data presented as real, no features that only work on the happy path. If something cannot be done, say so plainly.
- **Tests are part of the task.** A task is done only when typecheck, lint, unit, property and golden-image tests pass and you have launched the app and exercised the feature by hand. Report anything you could not verify.
- TypeScript strict. No `any` without a comment explaining why. Validate every boundary at runtime with zod: file load, IPC, worker messages, plugin output, pasted data.
- Respect the layering in §5. A lint rule must fail the build when a package imports upward.
- Add only the dependencies listed in §4. Anything else needs a `DECISIONS.md` entry (purpose, licence, maintenance, size). Pin exact versions and commit the lockfile.
- Never silently change a requirement, shortcut, threshold or budget in this spec. If you believe one is wrong, implement it as written and record a proposal in `DECISIONS.md`.
- On ambiguity, choose the option that best serves priorities 1 to 3, record the assumption, and continue. Ask only when you are blocked.
- Small commits with conventional messages, one per green milestone. Keep `CHANGELOG.md` current.
- End every task with a report: what was built; test counts and failures; what you ran by hand; known limitations; the next step. Never claim something works that you did not run.

### §4 Stack (decided; do not re-open)

| Layer | Choice | Notes |
| --- | --- | --- |
| Shell | Electron, exact pinned version | `contextIsolation` true, `sandbox` true, `nodeIntegration` false; narrow typed preload API via `contextBridge`; strict CSP; no remote content; validate every IPC sender and payload. Set `ozone-platform-hint` to `auto` explicitly and test both X11 and Wayland sessions. |
| Language | TypeScript 5.x strict, ES2022 | pnpm workspaces, Vitest, ESLint with a boundaries rule, Prettier |
| UI chrome | React 18 plus CSS variables (design tokens) | canvas objects are never React nodes |
| Canvas | Canvas 2D | two layers (§8); renderer sits behind an interface so WebGL could replace it |
| Spatial index | rbush | culling and hit-testing |
| Strokes | perfect-freehand for outlines; own One-Euro filter | §9 |
| Sketch style | rough.js with a stored per-object seed | deterministic: appearance never changes between renders |
| Math | KaTeX | fonts bundled |
| Code editing | CodeMirror 6 | Python, C++, plain text |
| Storage | SQLite via better-sqlite3 (main process only), WAL, FTS5 | rebuild native modules for Electron's ABI |
| Validation | zod | every boundary |
| IDs and order | ULID strings; fractional-indexing for z-order |  |
| Layout | dagre for DAG layout; own tidy-tree for trees |  |
| ML inference | ONNX Runtime Web in a Web Worker | fallback: onnxruntime-node in a utility process if the latency budget is missed |
| Testing | Vitest, fast-check, Playwright (Electron), pixelmatch |  |
| Packaging | electron-builder: AppImage and .deb | Flatpak is out of scope |
| Fonts (bundled, OFL) | Inter (UI and canvas text), JetBrains Mono (code), Source Serif 4 (book-style text option), Caveat (sketch-style text option), KaTeX fonts (math) | no font network requests |

### §5 Repository layout and layering

```
lensboard/
  SPEC.md  DECISIONS.md  CHANGELOG.md  CLAUDE.md
  packages/
    core/         pure TS, no DOM, no Node: document model, commands, history, geometry, interfaces
    recognizers/  pure TS: geometric, gesture, layout, classifier glue; runs in workers
    render/       Canvas 2D renderer, viewport, hit-testing, spatial index
    storage/      SQLite schema, op-log, snapshots, migrations, backups, FTS (main process)
    runner/       code-runner protocol and sandbox wrapper (utility process)
    ui/           React shell, tokens, palette, pie menu, drawers, overlays
  apps/
    desktop/      Electron main, preload, renderer entry, packaging
    cli/          the `lens` command
  tools/          train-symbols/, corpus-tools/
  tests/          e2e/, fixtures/, corpus/, golden/
```

Imports flow downward only: ui to render to core; storage to core; recognizers to core; runner is standalone; desktop wires everything together. `core` imports nothing else in the repo. Enforce with ESLint boundaries and fail CI on a violation. Data flows one way: input, then command, then document, then renderer. No layer reaches around another.

### §6 Document model

- World units equal CSS pixels at 100% zoom (float64). Viewport is `{x, y, zoom}`, with zoom clamped to 0.02 to 64.
- Every entity has a ULID `id`, `createdAt` and `updatedAt`. Z-order is a fractional-index string.
- **Base object:** `id, type, parentId` (frame id or null)`, x, y, w, h, rotation, z, style, tags, locked, hidden`. `style` holds semantic colour ids (never raw hex), stroke width, fill, render mode (`crisp` or `sketch`) and the sketch seed.
- **Object types** (each fully typed with zod): `ink` (points delta-encoded as x, y, t, quantised to 0.01 px; brush settings), `shape` (rect, ellipse, diamond, triangle, hexagon; text), `line` (straight, curve or elbow; arrowheads; `from` and `to` bindings `{objectId, anchor}`), `text` (markdown-lite), `equation` (latex, display flag), `code` (language, source, tests, last run), `table` (rows, cols, cells, merges, headers), `array` (cells, indices, pointers), `dpTable` (inputs, recurrence, base cases, fill order, computed cells, user cells), `graph` (nodes, edges, directed, weighted, layout), `recursionTree`, `nnBlock` (kind, params, shapes), `heatmap` and `plot` (data, labels), `featureCard`, `derivation` (lines with latex, justification, status), `paper`, `frame` (title, colour, collapsed, template, tags), `note` (anchor `{objectId, subId?}`, markdown, collapsed), `flow` (name, colour, steps `[{targetId, label}]`), `image` (asset hash), `stamp`, `bookmark`.
- Converted objects keep `sourceInk: StrokeId[]`, and those ink strokes are set `hidden: true`, never deleted.
- **Commands.** Every mutation is a typed, serialisable command whose inverse is computed when it is applied: `create`, `update` (patch plus previous values), `delete`, `reorder`, `group`, `ungroup`, `move`, `resize`, `setStyle`, `convertInk` (atomic: hide ink and create the object), `revertConversion`, and `batch`. Rapid updates to the same target (drags, resizes) within 300 ms coalesce into one undo step. The undo stack is persisted and survives restarts.
- **Purity.** `core` is pure: `apply(doc, command)` returns a new document with no I/O, no clock and no randomness (ids and timestamps are passed in).

### §7 Storage

One SQLite file per workspace (`~/LENS/workspace.lens`) holds all projects and boards, so search and backlinks work across boards.

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE projects(id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE boards(id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id),
  title TEXT NOT NULL, kind TEXT NOT NULL, meta TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE objects(id TEXT PRIMARY KEY, board_id TEXT NOT NULL REFERENCES boards(id),
  type TEXT NOT NULL, z TEXT NOT NULL, data TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL);
CREATE TABLE ops(seq INTEGER PRIMARY KEY AUTOINCREMENT, board_id TEXT NOT NULL, tx_id TEXT NOT NULL,
  ts INTEGER NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL, inverse TEXT NOT NULL);
CREATE TABLE snapshots(id TEXT PRIMARY KEY, board_id TEXT NOT NULL, at_seq INTEGER NOT NULL,
  data BLOB NOT NULL, starred INTEGER NOT NULL DEFAULT 0, label TEXT, ts INTEGER NOT NULL);
CREATE TABLE assets(hash TEXT PRIMARY KEY, mime TEXT NOT NULL, bytes BLOB NOT NULL);
CREATE TABLE reviews(board_id TEXT PRIMARY KEY, confidence INTEGER, next_review INTEGER,
  interval_days INTEGER, needs_review INTEGER NOT NULL DEFAULT 0);
CREATE TABLE links(from_board TEXT NOT NULL, to_board TEXT NOT NULL);
CREATE VIRTUAL TABLE search USING fts5(board_id UNINDEXED, object_id UNINDEXED, kind UNINDEXED, body,
  tokenize = 'unicode61 remove_diacritics 2');
```

- **One write path.** All database access goes through a `StorageService` in the main process; the renderer talks to it only through typed IPC. Never touch SQLite from the renderer.
- **Durable edits.** Each command is appended to `ops` and applied to `objects` in the same transaction. Group-commit at most every 100 ms and always flush on blur, quit and fatal-error handlers. With WAL and `synchronous=NORMAL` an application crash loses nothing and a power cut loses at most the last fraction of a second. Never go back to a periodic whole-file autosave.
- **Snapshots.** Write one every 500 ops or 5 minutes, whichever comes first. Loading a board means latest snapshot plus replay of later ops, so load time stays flat as history grows. Users can star a snapshot and label it.
- **Assets** are stored once, content-addressed by SHA-256.
- **Migrations.** Use `PRAGMA user_version`. Migrations are numbered, pure and tested against a fixture file from every previous version. Write a backup copy before migrating. Refuse to write to a file with a newer version than the app knows (offer read-only).
- **Integrity.** Run `PRAGMA quick_check` on open. On failure, enter salvage mode: rebuild a new file by replaying the op log, and never overwrite the damaged original.
- **Backups.** Use SQLite's online backup API (consistent while the app runs) into `~/LENS/backups/`: hourly for 24 hours, daily for 14 days, weekly for 8 weeks. Document in the settings screen that the user must sync the backups folder, never the live database, with Syncthing or similar.
- **Export as folder.** JSON plus assets per board, for Git-friendly history.
- **Save indicator.** A quiet dot that shows Saved only after the last commit is confirmed on disk, and a warning state if a write fails.

### §8 Rendering and input

- **Layers.** Two stacked canvases at device-pixel ratio: a static layer (the scene) and a live layer (in-progress stroke, selection, handles, guides, ghost previews, cursor chips). Redraw the static layer only when the scene or viewport changes; redraw the live layer per frame while interacting.
- **Caching.** Equations, code, tables, charts and other smart objects render once into an offscreen bitmap keyed by `(object id, version, zoom bucket)`, re-rasterised only when the key changes. Zoom buckets are powers of 2.
- **Culling and hit-testing.** An rbush index over object bounds drives both. Hit tolerance is 6 screen px for lines and strokes; minimum handle size is 24 screen px.
- **Level of detail.** Below zoom 0.25, frames draw as titled summary cards (title, tags, object counts, first line of text) from cached thumbnails; below 0.08, only frame titles draw.
- **Editing overlays.** Only the object being edited gets a DOM overlay (text field, CodeMirror, equation input, cell editor), positioned by a CSS transform that matches the viewport. Commit on blur, cancel on Esc; on commit the object returns to its cached bitmap.
- **Renderer interface:** `setScene`, `setViewport`, `invalidate(rect?)`, `hitTest(point)`, `toWorld`, `toScreen`, `capture(rect, scale)`, `dispose`.
- **Input.** Use Pointer Events with pointer capture and `getCoalescedEvents`; never use legacy mouse events. Normalise wheel `deltaMode` (lines times 16 px). Wheel zooms about the cursor by `exp(-deltaY * 0.0015)`; Shift+wheel pans horizontally; Alt+wheel changes brush size; middle button or Space+drag pans. **Dwell:** with the button down, if the pointer moves less than 3 px for 350 ms, emit a dwell event (reset on movement).
- **Budget.** Live-stroke latency under 16 ms from pointer event to pixels; capture at least one sample per 0.5 screen px.

### §9 Ink engine

- **Capture** world-space points `{x, y, t}` per stroke.
- **Stabiliser.** Lazy-string radius equals stabiliser percent times 0.4 px (0 to 100 maps to 0 to 40 screen px); the pen point trails the cursor while the cursor is farther away than the radius. Then apply a One-Euro filter to the pen point (minCutoff 1.0, beta 0.007, dCutoff 1.0, using sample timestamps) before generating the outline.
- **Outline** via perfect-freehand: size 3 px by default (Alt+wheel from 1 to 24), thinning 0.45, smoothing 0.6, streamline 0.5, `simulatePressure` true (velocity-based: slow is thicker, fast is thinner), start and end taper 6 px. A Uniform width setting sets thinning to 0 and removes tapers.
- **Shift while drawing** gives a straight line with 45° angle snapping. **Ctrl while drawing** is precision mode: the stroke follows the cursor at 40% of its movement, with a ghost cursor shown.
- **Eraser** (tool X, or hold X for a temporary eraser) removes whole strokes and objects within 8 px. Every erase is an undoable command.
- **Crisp and Sketch.** Converted shapes render either crisp or through rough.js. The seed is stored on the object so the sketch never jitters between renders or exports.

### §10 Ink Intelligence (the headline feature)

Rough mouse drawing and typing must become clean, organised, editable structure automatically, without ever destroying the user's ink.

**Interfaces** (defined in `core`, implemented in `recognizers`):

```ts
interface Recognizer {
  id: string;
  version: string;
  budgetMs: number;
  recognize(input: RecognitionInput, signal: AbortSignal): Promise<Candidate[]>;
}
interface RecognitionInput { strokes: Stroke[]; context: SceneContext; zoom: number }
interface Candidate {
  kind: ObjectKind;
  draft: ObjectDraft;
  confidence: number;    // 0 to 1
  consumes: StrokeId[];  // ink to hide on apply
  replaces: ObjectId[];  // existing objects this supersedes (a box that becomes a table)
  label: string;         // shown on the suggestion chip
  explain: string;       // shown in the debug overlay
}
```

**Pipeline**

1. **Group.** A stroke joins the current group when it starts within 300 ms of the previous stroke's end and within 24 screen px of the group's bounds. A group closes after 300 ms of idle. Dwell (350 ms) and Ctrl+Enter close the group immediately.
2. **Recognise.** Run all enabled recognizers in a pool of two workers. Time budgets: shapes and lines 150 ms; one glyph 50 ms; layout and graph recognizers 500 ms; Deep Convert providers 10 s. Abort on timeout or when new ink arrives in the group. A recognizer that throws is skipped for that group and logged; it never blocks the others.
3. **Decide** using the settings below.
4. **Apply** as one atomic `convertInk` command: create the object, hide the source ink, and play a 200 ms morph from stroke to clean geometry. Ctrl+Z restores the ink exactly; a Revert to ink command is also in the context menu and palette.
5. **Guardrails.** Never convert while the pointer is down, inside an object being edited, or when new ink starts within the idle window (extend the group instead). Scratch-out is evaluated first.

**Settings** (persisted, per recognizer): `enabled`, `auto`, `autoApply` 0.85, `margin` 0.15, `chip` 0.50. Globals: `idleMs` 300, `dwellMs` 350, `morphMs` 200. Decision rule: confidence at or above `autoApply` with a lead over the runner-up of at least `margin` auto-applies; confidence at or above `chip`, or a small lead, shows a suggestion chip with the top 3 candidates (keys 1, 2, 3); anything lower leaves the ink alone. Low-confidence suggestions also show a faint ghost preview (Enter accepts, Esc dismisses).

**Recognizers**

- **Line, arrow, bracket.** Simplify with Ramer-Douglas-Peucker (epsilon = max of 1.5 px and 2% of the bounding-box diagonal). A corner is a turning angle above 35°. Straight if maximum deviation is under 4% of length. Arrowhead: a hook, or a short second stroke forming a V of at most 60° with legs at most 15% of the shaft, at an end. Curve: least-squares cubic Bézier fit (Schneider) when deviation exceeds 4% and there are no corners. Elbow: a path of axis-aligned segments (within 12°). Output `line`.
- **Closed shapes.** Closed when the end gap is under max(20 px, 15% of path length). Polygon from RDP corners: 3 gives a triangle; 4 gives a rect if edges are within 12° of the axes or a diamond if within 12° of 45°; 6 gives a hexagon. Ellipse via direct least-squares fit (Fitzgibbon) with residual under 6% of the mean radius. Snap to square or circle when width and height differ by under 8%. Confidence combines fit residual, closure and corner clarity.
- **Connector binding.** If a recognised line's endpoint is inside a shape or within 16 screen px of its boundary, bind to the nearest anchor (edge midpoints, or a free point on the boundary). Bound connectors follow moved shapes. Elbow connectors use an orthogonal router (A\* on a coarse grid around obstacle bounds, penalising bends).
- **Scratch-out.** A stroke with at least 4 direction reversals that covers at least 60% of a target object's bounds deletes it (undoable); for smart objects show a confirm chip first.
- **Table or grid.** At least 2 near-horizontal and 2 near-vertical strokes (within 10° of axis) that intersect, or an existing rect plus at least 1 inner ruling stroke (uses `replaces`). Cluster line positions in 1-D (gap tolerance 8% of extent) to get rows and columns; equalise cell sizes unless spacing varies by more than 25%. Auto-apply yields `table`; the chip also offers DP table.
- **Array.** At least 3 adjacent boxes in a row with size variance under 20%, gaps under 20% of box width and alignment within 10% become an `array` with indices.
- **Graph or tree.** At least 2 circles joined by lines whose endpoints touch the circles become a `graph`. If the graph is connected, acyclic, single-rooted and parents sit above children, also offer `recursionTree`. Tidy-tree layout (Reingold-Tilford) on demand.
- **Symbols (digits, letters, math).** A classifier over 28x28 renders of the stroke group (centred, aspect preserved, 2 px padding). Classes: 0-9, a-z, and + - x / = < > <= >= ( ) \[ \] { } , . : ; sum, product, partial, nabla, infinity, theta, alpha, beta, lambda, sigma, pi, mu. Apply only where text is accepted (cell, label, shape text) or, for a lone group, via a chip. Train with `tools/train-symbols` on public datasets (for example EMNIST and HASYv2; verify licences), export to ONNX, int8-quantise, commit the model hash, and report held-out accuracy (targets: at least 95% for digits, at least 85% for the rest; report actuals). If the target is missed, ship the $P point-cloud template matcher behind the same interface and record it in `DECISIONS.md`. Optional calibration UI collects the user's own samples; it only improves accuracy and never changes how converted text looks (converted text is always typeset).
- **Typed text rules.** On a word boundary plus space or Enter: `->` to an arrow, `<=`, `>=`, `!=`, `=>`, and the words `lambda`, `sum`, `prod`, `grad`, `partial`, `argmax`, `argmin`, `inf` to their symbols (or LaTeX inside equations). Undoable.
- **Layer labels (architecture).** Typed or recognised label text on a shape is matched case-insensitively with Levenshtein distance of at most 1: Linear, FC, Dense to `linear`; Conv, Conv1d, Conv2d to `conv`; Attn, Attention, MHA to `attention`; LN, LayerNorm to `layernorm`; BN, BatchNorm to `batchnorm`; ReLU, GELU, SiLU, Tanh, Sigmoid to `activation`; Dropout; Softmax; Embed, Embedding; MLP; Pool, MaxPool, AvgPool; Add, Residual, + to `add`; Concat. A match converts the box to a typed `nnBlock` (chip if ambiguous); an unknown label becomes a generic block.
- **Residual detection.** A curved arrow whose endpoints bind to non-adjacent blocks in a chain, and whose midpoint bulges at least 20% of the chord length away from the chain axis, becomes a residual connection with an `add` node at its target end.
- **Flowchart.** Boxes, diamonds and arrows become flowchart nodes; diamonds get yes and no label slots on outgoing edges.
- **Deep Convert (phase 0.7).** Provider interface `recognize(image, hint: 'equation' or 'text', signal)` returning text or LaTeX plus confidence. Providers: a local math-OCR model (evaluate open-source options, record the choice), and an optional cloud vision provider using the user's own API key from the OS keyring, off by default, enabled only after a consent screen that states exactly what is sent. Always show the editable result beside the source ink; never auto-apply below 0.85.

**Auto-organise.** When a converted shape's edges or centres fall within 8 screen px of an existing shape's, snap to them; if sizes differ by under 12%, match them. Each board has a layout direction (left-to-right default, or top-down). The Re-layout command runs dagre on the selected diagram while honouring bound connectors, animated over 200 ms. Tidy (Ctrl+Shift+Enter) aligns, distributes and equalises the selection.

**Partial conversion.** Only groups that pass the thresholds convert; the rest stay as ink beside converted parts. Ctrl+Enter converts the selection immediately with the chip threshold lowered to 0.50.

**Corpus and gates.** Keep a labelled corpus in `tests/corpus` (stroke JSON, expected kind, parameter tolerances). Provide a dev command, Add last group to corpus, so mouse samples can be captured while using the app. Require at least 40 samples per shape kind, plus a set of non-shape scribbles. CI gates: top-1 accuracy at least 95% for lines and closed shapes; wrongly auto-applied conversions at most 2% of auto-applies; no metric may regress between commits.

### §11 Smart objects: DSA, research kit, notes, flows

**Problem Frame (template).** A frame with collapsible sections: Problem, Examples and edge cases, Brute force, Key observation, Optimised approach, Trace, Code, Complexity, Post-mortem. Metadata: problem link, tags (pattern, topic, difficulty), status (new, stuck, solved, review), time spent (start-stop timer), confidence 1 to 5.

**Array.** Cells with values and indices, named pointer tokens (i, j, lo, hi, mid, slow, fast) that snap to cells when dragged, shaded spans (windows) and dimmed ranges (discarded halves). Each pointer move is a trace frame when recording is on.

**DP table.** Inputs (named arrays and scalars), a recurrence, base cases (cell ranges with values or expressions), a fill order (row-major default, column-major, diagonal, custom) and per-cell states drawn with colour plus shape cues (§13). Dependencies are extracted by parsing the recurrence's index expressions and evaluating them per cell. Clicking a cell highlights its dependencies and draws arrows. **Verify mode** computes the whole table and flags cells where the user's value differs. **Fill-order animation** steps through the evaluation order. Limits: 200 x 200 cells, 1,000,000 evaluations, 200 ms evaluation budget in a worker, overflow beyond 2^53 flagged. The recurrence language is evaluated by a hand-written Pratt parser; never use `eval` or `Function`; maximum expression depth 64.

```
assign  := 'dp' '[' expr ']' '[' expr ']' '=' expr
expr    := or ('?' expr ':' expr)?
or      := and ('||' and)*
and     := cmp ('&&' cmp)*
cmp     := sum (('<' | '<=' | '>' | '>=' | '==' | '!=') sum)?
sum     := term (('+' | '-') term)*
term    := unary (('*' | '/' | '%') unary)*
unary   := ('-' | '!') unary | postfix
postfix := primary ('[' expr ']')*
primary := number | 'inf' | name | name '(' args ')' | '(' expr ')'
functions: max, min, abs, floor, ceil, sum   names: i, j, dp, and declared inputs
```

**Recursion tree.** Normalise node labels (trim, lowercase, remove spaces); flag nodes with identical labels as overlapping subproblems with a badge counting occurrences. One click overlays memoisation: repeated subtrees grey out and show the calls saved.

**Graph and tree.** Directed or weighted edges, tidy-tree or force layout, and step-through algorithms that emit frames `{visited, frontier, settled, current, caption}`: BFS, DFS, Dijkstra (non-negative weights), topological sort. Linked-list, stack, queue and heap objects reuse the same frame model and arrive after these.

**Trace Tape.** Any smart object can record `TraceFrame {objectPatches, caption, flowStepId?}`. A scrubber with step back and forward (arrow keys when focused), play and pause, and speeds 0.5x, 1x and 2x. Export a PDF flipbook (one page per frame) and WebM (canvas capture with MediaRecorder).

**Code block.** CodeMirror 6 with Python, C++ and plain text. Run is always explicit (never on open). Each run is a separate child process: Python via `python3 -I`; C++ compiled with `g++ -O2 -std=c++17` into a temp directory. Default wall limit 2 s (setting), memory 512 MB via `prlimit`, network blocked with `unshare -n` when available (otherwise warn once and continue), kill the whole process group on timeout, cap stdout and stderr at 64 KB each, delete the temp directory afterwards. A test table (input, expected) compares output ignoring trailing whitespace and shows pass, fail, timeout or error with runtime. **Stress test:** pick a solution block, a brute-force block and a generator block (prints one random input; receives a size in argv\[1\]); run up to 200 iterations; on the first mismatch show the input and both outputs and try to shrink by re-running the generator with smaller sizes. A complexity stamp attaches to the block and is indexed for search.

**Architecture blocks (`nnBlock`).** Input shape is user-set; shapes propagate along edges. A mismatch turns the edge amber with a message such as expected last dim 784, got 128. Parameter counts roll up per block and for the model. Repeated stacks collapse to a single N x block node. Rules:

| Block | Shape rule | Parameters |
| --- | --- | --- |
| linear(in, out) | last dim must equal in; becomes out | in x out + out |
| conv2d(cin, cout, k, s, p) | \[B, C, H, W\]; new size = floor((size + 2p - k) / s) + 1 | cout x cin x k x k + cout |
| attention(d, heads) | \[B, T, D\] unchanged; D must divide by heads | 4 x d x d + 4 x d |
| layernorm(d) | last dim must equal d | 2 x d |
| batchnorm(c) | channel dim must equal c | 2 x c |
| embedding(vocab, d) | \[B, T\] becomes \[B, T, d\] | vocab x d |
| mlp(d, hidden) | last dim d, unchanged | 2 x d x hidden + hidden + d |
| activation, dropout, softmax | unchanged | 0 |
| pool(k, s) | spatial dims shrink as conv | 0 |
| add | all inputs equal shape | 0 |
| concat(axis) | other dims equal; axis dims sum | 0 |

Templates: transformer block, and a residual-stream view with labelled hook points (`resid_pre`, `attn_out`, `mlp_out`, `resid_post`). Optional, last in its phase: export a PyTorch module skeleton as a code block.

**Heatmap and plot.** Paste CSV or a JSON 2-D array; optional row and column labels (for example tokens). Sequential, colour-blind-safe colour map (viridis-like, 256-entry lookup table), hover tooltip with value, legend. Line, scatter and bar plots from pasted columns. The source data is stored on the object, with a free-text link to the notebook and cell that produced it.

**Feature card, derivation, paper.** Feature card: id, label, top-activating examples with token highlighting, density sparkline, notes, links, JSON import. Derivation: numbered equation lines, each with a justification and a status (assumption, proven, TODO), referenceable from elsewhere on the board, exportable as a LaTeX snippet. Paper: title, authors, year, venue, link, notes, pasted BibTeX; no network lookups unless the user enables them.

**Equation object.** KaTeX with live preview. A syntax error shows an inline message and keeps the source; it never blanks the object. Word expansions (grad, partial, sum, argmax and so on) insert the matching LaTeX command.

**Notes.** Press N on a selection to attach a note. Anchor is `{objectId, subId?}` (subId is a cell, edge or node). Collapsed it is a 16 px marker with a count; expanded it is a card up to 320 px wide supporting Markdown, inline KaTeX and code fences. It follows its anchor, appears in search and in the outline, and exports with the board. Deleting the anchor archives the note into an Orphaned notes list rather than deleting it.

**Flows.** Press F, click blocks or edges in order, Enter to finish, Esc to cancel. A flow is a named, coloured, ordered list of steps with an optional label per step (double-click a badge to edit). While a flow is active, draw numbered badges and highlight its edges, and dim everything else to 40%. A diagram can hold several flows. Flows play in the Trace Tape one step at a time with the step's note shown beside it. A flowchart step can link to a line range in a code block `{codeObjectId, fromLine, toLine}`; selecting one highlights the other, ranges shift as lines are inserted or deleted, and a range that no longer matches is marked stale.

### §12 Library and memory

- **Hierarchy.** Workspace, then Projects, then Boards, then Frames. A system Inbox board always exists.
- **CLI capture.** `lens add 'text'`, `lens paste` (clipboard image or text via `wl-paste` or `xclip`, whichever exists) and `lens shot` (runs the screenshot command set in Settings, then imports its output). The CLI talks to the running app over a Unix socket at `$XDG_RUNTIME_DIR/lensboard.sock`. If the app is not running, write to `~/.local/share/lensboard/inbox-spool/` with an atomic temp-file-then-rename and import on next launch. A capture must never be lost. Do not rely on global hotkeys; the user binds the CLI in their desktop environment (Wayland-safe).
- **Search.** FTS5 over typed text, LaTeX, code, notes, frame titles, tags and recognised labels, indexed in the same transaction as the edit. Filters: `tag:`, `difficulty:`, `status:`, `type:`, `board:`. Results are grouped by board with snippets; choosing one opens the board and animates the viewport to the object. Target: under 100 ms on 10,000 indexed objects.
- **Backlinks.** `[[Board title]]` in text and notes resolves into the `links` table; a Backlinks panel lists boards that link to the current one.
- **Review queue.** Boards flagged needs-review resurface on a spaced schedule of 1, 3, 7 and 21 days. Grades: Again resets to 1 day, Hard repeats the interval, Good advances one step, Easy skips one step. Review mode shows only the Problem frame and blurs solution frames until Reveal.
- **Pattern Book.** An automatic view grouping boards by pattern tag and listing each board's Post-mortem text.
- **Lenses.** A lens is `{name, filter {types, tags, frameIds}, viewport}`. Non-matching objects dim to 30% (option: hide). Present mode is an ordered list of lenses: arrow keys move between them and Esc exits.
- **Timeline.** A read-only scrubber rebuilds a board at any op sequence from the nearest snapshot plus replay. Restoring is a new command that applies the old state; history is never rewritten. Starred snapshots are kept forever and excluded from pruning.
- **Time.** Store all timestamps as UTC epoch milliseconds.

### §13 UI and visual design

The interface must feel calm, precise and fast. Canvas first: chrome floats, recedes and gets out of the way.

**Layout**

- **Top-left:** breadcrumb (Project / Board) and the save dot. **Top:** slim tab strip of open boards, like an editor.
- **Bottom-centre:** floating pill toolbar (48 px high, 11 tool buttons of 40 px). It collapses to icons only and hides in Focus mode.
- **Contextual bar:** 40 px high, 8 px above the selection, showing only relevant properties (colour, stroke, fill, render mode, convert, align, note, flow). It replaces any permanent properties panel.
- **Drawers (320 px, collapsed by default):** left toggled by `[` (Outline, Library, Inbox), right toggled by `]` (Inspector, Lenses, Backlinks, History).
- **Bottom-right:** zoom control, a 160 x 100 px minimap (click to jump), and the Trace Tape when active.
- **Overlays:** command palette, insert menu, pie menu, suggestion chip, ghost preview, note markers, flow badges, toasts (bottom-left, 4 s, non-blocking). Use modal dialogs only for destructive confirmation and migrations.

**Colour tokens** (starting values; text pairs must meet WCAG AA, checked automatically in CI)

| Token | Midnight (default) | Paper |
| --- | --- | --- |
| canvas | #12141C | #FBFAF7 |
| surface | #1A1D28 | #FFFFFF |
| surface-raised | #232736 | #F3F1EA |
| border | #2E3347 | #E4E1D8 |
| text | #E8EAF2 | #1C1E26 |
| text-muted | #A3A9BD | #5B6070 |
| accent | #7C8CFF | #4F5BD5 |
| accent-2 (teal) | #3DD6C6 | #0E9F92 |
| warning | #FFC857 | #9A6700 |
| danger | #FF6B7A | #D6455A |

Two further themes override the same tokens: **Blueprint** (canvas #0B2A4A, lines and text #E6F0FF, accent #5CC8FF) and **Blackboard** (canvas #1E2A25, chalk #F2F0E6, accent #F5D76E, optional chalk texture on ink). Also ship a high-contrast variant of Midnight.

**Pen palette.** Ten slots stored as semantic ids, never hex: `ink` (theme-aware, so old boards stay readable when the theme changes), `gray`, the seven Okabe-Ito colours (`orange` #E69F00, `sky` #56B4E9, `green` #009E73, `yellow` #F0E442, `blue` #0072B2, `vermillion` #D55E00, `purple` #CC79A7) and `custom`. On dark themes, lighten blue and vermillion so each keeps at least 3:1 contrast against the canvas.

**DSA state coding (colour plus shape, never colour alone)**

| State | Colour | Non-colour cue |
| --- | --- | --- |
| Base case | teal fill | small corner triangle |
| Computed | indigo tint | none |
| Active | amber fill | thick outline |
| To compute | no fill | dashed outline |
| Mismatch (Verify) | vermillion | diagonal hatch |
| Final answer | gold | star badge |

**Typography and surfaces**

- Type scale 12, 13, 14, 16, 20, 28; line height 1.4. Fonts as in §4, loaded locally. Canvas text style options: Inter (default), Source Serif 4 (book-style), Caveat (sketch). The style applies to typeset text only; handwriting is never imitated.
- 4 px spacing unit on an 8 px grid; control radius 8 px, panel and frame radius 12 px; 1 px borders; shadows only on floating UI (for example `0 8px 24px` at 28% black on dark themes).
- Frames: 12 px radius, 6% tint of their colour, title chip at top-left.
- Background: dot grid (24 world units apart, 1.5 px dots) fading as you zoom out; ruled and graph paper optional.
- Cursor: a ring showing brush size, plus small chips for active modifiers (snap, straighten, precision).

**Motion.** 120 to 180 ms ease-out (`cubic-bezier(0.2, 0, 0, 1)`) for UI; 200 ms conversion morph; a 160 ms pulse when a connector snaps. A reduced-motion setting (also following the OS preference) replaces all motion with instant state changes.

**Controls**

- **Command palette (Ctrl+K).** Fuzzy search across commands, boards and objects, grouped, with each command's shortcut shown. Every action in the app is a registered command with an id, title, optional shortcut and an enabled-when rule.
- **Insert menu (`/`).** Array, DP table, tree, graph, NN block, heatmap, feature card, derivation, problem frame, flowchart, note and more.
- **Pie menu (right click).** Eight slots chosen by flick direction, 120 px radius, 24 px dead zone, customisable. Defaults: Colour, Tool, Undo, Redo, Convert, Tidy, Duplicate, Delete.
- **Suggestion chip.** Up to 3 candidates with small thumbnails and key hints 1, 2, 3; fades out after 4 s or on the next stroke.
- **Settings.** Sections: General, Ink, Recognition (per recognizer: enabled, auto, thresholds), Keyboard (rebinding with live conflict refusal), Appearance (theme, UI scale 80 to 200%, text style), Storage and backups (paths, last backup, restore), Runner (limits, toolchain paths), Providers (Deep Convert opt-in), Diagnostics.
- **Onboarding.** On first run, generate an interactive Playground board whose checklist ticks off as the user draws a box, an arrow, a table, an array, a skip connection, a note and a flow.
- **Accessibility.** Every control is reachable by keyboard with a 2 px accent focus ring (2 px offset), has an ARIA role and label, and respects UI scale, reduced motion and the high-contrast theme.
- **Error and empty states.** An object whose renderer throws shows a labelled placeholder with its raw source, still editable. An empty board shows a one-line hint. A failed save shows a persistent banner and never fails silently.

### §14 Interaction map

One job per input. Defaults live in a data-driven shortcut registry. A unit test must fail on any duplicate default binding, and the Settings screen must refuse a rebinding that conflicts. Single-key tool shortcuts are inactive while a text field, CodeMirror or overlay has focus.

**Mouse**

| Input | Action |
| --- | --- |
| Left button | Primary action of the active tool |
| Middle button, or Space + drag | Pan |
| Wheel | Zoom toward the cursor |
| Shift + wheel | Pan horizontally |
| Alt + wheel | Brush size |
| Right click | Pie menu (its only job) |
| Double click | Edit object, or place text on empty canvas |
| Hold still while drawing (350 ms) | Dwell: convert now |
| Hold Shift while drawing | Straight line, 45° snapping |
| Hold Ctrl while drawing | Precision mode (40% speed) |

**Keyboard**

| Group | Keys |
| --- | --- |
| Tools | V Select · P Pen · L Line or Arrow · S Shape · T Text · E Equation · C Code · G Grid or Table · X Eraser (hold for temporary) · R Ruler · H Hand (hold) |
| Selection actions | N attach note · F mark flow · Ctrl+Enter convert selection · Ctrl+Shift+Enter tidy · Ctrl+D duplicate · Ctrl+G group · Ctrl+Shift+G ungroup · Del delete · Enter edit · Tab and Shift+Tab next and previous object · Esc cancel or deselect |
| History | Ctrl+Z undo · Ctrl+Shift+Z redo (unlimited, persisted) · Ctrl+S star current version |
| Navigation | Ctrl+0 fit all · Ctrl+1 100% · Ctrl+2 zoom to selection · Alt+1 to 9 switch board tab · Ctrl+Tab next tab · Ctrl+T new tab · Ctrl+W close tab · \[ and \] toggle drawers |
| Insert and search | / insert menu · Ctrl+K command palette · Ctrl+F find on this board |
| Clipboard | Ctrl+C, Ctrl+X, Ctrl+V · Ctrl+Shift+C copy selection as PNG · pasting an image creates an image object |
| View | Ctrl+' toggle snap · Ctrl+. Focus mode |
| Diagnostics | Ctrl+Alt+Shift+R save the last 60 s session recording |

Present mode, lenses, review and all other actions are reachable from the palette. Record Focus mode's `Ctrl+.` and the diagnostics binding in `DECISIONS.md` as additions to the original map.

**Mouse-specific ink comfort** (implemented in §9): stabiliser, velocity width, smart guides with distance labels and magnetic snapping, connector attach points, generous hit targets.

### §15 Stability, testing and quality gates

**Fault isolation**

- Every smart object renders inside its own try/catch. On failure it shows a labelled placeholder with the raw source (still editable) and logs the error; the rest of the board is unaffected.
- Recognizers, the code runner and providers run in workers or child processes with timeouts, memory caps and abort signals, restart with exponential backoff, and can never mutate the document directly: they only return candidates or results.
- **Safe mode** (hold Shift at launch, or `--safe`): all recognizers, providers and the runner are off.
- Main-process handlers for uncaught exceptions and `render-process-gone` flush storage, show a banner, reload the renderer and restore from the last commit. Never exit silently.
- Validate with zod at every boundary; reject bad data with a clear message and never apply it partially.

**No surprises.** Release channels (stable and dev) via a build flag; unfinished features behind settings flags; pinned dependencies; no telemetry; no updater.

**Diagnostics.** A ring-buffer log (last 2,000 events, local file). A session recorder (last 60 s of pointer and keyboard events plus commands, saved as JSON with Ctrl+Alt+Shift+R). A `tests/replay` harness that replays a recording headlessly against `core` and `recognizers` and checks invariants, so a recording from a real bug becomes a permanent regression test. A Copy diagnostics command (versions, OS, X11 or Wayland session, GPU info, recent log). A performance HUD from the palette (frame time, stroke latency, object count).

**Tests** (a task is not done until its tests exist and pass)

- **Unit:** at least 90% line coverage in `core` and `recognizers`.
- **Property (fast-check, 1,000 runs in CI):** for random command sequences, apply then undo all equals the original; apply, undo, redo equals applied; serialise then parse is identity; write to SQLite then reload is identity; replaying the op log equals live state; convert then undo equals the pre-conversion document.
- **Golden images:** Playwright renders each object type in crisp and sketch modes, light and dark themes, at device-pixel ratio 1 and 2; pixelmatch with at most 0.1% differing pixels; goldens change only through an explicit, reviewed command.
- **Recognizer corpus gates:** §10.
- **File robustness:** fuzz the loader with truncated and corrupted files (must never crash or write); a migration test for every historical version.
- **End-to-end (Playwright for Electron):** draw a box and see it convert; undo restores the ink; SIGKILL the app mid-stroke and verify no committed data is lost and restart is clean; DP Verify flow; CLI capture while the app is closed; backup restore.
- **Soak:** a script draws, edits and undoes at random for 2 hours; it must finish with no errors, under 10% memory growth, and `PRAGMA integrity_check` returning ok.

**Performance budgets** (measured in CI on a reference machine; fail on regression): live-stroke latency under 16 ms; 60 fps pan and zoom with 10,000 objects; no main-thread task over 50 ms during recognition; recognition decision within 150 ms after the idle window; cold start under 2 s; a typical board opens in under 500 ms; search under 100 ms on 10,000 objects; under 400 MB resident memory in a normal session.

**Release gate.** Promote a build to stable only after 7 consecutive days of the user's daily use with no data loss or crash.

**Definition of done (every task).** Typecheck, lint (including layering) and all tests green; budgets measured and recorded; the feature exercised by hand in the running app in both Midnight and Paper; keyboard path works; errors handled and visible; docs, `DECISIONS.md` and `CHANGELOG.md` updated; the §3 report delivered.

**Anti-patterns.** Reject your own code if it does any of these: a DOM node per canvas object; document data in localStorage; SQLite access from the renderer; a periodic whole-file save; `any` or unvalidated JSON at a boundary; an empty `catch`; time or randomness inside `core`; heavy work inside pointermove handlers; a main-thread block over 50 ms; unseeded sketch randomness; a `TODO` in a shipped path; a dependency without a `DECISIONS.md` entry; changing a spec number without recording it.

### §16 Roadmap and exit gates

| Phase | Contents | Exit gate |
| --- | --- | --- |
| 0.1 Rock | §6 to §9, UI shell (§13), palette, pie menu and shortcut registry (§14), diagnostics, PNG, SVG and PDF export | All tests and budgets green; SIGKILL test passes; 7 days of the user's daily use with zero loss |
| 0.2 Smart shapes | §10 pipeline; line, closed-shape, connector and scratch-out recognizers; dwell, chip, ghost, morph; auto-organise; Tidy; Crisp and Sketch; notes | Corpus gates met; convert-then-undo property test green |
| 0.3 Math and Code | Equation object, text rules, symbol classifier, code block, runner, tests, stress test | Runner limits verified; symbol accuracy report; 20 snippets run without a hung process |
| 0.4 DSA Stage | Table, array, DP table, recursion tree, graph, Trace Tape, Problem Frame, flowchart, flows | Verify matches reference on 5 canonical DPs; user solves 20 real problems |
| 0.5 Library | §12 complete | Search under 100 ms on 10,000 objects; CLI capture-while-closed test; timeline property test |
| 0.6 Research Kit | Architecture blocks with shape checking, layer labels, residual detection, templates, heatmap, plots, cards, derivation, paper | Parameter-count and shape tests green; user redraws one real project's diagrams |
| 0.7 Deep Convert | Provider interface, local model evaluation, optional cloud provider, side-by-side correction | Measured accuracy report; zero network calls when disabled |
| 1.0 Freeze | Bug fixes, docs, packaging | 30 days of use with no data-loss incident |

## PART 2 — Kickoff prompt (paste once)

You are the lead engineer on LENSBoard. The complete specification is saved as `SPEC.md` in this repository. Do exactly the following and nothing more.

1. Read `SPEC.md` completely.
2. Reply with: (a) a ten-line summary of the product in your own words; (b) the five requirements you think are most likely to be implemented wrongly, and why; (c) every ambiguity or contradiction you found, each with the assumption you will make.
3. Scaffold the repository exactly as in §5: a pnpm workspace; strict TypeScript configuration; ESLint with a boundaries rule that fails on upward imports; Prettier; Vitest; fast-check; a Playwright configuration for Electron; a `pnpm verify` script that runs typecheck, lint and all tests; empty packages with an index file and one smoke test each; an Electron shell that opens a blank window with the security settings from §4; and `DECISIONS.md`, `CHANGELOG.md` and `CLAUDE.md` (which tells future sessions to read `SPEC.md` first and obey §3).
4. Run `pnpm verify` and fix anything red.
5. Write no feature code.
6. Finish with the §3 report and wait for the first phase prompt.

## PART 3 — Phase prompts (paste one at a time)

Each prompt is self-contained. Paste it as written only after the previous phase's exit gate (§16) has passed.

### Phase 0.1 — Rock

Implement Phase 0.1 of `SPEC.md`. Restate the scope and acceptance criteria before you start.

**Scope:** §6 document model, commands and history; §7 storage in full (WAL, op-log, group commit, snapshots, migrations scaffold with a v1 fixture, integrity check and salvage, online backups and restore, save indicator); §8 renderer and input; §9 ink engine; §13 UI shell (tokens, Midnight and Paper themes, pill toolbar, basic contextual bar, drawers, tab strip, settings skeleton); §14 shortcut registry, command palette and pie menu; §15 diagnostics (ring log, session recorder, safe-mode flag). Tools: Select, Pen, Line or Arrow and Shape (manual, no recognition yet), Text, Eraser, Hand, Ruler. Basic frames. Create, rename and open projects and boards. Export PNG, SVG and PDF of a selection or board.

**Out of scope:** recognition, equations, code, smart objects, notes, flows, search, CLI.

**Acceptance** (prove each with numbers in your report): all unit and property tests green (§15 list); the SIGKILL-mid-stroke end-to-end test passes; live-stroke latency under 16 ms and 60 fps pan and zoom with 10,000 objects, both measured; a typical board opens in under 500 ms; fuzzed corrupt files never crash or write; backup then restore verified; the shortcut-duplicate test and the layering lint pass; golden images exist for every object type in both themes.

### Phase 0.2 — Smart shapes

Implement Phase 0.2 of `SPEC.md`.

**Scope:** §10 in full except Table, Array, Graph, Symbols, Layer labels, Residual, Flowchart and Deep Convert. That means the group, recognise, decide and apply pipeline running in the worker pool; the line and arrow, closed-shape, connector-binding and scratch-out recognizers; dwell, Ctrl+Enter, the suggestion chip, ghost preview and 200 ms morph; auto-organise snapping, the Re-layout command and Tidy; partial conversion; Crisp and Sketch rendering with stored seeds; per-recognizer settings; notes (N) with anchors, markers and search indexing hooks; the corpus tooling including the Add last group to corpus dev command.

**Acceptance:** collect at least 40 mouse samples per shape kind plus non-shape scribbles, and meet the §10 gates (at least 95% top-1; at most 2% wrong auto-applies); the property test convert then undo equals the pre-conversion document; a deliberately throwing recognizer and a deliberately hanging recognizer do not break drawing; no main-thread task over 50 ms during recognition; recognition decides within 150 ms after the idle window; golden images for converted shapes in crisp and sketch (seed-stable); all earlier tests still green.

### Phase 0.3 — Math and Code

Implement Phase 0.3 of `SPEC.md`.

**Scope:** the equation object with KaTeX, live preview and word expansions; typed text rules; the symbol classifier (the `tools/train-symbols` pipeline, ONNX model, int8 quantisation, accuracy report, optional calibration UI, $P fallback if targets are missed) wired into cells, labels and chips; the code block with CodeMirror 6; the runner with every limit in §11; the test table; the stress test.

**Acceptance:** a runner test suite proving the wall-time kill (infinite loop), the memory cap, the 64 KB output cap, process-group cleanup, no execution on open, and temp-directory deletion; 20 varied snippets run without a hung process; a KaTeX syntax error never blanks an object; the symbol accuracy report lists measured numbers against the §10 targets; golden images for equations and code blocks; all earlier tests green.

### Phase 0.4 — DSA Stage

Implement Phase 0.4 of `SPEC.md`.

**Scope:** table, array, DP table (recurrence parser per the grammar in §11, dependency extraction, Verify mode, fill-order animation, limits), recursion tree with duplicate detection and memoisation overlay, graph with BFS, DFS, Dijkstra and topological sort, Trace Tape with PDF and WebM export, Problem Frame template, the table, array, graph, tree and flowchart recognizers, flowchart-to-code linking, and flows (F).

**Acceptance:** parser tests including hostile input (deep nesting, huge loops, division by zero) that hit limits cleanly with no hang; Verify mode matches independent reference implementations in the tests for 0/1 knapsack, LCS, edit distance, coin change and LIS; dependency arrows are exact for each; the recursion tree flags the repeated nodes in fib(5) correctly; BFS, DFS and Dijkstra frames match references; the corpus gates are extended to the new recognizers with at least 95% top-1; all earlier tests green.

### Phase 0.5 — Library

Implement Phase 0.5 of `SPEC.md`.

**Scope:** all of §12: FTS5 search with filters, tags, backlinks, Inbox and the `lens` CLI (socket and spool), review queue, Pattern Book, lenses and Present mode, semantic zoom, timeline with starred snapshots, export as folder.

**Acceptance:** search under 100 ms on 10,000 indexed objects, measured; a capture made while the app is closed is imported without loss, including when the CLI is killed mid-write; the property test that a timeline reconstruction at a random op sequence equals the live state at that point; restoring creates a new command and never rewrites history; golden images for the semantic-zoom levels; all earlier tests green.

### Phase 0.6 — Research Kit

Implement Phase 0.6 of `SPEC.md`.

**Scope:** `nnBlock` with shape propagation and parameter counts, the layer-label recognizer, residual detection, transformer and residual-stream templates, heatmap and plots, feature card, derivation, paper sticker; optionally the PyTorch skeleton export, last.

**Acceptance:** table-driven tests of every shape rule including mismatch messages; parameter counts verified against known values (Linear(784, 256) is 200,960; Conv2d(3, 64, 3) is 1,792; attention with d = 512 is 1,050,624; Embedding(50257, 768) is 38,597,376); at least 20 residual-connection samples in the corpus meeting the 95% gate; heatmap values and tooltips verified; golden images; all earlier tests green.

### Phase 0.7 — Deep Convert

Implement Phase 0.7 of `SPEC.md`.

**Scope:** the provider interface; evaluation of local math-OCR options with the choice and measured accuracy recorded in `DECISIONS.md`; the optional cloud vision provider (own API key in the OS keyring, off by default, consent screen stating exactly what is sent); the side-by-side correction editor; correction learning stored locally.

**Acceptance:** accuracy measured on at least 50 equation and text samples supplied by the user; a provider failure or timeout never blocks drawing; with the provider disabled, a test proves zero outbound network requests; nothing below 0.85 confidence auto-applies; all earlier tests green.

### Phase 1.0 — Freeze

No new features. Fix defects, finish docs (user guide, shortcut sheet, backup and restore guide), produce AppImage and .deb builds, run a 24-hour soak, and update `CHANGELOG.md`. Report any spec requirement that is still unmet, honestly.

## PART 4 — Review prompt (paste in a fresh session after each phase)

You are a sceptical senior reviewer who did not write this code. Review Phase X against `SPEC.md` and the phase prompt. Do not fix anything yet.

1. List every requirement from the relevant SPEC sections and the phase prompt as a checklist.
2. Mark each Done, Partial or Missing, with file and test evidence. Run the tests and launch the app; do not infer from names.
3. Hunt for: stubs and TODOs, swallowed errors, `any`, unvalidated boundaries, DOM nodes per canvas object, database access from the renderer, nondeterminism in `core`, layering violations, and budgets that were claimed but not measured.
4. Try to break it: SIGKILL during a write, corrupt a file, throw from a recognizer, paste 5 MB of text, load 10,000 objects.
5. Output a table of findings ranked by severity, each with a minimal fix. Then stop and wait for approval.
