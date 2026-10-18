/**
 * Browser Local Persistence, Autosave, Snapshots, and Export/Import Service.
 * Conforms to LENSBoard 2.0 Spec §7, §12, §16.
 */

import {
  type LensDocument,
  type CanvasObject,
  type PenColorSlot,
  LensDocumentSchema,
  generateUlid,
  createCanvasObject,
  generateInitialZ,
  sortRootIdsByZ,
  sanitizeCoordinate,
  clampZoom,
} from '@lensboard/core';
import { resolveColor } from '@lensboard/render';

export const WORKSPACE_STORAGE_KEY = 'lensboard_workspace_v2';
export const SNAPSHOTS_STORAGE_KEY = 'lensboard_snapshots_v2';
export const INBOX_STORAGE_KEY = 'lensboard_inbox_v2';

export interface StoredTab {
  id: string;
  title: string;
  isDirty?: boolean;
  isPinned?: boolean;
}

export interface WorkspaceState {
  version: number;
  activeTabId: string;
  theme: string;
  tabs: StoredTab[];
  boards: Record<string, LensDocument>;
  lastSavedAt: number;
}

export interface StoredSnapshot {
  id: string;
  boardId: string;
  label: string;
  starred: boolean;
  timestamp: number;
  doc: LensDocument;
}

export interface StoredInboxItem {
  id: string;
  text: string;
  timestamp: number;
  category?: string;
}

/**
 * Loads the workspace state from local storage.
 * Returns null if no valid state is found.
 */
export function loadWorkspaceFromStorage(): WorkspaceState | null {
  try {
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.boards) return null;
    return parsed as WorkspaceState;
  } catch (err) {
    console.warn('[Lensboard Storage] Failed to load workspace from localStorage:', err);
    return null;
  }
}

/**
 * Persists the entire workspace state to local storage.
 */
export function saveWorkspaceToStorage(state: WorkspaceState): boolean {
  try {
    const payload = JSON.stringify({
      ...state,
      version: 2,
      lastSavedAt: Date.now(),
    });
    localStorage.setItem(WORKSPACE_STORAGE_KEY, payload);
    return true;
  } catch (err) {
    console.error('[Lensboard Storage] Failed to persist workspace:', err);
    return false;
  }
}

/**
 * Loads snapshots for a specific board or all boards.
 */
export function loadSnapshotsFromStorage(boardId?: string): StoredSnapshot[] {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: StoredSnapshot[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    if (boardId) {
      return parsed.filter((s) => s.boardId === boardId);
    }
    return parsed;
  } catch (err) {
    console.warn('[Lensboard Storage] Failed to load snapshots:', err);
    return [];
  }
}

/**
 * Appends a new snapshot (e.g. starred or milestone) to local storage.
 */
export function saveSnapshotToStorage(snapshot: StoredSnapshot): void {
  try {
    const all = loadSnapshotsFromStorage();
    // Cap at 100 snapshots
    const updated = [snapshot, ...all.filter((s) => s.id !== snapshot.id)].slice(0, 100);
    localStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('[Lensboard Storage] Failed to save snapshot:', err);
  }
}

/**
 * Loads inbox captures from local storage.
 */
