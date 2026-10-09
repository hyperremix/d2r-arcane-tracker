import { app, ipcMain } from 'electron';
import { createIpcMainRegistry } from '../ipc/handle';
import type { GlobalHotkeyService } from '../services/globalHotkeys';
import type { Settings } from '../types/grail';

/**
 * Settings that require the global hotkeys to be re-registered when they change.
 */
const HOTKEY_SETTING_KEYS: readonly (keyof Settings)[] = [
  'runTrackerGlobalHotkeys',
  'runTrackerShortcuts',
];

/** Dependencies of the global hotkey IPC handlers. */
export interface GlobalHotkeyHandlerDependencies {
  hotkeys: GlobalHotkeyService;
  /**
   * Subscribes to persisted settings changes.
   * @returns Function that removes the listener
   */
  onSettingsUpdated: (listener: (settings: Partial<Settings>) => void) => () => void;
}

/**
 * Registers the global hotkey status handler and keeps the run tracker global hotkeys in sync with
 * the app focus and the hotkey settings. Must be called after the app is ready.
 * @param deps - The global hotkey service and the settings change subscription
 * @returns Function that removes the handler and the listeners
 */
export function initializeGlobalHotkeyHandlers({
  hotkeys,
  onSettingsUpdated,
}: GlobalHotkeyHandlerDependencies): () => void {
  const { handle, removeHandler } = createIpcMainRegistry(ipcMain);
  const cleanups: Array<() => void> = [];

  handle('run-tracker:get-global-hotkey-status', () => hotkeys.getStatus());
  cleanups.push(() => removeHandler('run-tracker:get-global-hotkey-status'));

  const handleFocusChange = () => hotkeys.handleFocusChange();
  app.on('browser-window-focus', handleFocusChange);
  app.on('browser-window-blur', handleFocusChange);
  cleanups.push(() => {
    app.removeListener('browser-window-focus', handleFocusChange);
    app.removeListener('browser-window-blur', handleFocusChange);
  });

  cleanups.push(
    onSettingsUpdated((settings) => {
      if (HOTKEY_SETTING_KEYS.some((key) => key in settings)) {
        hotkeys.sync();
      }
    }),
  );

  hotkeys.sync();

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}
