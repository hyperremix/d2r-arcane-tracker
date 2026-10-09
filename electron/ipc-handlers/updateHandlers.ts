import { type BrowserWindow, ipcMain } from 'electron';
import { sendToRenderer } from '../ipc/broadcast';
import { createIpcMainRegistry } from '../ipc/handle';
import type { UpdateService } from '../services/updateService';
import type { UpdateStatus } from '../types/grail';

/** Dependencies of the update IPC handlers. */
export interface UpdateHandlerDependencies {
  updateService: UpdateService;
  /** Returns the current main window (it can be re-created on macOS). */
  getMainWindow: () => BrowserWindow | undefined;
}

/**
 * Initializes IPC handlers for application update functionality.
 * Sets up handlers for checking updates, downloading, and installing.
 * @param deps - The update service and the main window the status is sent to
 * @returns Function that removes the handlers
 */
export function initializeUpdateHandlers({
  updateService,
  getMainWindow,
}: UpdateHandlerDependencies): () => void {
  const { handle, dispose } = createIpcMainRegistry(ipcMain);
  // Only initialize update service in production
  if (!process.env.VITE_DEV_SERVER_URL) {
    updateService.initialize();

    // Register status change callback to send updates to renderer
    updateService.setStatusCallback((status: UpdateStatus) => {
      const mainWindow = getMainWindow();
      if (mainWindow) {
        sendToRenderer(mainWindow.webContents, 'update:status', status);
      }
    });
  }

  /**
   * Handles checking for available updates.
   * Returns the current update status.
   */
  handle('update:checkForUpdates', async () => {
    try {
      // In development, return a mock status
      if (process.env.VITE_DEV_SERVER_URL) {
        return {
          checking: false,
          available: false,
          downloading: false,
          downloaded: false,
          error: 'Updates are disabled in development mode',
        };
      }

      const status = await updateService.checkForUpdates();
      return status;
    } catch (error) {
      console.error('[Update Handlers] Error checking for updates:', error);
      return {
        checking: false,
        available: false,
        downloading: false,
        downloaded: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  /**
   * Handles downloading the available update.
   * Returns success indicator.
   */
  handle('update:downloadUpdate', async () => {
    try {
      if (process.env.VITE_DEV_SERVER_URL) {
        return { success: false };
      }

      return await updateService.downloadUpdate();
    } catch (error) {
      console.error('[Update Handlers] Error downloading update:', error);
      return { success: false };
    }
  });

  /**
   * Handles quitting the application and installing the update.
   */
  handle('update:quitAndInstall', async () => {
    if (process.env.VITE_DEV_SERVER_URL) {
      return;
    }

    await updateService.quitAndInstall();
  });

  /**
   * Handles getting current update information.
   * Returns the current version and update status.
   */
  handle('update:getUpdateInfo', async () => {
    try {
      const currentVersion = updateService.getCurrentVersion();
      const status = updateService.getStatus();

      return {
        currentVersion,
        status,
      };
    } catch (error) {
      console.error('[Update Handlers] Error getting update info:', error);
      return {
        currentVersion: updateService.getCurrentVersion(),
        status: {
          checking: false,
          available: false,
          downloading: false,
          downloaded: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  });

  return dispose;
}
