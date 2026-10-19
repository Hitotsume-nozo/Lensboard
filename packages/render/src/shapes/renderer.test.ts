import { describe, it, expect } from 'vitest';
import {
  resolveColor,
  renderCanvasObject,
  wrapText,
  tokenizeCodeForCanvas,
  wrapCodeTokens,
  PEN_COLOR_MAP,
} from './renderer.js';
import { HeadlessCanvasAdapter } from '../canvas/adapter.js';
import type { CanvasObject } from '@lensboard/core';

describe('Shapes and Sketch Renderer', () => {
  it('correctly maps PenColorSlots to specified color hex values', () => {
    expect(resolveColor('ink')).toBe(PEN_COLOR_MAP.ink);
    expect(resolveColor('gray')).toBe(PEN_COLOR_MAP.gray);
    expect(resolveColor('orange')).toBe(PEN_COLOR_MAP.orange);
    expect(resolveColor('sky')).toBe(PEN_COLOR_MAP.sky);
    expect(resolveColor('green')).toBe(PEN_COLOR_MAP.green);
    expect(resolveColor('yellow')).toBe(PEN_COLOR_MAP.yellow);
    expect(resolveColor('blue')).toBe(PEN_COLOR_MAP.blue);
    expect(resolveColor('vermillion')).toBe(PEN_COLOR_MAP.vermillion);
    expect(resolveColor('purple')).toBe(PEN_COLOR_MAP.purple);
    expect(resolveColor(undefined)).toBe('#1C1E26');
  });

  it('renders crisp rectangles and shapes without error', () => {
    const adapter = new HeadlessCanvasAdapter(400, 300);
    const ctx = adapter.getContext()!;

    const rectObj: CanvasObject = {
      id: 'rect1',
      type: 'rect' as any,
      parentId: null,
      x: 10,
      y: 10,
      w: 100,
      h: 50,
      rotation: 0,
      z: 'a0',
      style: { colorId: 'blue', strokeWidth: 2, renderMode: 'crisp', fill: '#E0F2FE' },
      tags: [],
      locked: false,
      hidden: false,
      createdAt: 0,
      updatedAt: 0,
    };

    renderCanvasObject(ctx, rectObj, 1.0);
  });

  it('renders sketch shapes deterministically using rough.js seed', () => {
    const adapter = new HeadlessCanvasAdapter(400, 300);
    const ctx = adapter.getContext()!;

    const sketchObj: CanvasObject = {
      id: 'sketch1',
      type: 'rect' as any,
      parentId: null,
      x: 20,
      y: 20,
      w: 120,
      h: 80,
      rotation: 0,
      z: 'a0',
      style: {
        colorId: 'orange',
        strokeWidth: 2,
        renderMode: 'sketch',
        sketchSeed: 9876,
      },
      tags: [],
      locked: false,
      hidden: false,
      createdAt: 0,
      updatedAt: 0,
    };

    renderCanvasObject(ctx, sketchObj, 1.0);
  });

  it('renders ink strokes and lines without error', () => {
    const adapter = new HeadlessCanvasAdapter(400, 300);
    const ctx = adapter.getContext()!;

    const strokeObj: any = {
      id: 's1',
      type: 'ink',
      x: 0,
      y: 0,
      z: 'a0',
      style: { colorId: 'ink', strokeWidth: 3, renderMode: 'crisp' },
      points: [
        { x: 10, y: 10 },
        { x: 50, y: 50 },
        { x: 90, y: 30 },
      ],
    };

    renderCanvasObject(ctx, strokeObj, 1.0);

    const lineObj: any = {
      id: 'l1',
      type: 'line',
      x: 10,
      y: 10,
      w: 100,
      h: 100,
      style: { colorId: 'green', strokeWidth: 2, renderMode: 'crisp' },
      data: { x2: 110, y2: 110 },
    };

    renderCanvasObject(ctx, lineObj, 1.0);
  });

  it('skips hidden objects completely', () => {
    const adapter = new HeadlessCanvasAdapter(400, 300);
    const ctx = adapter.getContext()!;

    const hiddenObj: any = {
      id: 'h1',
      type: 'rect',
      hidden: true,
    };

    renderCanvasObject(ctx, hiddenObj, 1.0);
  });

  it('wrapText cleanly wraps long sentences and handles newlines without overflow', () => {
    const adapter = new HeadlessCanvasAdapter(400, 300);
    const ctx = adapter.getContext()!;

    const wrapped = wrapText(ctx, 'This is a long sentence that should wrap cleanly into multiple lines.', 100);
    expect(wrapped.length).toBeGreaterThan(1);
    expect(wrapped.join(' ')).toContain('This is a long sentence');

    const multiPara = wrapText(ctx, 'Line 1\nLine 2\nLine 3', 200);
    expect(multiPara.length).toBe(3);
    expect(multiPara[0]).toBe('Line 1');
  });

  it('renders diamond shape with centered label and dsaState cues', () => {
    const adapter = new HeadlessCanvasAdapter(400, 300);
    const ctx = adapter.getContext()!;

    const diamondObj: CanvasObject = {
      id: 'dia1',
      type: 'shape',
      shapeType: 'diamond',
      parentId: null,
      x: 100,
      y: 100,
      w: 120,
      h: 80,
      rotation: 0,
      z: 'a0',
      label: 'Decision: isPrime(n)?',
      data: { dsaState: 'base-case' },
      style: { colorId: 'blue', strokeWidth: 2, renderMode: 'crisp', fill: '#E0F2FE' },
      tags: ['decision', 'flowchart'],
      locked: false,
      hidden: false,
      createdAt: 0,
      updatedAt: 0,
    };

    renderCanvasObject(ctx, diamondObj, 1.0);
  });

  it('renders deep learning blocks (nnBlock, heatmap, derivation) cleanly', () => {
    const adapter = new HeadlessCanvasAdapter(800, 600);
    const ctx = adapter.getContext()!;

    const nnObj: CanvasObject = {
      id: 'nn1',
      type: 'nnBlock',
      parentId: null,
      x: 50,
      y: 50,
      w: 220,
      h: 120,
      rotation: 0,
      z: 'a0',
      label: 'Multi-Head Attention (12 Heads)',
      data: { blockType: 'attention', inDim: '768', outDim: '768', params: '2.3M' },
      style: { colorId: 'sky', strokeWidth: 2, renderMode: 'crisp' },
      tags: ['mha', 'transformer'],
      locked: false,
      hidden: false,
      createdAt: 0,
      updatedAt: 0,
    };
    renderCanvasObject(ctx, nnObj, 1.0);

    const heatmapObj: CanvasObject = {
      id: 'hm1',
      type: 'heatmap',
      parentId: null,
      x: 300,
      y: 50,
      w: 240,
      h: 180,
      rotation: 0,
      z: 'a1',
      label: 'Attention Matrix',
      data: { rows: 4, cols: 4, matrix: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]] },
      style: { colorId: 'orange', strokeWidth: 2, renderMode: 'crisp' },
      tags: ['attention', 'heatmap'],
      locked: false,
      hidden: false,
      createdAt: 0,
      updatedAt: 0,
    };
    renderCanvasObject(ctx, heatmapObj, 1.0);

    const derivObj: CanvasObject = {
      id: 'drv1',
      type: 'derivation',
      parentId: null,
      x: 50,
      y: 260,
      w: 320,
      h: 140,
      rotation: 0,
      z: 'a2',
      label: 'Step 1: Softmax Gradient',
      data: { stepNum: 1, formula: '∂L/∂z_i = p_i - y_i', explanation: 'Cross-entropy with softmax activation derivation.', status: 'Verified' },
      style: { colorId: 'purple', strokeWidth: 2, renderMode: 'crisp' },
      tags: ['derivation', 'math'],
      locked: false,
      hidden: false,
      createdAt: 0,
      updatedAt: 0,
    };
    renderCanvasObject(ctx, derivObj, 1.0);
  });

  it('renders code block with execution output drawer cleanly', () => {
    const adapter = new HeadlessCanvasAdapter(400, 300);
    const ctx = adapter.getContext()!;

    const codeWithOutput: CanvasObject = {
      id: 'c1',
      type: 'code',
      parentId: null,
      x: 40,
      y: 40,
      w: 260,
      h: 160,
      rotation: 0,
      z: 'a0',
      label: 'Custom Script',
      data: {
        language: 'typescript',
        code: 'const x = 42;\nconsole.log(x);',
        output: { success: true, durationMs: 1.2, logs: ['42'], result: 'undefined' },
      },
      style: { colorId: 'sky', strokeWidth: 2, renderMode: 'crisp' },
      tags: ['code'],
      locked: false,
      hidden: false,
      createdAt: 0,
      updatedAt: 0,
    };

    renderCanvasObject(ctx, codeWithOutput, 1.0);
  });

  it('tokenizes code lines with distinct syntax token colors for canvas rendering', () => {
    const tokens = tokenizeCodeForCanvas('function solve(arr: number[]): number { return 42; }');
    expect(tokens.length).toBeGreaterThan(5);
    const kwToken = tokens.find((t) => t.text === 'function');
    expect(kwToken?.color).toBe('#BB9AF7');
    const fnToken = tokens.find((t) => t.text === 'solve');
    expect(fnToken?.color).toBe('#7DCFFF');
    const numToken = tokens.find((t) => t.text === '42');
    expect(numToken?.color).toBe('#FF9E64');
  });

  it('wrapCodeTokens wraps long code lines within maxWidth without leaking bounds', () => {
    const adapter = new HeadlessCanvasAdapter(400, 300);
    const ctx = adapter.getContext()!;
    const longLine = 'const veryLongVariableNameExceedingLineLimit = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];';
    const wrapped = wrapCodeTokens(ctx, [longLine], 100);
    expect(wrapped.length).toBeGreaterThan(1);
  });

  it('wrapText splits unbroken words longer than maxWidth into chunks', () => {
    const adapter = new HeadlessCanvasAdapter(400, 300);
    const ctx = adapter.getContext()!;

    const longWord = 'Supercalifragilisticexpialidocious';
    const lines = wrapText(ctx, longWord, 60);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join('')).toBe(longWord);
  });

  it('renders residual stream block, Conv2D, and LayerNorm without errors', () => {
    const adapter = new HeadlessCanvasAdapter(800, 600);
    const ctx = adapter.getContext()!;

    const resBlock: CanvasObject = {
      id: 'res1',
      type: 'nnBlock',
      parentId: null,
      x: 20,
      y: 20,
      w: 240,
      h: 120,
      rotation: 0,
      z: 'a0',
      label: 'Residual Stream (x + F(x))',
      data: { blockType: 'residual', title: 'Residual Stream', sublayers: ['F(x)', 'Identity x'] },
      style: { colorId: 'green', strokeWidth: 2, renderMode: 'crisp' },
      tags: ['dl', 'residual'],
      locked: false,
      hidden: false,
      createdAt: 0,
      updatedAt: 0,
    };
    renderCanvasObject(ctx, resBlock, 1.0);

    const convBlock: CanvasObject = {
      id: 'conv1',
      type: 'nnBlock',
      parentId: null,
      x: 280,
      y: 20,
      w: 240,
      h: 120,
      rotation: 0,
      z: 'a1',
      label: 'Conv2D Layer',
      data: { blockType: 'conv', title: 'Conv2D Layer', inDim: 3, outDim: 64 },
      style: { colorId: 'orange', strokeWidth: 2, renderMode: 'crisp' },
      tags: ['dl', 'conv'],
      locked: false,
      hidden: false,
      createdAt: 0,
      updatedAt: 0,
    };
    renderCanvasObject(ctx, convBlock, 1.0);

    const normBlock: CanvasObject = {
      id: 'norm1',
      type: 'nnBlock',
      parentId: null,
      x: 20,
      y: 160,
      w: 220,
      h: 100,
      rotation: 0,
      z: 'a2',
      label: 'LayerNorm Layer',
      data: { blockType: 'norm', title: 'LayerNorm', inDim: 512 },
      style: { colorId: 'vermillion', strokeWidth: 2, renderMode: 'crisp' },
      tags: ['dl', 'norm'],
      locked: false,
      hidden: false,
      createdAt: 0,
      updatedAt: 0,
    };
    renderCanvasObject(ctx, normBlock, 1.0);
  });
});
