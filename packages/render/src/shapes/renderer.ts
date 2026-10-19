/**
 * Shape & Sketch Rendering Pipeline.
 * Authoritative: Spec §8, §9.
 * - Crisp rendering via standard Canvas 2D primitives.
 * - Rough.js sketch rendering mode with deterministic sketchSeed (never jitters).
 * - Full entity coverage: ink, shapes, rectangles, lines, frames with LOD, smart objects.
 */

import rough from 'roughjs';
import type { CanvasObject, PenColorSlot } from '@lensboard/core';
import { generateStrokeOutline, drawStrokeToContext } from '../ink/outline.js';
import { getFrameLODLevel, renderFrameSummaryCard, renderFrameTitleOnly } from '../canvas/lod.js';
import type { SmartObjectCache } from '../canvas/cache.js';

export const PEN_COLOR_MAP: Record<PenColorSlot, string> = {
  ink: '#1C1E26',
  gray: '#6B7280',
  orange: '#E69F00',
  sky: '#56B4E9',
  green: '#009E73',
  yellow: '#F0E442',
  blue: '#0072B2',
  vermillion: '#D55E00',
  purple: '#CC79A7',
  custom: '#1C1E26',
};

export function resolveCssColor(color?: string, fallback = 'transparent'): string {
  if (!color || color === 'none') return fallback;
  if (color.startsWith('var(')) {
    const match = color.match(/var\(\s*([^,\s)]+)(?:\s*,\s*([^)]+))?\)/);
    if (match) {
      const varName = match[1];
      const fb = match[2]?.trim() || fallback;
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
        if (val) return val;
      }
      return fb;
    }
  }
  return color;
}

export function resolveColor(colorId?: PenColorSlot, fallback = '#1C1E26'): string {
  if (!colorId) return fallback;
  const mapped = PEN_COLOR_MAP[colorId] ?? colorId;
  return resolveCssColor(mapped, fallback);
}

export const HANDWRITING_FONT_FAMILY = 'Caveat, "Segoe Print", cursive';

/**
 * Resolves whether an object should render with the Caveat handwriting font.
 */
export function resolveEntityFont(
  obj: CanvasObject,
  defaultFamily: string,
  baseSizePx: number,
  options: { bold?: boolean; italic?: boolean } = {}
): { font: string; lineHeight: number } {
  const globalHandwriting =
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-lb-font') === 'handwriting';
  const objFontPref = obj.data?.fontFamily as string | undefined;

  const useHandwriting =
    objFontPref === 'handwriting' ||
    (objFontPref === undefined && globalHandwriting) ||
    obj.style?.renderMode === 'sketch';

  if (useHandwriting) {
    const scaledSize = Math.round(baseSizePx * 1.22);
    const weight = options.bold ? '700' : '600';
    return {
      font: `${weight} ${scaledSize}px ${HANDWRITING_FONT_FAMILY}`,
      lineHeight: Math.round(scaledSize * 1.28),
    };
  }

  const stylePrefix = `${options.italic ? 'italic ' : ''}${options.bold ? 'bold ' : ''}`;
  return {
    font: `${stylePrefix}${baseSizePx}px ${defaultFamily}`,
    lineHeight: Math.round(baseSizePx * 1.35),
  };
}

/**
 * Normalizes LaTeX line breaks (\\, \newline, \cr) into '\n' and converts common
 * KaTeX/LaTeX commands into readable Unicode math symbols for Canvas 2D rendering.
 */
export function formatLatexForCanvas(raw: string): string {
  if (!raw) return '';
  return String(raw)
    .replace(/\\begin\{(aligned|align\*?|gathered|gather\*?|cases|array)\}/g, '')
    .replace(/\\end\{(aligned|align\*?|gathered|gather\*?|cases|array)\}/g, '')
    .replace(/\\\\|\\newline|\\cr/g, '\n')
    .replace(/&=/g, '= ')
    .replace(/&/g, ' ')
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .replace(/\\mathrm\{([^}]*)\}/g, '$1')
    .replace(/\\mathbf\{([^}]*)\}/g, '$1')
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)')
    .replace(/\\sqrt\{([^}]*)\}/g, '√($1)')
    .replace(/\\sum/g, '∑')
    .replace(/\\prod/g, '∏')
    .replace(/\\int/g, '∫')
    .replace(/\\infty/g, '∞')
    .replace(/\\nabla/g, '∇')
    .replace(/\\partial/g, '∂')
    .replace(/\\mathbb\{R\}/g, 'ℝ')
    .replace(/\\mathbb\{E\}/g, '𝔼')
    .replace(/\\mathbb\{N\}/g, 'ℕ')
    .replace(/\\mathbb\{Z\}/g, 'ℤ')
    .replace(/\\in/g, '∈')
    .replace(/\\notin/g, '∉')
    .replace(/\\subset/g, '⊂')
    .replace(/\\subseteq/g, '⊆')
    .replace(/\\le|\\leq/g, '≤')
    .replace(/\\ge|\\geq/g, '≥')
    .replace(/\\ne|\\neq/g, '≠')
    .replace(/\\approx/g, '≈')
    .replace(/\\equiv/g, '≡')
    .replace(/\\to|\\rightarrow/g, '→')
    .replace(/\\leftarrow/g, '←')
    .replace(/\\Rightarrow/g, '⇒')
    .replace(/\\iff|\\Leftrightarrow/g, '⇔')
    .replace(/\\times/g, '×')
    .replace(/\\cdot/g, '·')
    .replace(/\\pm/g, '±')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\delta/g, 'δ')
    .replace(/\\epsilon|\\varepsilon/g, 'ε')
    .replace(/\\theta/g, 'θ')
    .replace(/\\lambda/g, 'λ')
    .replace(/\\mu/g, 'μ')
    .replace(/\\pi/g, 'π')
    .replace(/\\sigma/g, 'σ')
    .replace(/\\tau/g, 'τ')
    .replace(/\\phi|\\varphi/g, 'φ')
    .replace(/\\omega/g, 'ω')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\Sigma/g, 'Σ')
    .replace(/\\Omega/g, 'Ω');
}

