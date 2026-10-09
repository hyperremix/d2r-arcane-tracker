import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GlobalHotkeyService } from '../services/globalHotkeys';
import type { GlobalHotkeyStatus, Settings } from '../types/grail';

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  appListeners: new Map<string, Set<() => void>>(),
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
}));

import { initializeGlobalHotkeyHandlers } from './globalHotkeyHandlers';

const status: GlobalHotkeyStatus = { enabled: true, registrations: [] };

function createHotkeysStub() {
  return {
    getStatus: vi.fn(() => status),
    handleFocusChange: vi.fn(),
    sync: vi.fn(),
  };
}

function emitAppEvent(event: string) {
  for (const listener of mocks.appListeners.get(event) ?? []) {
    listener();
  }
}

describe('When the global hotkey handlers are initialized', () => {
  const settingsListeners = new Set<(settings: Partial<Settings>) => void>();
  let hotkeys: ReturnType<typeof createHotkeysStub>;

  function initialize() {
    return initializeGlobalHotkeyHandlers({
      hotkeys: hotkeys as unknown as GlobalHotkeyService,
      onSettingsUpdated: (listener) => {
        settingsListeners.add(listener);
        return () => settingsListeners.delete(listener);
      },
    });
  }

  function emitSettingsUpdated(settings: Partial<Settings>) {
    for (const listener of settingsListeners) {
      listener(settings);
    }
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.handlers.clear();
    mocks.appListeners.clear();
    settingsListeners.clear();
    hotkeys = createHotkeysStub();
  });

  it('Then the hotkeys are synced with the settings and the status handler returns their status', async () => {
    // Act
    initialize();
    const result = await mocks.handlers.get('run-tracker:get-global-hotkey-status')?.({});

    // Assert
    expect(hotkeys.sync).toHaveBeenCalledTimes(1);
    expect(result).toBe(status);
  });

  it('When an app window gains or loses focus, Then the hotkeys follow the focus change', () => {
    // Arrange
    initialize();

    // Act
    emitAppEvent('browser-window-focus');
    emitAppEvent('browser-window-blur');

    // Assert
    expect(hotkeys.handleFocusChange).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['runTrackerGlobalHotkeys', { runTrackerGlobalHotkeys: false }],
    [
      'runTrackerShortcuts',
      {
        runTrackerShortcuts: {
          startRun: 'Ctrl+1',
          pauseRun: 'Ctrl+2',
          endRun: 'Ctrl+3',
          endSession: 'Ctrl+4',
        },
      },
    ],
  ])('When %s changes, Then the hotkeys are re-registered', (_key, settings) => {
    // Arrange
    initialize();
    hotkeys.sync.mockClear();

    // Act
    emitSettingsUpdated(settings);

    // Assert
    expect(hotkeys.sync).toHaveBeenCalledTimes(1);
  });

  it('If an unrelated setting changes, Then the hotkeys are not re-registered', () => {
    // Arrange
    initialize();
    hotkeys.sync.mockClear();

    // Act
    emitSettingsUpdated({ theme: 'dark' });

    // Assert
    expect(hotkeys.sync).not.toHaveBeenCalled();
  });

  it('When the handlers are disposed, Then the IPC handler and all listeners are removed', () => {
    // Arrange
    const dispose = initialize();

    // Act
    dispose();

    // Assert
    expect(mocks.handlers.has('run-tracker:get-global-hotkey-status')).toBe(false);
    expect(mocks.appListeners.get('browser-window-focus')?.size).toBe(0);
    expect(mocks.appListeners.get('browser-window-blur')?.size).toBe(0);
    expect(settingsListeners.size).toBe(0);
  });
});
