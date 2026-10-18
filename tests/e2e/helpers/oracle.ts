/**
 * LENSBoard 2.0 — Authoritative Test Oracles & Mathematical Verification Engines
 * All expected values and algorithmic behaviors are rigorously derived here.
 */

import type {
  ThemeName,
  ThemeTokens,
  LensDocument,
  CanvasObject,
  Command,
  CommandResult,
  ShortcutBinding,
  StrokePoint,
} from './contracts.ts';

// ============================================================================
// 1. WCAG AA Contrast Oracle (§13)
// Relative Luminance: L = 0.2126 * R + 0.7152 * G + 0.0722 * B
// Contrast Ratio = (L1 + 0.05) / (L2 + 0.05)
// ============================================================================

export function hexToRgb(hex: string): [number, number, number] {
  const cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    return [r, g, b];
  }
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return [r, g, b];
}

export function relativeLuminance(r: number, g: number, b: number): number {
  const sRGB = [r / 255, g / 255, b / 255];
  const linear = sRGB.map((c) => {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function calculateContrastRatio(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  const l1 = relativeLuminance(rgb1[0], rgb1[1], rgb1[2]);
  const l2 = relativeLuminance(rgb2[0], rgb2[1], rgb2[2]);
  const brighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (brighter + 0.05) / (darker + 0.05);
}

// ============================================================================
// 2. Theme Token Matrix (§13)
// ============================================================================

export const THEME_SPEC_TOKENS: Record<ThemeName, ThemeTokens> = {
  midnight: {
    canvas: '#12141C',
    surface: '#1A1D28',
    surfaceRaised: '#232736',
    border: '#2E3347',
    text: '#E8EAF2',
    textMuted: '#A3A9BD',
    accent: '#7C8CFF',
    accent2: '#3DD6C6',
    warning: '#FFC857',
    danger: '#FF6B7A',
  },
  paper: {
    canvas: '#FBFAF7',
    surface: '#FFFFFF',
    surfaceRaised: '#F3F1EA',
    border: '#E4E1D8',
    text: '#1C1E26',
    textMuted: '#5B6070',
    accent: '#4F5BD5',
    accent2: '#0E9F92',
    warning: '#9A6700',
    danger: '#D6455A',
  },
  blueprint: {
    canvas: '#0B2A4A',
    surface: '#0F3760',
    surfaceRaised: '#14467A',
    border: '#2462A0',
    text: '#E6F0FF',
    textMuted: '#9BBCE0',
    accent: '#5CC8FF',
    accent2: '#40E0D0',
    warning: '#FFD700',
    danger: '#FF6E7F',
  },
  blackboard: {
    canvas: '#1E2A25',
    surface: '#273832',
    surfaceRaised: '#31473F',
    border: '#3F5950',
    text: '#F2F0E6',
    textMuted: '#9FAFA6',
    accent: '#F5D76E',
    accent2: '#7CD1B8',
    warning: '#F5A623',
    danger: '#E06D53',
  },
  'high-contrast': {
    canvas: '#000000',
    surface: '#111111',
    surfaceRaised: '#222222',
    border: '#FFFFFF',
    text: '#FFFFFF',
    textMuted: '#CCCCCC',
    accent: '#FFFF00',
    accent2: '#00FFFF',
    warning: '#FFA500',
    danger: '#FF0000',
  },
};

// Okabe-Ito Color Palette (§13)
export const OKABE_ITO_PALETTE = {
  orange: '#E69F00',
  sky: '#56B4E9',
  green: '#009E73',
  yellow: '#F0E442',
  blue: '#0072B2',
  vermillion: '#D55E00',
  purple: '#CC79A7',
};

// Dark theme lightened variants to guarantee >= 3:1 contrast against dark canvas
export const OKABE_ITO_DARK_THEME_ADJUSTMENTS = {
  blueLightened: '#409CFF', // standard #0072B2 lightened
  vermillionLightened: '#FF7B33', // standard #D55E00 lightened
};

// ============================================================================
// 3. Zoom Calculation Oracle (§8)
// zoom' = zoom * exp(-deltaY * 0.0015), clamped to [0.02, 64]
// ============================================================================

export function calculateNewZoom(currentZoom: number, deltaY: number): number {
  const factor = Math.exp(-deltaY * 0.0015);
  const unconstrained = currentZoom * factor;
  return Math.min(64, Math.max(0.02, unconstrained));
}

// ============================================================================
// 4. Lazy-String Stabilizer Oracle (§9)
// radius = percent * 0.4 px (0..100 maps to 0..40 screen px)
// ============================================================================

export function calculateStabilizerRadius(percent: number): number {
  return percent * 0.4;
}

export function applyLazyStringStabilizer(
  cursor: { x: number; y: number },
  currentPen: { x: number; y: number },
  radius: number
): { x: number; y: number } {
  const dx = cursor.x - currentPen.x;
  const dy = cursor.y - currentPen.y;
  const dist = Math.hypot(dx, dy);

  if (dist <= radius || dist === 0) {
    return { ...currentPen };
  }

  // Pen trails the cursor while cursor is farther away than radius
  const ratio = (dist - radius) / dist;
  return {
    x: currentPen.x + dx * ratio,
    y: currentPen.y + dy * ratio,
  };
}

// ============================================================================
// 5. One-Euro Filter Oracle (§9)
// minCutoff = 1.0, beta = 0.007, dCutoff = 1.0
// ============================================================================

export class OneEuroFilterOracle {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xHatPrev: number | null = null;
  private dxHatPrev = 0;
  private tPrev: number | null = null;

  constructor(minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  private alpha(rate: number, cutoff: number): number {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    const te = 1.0 / rate;
    return 1.0 / (1.0 + tau / te);
  }

  filter(x: number, timestamp: number): number {
    if (this.tPrev === null || this.xHatPrev === null) {
      this.xHatPrev = x;
      this.dxHatPrev = 0;
      this.tPrev = timestamp;
      return x;
    }

    const dt = Math.max((timestamp - this.tPrev) / 1000, 0.0001); // in seconds
    const rate = 1.0 / dt;

    // Derivative filtering
    const dx = (x - this.xHatPrev) / dt;
    const aD = this.alpha(rate, this.dCutoff);
    const dxHat = aD * dx + (1 - aD) * this.dxHatPrev;

    // Signal filtering with speed-dependent cutoff
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = this.alpha(rate, cutoff);
    const xHat = a * x + (1 - a) * this.xHatPrev;

    this.xHatPrev = xHat;
    this.dxHatPrev = dxHat;
    this.tPrev = timestamp;

    return xHat;
  }
}

// ============================================================================
// 6. Shortcut Duplicate Detection Oracle (§14)
// Refuses duplicate hotkeys within same context
// ============================================================================

export function detectDuplicateBindingsOracle(bindings: ShortcutBinding[]): string[] {
  const seen = new Map<string, string>();
  const conflicts: string[] = [];

  for (const b of bindings) {
    const normalizedKey = b.keys.toLowerCase().replace(/\s+/g, '');
    const contextKey = `${b.context}:${normalizedKey}`;
    if (seen.has(contextKey)) {
      conflicts.push(`Duplicate binding for "${b.keys}" in context "${b.context}": conflict between "${seen.get(contextKey)}" and "${b.id}"`);
    } else {
      seen.set(contextKey, b.id);
    }
  }

  return conflicts;
}

// ============================================================================
// 7. Pure Command Application & Inversion Oracle (§6)
// Reference pure reducer for mathematical reversibility verification
// ============================================================================

export function applyCommandOracle(doc: LensDocument, command: Command): CommandResult {
  const clonedDoc: LensDocument = JSON.parse(JSON.stringify(doc));

  switch (command.type) {
    case 'create': {
      const targetObj = command.payload.object as CanvasObject;
      clonedDoc.objects[targetObj.id] = JSON.parse(JSON.stringify(targetObj));
      if (!clonedDoc.rootIds.includes(targetObj.id)) {
        clonedDoc.rootIds.push(targetObj.id);
      }
      const inverse: Command = {
        id: `inv-${command.id}`,
        type: 'delete',
        timestamp: command.timestamp,
        targets: [targetObj.id],
        payload: { previousObject: JSON.parse(JSON.stringify(targetObj)) },
      };
      return { doc: clonedDoc, inverse };
    }

    case 'delete': {
      const targetId = command.targets[0];
      const prevObj = clonedDoc.objects[targetId];
      if (!prevObj) {
        throw new Error(`Target object ${targetId} not found for delete`);
      }
      delete clonedDoc.objects[targetId];
      clonedDoc.rootIds = clonedDoc.rootIds.filter((id) => id !== targetId);
      const inverse: Command = {
        id: `inv-${command.id}`,
        type: 'create',
        timestamp: command.timestamp,
        targets: [targetId],
        payload: { object: JSON.parse(JSON.stringify(prevObj)) },
      };
      return { doc: clonedDoc, inverse };
    }

    case 'update':
    case 'move':
    case 'resize':
    case 'setStyle': {
      const targetId = command.targets[0];
      const current = clonedDoc.objects[targetId];
      if (!current) {
        throw new Error(`Target object ${targetId} not found for update`);
      }
      const previousState = JSON.parse(JSON.stringify(current));
      const patch = command.payload.patch as Partial<CanvasObject>;
      Object.assign(current, patch);
      current.updatedAt = command.timestamp;

      const inverse: Command = {
        id: `inv-${command.id}`,
        type: command.type,
        timestamp: command.timestamp,
        targets: [targetId],
        payload: { patch: previousState },
      };
      return { doc: clonedDoc, inverse };
    }

    case 'convertInk': {
      // Atomic conversion: create new clean object and set source ink hidden: true
      const newObject = command.payload.newObject as CanvasObject;
      const sourceInkIds = command.payload.sourceInkIds as string[];

      for (const id of sourceInkIds) {
        if (clonedDoc.objects[id]) {
          clonedDoc.objects[id].hidden = true;
        }
      }
      newObject.sourceInk = [...sourceInkIds];
      clonedDoc.objects[newObject.id] = newObject;
      if (!clonedDoc.rootIds.includes(newObject.id)) {
        clonedDoc.rootIds.push(newObject.id);
      }

      const inverse: Command = {
        id: `inv-${command.id}`,
        type: 'revertConversion',
        timestamp: command.timestamp,
        targets: [newObject.id],
        payload: {
          convertedObjectId: newObject.id,
          sourceInkIds: [...sourceInkIds],
        },
      };
      return { doc: clonedDoc, inverse };
    }

    case 'revertConversion': {
      const convertedObjectId = command.payload.convertedObjectId as string;
      const sourceInkIds = command.payload.sourceInkIds as string[];
      const convertedObj = clonedDoc.objects[convertedObjectId];

      delete clonedDoc.objects[convertedObjectId];
      clonedDoc.rootIds = clonedDoc.rootIds.filter((id) => id !== convertedObjectId);

      for (const id of sourceInkIds) {
        if (clonedDoc.objects[id]) {
          clonedDoc.objects[id].hidden = false;
        }
      }

      const inverse: Command = {
        id: `inv-${command.id}`,
        type: 'convertInk',
        timestamp: command.timestamp,
        targets: [convertedObjectId],
        payload: {
          newObject: convertedObj,
          sourceInkIds: [...sourceInkIds],
        },
      };
      return { doc: clonedDoc, inverse };
    }

    case 'batch': {
      const commands = command.payload.commands as Command[];
      let currentDoc = clonedDoc;
      const inverses: Command[] = [];

      for (const subCmd of commands) {
        const res = applyCommandOracle(currentDoc, subCmd);
        currentDoc = res.doc;
        inverses.unshift(res.inverse);
      }

      const inverse: Command = {
        id: `inv-${command.id}`,
        type: 'batch',
        timestamp: command.timestamp,
        targets: command.targets,
        payload: { commands: inverses },
      };
      return { doc: currentDoc, inverse };
    }

    default:
      throw new Error(`Unsupported command type: ${command.type}`);
  }
}
