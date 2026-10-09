import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getAppIconPath, getNotificationIconPath, resolveAppPaths } from './paths';

const mainDist = path.join('/app', 'dist-electron');
const resourcesPath = path.join('/install', 'resources');

describe('When the app locations are resolved', () => {
  it('If the app runs from the renderer build, Then static assets come from the build', () => {
    // Act
    const paths = resolveAppPaths(mainDist);

    // Assert
    expect(paths).toEqual({
      appRoot: path.join('/app'),
      mainDist,
      rendererDist: path.join('/app', 'dist'),
      publicDir: path.join('/app', 'dist'),
      viteDevServerUrl: undefined,
    });
  });

  it('If the app runs from the Vite dev server, Then static assets come from public', () => {
    // Act
    const paths = resolveAppPaths(mainDist, 'http://localhost:5173');

    // Assert
    expect(paths.publicDir).toBe(path.join('/app', 'public'));
    expect(paths.viteDevServerUrl).toBe('http://localhost:5173');
  });
});

describe('When the app icon is resolved', () => {
  it('If a packaged Windows build runs, Then the unpacked ICO file is used', () => {
    // Arrange
    const paths = resolveAppPaths(mainDist);

    // Act
    const windowIcon = getAppIconPath(paths, 'win32', resourcesPath);
    const notificationIcon = getNotificationIconPath(paths, 'win32', resourcesPath);

    // Assert
    const expected = path.join(resourcesPath, 'app.asar.unpacked', 'dist', 'logo.ico');
    expect(windowIcon).toBe(expected);
    expect(notificationIcon).toBe(expected);
  });

  it('If another platform runs, Then the PNG from the static assets is used', () => {
    // Act
    const icon = getAppIconPath(resolveAppPaths(mainDist), 'darwin', resourcesPath);

    // Assert
    expect(icon).toBe(path.join('/app', 'dist', 'logo.png'));
  });

  it('If the app runs from the dev server, Then notifications use the dev server logo URL', () => {
    // Arrange
    const paths = resolveAppPaths(mainDist, 'http://localhost:5173');

    // Act
    const windowIcon = getAppIconPath(paths, 'win32', resourcesPath);
    const notificationIcon = getNotificationIconPath(paths, 'win32', resourcesPath);

    // Assert
    expect(windowIcon).toBe(path.join('/app', 'public', 'logo.png'));
    expect(notificationIcon).toBe('/logo.png');
  });
});
