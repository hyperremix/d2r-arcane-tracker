import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GlobalHotkeyStatus, Settings } from '../types/grail';

const registeredCallbacks = vi.hoisted(() => new Map<string, () => void>());

vi.mock('electron', () => ({
  globalShortcut: {
    register: vi.fn((accelerator: string, callback: () => void) => {
      registeredCallbacks.set(accelerator, callback);
      return true;
    }),
    unregister: vi.fn((accelerator: string) => {
      registeredCallbacks.delete(accelerator);
    }),
  },
}));

import type { GlobalHotkeyRunTracker, GlobalHotkeyServiceOptions } from './globalHotkeys';

// The vitest config disables module isolation, so a cached globalHotkeys module could stay bound
// to the electron mock of another test file. Reset the registry so it binds to the mock above.
vi.resetModules();
const { globalShortcut } = await import('electron');
const { GlobalHotkeyService, resolveRunTrackerShortcuts, shortcutToAccelerator } = await import(
  './globalHotkeys'
);

type MockRunTracker = { [K in keyof GlobalHotkeyRunTracker]: ReturnType<typeof vi.fn> };

function createRunTracker(
  state: { session?: boolean; run?: boolean; paused?: boolean } = {},
): MockRunTracker {
  return {
    getActiveSession: vi.fn(() => (state.session ? ({ id: 'session-1' } as never) : null)),
    getActiveRun: vi.fn(() => (state.run ? ({ id: 'run-1' } as never) : null)),
    getState: vi.fn(() => ({ isPaused: state.paused ?? false }) as never),
    startRun: vi.fn(),
    endRun: vi.fn(),
    pauseRun: vi.fn(),
    resumeRun: vi.fn(),
    endSession: vi.fn(),
  };
}

function createService(overrides: {
  settings?: Partial<Settings>;
  runTracker?: MockRunTracker;
  focused?: boolean;
  platform?: NodeJS.Platform;
}) {
  let settings = { runTrackerGlobalHotkeys: true, ...overrides.settings } as Settings;
  let focused = overrides.focused ?? false;
  const onStatusChange = vi.fn<(status: GlobalHotkeyStatus) => void>();
  const options: GlobalHotkeyServiceOptions = {
    getSettings: () => settings,
    getRunTracker: () => overrides.runTracker as GlobalHotkeyRunTracker | undefined,
    isAppFocused: () => focused,
    onStatusChange,
    platform: overrides.platform ?? 'win32',
  };
  const service = new GlobalHotkeyService(options);
  return {
    service,
    onStatusChange,
    setSettings: (next: Partial<Settings>) => {
      settings = { ...settings, ...next } as Settings;
    },
    setFocused: (next: boolean) => {
      focused = next;
    },
  };
}

function press(accelerator: string) {
  const callback = registeredCallbacks.get(accelerator);
  if (!callback) {
    throw new Error(`No hotkey registered for ${accelerator}`);
  }
  callback();
}

describe('When converting a stored shortcut to an Electron accelerator', () => {
  it.each([
    ['Ctrl+R', 'CommandOrControl+R'],
    ['Ctrl+Space', 'CommandOrControl+Space'],
    ['Ctrl+Shift+E', 'CommandOrControl+Shift+E'],
    ['Shift+Alt+Ctrl+1', 'CommandOrControl+Alt+Shift+1'],
    ['Alt+ArrowUp', 'Alt+Up'],
    ['Ctrl+Esc', 'CommandOrControl+Escape'],
    ['Ctrl++', 'CommandOrControl+Plus'],
    ['Ctrl+Shift++', 'CommandOrControl+Shift+Plus'],
    ['Alt + +', 'Alt+Plus'],
    ['Ctrl+Plus', 'CommandOrControl+Plus'],
    ['Ctrl+Pageup', 'CommandOrControl+PageUp'],
    ['F5', 'F5'],
    ['Shift+F12', 'Shift+F12'],
    ['ctrl + /', 'CommandOrControl+/'],
  ])('If the shortcut is "%s", Then it becomes "%s"', (shortcut, expected) => {
    // Arrange & Act
    const accelerator = shortcutToAccelerator(shortcut);

    // Assert
    expect(accelerator).toBe(expected);
  });

  it.each([
    ['R'],
    ['Shift+R'],
    ['Space'],
    ['Ctrl+'],
    ['Shift++'],
    ['+'],
    ['Ctrl+Shift'],
    ['Ctrl+R+E'],
    ['Ctrl+MediaPlay'],
    [''],
  ])('If the shortcut is "%s", Then it is rejected for global use', (shortcut) => {
    // Arrange & Act
    const accelerator = shortcutToAccelerator(shortcut);

    // Assert
    expect(accelerator).toBeUndefined();
  });

  it('If the shortcut is not a string, Then it is rejected', () => {
    // Arrange & Act
    const accelerator = shortcutToAccelerator({ key: 'R' });

    // Assert
    expect(accelerator).toBeUndefined();
  });
});

