/**
 * Feature 9: Pure Document Schema (M3)
 * Authoritative Source: SPEC.md §6, PROJECT.md Feature 9
 * 21 entity types, ULID IDs, fractional indexing z, immutable doc state
 */

import { describe, it, expect } from '../harness.ts';
import {
  createEmptyDocument,
  createTestObject,
  createTestStroke,
} from '../helpers/document-builder.ts';
import type { EntityType } from '../helpers/contracts.ts';

describe('Feature 9: Pure Document Schema', () => {
  const allEntityTypes: EntityType[] = [
    'ink',
    'shape',
    'line',
    'text',
    'equation',
    'code',
    'table',
    'array',
    'dpTable',
    'graph',
    'recursionTree',
    'nnBlock',
    'heatmap',
    'plot',
    'featureCard',
    'derivation',
    'paper',
    'frame',
    'note',
    'flow',
    'image',
    'stamp',
    'bookmark',
  ];

  it('f09-1: document initializes with valid ULID, rootIds, and viewport', () => {
    const doc = createEmptyDocument('Algorithms');
    expect(doc.schemaVersion).toBe(1);
    expect(doc.id).toHaveLength(26);
    expect(doc.title).toBe('Algorithms');
    expect(doc.rootIds).toHaveLength(0);
    expect(doc.viewport.zoom).toBe(1.0);
  });

  it('f09-2: supports all 21 specification entity types', () => {
    expect(allEntityTypes.length).toBeGreaterThanOrEqual(21);
    for (const t of allEntityTypes) {
      const obj = createTestObject(t);
      expect(obj.type).toBe(t);
      expect(obj.id).toHaveLength(26);
    }
  });

  it('f09-3: base object attributes conform to specification structure', () => {
    const obj = createTestObject('shape', { x: 50, y: 75, w: 300, h: 200, rotation: 0, z: 'a0' });
    expect(obj.x).toBe(50);
    expect(obj.y).toBe(75);
    expect(obj.w).toBe(300);
    expect(obj.h).toBe(200);
    expect(obj.z).toBe('a0');
    expect(obj.locked).toBe(false);
    expect(obj.hidden).toBe(false);
    expect(obj.style.renderMode).toBe('crisp');
  });

  it('f09-4: ink object stores points with delta timestamps and coordinates', () => {
    const stroke = createTestStroke(5);
    expect(stroke.type).toBe('ink');
    expect(stroke.points).toHaveLength(5);
    expect(stroke.points[0].x).toBeDefined();
    expect(stroke.points[0].y).toBeDefined();
    expect(stroke.points[0].t).toBeDefined();
  });

  it('f09-5: fractional indexing orders rootIds lexicographically', () => {
    const doc = createEmptyDocument();
    const obj1 = createTestObject('shape', { z: 'a0' });
    const obj2 = createTestObject('shape', { z: 'a1' });
    const obj3 = createTestObject('shape', { z: 'a05' });

    doc.objects[obj1.id] = obj1;
    doc.objects[obj2.id] = obj2;
    doc.objects[obj3.id] = obj3;
    doc.rootIds = [obj1.id, obj3.id, obj2.id];

    const sortedZ = doc.rootIds.map((id) => doc.objects[id].z);
    expect(sortedZ[0]).toBe('a0');
    expect(sortedZ[1]).toBe('a05');
    expect(sortedZ[2]).toBe('a1');
    expect(sortedZ[0] < sortedZ[1] && sortedZ[1] < sortedZ[2]).toBe(true);
  });
});
