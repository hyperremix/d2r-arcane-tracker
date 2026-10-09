import path from 'node:path';

/**
 * Locations of the bundled app:
 *
 * ```
 * ├─┬─┬ dist
 * │ │ └── index.html
 * │ │
 * │ ├─┬ dist-electron
 * │ │ ├── main.js
 * │ │ └── preload.mjs
 * ```
 */
export interface AppPaths {
  /** The app root, which contains `dist` and `dist-electron`. */
  appRoot: string;
  /** Directory of the bundled main process (`dist-electron`), which contains `preload.mjs`. */
  mainDist: string;
  /** Directory of the renderer build (`dist`). */
  rendererDist: string;
  /** Static assets: `public` during development, the renderer build otherwise. */
  publicDir: string;
  /** Vite dev server URL; only set during development. */
  viteDevServerUrl?: string;
}

/**
 * Resolves the app locations from the directory of the bundled main process.
 * @param mainDist - Directory of the bundled main process (`dist-electron`)
 * @param viteDevServerUrl - Vite dev server URL during development
 * @returns The app locations
 */
export function resolveAppPaths(mainDist: string, viteDevServerUrl?: string): AppPaths {
  const appRoot = path.join(mainDist, '..');
  const rendererDist = path.join(appRoot, 'dist');
  return {
    appRoot,
    mainDist,
    rendererDist,
    publicDir: viteDevServerUrl ? path.join(appRoot, 'public') : rendererDist,
    viteDevServerUrl,
  };
}

/**
 * Path of the app icon file. Packaged Windows builds use the ICO file, which is unpacked from the
 * ASAR archive so Windows can read it; everything else uses the PNG from the static assets.
 * @param paths - The app locations
 * @param platform - Platform override for tests
 * @param resourcesPath - Resources directory override for tests
 */
export function getAppIconPath(
  paths: AppPaths,
  platform: NodeJS.Platform = process.platform,
  resourcesPath: string = process.resourcesPath,
): string {
  return platform === 'win32' && !paths.viteDevServerUrl
    ? path.join(resourcesPath, 'app.asar.unpacked', 'dist', 'logo.ico')
    : path.join(paths.publicDir, 'logo.png');
}

/**
 * Icon for native notifications: the dev server URL of the logo during development, the app icon
 * file otherwise.
 * @param paths - The app locations
 * @param platform - Platform override for tests
 * @param resourcesPath - Resources directory override for tests
 */
export function getNotificationIconPath(
  paths: AppPaths,
  platform: NodeJS.Platform = process.platform,
  resourcesPath: string = process.resourcesPath,
): string {
  return paths.viteDevServerUrl ? '/logo.png' : getAppIconPath(paths, platform, resourcesPath);
}
