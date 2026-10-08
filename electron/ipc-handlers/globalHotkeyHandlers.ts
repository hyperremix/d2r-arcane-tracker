import { app, type BrowserWindow, ipcMain, webContents } from 'electron';
import { grailDatabase } from '../database/database';
import { GlobalHotkeyService } from '../services/globalHotkeys';
import type { RunTrackerService } from '../services/runTracker';
import type { GlobalHotkeyStatus, Settings } from '../types/grail';
import { addSettingsUpdatedListener } from './grailHandlers';

/**
 * Settings that require the global hotkeys to be re-registered when they change.
 */
const HOTKEY_SETTING_KEYS: readonly (keyof Settings)[] = [
  'runTrackerGlobalHotkeys',
  'runTrackerShortcuts',
];

let service: GlobalHotkeyService | undefined;
const cleanups: Array<() => void> = [];

function broadcastStatus(status: GlobalHotkeyStatus): void {
  for (const wc of webContents.getAllWebContents()) {
    if (!wc.isDestroyed() && wc.getType() === 'window') {
      wc.send('run-tracker:global-hotkey-status', status);
    }
  }
}

/**
 * Initializes the run tracker global hotkeys and their IPC handlers.
 * Must be called after the app is ready.
 * @param runTracker - The run tracker service, or undefined if it failed to initialize. Without it
 *   no hotkeys are registered (they would swallow key presses without being able to act on them).
 * @param getMainWindow - Returns the current main window (it can be re-created on macOS)
 */
export function initializeGlobalHotkeyHandlers(
  runTracker: RunTrackerService | undefined,
  getMainWindow: () => BrowserWindow | null,
): void {
  closeGlobalHotkeys();

  if (!runTracker) {
    console.error('[globalHotkeys] Run tracker unavailable, global hotkeys are not registered');
    ipcMain.handle(
      'run-tracker:get-global-hotkey-status',
      (): GlobalHotkeyStatus => ({ enabled: false, registrations: [] }),
    );
    cleanups.push(() => ipcMain.removeHandler('run-tracker:get-global-hotkey-status'));
    return;
  }

  const hotkeys = new GlobalHotkeyService({
    getSettings: () => grailDatabase.getAllSettings(),
    getRunTracker: () => runTracker,
    isAppFocused: () => {
      const mainWindow = getMainWindow();
      return Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused());
    },
    onStatusChange: broadcastStatus,
  });
  service = hotkeys;

  ipcMain.handle('run-tracker:get-global-hotkey-status', () => hotkeys.getStatus());
  cleanups.push(() => ipcMain.removeHandler('run-tracker:get-global-hotkey-status'));

  const handleFocusChange = () => hotkeys.handleFocusChange();
  app.on('browser-window-focus', handleFocusChange);
  app.on('browser-window-blur', handleFocusChange);
  cleanups.push(() => {
    app.removeListener('browser-window-focus', handleFocusChange);
    app.removeListener('browser-window-blur', handleFocusChange);
  });

  cleanups.push(
    addSettingsUpdatedListener((settings) => {
      if (HOTKEY_SETTING_KEYS.some((key) => key in settings)) {
        hotkeys.sync();
      }
    }),
  );

  hotkeys.sync();
}

/**
 * Unregisters all global hotkeys and removes the related listeners.
 */
export function closeGlobalHotkeys(): void {
  for (const cleanup of cleanups) {
    cleanup();
  }
  cleanups.length = 0;

  service?.dispose();
  service = undefined;
}