/**
 * Wraps text into lines that fit within maxWidth using canvas measureText.
 * Handles newlines and breaks long continuous words gracefully.
 */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  if (!text) return [];
  if (maxWidth <= 0) return [String(text)];
  const lines: string[] = [];
  const paragraphs = String(text).split('\n');

  for (const para of paragraphs) {
    if (para.trim() === '') {
      lines.push('');
      continue;
    }
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const wordWidth = ctx.measureText(word).width;

      if (wordWidth > maxWidth) {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = '';
        }
        let subWord = '';
        for (const char of word) {
          if (ctx.measureText(subWord + char).width <= maxWidth) {
            subWord += char;
          } else {
            if (subWord) lines.push(subWord);
            subWord = char;
          }
        }
        currentLine = subWord;
        continue;
      }

      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = ctx.measureText(testLine).width;

      if (testWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

export interface CodeSyntaxToken {
  text: string;
  color: string;
}

/**
 * Tokenizes a line of code into syntax highlighting tokens with theme-aligned colors.
 */
export function tokenizeCodeForCanvas(line: string): CodeSyntaxToken[] {
  if (!line) return [];
  const tokenRegex =
    /(\/\/[^\n]*|#[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b(?:const|let|var|function|return|if|else|for|while|import|export|from|class|type|interface|extends|implements|async|await|new|typeof|instanceof|try|catch|finally|throw|switch|case|default|break|continue|void|def|self|None|True|False|elif|in|is|not|with|as|lambda|yield)\b)|(\b(?:number|string|boolean|any|unknown|never|Record|Array|Map|Set|List|Optional|Dict|Tuple|int|float|str|bool)\b)|(\b\d+(?:\.\d+)?\b)|(\b(?:true|false|null|undefined)\b)|([a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\())|([{}()[\];,+\-*/%=<>!&|^~?:])/g;

  let lastIndex = 0;
  const tokens: CodeSyntaxToken[] = [];
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: line.slice(lastIndex, match.index), color: '#C0CAF5' });
    }
    const [full, comment, str, kw, typeKw, num, bool, fnName, punct] = match;
    if (comment) tokens.push({ text: comment, color: '#565F89' });
    else if (str) tokens.push({ text: str, color: '#9ECE6A' });
    else if (kw) tokens.push({ text: kw, color: '#BB9AF7' });
    else if (typeKw) tokens.push({ text: typeKw, color: '#7AA2F7' });
    else if (num || bool) tokens.push({ text: num || bool, color: '#FF9E64' });
    else if (fnName) tokens.push({ text: fnName, color: '#7DCFFF' });
    else if (punct) tokens.push({ text: punct, color: '#89DDFF' });
    lastIndex = match.index + full.length;
  }
  if (lastIndex < line.length) {
    tokens.push({ text: line.slice(lastIndex), color: '#C0CAF5' });
  }
  return tokens;
}

/**
 * Wraps code tokens within maxWidth, splitting lines and oversized tokens without leaking.
 */
export function wrapCodeTokens(
  ctx: CanvasRenderingContext2D,
  rawLines: string[],
  maxWidth: number
): CodeSyntaxToken[][] {
  const wrapped: CodeSyntaxToken[][] = [];
  for (const rawLine of rawLines) {
    if (!rawLine) {
      wrapped.push([]);
      continue;
    }
    const tokens = tokenizeCodeForCanvas(rawLine);
    let curLine: CodeSyntaxToken[] = [];
    let curWidth = 0;

    for (const tok of tokens) {
      const tokWidth = ctx.measureText(tok.text).width;
      if (curWidth + tokWidth <= maxWidth) {
        curLine.push(tok);
        curWidth += tokWidth;
      } else {
        if (curLine.length > 0) {
          wrapped.push(curLine);
          curLine = [];
          curWidth = 0;
        }
        if (tokWidth > maxWidth) {
          let chunk = '';
          for (const ch of tok.text) {
            const chWidth = ctx.measureText(chunk + ch).width;
            if (chWidth <= maxWidth) {
              chunk += ch;
            } else {
              if (chunk) wrapped.push([{ text: chunk, color: tok.color }]);
              chunk = ch;
            }
          }
          if (chunk) {
            curLine = [{ text: chunk, color: tok.color }];
            curWidth = ctx.measureText(chunk).width;
          }
        } else {
          curLine.push(tok);
          curWidth = tokWidth;
        }
      }
    }
    if (curLine.length > 0) {
      wrapped.push(curLine);
    }
  }
  return wrapped;
}

const roughGenerator = rough.generator();

/**
 * Executes rough.js drawable operations onto a 2D rendering context.
 */
function drawRoughDrawable(
  ctx: CanvasRenderingContext2D,
  drawable: { sets: Array<{ type: string; ops: Array<{ op: string; data: number[] }> }> },
  strokeStyle: string,
  fillStyle?: string,
  strokeWidth = 1
): void {
  ctx.save();
  ctx.strokeStyle = strokeStyle;
  ctx.fillStyle = fillStyle || 'transparent';
  ctx.lineWidth = strokeWidth;

  for (const set of drawable.sets) {
    if (set.type === 'path') {
      ctx.beginPath();
      for (const op of set.ops) {
        if (op.op === 'move') {
          ctx.moveTo(op.data[0], op.data[1]);
        } else if (op.op === 'bcurveTo') {
          ctx.bezierCurveTo(
            op.data[0],
            op.data[1],
            op.data[2],
            op.data[3],
            op.data[4],
            op.data[5]
          );
        } else if (op.op === 'lineTo') {
          ctx.lineTo(op.data[0], op.data[1]);
        }
      }
      if (fillStyle && fillStyle !== 'none' && fillStyle !== 'transparent') {
        ctx.fill();
      }
      if (strokeStyle && strokeStyle !== 'none') {
        ctx.stroke();
      }
    }
  }

  ctx.restore();
}

/**
 * Renders any CanvasObject onto a 2D context with crisp/sketch mode and LOD adaptation.
 */
