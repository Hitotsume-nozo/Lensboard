/**
 * CanvasAdapter Abstraction.
 * Decouples the rendering pipeline from browser DOM so it executes cleanly in:
 * - Real browser (HTMLCanvasElement)
 * - Web Workers (OffscreenCanvas)
 * - Node.js / Vitest test runners (HeadlessCanvasAdapter)
 *
 * Edge cases handled:
 * - 0x0 or negative canvas resize clamped to minimum 1x1 (f18-b1)
 * - Fractional DPR scaling rounded cleanly: Math.round(cssDim * dpr) (f18-b2)
 * - Context loss detection and rebuild trigger (f18-b3)
 */

import type { CanvasAdapter } from '../types.js';

export function clampDimension(dim: number): number {
  return Math.max(1, Math.round(dim));
}

/**
 * Creates a lightweight mock 2D rendering context for headless / Node test execution.
 */
export function createMockContext2D(adapter: CanvasAdapter): CanvasRenderingContext2D {
  let fillStyle: string | CanvasGradient | CanvasPattern = '#000000';
  let strokeStyle: string | CanvasGradient | CanvasPattern = '#000000';
  let lineWidth = 1;
  let font = '10px sans-serif';
  let textAlign: CanvasTextAlign = 'start';
  let textBaseline: CanvasTextBaseline = 'alphabetic';
  let globalAlpha = 1.0;
  let globalCompositeOperation: GlobalCompositeOperation = 'source-over';

  const matrix = [1, 0, 0, 1, 0, 0];
  const matrixStack: number[][] = [];

  const mock: Partial<CanvasRenderingContext2D> = {
    get canvas() {
      return (adapter.getCanvasElement?.() ?? {}) as HTMLCanvasElement;
    },
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(val) {
      fillStyle = val;
    },
    get strokeStyle() {
      return strokeStyle;
    },
    set strokeStyle(val) {
      strokeStyle = val;
    },
    get lineWidth() {
      return lineWidth;
    },
    set lineWidth(val) {
      lineWidth = val;
    },
    get font() {
      return font;
    },
    set font(val) {
      font = val;
    },
    get textAlign() {
      return textAlign;
    },
    set textAlign(val) {
      textAlign = val;
    },
    get textBaseline() {
      return textBaseline;
    },
    set textBaseline(val) {
      textBaseline = val;
    },
    get globalAlpha() {
      return globalAlpha;
    },
    set globalAlpha(val) {
      globalAlpha = val;
    },
    get globalCompositeOperation() {
      return globalCompositeOperation;
    },
    set globalCompositeOperation(val) {
      globalCompositeOperation = val;
    },

    save: () => {
      matrixStack.push([...matrix]);
    },
    restore: () => {
      const popped = matrixStack.pop();
      if (popped) {
        matrix[0] = popped[0];
        matrix[1] = popped[1];
        matrix[2] = popped[2];
        matrix[3] = popped[3];
        matrix[4] = popped[4];
        matrix[5] = popped[5];
      }
    },
    setTransform: ((...args: [a?: any, b?: any, c?: any, d?: any, e?: any, f?: any]) => {
      const a = args[0];
      if (typeof a === 'number') {
        matrix[0] = a;
        matrix[1] = args[1] ?? 0;
        matrix[2] = args[2] ?? 0;
        matrix[3] = args[3] ?? 1;
        matrix[4] = args[4] ?? 0;
        matrix[5] = args[5] ?? 0;
      }
    }) as CanvasRenderingContext2D['setTransform'],
    resetTransform: () => {
      matrix[0] = 1;
      matrix[1] = 0;
      matrix[2] = 0;
      matrix[3] = 1;
      matrix[4] = 0;
      matrix[5] = 0;
    },
    translate: (x, y) => {
      matrix[4] += x;
      matrix[5] += y;
    },
    scale: (sx, sy) => {
      matrix[0] *= sx;
      matrix[3] *= sy;
    },
    rotate: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    arcTo: () => {},
    bezierCurveTo: () => {},
    quadraticCurveTo: () => {},
    rect: () => {},
    roundRect: () => {},
    fill: () => {},
    stroke: () => {},
    clip: () => {},
    clearRect: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    fillText: () => {},
    strokeText: () => {},
    measureText: (text: string) => ({
      width: text.length * 7,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 2,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: text.length * 7,
      fontBoundingBoxAscent: 10,
      fontBoundingBoxDescent: 2,
      emHeightAscent: 10,
      emHeightDescent: 2,
      hangingBaseline: 0,
      alphabeticBaseline: 0,
      ideographicBaseline: 0,
    }),
    drawImage: () => {},
    createImageData: () => ({ width: 1, height: 1, data: new Uint8ClampedArray(4), colorSpace: 'srgb' }),
    getImageData: () => ({ width: 1, height: 1, data: new Uint8ClampedArray(4), colorSpace: 'srgb' }),
    putImageData: () => {},
    createLinearGradient: () => ({
      addColorStop: () => {},
    } as unknown as CanvasGradient),
    createRadialGradient: () => ({
      addColorStop: () => {},
    } as unknown as CanvasGradient),
    createPattern: () => ({
      setTransform: () => {},
    } as unknown as CanvasPattern),
  };

  return mock as CanvasRenderingContext2D;
}

