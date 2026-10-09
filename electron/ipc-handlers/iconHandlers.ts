import { BrowserWindow, ipcMain } from 'electron';
import { grailDatabase } from '../database/database';
import { sendToRenderer } from '../ipc/broadcast';
import { createIpcMainRegistry } from '../ipc/handle';
import type { ConversionResult, ConversionStatus } from '../services/iconService';
import { iconService } from '../services/iconService';
import type { Settings } from '../types/grail';

/**
 * Converts a setting value to a string suitable for database storage.
 * Handles objects (JSON.stringify), undefined (skip), and primitives (String).
 * @param value - The setting value to convert
 * @returns String representation or null if value should be skipped
 */
function convertSettingValueToString(value: unknown): string | null {
  // Skip undefined values - don't save them
  if (value === undefined) {
    return null;
  }

  // Convert complex objects to JSON strings
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }

  // Convert primitives to strings
  return String(value);
}

/**
 * Updates multiple settings in the database
 */
function updateSettings(settings: Partial<Settings>): void {
  for (const key in settings) {
    const settingsKey = key as keyof Settings;
    const value = settings[settingsKey];
    const stringValue = convertSettingValueToString(value);

    // Skip if value should not be saved (undefined)
    if (stringValue !== null) {
      grailDatabase.setSetting(settingsKey, stringValue);
    }
  }
}

/**
 * Initializes IPC handlers for icon-related operations.
 */
export function initializeIconHandlers(): void {
  const { handle } = createIpcMainRegistry(ipcMain);
  /**
   * Sets the D2R installation path
   */
  handle('icon:setD2RPath', async (_, d2rPath): Promise<void> => {
    iconService.setD2RPath(d2rPath);
    // Save to settings
    updateSettings({ d2rInstallPath: d2rPath });
  });

  /**
   * Gets the current D2R installation path
   */
  handle('icon:getD2RPath', async (): Promise<string | null> => {
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
   * Gets the platform's default D2R installation path if it exists on disk.
   * Used by the setup wizard so it only suggests a path that is actually there.
   */
  handle('icon:getSuggestedD2RPath', async (): Promise<string | undefined> => {
    try {
      return iconService.getSuggestedD2RPath();
    } catch (error) {
      console.error('Failed to get suggested D2R path:', error);
      return undefined;
    }
  });

  /**
   * Converts all sprite files from D2R installation to PNGs
   */
  handle('icon:convertSprites', async (): Promise<ConversionResult> => {
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
          sendToRenderer(window.webContents, 'icon:conversionProgress', { current, total });
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
  handle('icon:getConversionStatus', async (): Promise<ConversionStatus> => {
    return iconService.getConversionStatus();
  });

  /**
   * Gets an item icon by filename.
   * @param _ - IPC event (unused)
   * @param filename - The icon filename (e.g., "item.png")
   * @returns Base64 data URL or null if not found
   */
  handle('icon:getByFilename', async (_, filename): Promise<string | null> => {
    try {
      return await iconService.getIconByFilename(filename);
    } catch (error) {
      console.error(`Failed to get icon for filename ${filename}:`, error);
      return null;
    }
  });

  /**
   * IPC handler for validating the D2R installation path for icon extraction.
   * @returns Promise resolving to validation result
   */
  handle(
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
