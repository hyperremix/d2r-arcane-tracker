import { ipcMain } from 'electron';
import { mainWindow } from '../main';
import { updateService } from '../services/updateService';
import type { UpdateStatus } from '../types/grail';

/**
 * Initializes IPC handlers for application update functionality.
 * Sets up handlers for checking updates, downloading, and installing.
 */
export function initializeUpdateHandlers() {
  // Only initialize update service in production
  if (!process.env.VITE_DEV_SERVER_URL) {
    updateService.initialize();

    // Register status change callback to send updates to renderer
    updateService.setStatusCallback((status: UpdateStatus) => {
      mainWindow?.webContents.send('update:status', status);
    });
  }

  /**
   * Handles checking for available updates.
   * Returns the current update status.
   */
  ipcMain.handle('update:checkForUpdates', async () => {
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
  ipcMain.handle('update:downloadUpdate', async () => {
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
  ipcMain.handle('update:quitAndInstall', async () => {
    try {
      if (process.env.VITE_DEV_SERVER_URL) {
        return;
      }

      await updateService.quitAndInstall();
    } catch (error) {
      console.error('[Update Handlers] Error installing update:', error);
      throw error;
    }
  });

  /**
   * Handles getting current update information.
   * Returns the current version and update status.
   */
  ipcMain.handle('update:getUpdateInfo', async () => {
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
}
