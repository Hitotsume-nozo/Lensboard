/**
 * @lensboard/render
 * Dual-layer Canvas 2D rendering pipeline, spatial indexing, and ink engine.
 *
 * Layer Invariants:
 * - Imports downward ONLY to @lensboard/core.
 * - Canvas entities are never React nodes.
 */

// Types & Contracts
export type {
  Point,
  TimedPoint,
  StrokePoint,
  StrokeObject,
  ViewportTransform,
  BoundingBox,
  SpatialItem,
  LODLevel,
  StrokeBrushOptions,
  GhostCursor,
  HandleHit,
  CanvasAdapter,
  CanvasRenderer,
  RendererOptions,
} from './types.js';

// Canvas Pipeline & Adapters
export {
  clampDimension,
  createMockContext2D,
  HeadlessCanvasAdapter,
  DOMCanvasAdapter,
  createCanvasAdapter,
} from './canvas/adapter.js';

export {
  DualLayerManager,
  type LayerManagerOptions,
} from './canvas/layers.js';

export {
  calculateZoomBucket,
  createCacheKey,
  SmartObjectCache,
  type CachedBitmap,
} from './canvas/cache.js';

export {
  LOD_SUMMARY_THRESHOLD,
  LOD_TITLE_ONLY_THRESHOLD,
  getFrameLODLevel,
  renderFrameTitleOnly,
  renderFrameSummaryCard,
  type FrameMetadata,
} from './canvas/lod.js';

// Spatial Indexing & Hit Testing
export {
  boxesIntersect,
  computeBoundingBox,
} from './spatial/bounds.js';

export { SpatialIndex } from './spatial/index.js';

export {
  STROKE_HIT_TOLERANCE_SCREEN_PX,
  HANDLE_HIT_SIZE_SCREEN_PX,
  pointToSegmentDistance,
  hitTestStroke,
  hitTestShape,
  hitTestDocument,
  hitTestObjectHandles,
} from './spatial/hit-test.js';

// Viewport Kinematics & Pan/Zoom
export {
  screenToWorld,
  worldToScreen,
  getVisibleWorldBounds,
} from './viewport/transform.js';

export {
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_EXP_FACTOR,
  normalizeWheelDelta,
  calculateNewZoom,
  zoomAtScreenPoint,
  panViewport,
  panHorizontalWheel,
  ViewportController,
} from './viewport/controller.js';

// Ink Engine Pipeline & Modifiers
export {
  calculateStabilizerRadius,
  applyLazyStringStabilizer,
  LazyStringStabilizer,
} from './ink/stabilizer.js';

export {
  DEFAULT_MIN_CUTOFF,
  DEFAULT_BETA,
  DEFAULT_D_CUTOFF,
  OneEuroFilter,
  OneEuroFilter2D,
} from './ink/filter.js';

export {
  DEFAULT_BRUSH_OPTIONS,
  UNIFORM_BRUSH_OPTIONS,
  clampBrushSize,
  generateStrokeOutline,
  getSvgPathFromStroke,
  drawStrokeToContext,
} from './ink/outline.js';

export {
  PRECISION_MODE_DAMPING,
  DWELL_MAX_MOVEMENT_PX,
  DWELL_DURATION_MS,
  snapTo45Degrees,
  applyShiftSnap,
  applyPrecisionModifier,
  PrecisionModeTracker,
  DwellDetector,
  TemporaryToolSwitcher,
} from './ink/modifiers.js';

export {
  ERASER_RADIUS_SCREEN_PX,
  isStrokeHitByEraser,
  findObjectsToErase,
  createEraseCommand,
} from './ink/eraser.js';

export {
  InkPipeline,
  type InkPipelineOptions,
} from './ink/pipeline.js';

// Shape & Sketch Rendering
export {
  PEN_COLOR_MAP,
  HANDWRITING_FONT_FAMILY,
  resolveColor,
  resolveEntityFont,
  formatLatexForCanvas,
  renderCanvasObject,
  wrapText,
  tokenizeCodeForCanvas,
  wrapCodeTokens,
  type CodeSyntaxToken,
} from './shapes/renderer.js';

// Ink Smoothing & Geometric Fitting
export {
  smoothStrokePoints,
  smoothStrokePointsFFT,
  detectPrimitiveFromPoints,
  type GeometricCandidate,
} from './ink/smoothing.js';

// CanvasRenderer & Factory
export {
  FullCanvasRenderer,
  createRenderer,
} from './renderer.js';
