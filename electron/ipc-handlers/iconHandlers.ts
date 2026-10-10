import { BrowserWindow, ipcMain } from 'electron';
import { sendToRenderer } from '../ipc/broadcast';
import { createIpcMainRegistry } from '../ipc/handle';
import type { ConversionResult, ConversionStatus, IconService } from '../services/iconService';
import type { SettingsService } from '../services/settingsService';

/** Dependencies of the icon IPC handlers. */
export interface IconHandlerDependencies {
  iconService: IconService;
  settings: SettingsService;
}

/**
 * Initializes IPC handlers for icon-related operations.
 * @param deps - The icon service and the settings storing the D2R path and conversion status
 * @returns Function that removes the handlers
 */
export function initializeIconHandlers({
  iconService,
  settings,
}: IconHandlerDependencies): () => void {
  const { handle, dispose } = createIpcMainRegistry(ipcMain);
  /**
   * Sets the D2R installation path
   */
  handle('icon:setD2RPath', async (_, d2rPath): Promise<void> => {
    iconService.setD2RPath(d2rPath);
    // Save to settings
    settings.update({ d2rInstallPath: d2rPath });
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
        d2rPath = settings.get('d2rInstallPath') || null;
        if (d2rPath) {
          iconService.setD2RPath(d2rPath);
        }
      }

      // If still not set, try to auto-detect
      if (!d2rPath) {
        d2rPath = iconService.findD2RInstallation();
        if (d2rPath) {
          settings.update({ d2rInstallPath: d2rPath });
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
      settings.update({
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
        settings.update({
          iconConversionProgress: { current, total },
        });
      };

      // Convert sprites
      const result = await iconService.convertAllSprites(d2rPath, onProgress);

      // Update final status
      settings.update({
        iconConversionStatus: result.success ? 'completed' : 'failed',
        iconConversionProgress: { current: result.totalFiles, total: result.totalFiles },
      });

      return result;
    } catch (error) {
      console.error('Failed to convert sprites:', error);
      settings.update({
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
        const d2rInstallPath = settings.get('d2rInstallPath');

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

  return dispose;
}