describe('When resolving stored run tracker shortcuts', () => {
  it('If values are missing or malformed, Then the defaults are used for them', () => {
    // Arrange
    const stored = { startRun: 'Ctrl+1', pauseRun: 42, endRun: '  ' };

    // Act
    const resolved = resolveRunTrackerShortcuts(stored);

    // Assert
    expect(resolved).toEqual({
      startRun: 'Ctrl+1',
      pauseRun: 'Ctrl+Space',
      endRun: 'Ctrl+E',
      endSession: 'Ctrl+Shift+E',
    });
  });
});

describe('When syncing global hotkeys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registeredCallbacks.clear();
  });

  it('If global hotkeys are disabled, Then nothing is registered and the status is disabled', () => {
    // Arrange
    const { service } = createService({ settings: { runTrackerGlobalHotkeys: false } });

    // Act
    service.sync();

    // Assert
    expect(globalShortcut.register).not.toHaveBeenCalled();
    expect(service.getStatus()).toEqual({ enabled: false, registrations: [] });
  });

  it('If global hotkeys are enabled and the app is in the background, Then every shortcut is registered', () => {
    // Arrange
    const { service, onStatusChange } = createService({});

    // Act
    service.sync();

    // Assert
    expect([...registeredCallbacks.keys()]).toEqual([
      'CommandOrControl+R',
      'CommandOrControl+Space',
      'CommandOrControl+E',
      'CommandOrControl+Shift+E',
    ]);
    expect(service.getStatus().registrations.map((r) => r.state)).toEqual([
      'registered',
      'registered',
      'registered',
      'registered',
    ]);
    expect(onStatusChange).toHaveBeenCalledWith(service.getStatus());
  });

  it('If another app already uses a shortcut, Then that action is reported as a conflict', () => {
    // Arrange
    vi.mocked(globalShortcut.register).mockImplementationOnce(() => false);
    const { service } = createService({});

    // Act
    service.sync();

    // Assert
    expect(service.getStatus().registrations[0]).toEqual({
      action: 'startRun',
      shortcut: 'Ctrl+R',
      state: 'conflict',
    });
    expect(registeredCallbacks.has('CommandOrControl+R')).toBe(false);
  });

  it('If two actions share a shortcut or a shortcut has no Ctrl/Alt, Then they are reported', () => {
    // Arrange
    const { service } = createService({
      settings: {
        runTrackerShortcuts: {
          startRun: 'Ctrl+R',
          pauseRun: 'Ctrl+R',
          endRun: 'E',
          endSession: 'Ctrl+Shift+E',
        },
      },
    });

    // Act
    service.sync();

    // Assert
    expect(service.getStatus().registrations.map((r) => r.state)).toEqual([
      'registered',
      'conflict',
      'unsupported',
      'registered',
    ]);
  });

  it('If the app window is focused, Then hotkeys are probed for conflicts but released again', () => {
    // Arrange
    const { service } = createService({ focused: true });

    // Act
    service.sync();

    // Assert
    expect(globalShortcut.register).toHaveBeenCalledTimes(4);
    expect(registeredCallbacks.size).toBe(0);
    expect(service.getStatus().enabled).toBe(true);
  });

  it('When the app window gains and loses focus, Then hotkeys are released and registered again', () => {
    // Arrange
    const { service, setFocused } = createService({});
    service.sync();

    // Act
    setFocused(true);
    service.handleFocusChange();
    const sizeWhileFocused = registeredCallbacks.size;
    setFocused(false);
    service.handleFocusChange();

    // Assert
    expect(sizeWhileFocused).toBe(0);
    expect(registeredCallbacks.size).toBe(4);
  });

  it('When the shortcuts change, Then the old hotkeys are replaced by the new ones', () => {
    // Arrange
    const { service, setSettings } = createService({});
    service.sync();

    // Act
    setSettings({
      runTrackerShortcuts: {
        startRun: 'Alt+1',
        pauseRun: 'Ctrl+Space',
        endRun: 'Ctrl+E',
        endSession: 'Ctrl+Shift+E',
      },
    });
    service.sync();

    // Assert
    expect(globalShortcut.unregister).toHaveBeenCalledWith('CommandOrControl+R');
    expect(registeredCallbacks.has('CommandOrControl+R')).toBe(false);
    expect(registeredCallbacks.has('Alt+1')).toBe(true);
  });

  it('When global hotkeys are disabled again, Then all hotkeys are unregistered', () => {
    // Arrange
    const { service, setSettings, onStatusChange } = createService({});
    service.sync();

    // Act
    setSettings({ runTrackerGlobalHotkeys: false });
    service.sync();

    // Assert
    expect(registeredCallbacks.size).toBe(0);
    expect(onStatusChange).toHaveBeenLastCalledWith({ enabled: false, registrations: [] });
  });

  it('When the service is disposed, Then all hotkeys are unregistered', () => {
    // Arrange
    const { service } = createService({});
    service.sync();

    // Act
    service.dispose();

    // Assert
    expect(globalShortcut.unregister).toHaveBeenCalledTimes(4);
    expect(registeredCallbacks.size).toBe(0);
  });
});

