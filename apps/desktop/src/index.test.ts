import { describe, it, expect } from 'vitest';
import {
  initMainRuntime,
  bridgeAPI,
  createDesktopRendererSession,
} from './index.js';

describe('@lensboard/desktop smoke test', () => {
  it('initializes main process runtime', () => {
    const mainRuntime = initMainRuntime();
    expect(mainRuntime.initialized).toBe(true);
    expect(mainRuntime.docTitle).toBe('Desktop Default Board');
    expect(mainRuntime.storage).toBeDefined();
  });

  it('exposes preload secure bridge API', () => {
    expect(bridgeAPI.version).toBe('2.0.0');
    expect(bridgeAPI.isDesktop).toBe(true);
  });

  it('wires core, render, and ui into desktop renderer session', () => {
    const session = createDesktopRendererSession();
    expect(session.document).toBeDefined();
    expect(session.document.title).toBe('Desktop Renderer Board');
    expect(session.renderer).toBeDefined();
    expect(session.theme.name).toBe('midnight');
  });
});
