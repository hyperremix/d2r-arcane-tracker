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

/** File name of the D2RLoader plugin DLL the app ships (built from `plugin/`). */
export const D2RLOADER_PLUGIN_FILE_NAME = 'd2rl-arcane-tracker.dll';

/**
 * Path of the D2RLoader plugin DLL the app ships. Packaged builds have it in the resources
 * directory (electron-builder `extraResources`); during development it is the local plugin build in
 * `plugin/dist`. Builds without the plugin (Linux, or a development checkout that didn't build it)
 * have no file there.
 * @param paths - The app locations
 * @param resourcesPath - Resources directory override for tests
 */
export function getBundledD2RLoaderPluginPath(
  paths: AppPaths,
  resourcesPath: string = process.resourcesPath,
): string {
  return paths.viteDevServerUrl
    ? path.join(paths.appRoot, 'plugin', 'dist', D2RLOADER_PLUGIN_FILE_NAME)
    : path.join(resourcesPath, 'd2rloader', D2RLOADER_PLUGIN_FILE_NAME);
}

/**
 * Folder name under the OS app data directory that holds the database, item icons and backups.
 * Electron derives the default from the package name, and earlier releases stored their data
 * there, so it stays fixed even though the app name is changed for notifications.
 */
export const USER_DATA_DIR_NAME = '@hyperremix/d2r-arcane-tracker';

/**
 * Resolves the user data directory: the fixed {@link USER_DATA_DIR_NAME} folder in the app data
 * directory.
 * @param appDataPath - The OS app data directory (`app.getPath('appData')`)
 * @returns The user data directory
 */
export function resolveUserDataPath(appDataPath: string): string {
  return path.join(appDataPath, USER_DATA_DIR_NAME);
}
