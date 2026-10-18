/**
 * @lensboard/desktop - Renderer Entrypoint
 * Bootstraps React UI and Canvas 2D engine in the browser window.
 */

import { createDocument, type LensDocument } from '@lensboard/core';
import { createRenderer, type CanvasRenderer } from '@lensboard/render';
import { getThemeTokens, type ThemeTokens } from '@lensboard/ui';

export interface DesktopRendererSession {
  document: LensDocument;
  renderer: CanvasRenderer;
  theme: ThemeTokens;
}

export function createDesktopRendererSession(): DesktopRendererSession {
  const document = createDocument('Desktop Renderer Board');
  const renderer = createRenderer(document);
  const theme = getThemeTokens('midnight');

  return {
    document,
    renderer,
    theme,
  };
}
