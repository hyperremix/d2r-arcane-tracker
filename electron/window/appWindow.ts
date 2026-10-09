import path from 'node:path';
import type { BrowserWindow, BrowserWindowConstructorOptions, WebPreferences } from 'electron';
import type { AppPaths } from '../app/paths';

/** The parts of a `BrowserWindow` needed to load the renderer. */
type RendererHost = Pick<BrowserWindow, 'loadURL' | 'loadFile'>;

/** Options of an app window: `BrowserWindow` options without web preferences, plus its route. */
export interface AppWindowOptions extends Omit<BrowserWindowConstructorOptions, 'webPreferences'> {
  /** Locations of the preload script and the renderer. */
  paths: AppPaths;
  /** Renderer route shown in the window, e.g. `/widget`; the main window shows the root route. */
  route?: string;
}

/**
 * Web preferences shared by every app window: the preload bridge with context isolation and the
 * sandbox, no Node.js in the renderer and web security on.
 * @param paths - Locations of the preload script
 */
export function getSecureWebPreferences(paths: AppPaths): WebPreferences {
  return {
    preload: path.join(paths.mainDist, 'preload.mjs'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
  };
}

/**
 * Loads a renderer route: from the Vite dev server during development, from the renderer build
 * otherwise.
 * @param window - The window to load the route in
 * @param paths - Locations of the renderer
 * @param route - Hash route, e.g. `/widget`; omitted for the root route
 */
export function loadAppRoute(window: RendererHost, paths: AppPaths, route?: string): void {
  if (paths.viteDevServerUrl) {
    window.loadURL(route ? `${paths.viteDevServerUrl}#${route}` : paths.viteDevServerUrl);
  } else if (route) {
    window.loadFile(path.join(paths.rendererDist, 'index.html'), { hash: route });
  } else {
    window.loadFile(path.join(paths.rendererDist, 'index.html'));
  }
}

/**
 * Creates an app window with the shared secure web preferences and loads its renderer route.
 * The window modules pass in the `BrowserWindow` class they import, which keeps this module free
 * of a direct Electron import (tests share one module registry and mock `electron` per file).
 * @param WindowClass - Electron's `BrowserWindow`
 * @param options - Window options and the route to show
 * @returns The created window
 */
export function createAppWindow<W extends RendererHost>(
  WindowClass: new (options: BrowserWindowConstructorOptions) => W,
  { paths, route, ...options }: AppWindowOptions,
): W {
  const window = new WindowClass({ ...options, webPreferences: getSecureWebPreferences(paths) });
  loadAppRoute(window, paths, route);
  return window;
}
