import { type BrowserWindow, ipcMain } from 'electron';
import { type AppPaths, getNotificationIconPath } from '../app/paths';
import { createIpcMainRegistry } from '../ipc/handle';
import { setInventorySnapshotWindowsTitleBarOverlay } from '../window/inventorySnapshotWindow';

/** Dependencies of the app window IPC handlers. */
export interface AppWindowHandlerDependencies {
  /** Returns the current main window (it can be re-created on macOS). */
  getMainWindow: () => BrowserWindow | undefined;
  /** Locations of the app icon. */
  paths: AppPaths;
}

/**
 * Initializes IPC handlers for the app window chrome: title bar overlay colors and the app icon.
 * @param deps - The main window and the app locations
 * @returns Function that removes the handlers
 */
export function initializeAppWindowHandlers({
  getMainWindow,
  paths,
}: AppWindowHandlerDependencies): () => void {
  const { handle, dispose } = createIpcMainRegistry(ipcMain);

  // Handle titlebar overlay updates (Windows/Linux only)
  handle('update-titlebar-overlay', (_event, colors) => {
    if (process.platform !== 'darwin') {
      getMainWindow()?.setTitleBarOverlay({
        color: colors.backgroundColor,
        symbolColor: colors.symbolColor,
        height: 47,
      });

      setInventorySnapshotWindowsTitleBarOverlay({
        color: colors.backgroundColor,
        symbolColor: colors.symbolColor,
      });
    }
    return { success: true };
  });

  // Handle app icon path requests for native notifications
  handle('app:getIconPath', () => getNotificationIconPath(paths));

  return dispose;
}
