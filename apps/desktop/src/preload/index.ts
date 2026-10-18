/**
 * @lensboard/desktop - Preload Script
 * Context-isolated bridge exposing narrow typed APIs to the renderer.
 */

export interface PreloadBridgeAPI {
  version: string;
  isDesktop: boolean;
}

export const bridgeAPI: PreloadBridgeAPI = {
  version: '2.0.0',
  isDesktop: true,
};