/**
 * Headless CanvasAdapter for Node / Vitest and mock testing.
 */
export class HeadlessCanvasAdapter implements CanvasAdapter {
  private width: number;
  private height: number;
  private dpr: number;
  private context: CanvasRenderingContext2D | null = null;
  private contextLostCallbacks: Set<() => void> = new Set();
  private isLost = false;

  constructor(width = 800, height = 600, dpr = 1) {
    this.width = clampDimension(width);
    this.height = clampDimension(height);
    this.dpr = dpr;
    this.context = createMockContext2D(this);
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }

  getDpr(): number {
    return this.dpr;
  }

  getPixelWidth(): number {
    return clampDimension(this.width * this.dpr);
  }

  getPixelHeight(): number {
    return clampDimension(this.height * this.dpr);
  }

  setSize(width: number, height: number, dpr = this.dpr): void {
    this.width = clampDimension(width);
    this.height = clampDimension(height);
    this.dpr = dpr;
  }

  getContext(): CanvasRenderingContext2D | null {
    if (this.isLost) return null;
    if (!this.context) {
      this.context = createMockContext2D(this);
    }
    return this.context;
  }

  clear(): void {
    const ctx = this.getContext();
    if (ctx) {
      ctx.clearRect(0, 0, this.getPixelWidth(), this.getPixelHeight());
    }
  }

  triggerContextLost(): void {
    this.isLost = true;
    for (const cb of this.contextLostCallbacks) {
      cb();
    }
  }

  restoreContext(): void {
    this.isLost = false;
    this.context = createMockContext2D(this);
  }

  onContextLost(callback: () => void): () => void {
    this.contextLostCallbacks.add(callback);
    return () => this.contextLostCallbacks.delete(callback);
  }

  isContextLost(): boolean {
    return this.isLost;
  }
}

/**
 * DOM CanvasAdapter for browser and Electron desktop runtime.
 */
export class DOMCanvasAdapter implements CanvasAdapter {
  private element: HTMLCanvasElement;
  private dpr: number;
  private cssWidth: number;
  private cssHeight: number;
  private contextLostCallbacks: Set<() => void> = new Set();
  private lost = false;

  constructor(element: HTMLCanvasElement, dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1) {
    this.element = element;
    this.dpr = dpr;
    this.cssWidth = clampDimension(element.clientWidth || parseInt(element.style.width, 10) || 800);
    this.cssHeight = clampDimension(element.clientHeight || parseInt(element.style.height, 10) || 600);

    this.syncBuffer();

    if (element.addEventListener) {
      element.addEventListener('contextlost', (e: Event) => {
        e.preventDefault?.();
        this.lost = true;
        for (const cb of this.contextLostCallbacks) {
          cb();
        }
      });
      element.addEventListener('contextrestored', () => {
        this.lost = false;
        this.syncBuffer();
      });
    }
  }

  getWidth(): number {
    return this.cssWidth;
  }

  getHeight(): number {
    return this.cssHeight;
  }

  getDpr(): number {
    return this.dpr;
  }

  setSize(width: number, height: number, dpr = this.dpr): void {
    this.cssWidth = clampDimension(width);
    this.cssHeight = clampDimension(height);
    this.dpr = dpr;
    this.syncBuffer();
  }

  getContext(): CanvasRenderingContext2D | null {
    if (this.lost) return null;
    return this.element.getContext('2d');
  }

  clear(): void {
    const ctx = this.getContext();
    if (ctx) {
      ctx.clearRect(0, 0, this.element.width, this.element.height);
    }
  }

  onContextLost(callback: () => void): () => void {
    this.contextLostCallbacks.add(callback);
    return () => this.contextLostCallbacks.delete(callback);
  }

  isContextLost(): boolean {
    return this.lost;
  }

  getCanvasElement(): HTMLCanvasElement {
    return this.element;
  }

  private syncBuffer(): void {
    const pixelWidth = clampDimension(this.cssWidth * this.dpr);
    const pixelHeight = clampDimension(this.cssHeight * this.dpr);

    if (this.element.width !== pixelWidth) {
      this.element.width = pixelWidth;
    }
    if (this.element.height !== pixelHeight) {
      this.element.height = pixelHeight;
    }
    this.element.style.width = `${this.cssWidth}px`;
    this.element.style.height = `${this.cssHeight}px`;
  }
}

/**
 * Factory creating an appropriate CanvasAdapter for the active environment.
 */
export function createCanvasAdapter(
  target?: HTMLCanvasElement | { width?: number; height?: number; dpr?: number }
): CanvasAdapter {
  if (
    typeof HTMLElement !== 'undefined' &&
    target instanceof HTMLElement &&
    target.tagName.toLowerCase() === 'canvas'
  ) {
    return new DOMCanvasAdapter(target as HTMLCanvasElement);
  }

  const w = target && 'width' in target ? target.width ?? 800 : 800;
  const h = target && 'height' in target ? target.height ?? 600 : 600;
  const dpr = target && 'dpr' in target ? target.dpr ?? 1 : 1;

  return new HeadlessCanvasAdapter(w, h, dpr);
}