export function loadInboxFromStorage(): StoredInboxItem[] {
  try {
    const raw = localStorage.getItem(INBOX_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Persists inbox captures to local storage.
 */
export function saveInboxToStorage(items: StoredInboxItem[]): void {
  try {
    localStorage.setItem(INBOX_STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('[Lensboard Storage] Failed to save inbox items:', err);
  }
}

/**
 * Export document as a downloadable .lens.json file.
 */
export function exportDocumentAsJson(doc: LensDocument): void {
  const jsonStr = JSON.stringify(doc, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const safeTitle = (doc.title || 'board').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();

  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeTitle}.lens.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Validates and imports a document from a JSON string.
 * Throws an error if JSON is malformed or invalid.
 */
export function importDocumentFromJson(jsonStr: string): LensDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    throw new Error(`Invalid JSON format: ${err instanceof Error ? err.message : String(err)}`);
  }

  const parseResult = LensDocumentSchema.safeParse(parsed);
  if (parseResult.success) {
    return parseResult.data as unknown as LensDocument;
  }

  // Graceful salvage if minor schema inconsistencies exist
  if (parsed && typeof parsed === 'object') {
    const raw = parsed as Record<string, unknown>;
    const rawObjects =
      raw.objects && typeof raw.objects === 'object'
        ? (raw.objects as Record<string, unknown>)
        : {};

    const rawViewport = (raw.viewport && typeof raw.viewport === 'object' ? raw.viewport : {}) as Record<string, unknown>;

    const salvaged: LensDocument = {
      schemaVersion: 1,
      id: typeof raw.id === 'string' && raw.id ? raw.id : generateUlid(),
      title: typeof raw.title === 'string' && raw.title ? raw.title : 'Imported Board',
      objects: {},
      rootIds: [],
      viewport: {
        x: sanitizeCoordinate(Number(rawViewport.x) || 0),
        y: sanitizeCoordinate(Number(rawViewport.y) || 0),
        zoom: clampZoom(Number(rawViewport.zoom) || 1.0),
      },
    };

    const validSlots = new Set<string>([
      'ink',
      'gray',
      'orange',
      'sky',
      'green',
      'yellow',
      'blue',
      'vermillion',
      'purple',
      'custom',
    ]);

    for (const [id, rawObj] of Object.entries(rawObjects)) {
      if (rawObj && typeof rawObj === 'object') {
        const o = rawObj as Record<string, unknown>;
        const objId = String(o.id || id);

        let colorId: PenColorSlot = 'blue';
        const rawStyle = o.style as Record<string, unknown> | undefined;
        if (rawStyle && typeof rawStyle.colorId === 'string' && validSlots.has(rawStyle.colorId)) {
          colorId = rawStyle.colorId as PenColorSlot;
        } else if (rawStyle && typeof rawStyle.colorId === 'string' && rawStyle.colorId.startsWith('#')) {
          colorId = 'custom';
        }

        const cleanObj: CanvasObject = createCanvasObject({
          id: objId,
          type: String(o.type || 'shape'),
          parentId: o.parentId ? String(o.parentId) : null,
          x: sanitizeCoordinate(Number(o.x) || 0),
          y: sanitizeCoordinate(Number(o.y) || 0),
          w: Math.max(0, sanitizeCoordinate(Number(o.w || o.width) || 120)),
          h: Math.max(0, sanitizeCoordinate(Number(o.h || o.height) || 60)),
          rotation: sanitizeCoordinate(Number(o.rotation) || 0),
          z: typeof o.z === 'string' && o.z ? o.z : generateInitialZ(),
          label: o.label ? String(o.label) : undefined,
          shapeType: (o.shapeType as CanvasObject['shapeType']) || undefined,
          style: {
            colorId,
            strokeWidth: Math.max(0.1, Number(rawStyle?.strokeWidth) || 2),
            renderMode: rawStyle?.renderMode === 'sketch' ? 'sketch' : 'crisp',
            fill: rawStyle?.fill ? String(rawStyle.fill) : undefined,
            sketchSeed: typeof rawStyle?.sketchSeed === 'number' ? rawStyle.sketchSeed : undefined,
          },
          tags: Array.isArray(o.tags) ? o.tags.map(String) : [],
          locked: Boolean(o.locked),
          hidden: Boolean(o.hidden),
          createdAt: Number(o.createdAt) || Date.now(),
          updatedAt: Number(o.updatedAt) || Date.now(),
          data: (o.data as Record<string, unknown>) || undefined,
          points: (o.points as CanvasObject['points']) || undefined,
          sourceInk: Array.isArray(o.sourceInk) ? o.sourceInk.map(String) : undefined,
          opacity: typeof o.opacity === 'number' ? o.opacity : undefined,
        });

        salvaged.objects[objId] = cleanObj;
        salvaged.rootIds.push(objId);
      }
    }

    if (Array.isArray(raw.rootIds)) {
      const validRootIds = raw.rootIds
        .map(String)
        .filter((rid) => salvaged.objects[rid] !== undefined);
      if (validRootIds.length > 0) {
        salvaged.rootIds = validRootIds;
      }
    }

    salvaged.rootIds = sortRootIdsByZ(salvaged.rootIds, salvaged.objects);
    return salvaged;
  }

  throw new Error(`Invalid LENSBoard document: ${parseResult.error.message}`);
}

/**
 * Exports a merged composite of static and live canvas layers as a high-resolution PNG.
 */
export function exportCanvasAsPng(
  staticCanvas: HTMLCanvasElement | null,
  liveCanvas: HTMLCanvasElement | null,
  filename = 'lensboard-export.png',
  backgroundColor = '#12141C'
): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (!staticCanvas) {
      resolve(null);
      return;
    }

    const width = staticCanvas.width;
    const height = staticCanvas.height;
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;

    const ctx = offscreen.getContext('2d');
    if (!ctx) {
      resolve(null);
      return;
    }

    // 1. Fill background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // 2. Draw static scene canvas
    ctx.drawImage(staticCanvas, 0, 0);

    // 3. Draw live interaction canvas if available
    if (liveCanvas) {
      ctx.drawImage(liveCanvas, 0, 0);
    }

    offscreen.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      resolve(blob);
    }, 'image/png');
  });
}

