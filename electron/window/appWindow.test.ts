import path from 'node:path';
import type { BrowserWindowConstructorOptions } from 'electron';
import { describe, expect, it, vi } from 'vitest';
import { resolveAppPaths } from '../app/paths';
import { createAppWindow } from './appWindow';

class FakeWindow {
  loadURL = vi.fn();
  loadFile = vi.fn();

  constructor(public options: BrowserWindowConstructorOptions) {}
}

const productionPaths = resolveAppPaths(path.join('/app', 'dist-electron'));
const developmentPaths = resolveAppPaths(
  path.join('/app', 'dist-electron'),
  'http://localhost:5173',
);

describe('When an app window is created', () => {
  it('Then it uses the shared secure web preferences with the preload bridge', () => {
    // Act
    const window = createAppWindow(FakeWindow, { paths: productionPaths, width: 400 });

    // Assert
    expect(window.options).toEqual({
      width: 400,
      webPreferences: {
        preload: path.join('/app', 'dist-electron', 'preload.mjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
      },
    });
  });

  describe('If the app runs from the renderer build', () => {
    it('Then the route is loaded from index.html as hash', () => {
      // Act
      const window = createAppWindow(FakeWindow, { paths: productionPaths, route: '/widget' });

      // Assert
      expect(window.loadFile).toHaveBeenCalledWith(path.join('/app', 'dist', 'index.html'), {
        hash: '/widget',
      });
    });

    it('If no route is given, Then index.html is loaded as is', () => {
      // Act
      const window = createAppWindow(FakeWindow, { paths: productionPaths });

      // Assert
      expect(window.loadFile).toHaveBeenCalledWith(path.join('/app', 'dist', 'index.html'));
    });
  });

  describe('If the app runs from the Vite dev server', () => {
    it('Then the route is loaded from the dev server URL', () => {
      // Act
      const window = createAppWindow(FakeWindow, { paths: developmentPaths, route: '/widget' });

      // Assert
      expect(window.loadURL).toHaveBeenCalledWith('http://localhost:5173#/widget');
      expect(window.loadFile).not.toHaveBeenCalled();
    });

    it('If no route is given, Then the dev server root is loaded', () => {
      // Act
      const window = createAppWindow(FakeWindow, { paths: developmentPaths });

      // Assert
      expect(window.loadURL).toHaveBeenCalledWith('http://localhost:5173');
    });
  });
});
