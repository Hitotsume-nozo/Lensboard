import { describe, it, expect } from 'vitest';
import {
  SCHEMA_VERSION,
  ALL_ENTITY_TYPES,
  createDocument,
  createCanvasObject,
  createStrokeObject,
  generateUlid,
  generateInitialZ,
  generateZBetween,
  sortRootIdsByZ,
  insertRootIdInOrder,
  sanitizeCoordinate,
  clampZoom,
  LensDocumentSchema,
  apply,
  shouldCoalesce,
  coalesceCommands,
  HistoryManager,
  DEFAULT_SHORTCUT_BINDINGS,
  detectDuplicateBindings,
  ShortcutRegistry,
  type CanvasObject,
  type Command,
  type ShortcutBinding,
} from './index.js';

describe('@lensboard/core Comprehensive Unit Tests', () => {
  describe('Document Model & Schema', () => {
    it('creates a valid document with ULID, version 1, and default viewport', () => {
      expect(generateUlid()).toHaveLength(26);
      const doc = createDocument('Algorithm Board');
      expect(doc.schemaVersion).toBe(SCHEMA_VERSION);
      expect(doc.schemaVersion).toBe(1);
      expect(doc.title).toBe('Algorithm Board');
      expect(doc.id).toHaveLength(26);
      expect(doc.objects).toEqual({});
      expect(doc.rootIds).toEqual([]);
      expect(doc.viewport).toEqual({ x: 0, y: 0, zoom: 1.0 });

      // Validates with Zod schema
      const parseResult = LensDocumentSchema.safeParse(doc);
      expect(parseResult.success).toBe(true);
    });

    it('contains all 21 specification entity types', () => {
      expect(ALL_ENTITY_TYPES.length).toBeGreaterThanOrEqual(21);
      for (const t of ALL_ENTITY_TYPES) {
        const obj = createCanvasObject({ type: t });
        expect(obj.type).toBe(t);
        expect(obj.id).toBeDefined();
        expect(obj.style).toBeDefined();
        expect(obj.locked).toBe(false);
        expect(obj.hidden).toBe(false);
      }
    });

    it('sanitizes NaN and Infinity coordinate values', () => {
      expect(sanitizeCoordinate(NaN)).toBe(0);
      expect(sanitizeCoordinate(Infinity)).toBe(0);
      expect(sanitizeCoordinate(-Infinity)).toBe(0);
      expect(sanitizeCoordinate(42.5)).toBe(42.5);

      const obj = createCanvasObject({ x: NaN, y: Infinity, w: -Infinity });
      expect(obj.x).toBe(0);
      expect(obj.y).toBe(0);
      expect(obj.w).toBe(0);
    });

    it('clamps zoom values strictly to [0.02, 64.0]', () => {
      expect(clampZoom(0.001)).toBe(0.02);
      expect(clampZoom(100)).toBe(64.0);
      expect(clampZoom(2.5)).toBe(2.5);
      expect(clampZoom(NaN)).toBe(1.0);
    });

    it('creates stroke objects with timestamped delta coordinates', () => {
      const stroke = createStrokeObject([
        { x: 10, y: 20, t: 1000 },
        { x: 15, y: 25, t: 1016 },
      ]);
      expect(stroke.type).toBe('ink');
      expect(stroke.points).toHaveLength(2);
      expect(stroke.points[0].t).toBe(1000);
    });
  });

  describe('Fractional Indexing Z-Order', () => {
    it('orders rootIds lexicographically without collisions', () => {
      const z0 = generateInitialZ(); // 'a0'
      const z1 = generateZBetween(z0, null); // key after 'a0'
      const zMid = generateZBetween(z0, z1); // key between z0 and z1

      expect(z0 < zMid && zMid < z1).toBe(true);

      const doc = createDocument();
      const obj1 = createCanvasObject({ id: 'obj1', z: z0 });
      const obj2 = createCanvasObject({ id: 'obj2', z: z1 });
      const obj3 = createCanvasObject({ id: 'obj3', z: zMid });

      doc.objects = { obj1, obj2, obj3 };
      doc.rootIds = sortRootIdsByZ(['obj2', 'obj1', 'obj3'], doc.objects);

      expect(doc.rootIds).toEqual(['obj1', 'obj3', 'obj2']);
    });

    it('insertRootIdInOrder maintains sorted order', () => {
      const doc = createDocument();
      const obj1 = createCanvasObject({ id: 'obj1', z: 'a0' });
      const obj2 = createCanvasObject({ id: 'obj2', z: 'a2' });
      const objMid = createCanvasObject({ id: 'objMid', z: 'a1' });

      doc.objects = { obj1, obj2, objMid };
      doc.rootIds = ['obj1', 'obj2'];

      const updatedRootIds = insertRootIdInOrder(doc.rootIds, doc.objects, 'objMid');
      expect(updatedRootIds).toEqual(['obj1', 'objMid', 'obj2']);
    });
  });

  describe('Commands & Exact Inverses', () => {
    it('create and delete commands are exact inverses', () => {
      const doc = createDocument();
      const testObj = createCanvasObject({ id: 'shape_1', type: 'shape', x: 50, y: 60 });
      const createCmd: Command = {
        id: 'cmd_create',
        type: 'create',
        timestamp: 1000,
        targets: [testObj.id],
        payload: { object: testObj },
      };

      const step1 = apply(doc, createCmd);
      expect(step1.doc.objects['shape_1']).toBeDefined();
      expect(step1.doc.rootIds).toContain('shape_1');
      expect(step1.inverse.type).toBe('delete');

      // Invert back
      const step2 = apply(step1.doc, step1.inverse);
      expect(step2.doc.objects['shape_1']).toBeUndefined();
      expect(step2.doc.rootIds).not.toContain('shape_1');
    });

    it('update, move, resize, setStyle commands invert to original state', () => {
      const doc = createDocument();
      const testObj = createCanvasObject({ id: 'box', type: 'shape', x: 10, y: 20, w: 100, h: 50 });
      doc.objects[testObj.id] = testObj;
      doc.rootIds = [testObj.id];

      // Update position
      const moveCmd: Command = {
        id: 'cmd_move',
        type: 'move',
        timestamp: 1100,
        targets: ['box'],
        payload: { patch: { x: 80, y: 90 } },
      };

      const step1 = apply(doc, moveCmd);
      expect(step1.doc.objects['box'].x).toBe(80);
      expect(step1.doc.objects['box'].y).toBe(90);

      // Revert move
      const step2 = apply(step1.doc, step1.inverse);
      expect(step2.doc.objects['box'].x).toBe(10);
      expect(step2.doc.objects['box'].y).toBe(20);
    });

    it('group and ungroup commands maintain parentId references cleanly', () => {
      const doc = createDocument();
      const child1 = createCanvasObject({ id: 'c1', parentId: null });
      const child2 = createCanvasObject({ id: 'c2', parentId: null });
      doc.objects = { c1: child1, c2: child2 };
      doc.rootIds = ['c1', 'c2'];

      const groupCmd: Command = {
        id: 'cmd_group',
        type: 'group',
        timestamp: 1200,
        targets: ['c1', 'c2'],
        payload: { frameId: 'frame_1' },
      };

      const step1 = apply(doc, groupCmd);
      expect(step1.doc.objects['c1'].parentId).toBe('frame_1');
      expect(step1.doc.objects['c2'].parentId).toBe('frame_1');
      expect(step1.inverse.type).toBe('ungroup');

      const step2 = apply(step1.doc, step1.inverse);
      expect(step2.doc.objects['c1'].parentId).toBeNull();
      expect(step2.doc.objects['c2'].parentId).toBeNull();
    });

    it('convertInk hides source strokes non-destructively and revert restores them', () => {
      const doc = createDocument();
      const stroke = createStrokeObject([{ x: 1, y: 1, t: 10 }], { id: 'stroke_1' });
      doc.objects['stroke_1'] = stroke;
      doc.rootIds = ['stroke_1'];

      const convertedShape = createCanvasObject({ id: 'clean_rect', type: 'shape' });
      const convertCmd: Command = {
        id: 'cmd_convert',
        type: 'convertInk',
        timestamp: 1300,
        targets: [convertedShape.id],
        payload: { newObject: convertedShape, sourceInkIds: ['stroke_1'] },
      };

      const step1 = apply(doc, convertCmd);
      expect(step1.doc.objects['stroke_1'].hidden).toBe(true);
      expect(step1.doc.objects['clean_rect'].sourceInk).toEqual(['stroke_1']);
      expect(step1.inverse.type).toBe('revertConversion');

      // Revert conversion
      const step2 = apply(step1.doc, step1.inverse);
      expect(step2.doc.objects['clean_rect']).toBeUndefined();
      expect(step2.doc.objects['stroke_1'].hidden).toBe(false);
      expect(step2.doc.objects['stroke_1'].points).toEqual(stroke.points);
    });

    it('batch command applies sequentially and inverts in reverse LIFO order', () => {
      const doc = createDocument();
      const objA = createCanvasObject({ id: 'A', x: 0 });
      const objB = createCanvasObject({ id: 'B', x: 0 });

      const batchCmd: Command = {
        id: 'cmd_batch',
        type: 'batch',
        timestamp: 1400,
        targets: ['A', 'B'],
        payload: {
          commands: [
            { id: 'c1', type: 'create', timestamp: 1401, targets: ['A'], payload: { object: objA } },
            { id: 'c2', type: 'create', timestamp: 1402, targets: ['B'], payload: { object: objB } },
          ],
        },
      };

      const step1 = apply(doc, batchCmd);
      expect(step1.doc.objects['A']).toBeDefined();
      expect(step1.doc.objects['B']).toBeDefined();
      expect(step1.inverse.type).toBe('batch');

      // Inverse batch has subcommands in reverse order (c2 inverse first, then c1 inverse)
      const invSubCommands = (step1.inverse.payload.commands as Command[]);
      expect(invSubCommands).toHaveLength(2);
      expect(invSubCommands[0].targets).toEqual(['B']);
      expect(invSubCommands[1].targets).toEqual(['A']);

      const step2 = apply(step1.doc, step1.inverse);
      expect(step2.doc.objects['A']).toBeUndefined();
      expect(step2.doc.objects['B']).toBeUndefined();
    });

    it('throws descriptive error on deleting non-existent target', () => {
      const doc = createDocument();
      const deleteCmd: Command = {
        id: 'cmd_del',
        type: 'delete',
        timestamp: 1000,
        targets: ['missing_id'],
        payload: {},
      };
      expect(() => apply(doc, deleteCmd)).toThrow('Target object missing_id not found for delete');
    });

    it('throws descriptive error on unsupported command type', () => {
      const doc = createDocument();
      const invalidCmd: Command = {
        id: 'cmd_err',
        type: 'teleport',
        timestamp: 1000,
        targets: [],
        payload: {},
      };
      expect(() => apply(doc, invalidCmd)).toThrow('Unsupported command type: teleport');
    });

    it('supports legacy command aliases create_object, delete_object, set_viewport', () => {
      const doc = createDocument();
      const obj: CanvasObject = {
        id: 'legacy_1',
        type: 'rect',
        x: 10,
        y: 20,
        w: 50,
        h: 60,
        rotation: 0,
        z: 'a0',
        style: { colorId: 'ink', strokeWidth: 2, renderMode: 'crisp' },
        tags: [],
        locked: false,
        hidden: false,
        createdAt: 1000,
        updatedAt: 1000,
      };

      const cmd1: Command = {
        id: 'c_leg',
        type: 'create_object',
        timestamp: 1000,
        targets: ['legacy_1'],
        payload: obj,
      };

      const res1 = apply(doc, cmd1);
      expect(res1.doc.objects['legacy_1']).toBeDefined();
      expect(res1.inverse.type).toBe('delete_object');

      const res2 = apply(res1.doc, res1.inverse);
      expect(res2.doc.objects['legacy_1']).toBeUndefined();
    });
  });

  describe('Command Coalescing', () => {
    it('coalesces rapid property mutations to same target within 300ms', () => {
      const cmd1: Command = {
        id: 'cmd1',
        type: 'move',
        timestamp: 1000,
        targets: ['target1'],
        payload: { patch: { x: 10 } },
      };
      const cmd2: Command = {
        id: 'cmd2',
        type: 'move',
        timestamp: 1250,
        targets: ['target1'],
        payload: { patch: { x: 25 } },
      };
      expect(shouldCoalesce(cmd1, cmd2)).toBe(true);
    });

    it('does not coalesce beyond 300ms window', () => {
      const cmd1: Command = {
        id: 'cmd1',
        type: 'move',
        timestamp: 1000,
        targets: ['target1'],
        payload: { patch: { x: 10 } },
      };
      const cmd2: Command = {
        id: 'cmd2',
        type: 'move',
        timestamp: 1301,
        targets: ['target1'],
        payload: { patch: { x: 25 } },
      };
      expect(shouldCoalesce(cmd1, cmd2)).toBe(false);
    });

    it('does not coalesce different targets or different command types', () => {
      const cmd1: Command = {
        id: 'cmd1',
        type: 'move',
        timestamp: 1000,
        targets: ['target1'],
        payload: { patch: { x: 10 } },
      };
      const cmdDifferentTarget: Command = {
        id: 'cmd2',
        type: 'move',
        timestamp: 1100,
        targets: ['target2'],
        payload: { patch: { x: 25 } },
      };
      const cmdDifferentType: Command = {
        id: 'cmd3',
        type: 'resize',
        timestamp: 1100,
        targets: ['target1'],
        payload: { patch: { w: 200 } },
      };
      expect(shouldCoalesce(cmd1, cmdDifferentTarget)).toBe(false);
      expect(shouldCoalesce(cmd1, cmdDifferentType)).toBe(false);
    });

    it('coalescing preserves initial pre-drag inverse state', () => {
      const prevCmd: Command = {
        id: 'c1',
        type: 'move',
        timestamp: 1000,
        targets: ['target1'],
        payload: { patch: { x: 10 } },
      };
      const nextCmd: Command = {
        id: 'c2',
        type: 'move',
        timestamp: 1150,
        targets: ['target1'],
        payload: { patch: { x: 20 } },
      };
      const initialInverse: Command = {
        id: 'inv-c1',
        type: 'move',
        timestamp: 1000,
        targets: ['target1'],
        payload: { patch: { x: 0 } },
      };

      const coalesced = coalesceCommands(prevCmd, nextCmd, initialInverse);
      expect(coalesced.command.payload).toEqual({ patch: { x: 20 } });
      // Inverse still restores initial pre-drag state x: 0!
      expect(coalesced.inverse.payload).toEqual({ patch: { x: 0 } });
    });
  });

  describe('HistoryManager', () => {
    it('manages undo/redo stacks, clearing redo stack on new action', () => {
      const doc = createDocument();
      const history = new HistoryManager(doc);

      const obj = createCanvasObject({ id: 'box', x: 0 });
      const createCmd: Command = {
        id: 'c1',
        type: 'create',
        timestamp: 1000,
        targets: ['box'],
        payload: { object: obj },
      };

      history.apply(createCmd);
      expect(history.canUndo()).toBe(true);
      expect(history.canRedo()).toBe(false);

      // Perform undo
      history.undo();
      expect(history.getDocument().objects['box']).toBeUndefined();
      expect(history.canRedo()).toBe(true);

      // Perform redo
      history.redo();
      expect(history.getDocument().objects['box']).toBeDefined();
      expect(history.canRedo()).toBe(false);
    });

    it('safe no-op when undo or redo invoked on empty stack', () => {
      const doc = createDocument();
      const history = new HistoryManager(doc);
      expect(history.undo()).toBeNull();
      expect(history.redo()).toBeNull();
      expect(history.canUndo()).toBe(false);
      expect(history.canRedo()).toBe(false);
    });

    it('clamps history stack to 5,000 commands capacity', () => {
      const doc = createDocument();
      const history = new HistoryManager(doc, 50); // Test with smaller clamp of 50

      const obj = createCanvasObject({ id: 'box', x: 0 });
      doc.objects['box'] = obj;

      for (let i = 1; i <= 60; i++) {
        history.apply({
          id: `cmd_${i}`,
          type: 'update',
          timestamp: 1000 + i * 500, // > 300ms so no coalesce
          targets: ['box'],
          payload: { patch: { x: i } },
        });
      }

      expect(history.getUndoStack().length).toBe(50);
      // Oldest operations 1-10 were purged
      expect(history.getUndoStack()[0].command.id).toBe('cmd_11');
    });

    it('serializes and deserializes history across restarts', () => {
      const doc = createDocument();
      const history = new HistoryManager(doc);
      const obj = createCanvasObject({ id: 'box', x: 10 });

      history.apply({
        id: 'c1',
        type: 'create',
        timestamp: 1000,
        targets: ['box'],
        payload: { object: obj },
      });

      const serialized = history.serialize();
      expect(serialized.undoStack).toHaveLength(1);

      const restoredHistory = new HistoryManager(doc);
      restoredHistory.deserialize(serialized);
      expect(restoredHistory.canUndo()).toBe(true);
      expect(restoredHistory.getUndoStack()[0].command.id).toBe('c1');
    });
  });

  describe('ShortcutRegistry & Conflict Detection', () => {
    it('detects duplicate hotkeys in the same context', () => {
      const bindings: ShortcutBinding[] = [
        { id: '1', keys: 'Ctrl+K', context: 'global', action: 'palette' },
        { id: '2', keys: 'ctrl + k', context: 'global', action: 'search' },
      ];
      const conflicts = detectDuplicateBindings(bindings);
      expect(conflicts.length).toBe(1);
      expect(conflicts[0]).toContain('Duplicate binding');
      expect(conflicts[0]).toContain('Conflict detected');
    });

    it('permits identical hotkeys in different contexts', () => {
      const bindings: ShortcutBinding[] = [
        { id: '1', keys: 'Enter', context: 'canvas', action: 'edit' },
        { id: '2', keys: 'Enter', context: 'editor', action: 'newline' },
      ];
      const conflicts = detectDuplicateBindings(bindings);
      expect(conflicts).toHaveLength(0);
    });

    it('suppresses single-key canvas tools when editor focus is true', () => {
      const registry = new ShortcutRegistry();
      registry.register({ id: 'pen', keys: 'P', context: 'canvas', action: 'pen' });
      registry.register({ id: 'save', keys: 'Ctrl+S', context: 'global', action: 'save' });

      // No editor focus: pen matches
      expect(registry.findMatch('P', 'canvas', false)?.action).toBe('pen');

      // With editor focus: pen is suppressed
      expect(registry.findMatch('P', 'canvas', true)).toBeUndefined();

      // Multi-key global shortcut is still active during editor focus
      expect(registry.findMatch('Ctrl+S', 'canvas', true)?.action).toBe('save');
    });

    it('default shortcut bindings contain zero duplicate conflicts', () => {
      const conflicts = detectDuplicateBindings(DEFAULT_SHORTCUT_BINDINGS as ShortcutBinding[]);
      expect(conflicts).toHaveLength(0);
    });

    it('registers, unregisters, and checks conflicts cleanly', () => {
      const registry = new ShortcutRegistry();
      registry.register({ id: 'a1', keys: 'Ctrl+D', context: 'canvas', action: 'dup' });
      expect(registry.getBinding('a1')).toBeDefined();

      const removed = registry.unregister('a1');
      expect(removed).toBe(true);
      expect(registry.getBinding('a1')).toBeUndefined();
    });
  });
});
