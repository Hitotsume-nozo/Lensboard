/**
 * LENSBoard 2.0 — Deterministic Document Builder for E2E Tests
 */

import type {
  LensDocument,
  CanvasObject,
  StrokeObject,
  EntityType,
  ObjectStyle,
  Command,
} from './contracts.ts';

let idCounter = 1;

export function resetIdCounter(): void {
  idCounter = 1;
}

export function generateTestUlid(prefix = 'obj'): string {
  const p = prefix.toUpperCase().padEnd(3, 'X').substring(0, 3);
  const counterStr = String(idCounter++).padStart(9, '0');
  return `01ARZ3NDEKTSV4${p}${counterStr}`;
}

export function createEmptyDocument(title = 'Test Board'): LensDocument {
  return {
    schemaVersion: 1,
    id: generateTestUlid('doc'),
    title,
    objects: {},
    rootIds: [],
    viewport: { x: 0, y: 0, zoom: 1.0 },
  };
}

export function createTestStyle(overrides?: Partial<ObjectStyle>): ObjectStyle {
  return {
    colorId: 'ink',
    strokeWidth: 3,
    renderMode: 'crisp',
    ...overrides,
  };
}

export function createTestObject(
  type: EntityType = 'shape',
  overrides?: Partial<CanvasObject>
): CanvasObject {
  const id = overrides?.id ?? generateTestUlid('ent');
  return {
    id,
    type,
    parentId: null,
    x: 100,
    y: 100,
    w: 200,
    h: 150,
    rotation: 0,
    z: 'a0',
    style: createTestStyle(),
    tags: [],
    locked: false,
    hidden: false,
    createdAt: 1776000000000,
    updatedAt: 1776000000000,
    ...overrides,
  };
}

export function createTestStroke(
  pointsCount = 10,
  overrides?: Partial<StrokeObject>
): StrokeObject {
  const points = [];
  for (let i = 0; i < pointsCount; i++) {
    points.push({
      x: 100 + i * 10,
      y: 150 + Math.sin(i / 2) * 20,
      t: 1776000000000 + i * 16,
    });
  }

  const base = createTestObject('ink', overrides);
  return {
    ...base,
    type: 'ink',
    points,
    ...overrides,
  };
}

export function createCreateCommand(obj: CanvasObject, timestamp = 1776000000000): Command {
  return {
    id: generateTestUlid('cmd'),
    type: 'create',
    timestamp,
    targets: [obj.id],
    payload: { object: obj },
  };
}

export function createUpdateCommand(
  targetId: string,
  patch: Partial<CanvasObject>,
  timestamp = 1776000000000
): Command {
  return {
    id: generateTestUlid('cmd'),
    type: 'update',
    timestamp,
    targets: [targetId],
    payload: { patch },
  };
}

export function createDeleteCommand(targetId: string, timestamp = 1776000000000): Command {
  return {
    id: generateTestUlid('cmd'),
    type: 'delete',
    timestamp,
    targets: [targetId],
    payload: {},
  };
}