/**
 * Copies the current canvas view to system clipboard as a PNG image.
 */
export async function copyCanvasToClipboard(
  staticCanvas: HTMLCanvasElement | null,
  liveCanvas: HTMLCanvasElement | null,
  backgroundColor = '#12141C'
): Promise<boolean> {
  if (!staticCanvas || typeof ClipboardItem === 'undefined') return false;

  return new Promise((resolve) => {
    const width = staticCanvas.width;
    const height = staticCanvas.height;
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;

    const ctx = offscreen.getContext('2d');
    if (!ctx) {
      resolve(false);
      return;
    }

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(staticCanvas, 0, 0);
    if (liveCanvas) ctx.drawImage(liveCanvas, 0, 0);

    offscreen.toBlob(async (blob) => {
      if (!blob) {
        resolve(false);
        return;
      }
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        resolve(true);
      } catch (err) {
        console.warn('Clipboard write failed:', err);
        resolve(false);
      }
    }, 'image/png');
  });
}

/**
 * Exports document objects as an SVG string.
 */
export function exportDocumentAsSvg(doc: LensDocument): void {
  const safeTitle = (doc.title || 'board').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
  const width = 2400;
  const height = 1600;

  let svgElements = '';

  for (const id of doc.rootIds) {
    const obj = doc.objects[id];
    if (!obj || obj.hidden) continue;

    const strokeColor = resolveColor(obj.style?.colorId as PenColorSlot, '#7C8CFF');
    const strokeWidth = obj.style?.strokeWidth || 2;
    const fill = obj.style?.fill && obj.style.fill !== 'transparent' ? obj.style.fill : 'none';
    const objW = Math.max(10, obj.w || 100);
    const objH = Math.max(10, obj.h || 50);
    const opacityAttr = typeof obj.opacity === 'number' && obj.opacity < 1.0 ? ` opacity="${obj.opacity}"` : '';

    if (obj.type === 'shape') {
      const shapeType = obj.shapeType || (obj.data?.shapeType as string) || 'rectangle';
      if (shapeType === 'circle' || shapeType === 'ellipse') {
        const cx = obj.x + objW / 2;
        const cy = obj.y + objH / 2;
        const rx = objW / 2;
        const ry = objH / 2;
        svgElements += `  <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${strokeColor}" stroke-width="${strokeWidth}"${opacityAttr} />\n`;
      } else if (shapeType === 'diamond') {
        const cx = obj.x + objW / 2;
        const cy = obj.y + objH / 2;
        const pts = `${cx},${obj.y} ${obj.x + objW},${cy} ${cx},${obj.y + objH} ${obj.x},${cy}`;
        svgElements += `  <polygon points="${pts}" fill="${fill}" stroke="${strokeColor}" stroke-width="${strokeWidth}"${opacityAttr} />\n`;
      } else if (shapeType === 'triangle') {
        const cx = obj.x + objW / 2;
        const pts = `${cx},${obj.y} ${obj.x + objW},${obj.y + objH} ${obj.x},${obj.y + objH}`;
        svgElements += `  <polygon points="${pts}" fill="${fill}" stroke="${strokeColor}" stroke-width="${strokeWidth}"${opacityAttr} />\n`;
      } else {
        svgElements += `  <rect x="${obj.x}" y="${obj.y}" width="${objW}" height="${objH}" rx="6" fill="${fill}" stroke="${strokeColor}" stroke-width="${strokeWidth}"${opacityAttr} />\n`;
      }
      if (obj.label) {
        const rawLines = String(obj.label).split('\n');
        if (rawLines.length === 1) {
          svgElements += `  <text x="${obj.x + objW / 2}" y="${obj.y + objH / 2 + 4}" font-family="Inter, sans-serif" font-size="12" fill="${strokeColor}" text-anchor="middle"${opacityAttr}>${escapeXml(rawLines[0])}</text>\n`;
        } else {
          const startY = obj.y + objH / 2 - (rawLines.length - 1) * 7.5 + 4;
          svgElements += `  <text x="${obj.x + objW / 2}" y="${startY}" font-family="Inter, sans-serif" font-size="12" fill="${strokeColor}" text-anchor="middle"${opacityAttr}>\n`;
          rawLines.forEach((l, idx) => {
            svgElements += `    <tspan x="${obj.x + objW / 2}" dy="${idx === 0 ? 0 : 15}">${escapeXml(l)}</tspan>\n`;
          });
          svgElements += `  </text>\n`;
        }
      }
    } else if (obj.type === 'nnBlock') {
      const title = String(obj.data?.title || obj.label || 'Neural Network Block');
      svgElements += `  <rect x="${obj.x}" y="${obj.y}" width="${objW}" height="${objH}" rx="6" fill="rgba(23,27,40,0.95)" stroke="${strokeColor}" stroke-width="${strokeWidth}"${opacityAttr} />\n`;
      svgElements += `  <rect x="${obj.x}" y="${obj.y}" width="${objW}" height="24" rx="4" fill="rgba(86,180,233,0.2)"${opacityAttr} />\n`;
      svgElements += `  <text x="${obj.x + 8}" y="${obj.y + 16}" font-family="Inter, sans-serif" font-size="11" font-weight="bold" fill="${strokeColor}"${opacityAttr}>⚡ ${escapeXml(title)}</text>\n`;
    } else if (obj.type === 'heatmap') {
      const title = String(obj.data?.title || obj.label || 'Attention Heatmap');
      svgElements += `  <rect x="${obj.x}" y="${obj.y}" width="${objW}" height="${objH}" rx="6" fill="rgba(17,20,29,0.95)" stroke="${strokeColor}" stroke-width="${strokeWidth}"${opacityAttr} />\n`;
      svgElements += `  <text x="${obj.x + 8}" y="${obj.y + 16}" font-family="Inter, sans-serif" font-size="10" font-weight="bold" fill="${strokeColor}"${opacityAttr}>🔥 ${escapeXml(title)}</text>\n`;
    } else if (obj.type === 'derivation') {
      const title = String(obj.data?.title || obj.label || 'Derivation Step');
      svgElements += `  <rect x="${obj.x}" y="${obj.y}" width="${objW}" height="${objH}" rx="6" fill="rgba(23,27,40,0.95)" stroke="${strokeColor}" stroke-width="${strokeWidth}"${opacityAttr} />\n`;
      svgElements += `  <text x="${obj.x + 8}" y="${obj.y + 16}" font-family="Inter, sans-serif" font-size="10" font-weight="bold" fill="${strokeColor}"${opacityAttr}>📝 ${escapeXml(title)}</text>\n`;
    } else if (obj.type === 'image') {
      const src = String(obj.data?.src || '');
      svgElements += `  <rect x="${obj.x}" y="${obj.y}" width="${objW}" height="${objH}" rx="4" fill="rgba(15,23,42,0.6)" stroke="${strokeColor}" stroke-width="${strokeWidth}"${opacityAttr} />\n`;
      if (src) {
        svgElements += `  <image href="${escapeXml(src)}" x="${obj.x}" y="${obj.y}" width="${objW}" height="${objH}" preserveAspectRatio="xMidYMid meet"${opacityAttr} />\n`;
      } else {
        svgElements += `  <text x="${obj.x + objW / 2}" y="${obj.y + objH / 2 + 4}" font-family="Inter, sans-serif" font-size="12" fill="${strokeColor}" text-anchor="middle"${opacityAttr}>🖼️ Image</text>\n`;
      }
    } else if (obj.type === 'frame') {
      const title = String(obj.data?.title || obj.label || 'Frame');
      svgElements += `  <rect x="${obj.x}" y="${obj.y}" width="${objW}" height="${objH}" rx="8" fill="rgba(30,41,59,0.3)" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-dasharray="4 4"${opacityAttr} />\n`;
      svgElements += `  <rect x="${obj.x}" y="${obj.y - 24}" width="${objW}" height="24" rx="4" fill="rgba(15,23,42,0.85)"${opacityAttr} />\n`;
      svgElements += `  <text x="${obj.x + 8}" y="${obj.y - 8}" font-family="Inter, sans-serif" font-weight="bold" font-size="11" fill="#E2E8F0"${opacityAttr}>${escapeXml(title)}</text>\n`;
    } else if (obj.type === 'line' || obj.type === 'arrow') {
      const x2 = (obj.data?.x2 as number) ?? obj.x + objW;
      const y2 = (obj.data?.y2 as number) ?? obj.y + objH;
      svgElements += `  <line x1="${obj.x}" y1="${obj.y}" x2="${x2}" y2="${y2}" stroke="${strokeColor}" stroke-width="${strokeWidth}"${opacityAttr} />\n`;
      if (obj.data?.arrow || obj.type === 'arrow') {
        const angle = Math.atan2(y2 - obj.y, x2 - obj.x);
        const arrowLen = 12;
        const x3 = x2 - arrowLen * Math.cos(angle - Math.PI / 6);
        const y3 = y2 - arrowLen * Math.sin(angle - Math.PI / 6);
        const x4 = x2 - arrowLen * Math.cos(angle + Math.PI / 6);
        const y4 = y2 - arrowLen * Math.sin(angle + Math.PI / 6);
        svgElements += `  <polygon points="${x2},${y2} ${x3},${y3} ${x4},${y4}" fill="${strokeColor}"${opacityAttr} />\n`;
      }
      if (obj.label) {
        svgElements += `  <text x="${(obj.x + x2) / 2}" y="${(obj.y + y2) / 2 - 6}" font-family="Inter, sans-serif" font-size="11" fill="${strokeColor}" text-anchor="middle"${opacityAttr}>${escapeXml(String(obj.label))}</text>\n`;
      }
    } else if (obj.type === 'ink' && obj.points && obj.points.length > 1) {
      const pathData = obj.points.reduce((acc, pt, idx) => {
        return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
      }, '');
      svgElements += `  <path d="${pathData}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${opacityAttr} />\n`;
    } else if (obj.type === 'code') {
      const codeVal = String(obj.data?.code || obj.label || '// code');
      svgElements += `  <rect x="${obj.x}" y="${obj.y}" width="${objW}" height="${objH}" rx="8" fill="rgba(21,24,35,0.95)" stroke="${strokeColor}" stroke-width="${strokeWidth}"${opacityAttr} />\n`;
      svgElements += `  <text x="${obj.x + 10}" y="${obj.y + 24}" font-family="monospace" font-size="11" fill="#E2E8F0"${opacityAttr}>${escapeXml(codeVal.slice(0, 80))}</text>\n`;
    } else if (obj.type === 'equation') {
      const eqVal = String(obj.data?.equation || obj.label || 'f(x) = y');
      svgElements += `  <rect x="${obj.x}" y="${obj.y}" width="${objW}" height="${objH}" rx="6" fill="rgba(30,36,54,0.85)" stroke="${strokeColor}" stroke-width="${strokeWidth}"${opacityAttr} />\n`;
      svgElements += `  <text x="${obj.x + objW / 2}" y="${obj.y + objH / 2 + 5}" font-family="serif" font-style="italic" font-size="13" fill="#E2E8F0" text-anchor="middle"${opacityAttr}>${escapeXml(eqVal)}</text>\n`;
    } else if (obj.type === 'grid' || obj.type === 'table' || obj.type === 'dpTable') {
      const rows = Number(obj.data?.rows) || 3;
      const cols = Number(obj.data?.cols) || 4;
      const cellW = objW / cols;
      const cellH = objH / rows;
      svgElements += `  <rect x="${obj.x}" y="${obj.y}" width="${objW}" height="${objH}" rx="4" fill="rgba(30,36,54,0.85)" stroke="${strokeColor}" stroke-width="${strokeWidth}"${opacityAttr} />\n`;
      for (let c = 1; c < cols; c++) {
        svgElements += `  <line x1="${obj.x + c * cellW}" y1="${obj.y}" x2="${obj.x + c * cellW}" y2="${obj.y + objH}" stroke="${strokeColor}" stroke-width="1" stroke-opacity="0.3"${opacityAttr} />\n`;
      }
      for (let r = 1; r < rows; r++) {
        svgElements += `  <line x1="${obj.x}" y1="${obj.y + r * cellH}" x2="${obj.x + objW}" y2="${obj.y + r * cellH}" stroke="${strokeColor}" stroke-width="1" stroke-opacity="0.3"${opacityAttr} />\n`;
      }
      if (obj.label) {
        svgElements += `  <text x="${obj.x + objW / 2}" y="${obj.y - 6}" font-family="Inter, sans-serif" font-size="11" font-weight="bold" fill="${strokeColor}" text-anchor="middle"${opacityAttr}>${escapeXml(String(obj.label))}</text>\n`;
      }
    } else if (obj.type === 'note') {
      const noteVal = String(obj.data?.text || obj.label || 'Note');
      svgElements += `  <rect x="${obj.x}" y="${obj.y}" width="${objW}" height="${objH}" rx="6" fill="rgba(251,191,36,0.15)" stroke="${strokeColor}" stroke-width="${strokeWidth}"${opacityAttr} />\n`;
      svgElements += `  <text x="${obj.x + 8}" y="${obj.y + 16}" font-family="Inter, sans-serif" font-size="11" font-weight="bold" fill="${strokeColor}"${opacityAttr}>📌 ${escapeXml(noteVal.slice(0, 40))}</text>\n`;
    } else {
      const textVal = String(obj.data?.text || obj.label || '');
      svgElements += `  <text x="${obj.x}" y="${obj.y + 16}" font-family="Inter, sans-serif" font-size="14" fill="${strokeColor}"${opacityAttr}>${escapeXml(textVal)}</text>\n`;
    }
  }

  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#12141C" />
${svgElements}
</svg>`;

  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeTitle}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Runs quick-check integrity diagnostics across all stored boards.
 * Automatically salvages orphaned root IDs and repairable documents.
 */
export function quickCheckWorkspace(state: WorkspaceState): {
  healthy: boolean;
  fixedCount: number;
  report: string;
} {
  let fixedCount = 0;
  const issues: string[] = [];

  for (const [boardId, doc] of Object.entries(state.boards)) {
    if (!doc.objects) {
      doc.objects = {};
      fixedCount++;
      issues.push(`Board ${boardId}: Reconstructed missing objects map`);
    }
    if (!Array.isArray(doc.rootIds)) {
      doc.rootIds = Object.keys(doc.objects);
      fixedCount++;
      issues.push(`Board ${boardId}: Reconstructed missing rootIds`);
    }

    // Filter out root IDs that don't exist in objects
    const validRootIds = doc.rootIds.filter((id) => doc.objects[id] !== undefined);
    if (validRootIds.length !== doc.rootIds.length) {
      fixedCount += doc.rootIds.length - validRootIds.length;
      doc.rootIds = validRootIds;
      issues.push(`Board ${boardId}: Cleaned up dangling root IDs`);
    }

    // Add unindexed objects to rootIds and sanitize styles/timestamps
    const validSlots = new Set<string>([
      'ink',
      'gray',
      'orange',
      'sky',
      'green',
      'yellow',
      'blue',
      'vermillion',
      'purple',
      'custom',
    ]);

    for (const [id, obj] of Object.entries(doc.objects)) {
      if (!doc.rootIds.includes(id)) {
        doc.rootIds.push(id);
        fixedCount++;
        issues.push(`Board ${boardId}: Indexed untracked object ${id}`);
      }

      if (typeof obj.createdAt !== 'number' || typeof obj.updatedAt !== 'number') {
        obj.createdAt = Number(obj.createdAt) || Date.now();
        obj.updatedAt = Number(obj.updatedAt) || Date.now();
        fixedCount++;
        issues.push(`Board ${boardId}: Normalized timestamps for ${id}`);
      }

      if (!obj.z) {
        obj.z = generateInitialZ();
        fixedCount++;
        issues.push(`Board ${boardId}: Generated missing z index for ${id}`);
      }

      if (!obj.style || !validSlots.has(String(obj.style.colorId))) {
        obj.style = {
          colorId: 'blue',
          strokeWidth: Math.max(0.1, Number(obj.style?.strokeWidth) || 2),
          renderMode: obj.style?.renderMode === 'sketch' ? 'sketch' : 'crisp',
          fill: obj.style?.fill,
        };
        fixedCount++;
        issues.push(`Board ${boardId}: Sanitized style slot for ${id}`);
      }
    }

    if (doc.viewport) {
      const sanitizedZoom = clampZoom(doc.viewport.zoom);
      if (sanitizedZoom !== doc.viewport.zoom) {
        doc.viewport.zoom = sanitizedZoom;
        fixedCount++;
        issues.push(`Board ${boardId}: Clamped out-of-range viewport zoom`);
      }
    }
  }

  return {
    healthy: issues.length === 0,
    fixedCount,
    report:
      issues.length === 0
        ? 'All boards passed PRAGMA quick-check integrity verification without error.'
        : `Salvaged ${fixedCount} anomalies across workspace boards:\n` + issues.join('\n'),
  };
}
