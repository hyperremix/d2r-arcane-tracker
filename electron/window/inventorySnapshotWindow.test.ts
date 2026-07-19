import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  browserWindowInstances: [] as Array<{
    options: Record<string, unknown>;
    loadURL: ReturnType<typeof vi.fn>;
    loadFile: ReturnType<typeof vi.fn>;
    show: ReturnType<typeof vi.fn>;
    focus: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
    setTitleBarOverlay: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    isDestroyed: ReturnType<typeof vi.fn>;
    isMinimized: ReturnType<typeof vi.fn>;
    __events: Map<string, () => void>;
  }>,
}));

vi.mock('electron', () => {
  class BrowserWindow {
    public loadURL = vi.fn();
    public loadFile = vi.fn();
    public show = vi.fn();
    public focus = vi.fn();
    public restore = vi.fn();
    public setTitleBarOverlay = vi.fn();
    public close = vi.fn(() => {
      this.isDestroyed.mockReturnValue(true);
      const closedListener = this.__events.get('closed');
      if (closedListener) {
        closedListener();
      }
    });
    public on = vi.fn((event: string, listener: () => void) => {
      this.__events.set(event, listener);
      return this;
    });
    public isDestroyed = vi.fn(() => false);
    public isMinimized = vi.fn(() => false);
    public __events = new Map<string, () => void>();

    constructor(public options: Record<string, unknown>) {
      mocks.browserWindowInstances.push(this);
    }
  }

  return {
    BrowserWindow,
  };
});

import {
  closeInventorySnapshotWindows,
  openInventorySnapshotWindow,
  setInventorySnapshotWindowsTitleBarOverlay,
} from './inventorySnapshotWindow';

describe('When inventory snapshot windows are managed', () => {
  beforeEach(() => {
    mocks.browserWindowInstances.length = 0;
  });

  afterEach(() => {
    closeInventorySnapshotWindows();
  });

  describe('If a snapshot window is opened for the first time', () => {
    it('Then it creates a new BrowserWindow and loads the snapshot route', () => {
      // Arrange

      // Act
      const window = openInventorySnapshotWindow(
        {
          sourceFilePath: '/tmp/sorc.d2s',
          sourceFileType: 'd2s',
          characterName: 'Sorc',
        },
        '/tmp/main',
        'http://localhost:5173',
        '/tmp/renderer',
      );

      // Assert
      expect(window).toBeDefined();
      expect(mocks.browserWindowInstances).toHaveLength(1);
      expect(mocks.browserWindowInstances[0].options.title).toBe('Sorc');
      expect(mocks.browserWindowInstances[0].options.titleBarStyle).toBe('hidden');
      if (process.platform === 'darwin') {
        expect(mocks.browserWindowInstances[0].options.trafficLightPosition).toEqual({
          x: 10,
          y: 14,
        });
      } else {
        expect(mocks.browserWindowInstances[0].options.titleBarOverlay).toEqual({
          color: '#09090b',
          symbolColor: '#ffffff',
          height: 47,
        });
      }
      expect(mocks.browserWindowInstances[0].loadURL).toHaveBeenCalledWith(
        'http://localhost:5173#/inventory-snapshot?sourceFilePath=%2Ftmp%2Fsorc.d2s&sourceFileType=d2s&characterName=Sorc',
      );
    });
  });

  describe('If the same snapshot window is opened again', () => {
    it('Then it reuses and focuses the existing BrowserWindow', () => {
      // Arrange
      const firstWindow = openInventorySnapshotWindow(
        {
          sourceFilePath: '/tmp/sorc.d2s',
          sourceFileType: 'd2s',
          characterName: 'Sorc',
        },
        '/tmp/main',
        'http://localhost:5173',
        '/tmp/renderer',
      );

      // Act
      const secondWindow = openInventorySnapshotWindow(
        {
          sourceFilePath: '/tmp/sorc.d2s',
          sourceFileType: 'd2s',
          characterName: 'Sorc',
        },
        '/tmp/main',
        'http://localhost:5173',
        '/tmp/renderer',
      );

      // Assert
      expect(secondWindow).toBe(firstWindow);
      expect(mocks.browserWindowInstances).toHaveLength(1);
      expect(mocks.browserWindowInstances[0].show).toHaveBeenCalledTimes(1);
      expect(mocks.browserWindowInstances[0].focus).toHaveBeenCalledTimes(1);
    });
  });

  describe('If different snapshot targets are opened', () => {
    it('Then it creates a separate window per snapshot key', () => {
      // Arrange
      openInventorySnapshotWindow(
        {
          sourceFilePath: '/tmp/sorc.d2s',
          sourceFileType: 'd2s',
          characterName: 'Sorc',
        },
        '/tmp/main',
        'http://localhost:5173',
        '/tmp/renderer',
      );

      // Act
      openInventorySnapshotWindow(
        {
          sourceFilePath: '/tmp/shared.d2i',
          sourceFileType: 'd2i',
          characterName: 'Shared Stash Softcore',
        },
        '/tmp/main',
        'http://localhost:5173',
        '/tmp/renderer',
      );

      // Assert
      expect(mocks.browserWindowInstances).toHaveLength(2);
    });
  });

  describe('If all snapshot windows are closed', () => {
    it('Then each existing BrowserWindow is closed', () => {
      // Arrange
      openInventorySnapshotWindow(
        {
          sourceFilePath: '/tmp/sorc.d2s',
          sourceFileType: 'd2s',
          characterName: 'Sorc',
        },
        '/tmp/main',
        'http://localhost:5173',
        '/tmp/renderer',
      );
      openInventorySnapshotWindow(
        {
          sourceFilePath: '/tmp/shared.d2i',
          sourceFileType: 'd2i',
          characterName: 'Shared Stash Softcore',
        },
        '/tmp/main',
        'http://localhost:5173',
        '/tmp/renderer',
      );

      // Act
      closeInventorySnapshotWindows();

      // Assert
      expect(mocks.browserWindowInstances[0].close).toHaveBeenCalledTimes(1);
      expect(mocks.browserWindowInstances[1].close).toHaveBeenCalledTimes(1);
    });
  });

  describe('If title bar overlay colors are updated', () => {
    it('Then each snapshot window receives the same overlay colors', () => {
      // Arrange
      openInventorySnapshotWindow(
        {
          sourceFilePath: '/tmp/sorc.d2s',
          sourceFileType: 'd2s',
          characterName: 'Sorc',
        },
        '/tmp/main',
        'http://localhost:5173',
        '/tmp/renderer',
      );
      openInventorySnapshotWindow(
        {
          sourceFilePath: '/tmp/shared.d2i',
          sourceFileType: 'd2i',
          characterName: 'Shared Stash Softcore',
        },
        '/tmp/main',
        'http://localhost:5173',
        '/tmp/renderer',
      );

      // Act
      setInventorySnapshotWindowsTitleBarOverlay({
        color: '#ffffff',
        symbolColor: '#000000',
      });

      // Assert
      expect(mocks.browserWindowInstances[0].setTitleBarOverlay).toHaveBeenCalledWith({
        color: '#ffffff',
        symbolColor: '#000000',
        height: 47,
      });
      expect(mocks.browserWindowInstances[1].setTitleBarOverlay).toHaveBeenCalledWith({
        color: '#ffffff',
        symbolColor: '#000000',
        height: 47,
      });
    });
  });
});
