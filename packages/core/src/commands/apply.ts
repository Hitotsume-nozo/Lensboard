/**
 * @lensboard/core - Pure Command Reducer & Inversion Engine
 * Pure reducer apply(doc, command) => { doc, inverse }
 * Zero I/O, zero clock, zero randomness, exact mathematical inverses.
 */

import type { CanvasObject, LensDocument, Viewport } from '../model/entities.js';
import { insertRootIdInOrder, sortRootIdsByZ } from '../model/fractional.js';
import { clampZoom, sanitizeCoordinate } from '../model/schema.js';
import type { Command, CommandResult } from './types.js';

/**
 * Pure reducer applying a command immutably and returning { doc, inverse }.
 */
export function apply(doc: LensDocument, command: Command): CommandResult {
  // Deep clone doc to ensure purity and no side effects on input doc
  const clonedDoc: LensDocument = {
    schemaVersion: doc.schemaVersion,
    id: doc.id,
    title: doc.title,
    objects: JSON.parse(JSON.stringify(doc.objects)),
    rootIds: [...doc.rootIds],
    viewport: { ...doc.viewport },
  };

  switch (command.type) {
    case 'create': {
      const targetObj = (command.payload.object ?? command.payload) as CanvasObject;
      const cleanObj: CanvasObject = JSON.parse(JSON.stringify(targetObj));
      cleanObj.x = sanitizeCoordinate(cleanObj.x);
      cleanObj.y = sanitizeCoordinate(cleanObj.y);
      if (cleanObj.w !== undefined) cleanObj.w = sanitizeCoordinate(cleanObj.w);
      if (cleanObj.h !== undefined) cleanObj.h = sanitizeCoordinate(cleanObj.h);
      if (cleanObj.width !== undefined) cleanObj.width = sanitizeCoordinate(cleanObj.width);
      if (cleanObj.height !== undefined) cleanObj.height = sanitizeCoordinate(cleanObj.height);

      clonedDoc.objects[cleanObj.id] = cleanObj;
      if (!clonedDoc.rootIds.includes(cleanObj.id)) {
        clonedDoc.rootIds = insertRootIdInOrder(clonedDoc.rootIds, clonedDoc.objects, cleanObj.id);
      }

      const inverse: Command = {
        id: `inv-${command.id}`,
        type: 'delete',
        timestamp: command.timestamp,
        targets: [cleanObj.id],
        payload: {
          previousObject: JSON.parse(JSON.stringify(cleanObj)),
          object: JSON.parse(JSON.stringify(cleanObj)),
        },
      };
      return { doc: clonedDoc, inverse };
    }

    case 'create_object': {
      const targetObj = (command.payload.object ?? command.payload) as CanvasObject;
      const cleanObj: CanvasObject = JSON.parse(JSON.stringify(targetObj));
      clonedDoc.objects[cleanObj.id] = cleanObj;
      if (!clonedDoc.rootIds.includes(cleanObj.id)) {
        clonedDoc.rootIds = insertRootIdInOrder(clonedDoc.rootIds, clonedDoc.objects, cleanObj.id);
      }

      const inverse: Command = {
        id: `inv-${command.id}`,
        type: 'delete_object',
        timestamp: command.timestamp,
        targets: [cleanObj.id],
        payload: { id: cleanObj.id, previous: cleanObj },
      };
      return { doc: clonedDoc, inverse };
    }

    case 'delete': {
      const targetId = command.targets[0] ?? (command.payload as Record<string, unknown>)?.id;
      const prevObj =
        clonedDoc.objects[targetId] ??
        (command.payload as Record<string, unknown>)?.previousObject ??
        (command.payload as Record<string, unknown>)?.object;

      if (!clonedDoc.objects[targetId] && !prevObj) {
        throw new Error(`Target object ${targetId} not found for delete`);
      }

      const savedPrev = prevObj ? JSON.parse(JSON.stringify(prevObj)) : clonedDoc.objects[targetId];
      delete clonedDoc.objects[targetId];
      clonedDoc.rootIds = clonedDoc.rootIds.filter((id) => id !== targetId);

      const inverse: Command = {
        id: `inv-${command.id}`,
        type: 'create',
        timestamp: command.timestamp,
        targets: [targetId],
        payload: { object: savedPrev },
      };
      return { doc: clonedDoc, inverse };
    }

    case 'delete_object': {
      const payload = command.payload as { id: string; previous?: CanvasObject };
      const targetId = command.targets[0] ?? payload.id;
      const prev = clonedDoc.objects[targetId] ?? payload.previous;
      delete clonedDoc.objects[targetId];
      clonedDoc.rootIds = clonedDoc.rootIds.filter((id) => id !== targetId);

      const inverse: Command = {
        id: `inv-${command.id}`,
        type: 'create_object',
        timestamp: command.timestamp,
        targets: [targetId],
        payload: prev ?? { id: targetId },
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
      const patch = (command.payload.patch ?? command.payload) as Partial<CanvasObject>;

      // Apply patch with coordinate sanitization
      Object.assign(current, patch);
      if (patch.x !== undefined) current.x = sanitizeCoordinate(patch.x);
      if (patch.y !== undefined) current.y = sanitizeCoordinate(patch.y);
      if (patch.w !== undefined) current.w = sanitizeCoordinate(patch.w);
      if (patch.h !== undefined) current.h = sanitizeCoordinate(patch.h);
      if (patch.width !== undefined) current.width = sanitizeCoordinate(patch.width);
      if (patch.height !== undefined) current.height = sanitizeCoordinate(patch.height);
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

    case 'reorder': {
      const targetId = command.targets[0];
      const current = clonedDoc.objects[targetId];
      if (!current) {
        throw new Error(`Target object ${targetId} not found for update`);
      }

      const prevZ = current.z;
      const newZ = (command.payload.z as string) ?? current.z;
      current.z = newZ;
      current.updatedAt = command.timestamp;
      clonedDoc.rootIds = sortRootIdsByZ(clonedDoc.rootIds, clonedDoc.objects);

      const inverse: Command = {
        id: `inv-${command.id}`,
        type: 'reorder',
        timestamp: command.timestamp,
        targets: [targetId],
        payload: { z: prevZ, patch: { z: prevZ } },
      };
      return { doc: clonedDoc, inverse };
    }

    case 'group': {
      const frameId = (command.payload.frameId ?? command.payload.parentId) as string;
      const previousParents: Record<string, string | null> = {};

      for (const id of command.targets) {
        if (clonedDoc.objects[id]) {
          previousParents[id] = clonedDoc.objects[id].parentId ?? null;
          clonedDoc.objects[id].parentId = frameId;
          clonedDoc.objects[id].updatedAt = command.timestamp;
        }
      }

      const inverse: Command = {
        id: `inv-${command.id}`,
        type: 'ungroup',
        timestamp: command.timestamp,
        targets: [...command.targets],
        payload: { previousParents, frameId },
      };
      return { doc: clonedDoc, inverse };
    }

    case 'ungroup': {
      const previousParents = (command.payload.previousParents as Record<string, string | null>) ?? {};
      const restoredParents: Record<string, string | null> = {};

      for (const id of command.targets) {
        if (clonedDoc.objects[id]) {
          restoredParents[id] = clonedDoc.objects[id].parentId ?? null;
          clonedDoc.objects[id].parentId = previousParents[id] ?? null;
          clonedDoc.objects[id].updatedAt = command.timestamp;
        }
      }

      const inverse: Command = {
        id: `inv-${command.id}`,
        type: 'group',
        timestamp: command.timestamp,
        targets: [...command.targets],
        payload: { previousParents: restoredParents, frameId: command.payload.frameId ?? null },
      };
      return { doc: clonedDoc, inverse };
    }

    case 'convertInk': {
      const newObject = (command.payload.newObject ?? command.payload.object) as CanvasObject;
      const sourceInkIds = ((command.payload.sourceInkIds as string[]) ?? []).slice();

      for (const id of sourceInkIds) {
        if (clonedDoc.objects[id]) {
          clonedDoc.objects[id].hidden = true;
        }
      }

      const cleanObj: CanvasObject = JSON.parse(JSON.stringify(newObject));
      cleanObj.sourceInk = [...sourceInkIds];
      clonedDoc.objects[cleanObj.id] = cleanObj;

      if (!clonedDoc.rootIds.includes(cleanObj.id)) {
        clonedDoc.rootIds = insertRootIdInOrder(clonedDoc.rootIds, clonedDoc.objects, cleanObj.id);
      }

      const inverse: Command = {
        id: `inv-${command.id}`,
        type: 'revertConversion',
        timestamp: command.timestamp,
        targets: [cleanObj.id],
        payload: {
          convertedObjectId: cleanObj.id,
          sourceInkIds: [...sourceInkIds],
        },
      };
      return { doc: clonedDoc, inverse };
    }

    case 'revertConversion': {
      const convertedObjectId = (command.payload.convertedObjectId ?? command.targets[0]) as string;
      const sourceInkIds = ((command.payload.sourceInkIds as string[]) ?? []).slice();
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
      const subCommands = ((command.payload.commands as Command[]) ?? []).slice();
      let currentDoc = clonedDoc;
      const inverses: Command[] = [];

      for (const subCmd of subCommands) {
        const res = apply(currentDoc, subCmd);
        currentDoc = res.doc;
        inverses.unshift(res.inverse);
      }

      const inverse: Command = {
        id: `inv-${command.id}`,
        type: 'batch',
        timestamp: command.timestamp,
        targets: command.targets ?? [],
        payload: { commands: inverses },
      };
      return { doc: currentDoc, inverse };
    }

    case 'setViewport':
    case 'set_viewport': {
      const prevViewport = { ...clonedDoc.viewport };
      const nextViewport = (command.payload.viewport ?? command.payload) as Partial<Viewport>;

      clonedDoc.viewport = {
        x: sanitizeCoordinate(nextViewport.x ?? clonedDoc.viewport.x),
        y: sanitizeCoordinate(nextViewport.y ?? clonedDoc.viewport.y),
        zoom: clampZoom(nextViewport.zoom ?? clonedDoc.viewport.zoom),
      };

      const inverse: Command = {
        id: `inv-${command.id}`,
        type: command.type,
        timestamp: command.timestamp,
        targets: [],
        payload: prevViewport as Record<string, unknown>,
      };
      return { doc: clonedDoc, inverse };
    }

    default:
      throw new Error(`Unsupported command type: ${command.type}`);
  }
}
