import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings } from '../types/grail';

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  appListeners: new Map<string, Set<() => void>>(),
  settingsListeners: new Set<(settings: Partial<Settings>) => void>(),
  registered: new Set<string>(),
  send: vi.fn(),
  settings: { runTrackerGlobalHotkeys: true } as Partial<Settings>,
}));

vi.mock('electron', () => ({
  app: {
    on: vi.fn((event: string, listener: () => void) => {
      const listeners = mocks.appListeners.get(event) ?? new Set();
      listeners.add(listener);
      mocks.appListeners.set(event, listeners);
    }),
    removeListener: vi.fn((event: string, listener: () => void) => {
      mocks.appListeners.get(event)?.delete(listener);
    }),
  },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      mocks.handlers.set(channel, handler);
    }),
    removeHandler: vi.fn((channel: string) => {
      mocks.handlers.delete(channel);
    }),
  },
  webContents: {
    getAllWebContents: vi.fn(() => [
      { isDestroyed: () => false, getType: () => 'window', send: mocks.send },
    ]),
  },
  globalShortcut: {
    register: vi.fn((accelerator: string) => {
      mocks.registered.add(accelerator);
      return true;
    }),
    unregister: vi.fn((accelerator: string) => {
      mocks.registered.delete(accelerator);
    }),
  },
}));

vi.mock('../database/database', () => ({
  grailDatabase: { getAllSettings: vi.fn(() => mocks.settings) },
}));

vi.mock('./grailHandlers', () => ({
  addSettingsUpdatedListener: vi.fn((listener: (settings: Partial<Settings>) => void) => {
    mocks.settingsListeners.add(listener);
    return () => mocks.settingsListeners.delete(listener);
  }),
}));

import { closeGlobalHotkeys, initializeGlobalHotkeyHandlers } from './globalHotkeyHandlers';

function createMainWindow(focused: boolean) {
  return { isDestroyed: () => false, isFocused: vi.fn(() => focused) };
}

function emitAppEvent(event: string) {
  for (const listener of mocks.appListeners.get(event) ?? []) {
    listener();
  }
}

function emitSettingsUpdated(settings: Partial<Settings>) {
  for (const listener of mocks.settingsListeners) {
    listener(settings);
  }
}

describe('When the global hotkey handlers are initialized', () => {
  beforeEach(() => {
    closeGlobalHotkeys();
    vi.clearAllMocks();
    mocks.handlers.clear();
    mocks.appListeners.clear();
    mocks.settingsListeners.clear();
    mocks.registered.clear();
    mocks.settings = { runTrackerGlobalHotkeys: true };
  });

  it('If global hotkeys are enabled, Then the hotkeys are registered and the status is broadcast', async () => {
    // Arrange
    const mainWindow = createMainWindow(false);

    // Act
    initializeGlobalHotkeyHandlers(null, () => mainWindow as never);
    const status = await mocks.handlers.get('run-tracker:get-global-hotkey-status')?.({});

    // Assert
    expect(mocks.registered.size).toBe(4);
    expect(status).toMatchObject({ enabled: true });
    expect(mocks.send).toHaveBeenCalledWith('run-tracker:global-hotkey-status', status);
  });

  it('When the main window gains focus, Then the hotkeys are released for the in-app listener', () => {
    // Arrange
    let focused = false;
    const mainWindow = { isDestroyed: () => false, isFocused: () => focused };
    initializeGlobalHotkeyHandlers(null, () => mainWindow as never);

    // Act
    focused = true;
    emitAppEvent('browser-window-focus');
    const sizeWhileFocused = mocks.registered.size;
    focused = false;
    emitAppEvent('browser-window-blur');

    // Assert
    expect(sizeWhileFocused).toBe(0);
    expect(mocks.registered.size).toBe(4);
  });

  it('When the global hotkeys setting is turned off, Then the hotkeys are unregistered', () => {
    // Arrange
    initializeGlobalHotkeyHandlers(null, () => null);

    // Act
    mocks.settings = { runTrackerGlobalHotkeys: false };
    emitSettingsUpdated({ runTrackerGlobalHotkeys: false });

    // Assert
    expect(mocks.registered.size).toBe(0);
    expect(mocks.send).toHaveBeenLastCalledWith('run-tracker:global-hotkey-status', {
      enabled: false,
      registrations: [],
    });
  });

  it('If an unrelated setting changes, Then the hotkeys are not re-registered', async () => {
    // Arrange
    initializeGlobalHotkeyHandlers(null, () => null);
    const { globalShortcut } = await import('electron');
    vi.mocked(globalShortcut.register).mockClear();

    // Act
    emitSettingsUpdated({ theme: 'dark' });

    // Assert
    expect(globalShortcut.register).not.toHaveBeenCalled();
  });

  it('When the hotkeys are closed on quit, Then hotkeys, IPC handlers and listeners are removed', () => {
    // Arrange
    initializeGlobalHotkeyHandlers(null, () => null);

    // Act
    closeGlobalHotkeys();

    // Assert
    expect(mocks.registered.size).toBe(0);
    expect(mocks.handlers.has('run-tracker:get-global-hotkey-status')).toBe(false);
    expect(mocks.appListeners.get('browser-window-focus')?.size).toBe(0);
    expect(mocks.appListeners.get('browser-window-blur')?.size).toBe(0);
    expect(mocks.settingsListeners.size).toBe(0);
  });
});
