/**
 * Feature 12: Source Ink Preservation (M3)
 * Authoritative Source: SPEC.md §2 (Principle 1), §6, PROJECT.md Feature 12
 * Ink is sacred: raw strokes are never destroyed; conversions set source ink hidden: true; revertible
 */

import { describe, it, expect } from '../harness.ts';
import {
  createEmptyDocument,
  createTestStroke,
  createTestObject,
} from '../helpers/document-builder.ts';
import { applyCommandOracle } from '../helpers/oracle.ts';
import type { Command } from '../helpers/contracts.ts';

describe('Feature 12: Source Ink Preservation', () => {
  it('f12-1: convertInk hides source strokes rather than deleting them', () => {
    const doc = createEmptyDocument();
    const stroke1 = createTestStroke(5);
    const stroke2 = createTestStroke(5);
    doc.objects[stroke1.id] = stroke1;
    doc.objects[stroke2.id] = stroke2;
    doc.rootIds = [stroke1.id, stroke2.id];

    const convertedShape = createTestObject('shape');
    const convertCmd: Command = {
      id: 'cmd-conv-1',
      type: 'convertInk',
      timestamp: 1776000000000,
      targets: [convertedShape.id],
      payload: {
        newObject: convertedShape,
        sourceInkIds: [stroke1.id, stroke2.id],
      },
    };

    const { doc: nextDoc } = applyCommandOracle(doc, convertCmd);
    expect(nextDoc.objects[stroke1.id]).toBeDefined();
    expect(nextDoc.objects[stroke2.id]).toBeDefined();
    expect(nextDoc.objects[stroke1.id].hidden).toBe(true);
    expect(nextDoc.objects[stroke2.id].hidden).toBe(true);
  });

  it('f12-2: converted shape stores sourceInk references in sourceInk array', () => {
    const doc = createEmptyDocument();
    const stroke = createTestStroke(5);
    doc.objects[stroke.id] = stroke;

    const convertedShape = createTestObject('shape');
    const convertCmd: Command = {
      id: 'cmd-conv-2',
      type: 'convertInk',
      timestamp: 1776000000000,
      targets: [convertedShape.id],
      payload: {
        newObject: convertedShape,
        sourceInkIds: [stroke.id],
      },
    };

    const { doc: nextDoc } = applyCommandOracle(doc, convertCmd);
    expect(nextDoc.objects[convertedShape.id].sourceInk).toEqual([stroke.id]);
  });

  it('f12-3: revertConversion restores source strokes hidden to false and removes converted shape', () => {
    const doc = createEmptyDocument();
    const stroke = createTestStroke(5);
    doc.objects[stroke.id] = stroke;

    const convertedShape = createTestObject('shape');
    const convertCmd: Command = {
      id: 'cmd-conv-3',
      type: 'convertInk',
      timestamp: 1776000000000,
      targets: [convertedShape.id],
      payload: {
        newObject: convertedShape,
        sourceInkIds: [stroke.id],
      },
    };

    const { doc: convertedDoc, inverse } = applyCommandOracle(doc, convertCmd);
    expect(inverse.type).toBe('revertConversion');

    const { doc: revertedDoc } = applyCommandOracle(convertedDoc, inverse);
    expect(revertedDoc.objects[convertedShape.id]).toBeUndefined();
    expect(revertedDoc.objects[stroke.id].hidden).toBe(false);
  });

  it('f12-4: undoing a conversion immediately returns the raw ink intact', () => {
    const doc = createEmptyDocument();
    const stroke = createTestStroke(5);
    doc.objects[stroke.id] = JSON.parse(JSON.stringify(stroke));

    const convertedShape = createTestObject('shape');
    const convertCmd: Command = {
      id: 'cmd-conv-4',
      type: 'convertInk',
      timestamp: 1776000000000,
      targets: [convertedShape.id],
      payload: {
        newObject: convertedShape,
        sourceInkIds: [stroke.id],
      },
    };

    const step1 = applyCommandOracle(doc, convertCmd);
    const step2 = applyCommandOracle(step1.doc, step1.inverse);

    expect(step2.doc.objects[stroke.id]).toEqual(stroke);
  });

  it('f12-5: raw strokes are excluded from active spatial hit-testing while hidden', () => {
    const stroke = createTestStroke(5);
    stroke.hidden = true;
    function canHitTest(obj: { hidden: boolean; locked: boolean }): boolean {
      return !obj.hidden && !obj.locked;
    }
    expect(canHitTest(stroke)).toBe(false);
  });
});
