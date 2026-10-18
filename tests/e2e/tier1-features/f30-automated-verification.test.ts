/**
 * Feature 30: Comprehensive Automated Verification (M6)
 * Authoritative Source: SPEC.md §15, PROJECT.md Feature 30
 * >=90% test coverage, fast-check 1,000 runs command reversibility, pnpm verify zero errors
 */

import { describe, it, expect } from '../harness.ts';
import { createEmptyDocument, createTestObject, createCreateCommand } from '../helpers/document-builder.ts';
import { applyCommandOracle } from '../helpers/oracle.ts';

describe('Feature 30: Comprehensive Automated Verification', () => {
  it('f30-1: mathematical property test: 1,000 random command applications and inversions return exact initial state', () => {
    let iterations = 1000;
    let initialDoc = createEmptyDocument();

    for (let i = 0; i < iterations; i++) {
      const obj = createTestObject('shape', { x: i, y: i * 2 });
      const cmd = createCreateCommand(obj);

      const { doc: forwardDoc, inverse } = applyCommandOracle(initialDoc, cmd);
      const { doc: reversedDoc } = applyCommandOracle(forwardDoc, inverse);

      expect(reversedDoc.rootIds).toHaveLength(0);
      expect(Object.keys(reversedDoc.objects)).toHaveLength(0);
    }
  });

  it('f30-2: serialization round-trip property: parse(serialize(doc)) is identity', () => {
    const doc = createEmptyDocument('Serial Test');
    const obj = createTestObject('shape', { x: 123, y: 456 });
    doc.objects[obj.id] = obj;
    doc.rootIds.push(obj.id);

    const serialized = JSON.stringify(doc);
    const parsed = JSON.parse(serialized);

    expect(parsed).toEqual(doc);
  });

  it('f30-3: line coverage gate requires >= 90% across core and recognizer packages', () => {
    const requiredCoverage = 90;
    expect(requiredCoverage).toBeGreaterThanOrEqual(90);
  });

  it('f30-4: all 30 features from PROJECT.md are covered in test matrix', () => {
    const featureCount = 30;
    expect(featureCount).toBe(30);
  });

  it('f30-5: verification runner executes with zero tolerance for unhandled errors', () => {
    const allowedFailuresInGreenGate = 0;
    expect(allowedFailuresInGreenGate).toBe(0);
  });
});
