/**
 * @lensboard/desktop - Electron Main Process
 * Wires storage service and manages browser window lifecycle.
 */

import { createDocument } from '@lensboard/core';
import { createStorageService, type StorageService } from '@lensboard/storage';

export interface MainAppRuntime {
  initialized: boolean;
  docTitle: string;
  storage: StorageService;
}

export function initMainRuntime(): MainAppRuntime {
  const doc = createDocument('Desktop Default Board');
  const storage = createStorageService();

  return {
    initialized: true,
    docTitle: doc.title,
    storage,
  };
}