export function renderCanvasObject(
  ctx: CanvasRenderingContext2D,
  obj: CanvasObject,
  zoom = 1.0,
  _cache?: SmartObjectCache
): void {
  if (obj.hidden) return;

  const width = obj.w ?? (obj as { width?: number }).width ?? 0;
  const height = obj.h ?? (obj as { height?: number }).height ?? 0;
  const strokeColor = resolveColor(obj.style?.colorId);
  const strokeWidth = obj.style?.strokeWidth ?? (obj as { size?: number }).size ?? 2;
  const isSketch = obj.style?.renderMode === 'sketch';
  const sketchSeed = obj.style?.sketchSeed ?? 42;

  // Apply object-level opacity
  const opacity =
    typeof (obj as { opacity?: number }).opacity === 'number'
      ? (obj as { opacity: number }).opacity
      : 1.0;
  const applyOpacity = opacity < 1.0;
  if (applyOpacity) {
    ctx.save();
    ctx.globalAlpha = opacity;
  }

  // Apply object-level rotation
  const hasRotation = !!obj.rotation;
  if (hasRotation) {
    ctx.save();
    const cx = obj.x + width / 2;
    const cy = obj.y + height / 2;
    ctx.translate(cx, cy);
    ctx.rotate(obj.rotation ?? 0);
    ctx.translate(-cx, -cy);
  }

  try {
    switch (obj.type) {
      case 'ink':
      case 'stroke' as string: {
        const points = (obj as { points?: Array<{ x: number; y: number }> }).points ?? [];
        if (points.length > 0) {
          const outline = generateStrokeOutline(points, {
            size: strokeWidth,
            thinning: 0,
            smoothing: 0.85,
            streamline: 0.7,
            simulatePressure: false,
            startTaper: 0,
            endTaper: 0,
          });
          drawStrokeToContext(ctx, outline, strokeColor);
        }
        break;
      }

      case 'frame': {
        const lod = getFrameLODLevel(zoom);
        const title = (obj.data?.title as string) || 'Frame';
        if (lod === 'title') {
          renderFrameTitleOnly(ctx, obj, title);
        } else if (lod === 'summary') {
          renderFrameSummaryCard(ctx, obj, {
            title,
            tags: obj.tags,
            childCount: (obj.data?.childCount as number) || 0,
          });
        } else {
          // Full Frame
          ctx.save();
          ctx.fillStyle = obj.style?.fill || 'rgba(30, 41, 59, 0.4)';
          ctx.fillRect(obj.x, obj.y, width, height);
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = strokeWidth;
          ctx.strokeRect(obj.x, obj.y, width, height);

          // Frame Title Banner
          ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
          ctx.fillRect(obj.x, obj.y - 24, width, 24);
          ctx.font = 'bold 12px sans-serif';
          ctx.fillStyle = '#E2E8F0';
          ctx.fillText(title, obj.x + 8, obj.y - 8);
          ctx.restore();
        }
        break;
      }

      case 'line':
      case 'arrow': {
        const x2 = (obj.data?.x2 as number) ?? obj.x + width;
        const y2 = (obj.data?.y2 as number) ?? obj.y + height;
        const hasArrow = !!(obj.data?.arrow || obj.shapeType === 'arrow' || obj.type === 'arrow');

        if (isSketch) {
          const d = roughGenerator.line(obj.x, obj.y, x2, y2, {
            seed: sketchSeed,
            stroke: strokeColor,
            strokeWidth,
          });
          drawRoughDrawable(ctx, d, strokeColor, undefined, strokeWidth);
        } else {
          ctx.save();
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = strokeWidth;
          ctx.beginPath();
          ctx.moveTo(obj.x, obj.y);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          ctx.restore();
        }

        if (hasArrow) {
          const angle = Math.atan2(y2 - obj.y, x2 - obj.x);
          const arrowLength = Math.max(10, strokeWidth * 4);
          ctx.save();
          ctx.fillStyle = strokeColor;
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = strokeWidth;
          ctx.beginPath();
          ctx.moveTo(x2, y2);
          ctx.lineTo(
            x2 - arrowLength * Math.cos(angle - Math.PI / 6),
            y2 - arrowLength * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            x2 - arrowLength * Math.cos(angle + Math.PI / 6),
            y2 - arrowLength * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }

        if (obj.label) {
          ctx.save();
          ctx.fillStyle = strokeColor;
          ctx.font = '12px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(String(obj.label), (obj.x + x2) / 2, (obj.y + y2) / 2 - 4);
          ctx.restore();
        }
        break;
      }

      case 'ruler': {
        const x2 = (obj.data?.x2 as number) ?? obj.x + width;
        const y2 = (obj.data?.y2 as number) ?? obj.y + height;
        const dist = Math.hypot(x2 - obj.x, y2 - obj.y);
        const angle = Math.atan2(y2 - obj.y, x2 - obj.x);
        const normAngle = angle + Math.PI / 2;

        ctx.save();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.beginPath();
        ctx.moveTo(obj.x, obj.y);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        const tickStep = 20;
        const numTicks = Math.floor(dist / tickStep);
        for (let i = 0; i <= numTicks; i++) {
          const t = i * tickStep;
          const tx = obj.x + Math.cos(angle) * t;
          const ty = obj.y + Math.sin(angle) * t;
          const tickLen = i % 5 === 0 ? 10 : 5;
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(tx + Math.cos(normAngle) * tickLen, ty + Math.sin(normAngle) * tickLen);
          ctx.stroke();
        }

        const mx = (obj.x + x2) / 2;
        const my = (obj.y + y2) / 2;
        const labelText: string = typeof obj.label === 'string' ? obj.label : `${Math.round(dist)} px`;
        ctx.font = 'bold 11px Inter, sans-serif';
        const txtWidth = ctx.measureText(labelText).width;
        ctx.fillStyle = 'rgba(23, 27, 38, 0.9)';
        ctx.fillRect(mx - txtWidth / 2 - 6, my - 10, txtWidth + 12, 20);
        ctx.strokeStyle = strokeColor;
        ctx.strokeRect(mx - txtWidth / 2 - 6, my - 10, txtWidth + 12, 20);
        ctx.fillStyle = strokeColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, mx, my);
        ctx.restore();
        break;
      }

      case 'text': {
        const textContent: string =
          typeof obj.data?.text === 'string'
            ? obj.data.text
            : typeof obj.label === 'string'
              ? obj.label
              : 'Text';
        const fontSize = (obj.data?.fontSize as number) || 16;
        const { font, lineHeight } = resolveEntityFont(
          obj,
          'Inter, -apple-system, sans-serif',
          fontSize
        );
        ctx.save();
        ctx.font = font;
        const maxTextW = Math.max(20, width - 12);
        const lines = wrapText(ctx, textContent, maxTextW);
        const effectiveH = Math.max(height, lines.length * lineHeight + 12);
        if (effectiveH > height) {
          obj.h = effectiveH;
        }
        if (obj.style?.fill && obj.style.fill !== 'transparent') {
          ctx.fillStyle = resolveCssColor(obj.style.fill);
          ctx.fillRect(obj.x, obj.y, width, effectiveH);
        }
        ctx.fillStyle = strokeColor;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], obj.x + 6, obj.y + 6 + i * lineHeight);
        }
        ctx.restore();
        break;
      }

      case 'equation': {
        const rawEqText: string =
          typeof obj.data?.equation === 'string'
            ? obj.data.equation
            : typeof obj.label === 'string'
              ? obj.label
              : 'f(x) = y';
        const formattedEq = formatLatexForCanvas(rawEqText);
        const fontSize = (obj.data?.fontSize as number) || 15;
        const { font, lineHeight } = resolveEntityFont(
          obj,
          '"Times New Roman", Georgia, serif',
          fontSize,
          { italic: true }
        );

        ctx.save();
        ctx.font = font;
        const paddingX = 12;
        const headerH = 20;
        const maxEqW = Math.max(40, width - paddingX * 2);
        const lines = wrapText(ctx, formattedEq, maxEqW);

        const contentH = Math.max(36, lines.length * lineHeight + 16);
        const effectiveH = Math.max(height, headerH + contentH);
        if (effectiveH > height) {
          obj.h = effectiveH;
        }

        ctx.fillStyle = resolveCssColor(obj.style?.fill, 'rgba(30, 36, 54, 0.85)');
        ctx.fillRect(obj.x, obj.y, width, effectiveH);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.strokeRect(obj.x, obj.y, width, effectiveH);

        ctx.fillStyle = 'rgba(99, 102, 241, 0.2)';
        ctx.fillRect(obj.x, obj.y, width, headerH);
        ctx.font = 'bold 9px sans-serif';
        ctx.fillStyle = strokeColor;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('∑ KaTeX Equation', obj.x + 8, obj.y + headerH / 2);

        ctx.beginPath();
        ctx.rect(
          obj.x + 2,
          obj.y + headerH,
          Math.max(1, width - 4),
          Math.max(1, effectiveH - headerH - 2)
        );
        ctx.clip();

        ctx.font = font;
        ctx.fillStyle = '#E2E8F0';
        const isMultiLine = lines.length > 1;
        ctx.textAlign = isMultiLine ? 'left' : 'center';
        ctx.textBaseline = 'top';

        const totalTextH = lines.length * lineHeight;
        const bodyTop = obj.y + headerH;
        const bodyAvailH = effectiveH - headerH;
        const startY = bodyTop + Math.max(6, (bodyAvailH - totalTextH) / 2);

        for (let i = 0; i < lines.length; i++) {
          const drawX = isMultiLine ? obj.x + paddingX : obj.x + width / 2;
          ctx.fillText(lines[i], drawX, startY + i * lineHeight);
        }
        ctx.restore();
        break;
      }

      case 'code': {
        const codeText: string =
          typeof obj.data?.code === 'string'
            ? obj.data.code
            : typeof obj.label === 'string'
              ? obj.label
              : '// code block';
        const lang = (obj.data?.language as string) || 'code';
        const output = obj.data?.output as
          | { logs?: string[]; result?: string; error?: string; durationMs?: number; success?: boolean }
          | undefined;

        ctx.save();
        ctx.font = '12px "Fira Code", Menlo, Monaco, Consolas, monospace';
        const paddingX = 10;
        const headerH = 22;
        const maxCodeW = Math.max(30, width - paddingX * 2);
        const codeLines = codeText.split('\n');
        const wrappedLines = wrapCodeTokens(ctx, codeLines, maxCodeW);

        const lineHeight = 16;
        const outH = output ? Math.max(36, Math.min(64, height * 0.38)) : 0;
        const requiredContentH = wrappedLines.length * lineHeight + 12;
        const effectiveH = Math.max(height, headerH + requiredContentH + outH);
        if (effectiveH > height) {
          obj.h = effectiveH;
        }

        ctx.fillStyle = resolveCssColor(obj.style?.fill, 'rgba(21, 24, 35, 0.95)');
        ctx.fillRect(obj.x, obj.y, width, effectiveH);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.strokeRect(obj.x, obj.y, width, effectiveH);

        // Header bar with window control dots
        ctx.fillStyle = 'rgba(35, 40, 58, 0.9)';
        ctx.fillRect(obj.x, obj.y, width, headerH);

        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(obj.x + 10, obj.y + 11, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(obj.x + 22, obj.y + 11, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#10B981';
        ctx.beginPath();
        ctx.arc(obj.x + 34, obj.y + 11, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = '#94A3B8';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(lang.toUpperCase(), obj.x + width - 8, obj.y + 11);

        // Clip code content area so text NEVER escapes bounding box
        ctx.save();
        ctx.beginPath();
        ctx.rect(
          obj.x + 2,
          obj.y + headerH,
          Math.max(1, width - 4),
          Math.max(1, effectiveH - headerH - outH - 2)
        );
        ctx.clip();

        ctx.font = '12px "Fira Code", Menlo, Monaco, Consolas, monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        const maxVisibleLines = Math.floor((effectiveH - headerH - outH - 8) / lineHeight);
        const linesToDraw = Math.min(wrappedLines.length, maxVisibleLines);
        for (let i = 0; i < linesToDraw; i++) {
          let curX = obj.x + paddingX;
          const curY = obj.y + headerH + 6 + i * lineHeight;
          for (const tok of wrappedLines[i]) {
            ctx.fillStyle = tok.color;
            ctx.fillText(tok.text, curX, curY);
            curX += ctx.measureText(tok.text).width;
          }
        }
        ctx.restore(); // restore clip

        // Render embedded output window if execution output is present
        if (output) {
          const outY = obj.y + effectiveH - outH;
          ctx.fillStyle = 'rgba(11, 14, 23, 0.96)';
          ctx.fillRect(obj.x, outY, width, outH);
          ctx.strokeStyle = output.success === false ? '#EF4444' : '#10B981';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(obj.x, outY);
          ctx.lineTo(obj.x + width, outY);
          ctx.stroke();

          // Output status pill
          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = output.success === false ? '#EF4444' : '#10B981';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          const statusText = output.success === false ? '✕ ERROR' : `✓ RUN (${output.durationMs ?? 0}ms)`;
          ctx.fillText(statusText, obj.x + 8, outY + 4);

          // Output logs / result preview
          ctx.font = '10px monospace';
          ctx.fillStyle = output.success === false ? '#FCA5A5' : '#86EFAC';
          const outMsg =
            output.error ||
            (output.logs && output.logs.length > 0 ? output.logs[0] : output.result ? `=> ${output.result}` : 'Done');
          ctx.fillText(String(outMsg).slice(0, 40), obj.x + 8, outY + 18);
        }

        ctx.restore();
        break;
      }

      case 'grid':
      case 'table':
      case 'dpTable': {
        const rows = (obj.data?.rows as number) || 3;
        const cols = (obj.data?.cols as number) || 4;
        const cellW = width / cols;
        const cellH = height / rows;
        ctx.save();
        ctx.fillStyle = resolveCssColor(obj.style?.fill, 'rgba(30, 36, 54, 0.85)');
        ctx.fillRect(obj.x, obj.y, width, height);

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.strokeRect(obj.x, obj.y, width, height);

        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(124, 140, 255, 0.35)';
        for (let c = 1; c < cols; c++) {
          ctx.beginPath();
          ctx.moveTo(obj.x + c * cellW, obj.y);
          ctx.lineTo(obj.x + c * cellW, obj.y + height);
          ctx.stroke();
        }
        for (let r = 1; r < rows; r++) {
          ctx.beginPath();
          ctx.moveTo(obj.x, obj.y + r * cellH);
          ctx.lineTo(obj.x + width, obj.y + r * cellH);
          ctx.stroke();
        }

        if (obj.label) {
          ctx.fillStyle = strokeColor;
          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(String(obj.label), obj.x + width / 2, obj.y - 18);
        }
        ctx.restore();
        break;
      }

      case 'note': {
        ctx.save();
        const noteText =
          typeof obj.data?.text === 'string'
            ? obj.data.text
            : typeof obj.label === 'string'
              ? obj.label
              : 'Note';
        const fontSize = (obj.data?.fontSize as number) || 13;
        const { font, lineHeight } = resolveEntityFont(
          obj,
          'Inter, -apple-system, sans-serif',
          fontSize
        );
        ctx.font = font;
        const maxTextW = Math.max(30, width - 16);
        const lines = wrapText(ctx, noteText, maxTextW);
        const headerH = 22;
        const effectiveH = Math.max(height, headerH + lines.length * lineHeight + 14);
        if (effectiveH > height) {
          obj.h = effectiveH;
        }

        ctx.fillStyle = resolveCssColor(obj.style?.fill, 'rgba(251, 191, 36, 0.15)');
        ctx.fillRect(obj.x, obj.y, width, effectiveH);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.strokeRect(obj.x, obj.y, width, effectiveH);

        // Header bar with pin
        ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
        ctx.fillRect(obj.x, obj.y, width, headerH);
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillStyle = strokeColor;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('📌 Note', obj.x + 8, obj.y + 11);

        // Content with word wrap & intentional newline preservation
        ctx.beginPath();
        ctx.rect(
          obj.x + 2,
          obj.y + headerH,
          Math.max(1, width - 4),
          Math.max(1, effectiveH - headerH - 2)
        );
        ctx.clip();

        ctx.font = font;
        ctx.fillStyle = strokeColor;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], obj.x + 8, obj.y + 28 + i * lineHeight);
        }
        ctx.restore();
        break;
      }

      case 'image': {
        ctx.save();
        ctx.fillStyle = resolveCssColor(obj.style?.fill, 'rgba(15, 23, 42, 0.6)');
        ctx.fillRect(obj.x, obj.y, width, height);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.strokeRect(obj.x, obj.y, width, height);

        const imgSrc = (obj.data?.src as string) || '';
        if (imgSrc) {
          let img = (obj as unknown as { _cachedImg?: HTMLImageElement })._cachedImg;
          if (!img && typeof Image !== 'undefined') {
            img = new Image();
            img.onload = () => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('lensboard:invalidate'));
              }
            };
            img.src = imgSrc;
            (obj as unknown as { _cachedImg?: HTMLImageElement })._cachedImg = img;
          }
          if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, obj.x, obj.y, width, height);
          } else {
            ctx.font = 'bold 12px Inter, sans-serif';
            ctx.fillStyle = strokeColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🖼️ ' + (obj.label || 'Image'), obj.x + width / 2, obj.y + height / 2);
          }
        } else {
          ctx.font = 'bold 12px Inter, sans-serif';
          ctx.fillStyle = strokeColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🖼️ ' + (obj.label || 'Image'), obj.x + width / 2, obj.y + height / 2);
        }
        ctx.restore();
        break;
      }

      case 'nnBlock': {
        const title = (obj.data?.title as string) || (obj.label as string) || 'Neural Network Block';
        const blockType = String((obj.data?.blockType as string) || (obj.data?.layerType as string) || 'block').toLowerCase();
        const inDim = (obj.data?.inDim as string | number) || 'in';
        const outDim = (obj.data?.outDim as string | number) || 'out';
        const params = (obj.data?.params as string) || (obj.data?.paramCount as string) || '';
        const details = (obj.data?.details as string) || '';

        ctx.save();
        ctx.fillStyle = resolveCssColor(obj.style?.fill, 'rgba(23, 27, 40, 0.95)');
        ctx.fillRect(obj.x, obj.y, width, height);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.strokeRect(obj.x, obj.y, width, height);

        const isAttention = blockType.includes('attention') || title.toLowerCase().includes('attention') || title.toLowerCase().includes('mha');
        const isConv = blockType.includes('conv') || title.toLowerCase().includes('conv');
        const isLinear = blockType.includes('linear') || title.toLowerCase().includes('linear') || title.toLowerCase().includes('fc');
        const isNorm = blockType.includes('norm') || title.toLowerCase().includes('norm');
        const isTransformer = blockType.includes('transformer') || title.toLowerCase().includes('transformer');
        const isResidual = blockType.includes('residual') || title.toLowerCase().includes('residual') || title.toLowerCase().includes('skip');

        const headerColor = isAttention
          ? 'rgba(86, 180, 233, 0.25)'
          : isConv
            ? 'rgba(230, 159, 0, 0.25)'
            : isLinear
              ? 'rgba(0, 158, 115, 0.25)'
              : isNorm
                ? 'rgba(204, 121, 167, 0.25)'
                : isResidual
                  ? 'rgba(0, 158, 115, 0.25)'
                  : 'rgba(86, 180, 233, 0.25)';

        ctx.fillStyle = headerColor;
        ctx.fillRect(obj.x, obj.y, width, 24);

        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillStyle = strokeColor;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const icon = isTransformer
          ? '⚡'
          : isAttention
            ? '🎯'
            : isConv
              ? '🖼️'
              : isLinear
                ? '📐'
                : isNorm
                  ? '⚖️'
                  : isResidual
                    ? '↪️'
                    : '🧠';
        ctx.fillText(`${icon} ${title}`, obj.x + 8, obj.y + 12);

        if (params || (inDim && outDim)) {
          const badgeText = params ? params : `${inDim} → ${outDim}`;
          ctx.font = '9px monospace';
          ctx.fillStyle = '#56B4E9';
          ctx.textAlign = 'right';
          ctx.fillText(badgeText, obj.x + width - 8, obj.y + 12);
        }

        const bodyY = obj.y + 32;
        if (isConv) {
          ctx.font = '10px monospace';
          ctx.fillStyle = '#E2E8F0';
          ctx.textAlign = 'left';
          ctx.fillText(`Cin: ${inDim} → Cout: ${outDim}`, obj.x + 10, bodyY + 6);
          ctx.fillText('Kernel: 3×3 | s=1, p=1', obj.x + 10, bodyY + 22);
          ctx.font = '9px monospace';
          ctx.fillStyle = '#94A3B8';
          ctx.fillText('Feature Map [H×W]', obj.x + 10, bodyY + 38);

          // 3x3 convolution grid on right without text collision
          const gridX = Math.max(obj.x + 160, obj.x + width - 42);
          const gridY = bodyY + 2;
          ctx.strokeStyle = 'rgba(230, 159, 0, 0.7)';
          ctx.lineWidth = 1;
          for (let i = 0; i <= 3; i++) {
            ctx.beginPath();
            ctx.moveTo(gridX + i * 9, gridY);
            ctx.lineTo(gridX + i * 9, gridY + 27);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(gridX, gridY + i * 9);
            ctx.lineTo(gridX + 27, gridY + i * 9);
            ctx.stroke();
          }
        } else if (isLinear) {
          ctx.font = 'italic 12px "Times New Roman", serif';
          ctx.fillStyle = '#E2E8F0';
          ctx.textAlign = 'left';
          ctx.fillText('y = W · x + b', obj.x + 10, bodyY + 6);

          ctx.font = '10px monospace';
          ctx.fillStyle = '#94A3B8';
          ctx.fillText(`W ∈ ℝ^(${inDim}×${outDim})  b ∈ ℝ^(${outDim})`, obj.x + 10, bodyY + 22);

          // Activation badge
          ctx.fillStyle = 'rgba(0, 158, 115, 0.2)';
          ctx.fillRect(obj.x + 10, bodyY + 34, 110, 16);
          ctx.strokeStyle = '#009E73';
          ctx.strokeRect(obj.x + 10, bodyY + 34, 110, 16);
          ctx.fillStyle = '#5EEAD4';
          ctx.font = 'bold 9px monospace';
          ctx.fillText('ACTIVATION: GELU', obj.x + 14, bodyY + 45);
        } else if (isAttention) {
          ctx.font = 'italic 10px "Times New Roman", serif';
          ctx.fillStyle = '#E2E8F0';
          ctx.textAlign = 'left';
          ctx.fillText('Attn(Q,K,V) = softmax(QKᵀ / √dₖ)·V', obj.x + 10, bodyY + 6);

          // Q, K, V projection head pills
          const pillW = 44;
          const pillH = 16;
          const pills = ['Q: d→d', 'K: d→d', 'V: d→d'];
          for (let pIdx = 0; pIdx < pills.length; pIdx++) {
            const px = obj.x + 10 + pIdx * (pillW + 6);
            ctx.fillStyle = 'rgba(86, 180, 233, 0.15)';
            ctx.fillRect(px, bodyY + 18, pillW, pillH);
            ctx.strokeStyle = '#56B4E9';
            ctx.strokeRect(px, bodyY + 18, pillW, pillH);
            ctx.font = 'bold 8px monospace';
            ctx.fillStyle = '#93C5FD';
            ctx.fillText(pills[pIdx], px + 4, bodyY + 29);
          }

          ctx.font = '9px monospace';
          ctx.fillStyle = '#94A3B8';
          ctx.fillText(details || 'Scaled Dot-Product | 8 Heads', obj.x + 10, bodyY + 46);
        } else if (isResidual) {
          ctx.font = 'italic 11px "Times New Roman", serif';
          ctx.fillStyle = '#E2E8F0';
          ctx.textAlign = 'left';
          ctx.fillText('x_{l+1} = x_l + F(x_l)', obj.x + 10, bodyY + 6);

          // Sublayer box
          ctx.fillStyle = 'rgba(0, 158, 115, 0.15)';
          ctx.fillRect(obj.x + 10, bodyY + 18, width - 20, 20);
          ctx.strokeStyle = 'rgba(0, 158, 115, 0.5)';
          ctx.strokeRect(obj.x + 10, bodyY + 18, width - 20, 20);
          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = '#A7F3D0';
          ctx.fillText('F(x) Sublayer Transformation', obj.x + 16, bodyY + 31);

          // Skip connection line & (+) Add node
          ctx.strokeStyle = '#009E73';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(obj.x + 20, bodyY + 42);
          ctx.lineTo(obj.x + 35, bodyY + 52);
          ctx.lineTo(obj.x + 60, bodyY + 52);
          ctx.stroke();

          // (+) circle
          ctx.beginPath();
          ctx.arc(obj.x + 70, bodyY + 52, 6, 0, Math.PI * 2);
          ctx.fillStyle = '#009E73';
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('+', obj.x + 70, bodyY + 52);

          ctx.font = '9px monospace';
          ctx.fillStyle = '#94A3B8';
          ctx.textAlign = 'left';
          ctx.fillText('Identity Shortcut Skip', obj.x + 85, bodyY + 52);
        } else if (isNorm) {
          ctx.font = 'italic 11px "Times New Roman", serif';
          ctx.fillStyle = '#E2E8F0';
          ctx.textAlign = 'left';
          ctx.fillText('LayerNorm(x) = γ · (x - μ) / √(σ² + ε) + β', obj.x + 10, bodyY + 8);
          ctx.font = '10px monospace';
          ctx.fillStyle = '#94A3B8';
          ctx.fillText(`Normalized Dim: d=${inDim}`, obj.x + 10, bodyY + 26);
          ctx.fillText(`Learnable: γ, β ∈ ℝ^${inDim}`, obj.x + 10, bodyY + 42);
        } else if (isTransformer) {
          // Render structured sublayer cards: MHA and MLP
          const boxH = Math.max(20, Math.floor((height - 58) / 2));
          // Sublayer 1: Attention
          ctx.fillStyle = 'rgba(86, 180, 233, 0.12)';
          ctx.fillRect(obj.x + 10, bodyY, width - 20, boxH);
          ctx.strokeStyle = 'rgba(86, 180, 233, 0.4)';
          ctx.strokeRect(obj.x + 10, bodyY, width - 20, boxH);
          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = '#93C5FD';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText('1. Multi-Head Attention (12h)', obj.x + 16, bodyY + boxH / 2);
          ctx.fillStyle = '#38BDF8';
          ctx.textAlign = 'right';
          ctx.fillText('⊕ Add & Norm', obj.x + width - 16, bodyY + boxH / 2);

          // Sublayer 2: MLP
          const box2Y = bodyY + boxH + 6;
          ctx.fillStyle = 'rgba(168, 85, 247, 0.12)';
          ctx.fillRect(obj.x + 10, box2Y, width - 20, boxH);
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
          ctx.strokeRect(obj.x + 10, box2Y, width - 20, boxH);
          ctx.font = 'bold 9px monospace';
          ctx.fillStyle = '#D8B4FE';
          ctx.textAlign = 'left';
          ctx.fillText('2. Feed-Forward MLP (d_ff=3072)', obj.x + 16, box2Y + boxH / 2);
          ctx.fillStyle = '#C084FC';
          ctx.textAlign = 'right';
          ctx.fillText('⊕ Add & Norm', obj.x + width - 16, box2Y + boxH / 2);
        } else {
          ctx.font = '10px monospace';
          ctx.fillStyle = '#E2E8F0';
          ctx.textAlign = 'left';
          const sublayers = (obj.data?.sublayers as string[]) || [
            'Multi-Head Attention (12 heads)',
            'Add & LayerNorm',
            'MLP Feed-Forward (d_ff=3072)',
            'Add & LayerNorm',
          ];
          for (let i = 0; i < sublayers.length && i < 4; i++) {
            ctx.fillText(`• ${sublayers[i]}`, obj.x + 10, bodyY + i * 16);
          }
        }

        // Port indicators
        ctx.fillStyle = strokeColor;
        ctx.beginPath();
        ctx.arc(obj.x + width / 2, obj.y, 4, 0, Math.PI * 2);
        ctx.arc(obj.x + width / 2, obj.y + height, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
        break;
      }

      case 'heatmap': {
        const title = (obj.data?.title as string) || (obj.label as string) || 'Attention Heatmap';
        const rows = (obj.data?.rows as number) || 4;
        const cols = (obj.data?.cols as number) || 4;
        const rowLabels = (obj.data?.rowLabels as string[]) || ['[CLS]', 'the', 'cat', '[SEP]'];
        const colLabels = (obj.data?.colLabels as string[]) || ['[CLS]', 'the', 'cat', '[SEP]'];
        const matrix = (obj.data?.matrix as number[][]) || [
          [0.85, 0.05, 0.08, 0.02],
          [0.10, 0.65, 0.20, 0.05],
          [0.08, 0.15, 0.72, 0.05],
          [0.05, 0.05, 0.10, 0.80],
        ];

        ctx.save();
        ctx.fillStyle = resolveCssColor(obj.style?.fill, 'rgba(17, 20, 29, 0.95)');
        ctx.fillRect(obj.x, obj.y, width, height);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.strokeRect(obj.x, obj.y, width, height);

        ctx.fillStyle = 'rgba(86, 180, 233, 0.18)';
        ctx.fillRect(obj.x, obj.y, width, 22);
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.fillStyle = strokeColor;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`🔥 ${title}`, obj.x + 8, obj.y + 11);

        const gridStartX = obj.x + 44;
        const gridStartY = obj.y + 38;
        const gridW = Math.max(20, width - 54);
        const gridH = Math.max(20, height - 48);
        const cellW = gridW / cols;
        const cellH = gridH / rows;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const val = matrix[r]?.[c] ?? (r === c ? 0.7 : 0.1);
            const rCol = Math.round(val * 240);
            const gCol = Math.round(160 + val * 80);
            const bCol = Math.round(255 * (1 - val * 0.4));
            ctx.fillStyle = `rgba(${rCol}, ${gCol}, ${bCol}, ${0.2 + val * 0.75})`;
            ctx.fillRect(gridStartX + c * cellW, gridStartY + r * cellH, cellW - 1, cellH - 1);

            if (cellW > 22 && cellH > 14) {
              ctx.font = '8px monospace';
              ctx.fillStyle = val > 0.5 ? '#FFFFFF' : '#94A3B8';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(val.toFixed(2), gridStartX + (c + 0.5) * cellW, gridStartY + (r + 0.5) * cellH);
            }
          }
        }

        ctx.font = '8px monospace';
        ctx.fillStyle = '#94A3B8';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let r = 0; r < rows; r++) {
          const lbl = rowLabels[r] || `t${r}`;
          ctx.fillText(lbl, gridStartX - 4, gridStartY + (r + 0.5) * cellH);
        }

        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        for (let c = 0; c < cols; c++) {
          const lbl = colLabels[c] || `t${c}`;
          ctx.fillText(lbl, gridStartX + (c + 0.5) * cellW, gridStartY - 3);
        }

        ctx.restore();
        break;
      }

      case 'derivation': {
        const stepNum = (obj.data?.stepNum as number) || 1;
        const title = (obj.data?.title as string) || (obj.label as string) || `Derivation Step ${stepNum}`;
        const formula = (obj.data?.formula as string) || '∇_θ L(θ) = 𝔼[ ∇_θ log π_θ(a|s) Q(s,a) ]';
        const explanation =
          (obj.data?.explanation as string) ||
          (obj.data?.desc as string) ||
          'Apply policy gradient theorem with baseline subtraction.';
        const status = (obj.data?.status as string) || 'Proven';

        ctx.save();
        ctx.fillStyle = resolveCssColor(obj.style?.fill, 'rgba(23, 27, 40, 0.95)');
        ctx.fillRect(obj.x, obj.y, width, height);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.strokeRect(obj.x, obj.y, width, height);

        ctx.fillStyle = 'rgba(124, 140, 255, 0.18)';
        ctx.fillRect(obj.x, obj.y, width, 24);

        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.fillStyle = strokeColor;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`📝 ${title}`, obj.x + 8, obj.y + 12);

        ctx.fillStyle = '#009E73';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`✓ ${status}`, obj.x + width - 8, obj.y + 12);

        ctx.fillStyle = 'rgba(30, 36, 56, 0.7)';
        ctx.fillRect(obj.x + 8, obj.y + 30, width - 16, 32);
        ctx.strokeStyle = 'rgba(124, 140, 255, 0.3)';
        ctx.strokeRect(obj.x + 8, obj.y + 30, width - 16, 32);

        const maxFormulaW = width - 24;
        ctx.font = 'italic 12px "Times New Roman", serif';
        if (ctx.measureText(formula).width > maxFormulaW) {
          ctx.font = 'italic 10px "Times New Roman", serif';
        }
        ctx.fillStyle = '#F8FAFC';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(formula, obj.x + width / 2, obj.y + 46);

        ctx.font = '10px Inter, sans-serif';
        ctx.fillStyle = '#94A3B8';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        const explLines = wrapText(ctx, explanation, width - 20);
        for (let i = 0; i < explLines.length && i < 3; i++) {
          ctx.fillText(explLines[i], obj.x + 10, obj.y + 68 + i * 14);
        }

        ctx.restore();
        break;
      }

      case 'shape':
      case 'rect' as string:
      default: {
        const fill = resolveCssColor(obj.style?.fill, 'transparent');
        const shapeType = (obj.shapeType as string) || (obj.data?.shapeType as string) || 'rectangle';

        if (shapeType === 'circle' || shapeType === 'ellipse') {
          const cx = obj.x + width / 2;
          const cy = obj.y + height / 2;
          const rx = width / 2;
          const ry = height / 2;
          if (isSketch) {
            const d = roughGenerator.ellipse(cx, cy, width, height, {
              seed: sketchSeed,
              stroke: strokeColor,
              fill: fill !== 'transparent' ? fill : undefined,
              strokeWidth,
            });
            drawRoughDrawable(ctx, d, strokeColor, fill, strokeWidth);
          } else {
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
            if (fill && fill !== 'transparent') {
              ctx.fillStyle = fill;
              ctx.fill();
            }
            if (strokeColor && strokeColor !== 'transparent') {
              ctx.strokeStyle = strokeColor;
              ctx.lineWidth = strokeWidth;
              if (obj.data?.dsaState === 'to-compute') {
                ctx.setLineDash([4, 4]);
              } else if (obj.data?.dsaState === 'active') {
                ctx.lineWidth = strokeWidth * 2;
              }
              ctx.stroke();
            }
            ctx.restore();
          }
        } else if (shapeType === 'diamond') {
          const cx = obj.x + width / 2;
          const cy = obj.y + height / 2;
          if (isSketch) {
            const d = roughGenerator.polygon(
              [
                [cx, obj.y],
                [obj.x + width, cy],
                [cx, obj.y + height],
                [obj.x, cy],
              ],
              {
                seed: sketchSeed,
                stroke: strokeColor,
                fill: fill !== 'transparent' ? fill : undefined,
                strokeWidth,
              }
            );
            drawRoughDrawable(ctx, d, strokeColor, fill, strokeWidth);
          } else {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(cx, obj.y);
            ctx.lineTo(obj.x + width, cy);
            ctx.lineTo(cx, obj.y + height);
            ctx.lineTo(obj.x, cy);
            ctx.closePath();
            if (fill && fill !== 'transparent') {
              ctx.fillStyle = fill;
              ctx.fill();
            }
            if (strokeColor && strokeColor !== 'transparent') {
              ctx.strokeStyle = strokeColor;
              ctx.lineWidth = strokeWidth;
              if (obj.data?.dsaState === 'to-compute') {
                ctx.setLineDash([4, 4]);
              } else if (obj.data?.dsaState === 'active') {
                ctx.lineWidth = strokeWidth * 2;
              }
              ctx.stroke();
            }
            ctx.restore();
          }
        } else {
          if (isSketch) {
            const d = roughGenerator.rectangle(obj.x, obj.y, width, height, {
              seed: sketchSeed,
              stroke: strokeColor,
              fill: fill !== 'transparent' ? fill : undefined,
              strokeWidth,
            });
            drawRoughDrawable(ctx, d, strokeColor, fill, strokeWidth);
          } else {
            ctx.save();
            if (fill && fill !== 'transparent') {
              ctx.fillStyle = fill;
              ctx.fillRect(obj.x, obj.y, width, height);
            }
            if (strokeColor && strokeColor !== 'transparent') {
              ctx.strokeStyle = strokeColor;
              ctx.lineWidth = strokeWidth;
              if (obj.data?.dsaState === 'to-compute') {
                ctx.setLineDash([4, 4]);
              } else if (obj.data?.dsaState === 'active') {
                ctx.lineWidth = strokeWidth * 2;
              }
              ctx.strokeRect(obj.x, obj.y, width, height);
            }
            ctx.restore();
          }
        }

        const dsaState = obj.data?.dsaState as string | undefined;
        if (dsaState) {
          ctx.save();
          if (dsaState === 'base-case') {
            const triSize = Math.min(14, Math.min(width, height) * 0.35);
            ctx.fillStyle = '#009E73';
            ctx.beginPath();
            if (shapeType === 'diamond') {
              const cx = obj.x + width / 2;
              ctx.moveTo(cx, obj.y);
              ctx.lineTo(cx + triSize, obj.y + triSize);
              ctx.lineTo(cx - triSize, obj.y + triSize);
            } else {
              ctx.moveTo(obj.x, obj.y);
              ctx.lineTo(obj.x + triSize, obj.y);
              ctx.lineTo(obj.x, obj.y + triSize);
            }
            ctx.closePath();
            ctx.fill();
          } else if (dsaState === 'mismatch') {
            ctx.save();
            ctx.beginPath();
            if (shapeType === 'circle' || shapeType === 'ellipse') {
              ctx.ellipse(obj.x + width / 2, obj.y + height / 2, Math.max(1, width / 2), Math.max(1, height / 2), 0, 0, Math.PI * 2);
            } else if (shapeType === 'diamond') {
              const cx = obj.x + width / 2;
              const cy = obj.y + height / 2;
              ctx.moveTo(cx, obj.y);
              ctx.lineTo(obj.x + width, cy);
              ctx.lineTo(cx, obj.y + height);
              ctx.lineTo(obj.x, cy);
              ctx.closePath();
            } else {
              ctx.rect(obj.x, obj.y, width, height);
            }
            ctx.clip();
            ctx.strokeStyle = '#D55E00';
            ctx.lineWidth = 1.5;
            const step = 8;
            for (let offset = -height; offset < width + height; offset += step) {
              ctx.beginPath();
              ctx.moveTo(obj.x + offset, obj.y);
              ctx.lineTo(obj.x + offset + height, obj.y + height);
              ctx.stroke();
            }
            ctx.restore();
          } else if (dsaState === 'final-answer') {
            ctx.font = '12px sans-serif';
            ctx.fillStyle = '#F0E442';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'top';
            if (shapeType === 'diamond') {
              ctx.fillText('★', obj.x + width * 0.82, obj.y + height * 0.2);
            } else {
              ctx.fillText('★', obj.x + width - 4, obj.y + 4);
            }
          }
          ctx.restore();
        }

        if (obj.label) {
          ctx.save();
          ctx.font = 'bold 12px Inter, sans-serif';
          ctx.fillStyle = strokeColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const cx = obj.x + width / 2;
          const cy = obj.y + height / 2;

          let maxLabelW = Math.max(20, width - 16);
          if (shapeType === 'diamond') {
            maxLabelW = Math.max(20, width * 0.62);
          } else if (shapeType === 'circle' || shapeType === 'ellipse') {
            maxLabelW = Math.max(20, width * 0.70);
          }

          const lines = wrapText(ctx, String(obj.label), maxLabelW);
          const lineHeight = 15;
          const maxLines = Math.max(1, Math.floor((height - 12) / lineHeight));
          const visibleLines = lines.slice(0, maxLines);
          if (lines.length > maxLines && visibleLines.length > 0) {
            const lastIdx = visibleLines.length - 1;
            const lastLine = visibleLines[lastIdx];
            visibleLines[lastIdx] = lastLine.length > 3 ? lastLine.slice(0, -1) + '…' : lastLine + '…';
          }
          const totalH = visibleLines.length * lineHeight;
          const startY = cy - totalH / 2 + lineHeight / 2;
          for (let i = 0; i < visibleLines.length; i++) {
            ctx.fillText(visibleLines[i], cx, startY + i * lineHeight);
          }
          ctx.restore();
        }
        break;
      }
    }
  } finally {
    if (applyOpacity) {
      ctx.restore();
    }
    if (hasRotation) {
      ctx.restore();
    }
  }
}
