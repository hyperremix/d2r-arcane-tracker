import { BrowserWindow, ipcMain } from 'electron';
import { grailDatabase } from '../database/database';
import type { ConversionResult, ConversionStatus } from '../services/iconService';
import { iconService } from '../services/iconService';
import type { Settings } from '../types/grail';

/**
 * Updates multiple settings in the database
 */
function updateSettings(settings: Partial<Settings>): void {
  for (const key in settings) {
    const settingsKey = key as keyof Settings;
    grailDatabase.setSetting(settingsKey, String(settings[settingsKey]));
  }
}

/**
 * Initializes IPC handlers for icon-related operations.
 */
export function initializeIconHandlers(): void {
  /**
   * Sets the D2R installation path
   */
  ipcMain.handle('icon:setD2RPath', async (_, d2rPath: string): Promise<void> => {
    try {
      iconService.setD2RPath(d2rPath);
      // Save to settings
      updateSettings({ d2rInstallPath: d2rPath });
    } catch (error) {
      console.error('Failed to set D2R path:', error);
      throw error;
    }
  });

  /**
   * Gets the current D2R installation path
   */
  ipcMain.handle('icon:getD2RPath', async (): Promise<string | null> => {
    try {
      // Try to get from service first
      let d2rPath = iconService.getD2RPath();

      // If not set, try to load from settings
      if (!d2rPath) {
        const settings = grailDatabase.getAllSettings();
        d2rPath = settings.d2rInstallPath || null;
        if (d2rPath) {
          iconService.setD2RPath(d2rPath);
        }
      }

      // If still not set, try to auto-detect
      if (!d2rPath) {
        d2rPath = iconService.findD2RInstallation();
        if (d2rPath) {
          updateSettings({ d2rInstallPath: d2rPath });
        }
      }

      return d2rPath;
    } catch (error) {
      console.error('Failed to get D2R path:', error);
      return null;
    }
  });

  /**
   * Converts all sprite files from D2R installation to PNGs
   */
  ipcMain.handle('icon:convertSprites', async (): Promise<ConversionResult> => {
    try {
      // Get D2R path
      const d2rPath = iconService.getD2RPath();
      if (!d2rPath) {
        throw new Error('D2R installation path not set');
      }

      // Update status to in_progress
      updateSettings({
        iconConversionStatus: 'in_progress',
        iconConversionProgress: { current: 0, total: 0 },
      });

      // Progress callback
      const onProgress = (current: number, total: number) => {
        // Send progress update to renderer
        const window = BrowserWindow.getAllWindows()[0];
        if (window) {
          window.webContents.send('icon:conversionProgress', { current, total });
        }

        // Update settings
        updateSettings({
          iconConversionProgress: { current, total },
        });
      };

      // Convert sprites
      const result = await iconService.convertAllSprites(d2rPath, onProgress);

      // Update final status
      updateSettings({
        iconConversionStatus: result.success ? 'completed' : 'failed',
        iconConversionProgress: { current: result.totalFiles, total: result.totalFiles },
      });

      return result;
    } catch (error) {
      console.error('Failed to convert sprites:', error);
      updateSettings({
        iconConversionStatus: 'failed',
      });
      throw error;
    }
  });

  /**
   * Gets the current conversion status
   */
  ipcMain.handle('icon:getConversionStatus', async (): Promise<ConversionStatus> => {
    try {
      return iconService.getConversionStatus();
    } catch (error) {
      console.error('Failed to get conversion status:', error);
      throw error;
    }
  });

  /**
   * Gets an item icon by item name.
   * @returns Base64 data URL or null if not found
   */
  ipcMain.handle('icon:getByName', async (): Promise<string | null> => {
    try {
      return await iconService.getIconByName();
    } catch (error) {
      console.error('Failed to get icon:', error);
      return null;
    }
  });

  /**
   * Gets an item icon by filename.
   * @param _ - IPC event (unused)
   * @param filename - The icon filename (e.g., "item.png")
   * @returns Base64 data URL or null if not found
   */
  ipcMain.handle('icon:getByFilename', async (_, filename: string): Promise<string | null> => {
    try {
      return await iconService.getIconByFilename(filename);
    } catch (error) {
      console.error(`Failed to get icon for filename ${filename}:`, error);
      return null;
    }
  });

  /**
   * Clears the icon cache.
   */
  ipcMain.handle('icon:clearCache', async (): Promise<{ success: boolean }> => {
    try {
      iconService.clearCache();
      return { success: true };
    } catch (error) {
      console.error('Failed to clear cache:', error);
      return { success: false };
    }
  });

  /**
   * Gets cache statistics for debugging.
   */
  ipcMain.handle('icon:getCacheStats', async () => {
    try {
      return iconService.getCacheStats();
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      throw error;
    }
  });

  /**
   * IPC handler for validating the D2R installation path for icon extraction.
   * @returns Promise resolving to validation result
   */
  ipcMain.handle(
    'icon:validatePath',
    async (): Promise<{ valid: boolean; path?: string; error?: string }> => {
      try {
        const settings = grailDatabase.getAllSettings();
        const d2rInstallPath = settings.d2rInstallPath;

        if (!d2rInstallPath) {
          return { valid: false, error: 'D2R installation path is not configured' };
        }

        return await iconService.validateIconPath(d2rInstallPath);
      } catch (error) {
        console.error('Failed to validate icon path:', error);
        return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    },
  );

  console.log('Icon IPC handlers initialized');
}