describe('When a global hotkey is pressed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registeredCallbacks.clear();
  });

  it('If a session is active without a run, Then the start run hotkey starts a manual run', () => {
    // Arrange
    const runTracker = createRunTracker({ session: true });
    const { service } = createService({ runTracker });
    service.sync();

    // Act
    press('CommandOrControl+R');

    // Assert
    expect(runTracker.startRun).toHaveBeenCalledWith(undefined, true);
  });

  it('If a run is active, Then the pause hotkey toggles between pause and resume', () => {
    // Arrange
    const runningTracker = createRunTracker({ session: true, run: true, paused: false });
    const pausedTracker = createRunTracker({ session: true, run: true, paused: true });
    const running = createService({ runTracker: runningTracker });
    const paused = createService({ runTracker: pausedTracker });

    // Act
    running.service.handleAction('pauseRun');
    paused.service.handleAction('pauseRun');

    // Assert
    expect(runningTracker.pauseRun).toHaveBeenCalled();
    expect(pausedTracker.resumeRun).toHaveBeenCalled();
  });

  it('If a run is active, Then the end run and end session hotkeys act without confirmation', () => {
    // Arrange
    const runTracker = createRunTracker({ session: true, run: true });
    const { service } = createService({ runTracker });

    // Act
    service.handleAction('endRun');
    service.handleAction('endSession');

    // Assert
    expect(runTracker.endRun).toHaveBeenCalledWith(true);
    expect(runTracker.endSession).toHaveBeenCalled();
  });

  it('If auto mode is enabled, Then run hotkeys are ignored but End Session still works', () => {
    // Arrange
    const runTracker = createRunTracker({ session: true, run: true });
    const { service } = createService({
      runTracker,
      settings: { runTrackerMemoryReading: true },
      platform: 'win32',
    });

    // Act
    service.handleAction('startRun');
    service.handleAction('pauseRun');
    service.handleAction('endRun');
    service.handleAction('endSession');

    // Assert
    expect(runTracker.startRun).not.toHaveBeenCalled();
    expect(runTracker.pauseRun).not.toHaveBeenCalled();
    expect(runTracker.endRun).not.toHaveBeenCalled();
    expect(runTracker.endSession).toHaveBeenCalled();
  });

  it('If memory reading is set on a non-Windows platform, Then run hotkeys still work', () => {
    // Arrange
    const runTracker = createRunTracker({ session: true });
    const { service } = createService({
      runTracker,
      settings: { runTrackerMemoryReading: true },
      platform: 'darwin',
    });

    // Act
    service.handleAction('startRun');

    // Assert
    expect(runTracker.startRun).toHaveBeenCalled();
  });

  it('If the app window is focused, Then the press is left to the in-app shortcut listener', () => {
    // Arrange
    const runTracker = createRunTracker({ session: true });
    const { service } = createService({ runTracker, focused: true });

    // Act
    service.handleAction('startRun');

    // Assert
    expect(runTracker.startRun).not.toHaveBeenCalled();
  });

  it('If there is no active session, Then the start run and end session hotkeys do nothing', () => {
    // Arrange
    const runTracker = createRunTracker({});
    const { service } = createService({ runTracker });

    // Act
    service.handleAction('startRun');
    service.handleAction('endSession');

    // Assert
    expect(runTracker.startRun).not.toHaveBeenCalled();
    expect(runTracker.endSession).not.toHaveBeenCalled();
  });

  it('If the run tracker throws, Then the error is logged instead of crashing', () => {
    // Arrange
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const runTracker = createRunTracker({ session: true });
    runTracker.startRun.mockImplementation(() => {
      throw new Error('boom');
    });
    const { service } = createService({ runTracker });

    // Act
    const act = () => service.handleAction('startRun');

    // Assert
    expect(act).not.toThrow();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
