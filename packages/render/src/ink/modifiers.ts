/**
 * Ink Modifier Modes.
 * Authoritative: Spec §8, §9, §14.
 * - Shift-snap 45° straight lines (PI/4 increments), clean reversion on release
 * - Ctrl precision mode (40% movement speed) + ghost cursor position
 * - Dwell detection: <3px movement for 350ms emits dwell event
 * - Temporary hold-to-erase tool switching ('X' key)
 */

import type { Point, GhostCursor } from '../types.js';

export const PRECISION_MODE_DAMPING = 0.4; // 40% speed
export const DWELL_MAX_MOVEMENT_PX = 3.0;
export const DWELL_DURATION_MS = 350;

/**
 * Snaps a 2D delta vector to the nearest 45-degree (PI/4) angle increment.
 */
export function snapTo45Degrees(dx: number, dy: number): { x: number; y: number } {
  const length = Math.hypot(dx, dy);
  if (length === 0) return { x: 0, y: 0 };

  const angle = Math.atan2(dy, dx);
  const step = Math.PI / 4; // 45 degrees
  const snappedAngle = Math.round(angle / step) * step;

  return {
    x: Math.round(length * Math.cos(snappedAngle)),
    y: Math.round(length * Math.sin(snappedAngle)),
  };
}

/**
 * Snaps a current cursor point to 45° increments relative to an anchor starting point.
 */
export function applyShiftSnap(anchor: Point, current: Point): Point {
  const dx = current.x - anchor.x;
  const dy = current.y - anchor.y;
  const snapped = snapTo45Degrees(dx, dy);
  return {
    x: anchor.x + snapped.x,
    y: anchor.y + snapped.y,
  };
}

/**
 * Dampens mouse movement delta by 40% when Ctrl modifier is active.
 */
export function applyPrecisionModifier(
  delta: { dx: number; dy: number },
  ctrlDown: boolean
): { dx: number; dy: number } {
  const scale = ctrlDown ? PRECISION_MODE_DAMPING : 1.0;
  return {
    dx: delta.dx * scale,
    dy: delta.dy * scale,
  };
}

/**
 * Precision mode coordinator tracking dampened virtual pen and raw ghost cursor.
 */
export class PrecisionModeTracker {
  private virtualPos: Point | null = null;
  private rawPos: Point | null = null;

  reset(startPoint?: Point): void {
    this.virtualPos = startPoint ? { ...startPoint } : null;
    this.rawPos = startPoint ? { ...startPoint } : null;
  }

  update(rawPoint: Point, ctrlDown: boolean): { penPoint: Point; ghostCursor: GhostCursor } {
    if (!this.virtualPos || !this.rawPos) {
      this.virtualPos = { ...rawPoint };
      this.rawPos = { ...rawPoint };
      return {
        penPoint: { ...rawPoint },
        ghostCursor: { x: rawPoint.x, y: rawPoint.y, visible: false },
      };
    }

    const rawDelta = {
      dx: rawPoint.x - this.rawPos.x,
      dy: rawPoint.y - this.rawPos.y,
    };
    this.rawPos = { ...rawPoint };

    const effectiveDelta = applyPrecisionModifier(rawDelta, ctrlDown);
    this.virtualPos = {
      x: this.virtualPos.x + effectiveDelta.dx,
      y: this.virtualPos.y + effectiveDelta.dy,
    };

    return {
      penPoint: { ...this.virtualPos },
      ghostCursor: {
        x: rawPoint.x,
        y: rawPoint.y,
        visible: ctrlDown,
      },
    };
  }

  getGhostCursor(ctrlDown: boolean): GhostCursor | null {
    if (!this.rawPos || !ctrlDown) return null;
    return {
      x: this.rawPos.x,
      y: this.rawPos.y,
      visible: true,
    };
  }
}

/**
 * Dwell Detector:
 * Emits dwell event when holding the pointer still (< 3px movement for 350ms).
 * Resets immediately on movement >= 3px.
 */
export class DwellDetector {
  private anchor: Point | null = null;
  private startTime: number | null = null;
  private triggered = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private onDwellCallback?: () => void;

  constructor(onDwell?: () => void) {
    this.onDwellCallback = onDwell;
  }

  onPointerDown(point: Point, now = Date.now()): void {
    this.anchor = { ...point };
    this.startTime = now;
    this.triggered = false;
    this.armTimer();
  }

  onPointerMove(point: Point, now = Date.now()): boolean {
    if (!this.anchor || !this.startTime) return false;

    const dist = Math.hypot(point.x - this.anchor.x, point.y - this.anchor.y);
    if (dist >= DWELL_MAX_MOVEMENT_PX) {
      // Movement >= 3px resets dwell detection
      this.disarmTimer();
      this.anchor = { ...point };
      this.startTime = now;
      this.triggered = false;
      this.armTimer();
      return false;
    }

    // Check if time threshold exceeded synchronously
    if (!this.triggered && now - this.startTime >= DWELL_DURATION_MS) {
      this.triggered = true;
      this.disarmTimer();
      this.onDwellCallback?.();
      return true;
    }

    return false;
  }

  onPointerUp(): void {
    this.reset();
  }

  reset(): void {
    this.disarmTimer();
    this.anchor = null;
    this.startTime = null;
    this.triggered = false;
  }

  isTriggered(): boolean {
    return this.triggered;
  }

  private armTimer(): void {
    this.disarmTimer();
    if (typeof setTimeout !== 'undefined') {
      this.timer = setTimeout(() => {
        if (!this.triggered && this.anchor) {
          this.triggered = true;
          this.onDwellCallback?.();
        }
      }, DWELL_DURATION_MS);
    }
  }

  private disarmTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

/**
 * Manages temporary hold-to-erase ('X' key) tool switching.
 */
export class TemporaryToolSwitcher {
  private activeTool: string;
  private previousTool: string;
  private isHoldingModifier = false;

  constructor(initialTool = 'pen') {
    this.activeTool = initialTool;
    this.previousTool = initialTool;
  }

  getActiveTool(): string {
    return this.activeTool;
  }

  setActiveTool(tool: string): void {
    this.activeTool = tool;
    this.previousTool = tool;
  }

  onKeyDown(key: string): boolean {
    if ((key === 'X' || key === 'x') && !this.isHoldingModifier) {
      this.isHoldingModifier = true;
      this.previousTool = this.activeTool;
      this.activeTool = 'eraser';
      return true;
    }
    return false;
  }

  onKeyUp(key: string): boolean {
    if ((key === 'X' || key === 'x') && this.isHoldingModifier) {
      this.isHoldingModifier = false;
      this.activeTool = this.previousTool;
      return true;
    }
    return false;
  }
}
