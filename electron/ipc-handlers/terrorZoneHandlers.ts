import { ipcMain } from 'electron';
import { grailDatabase } from '../database/database';
import { createIpcMainRegistry } from '../ipc/handle';
import { TerrorZoneService } from '../services/terrorZoneService';
import type { TerrorZone, TerrorZoneValidationResult } from '../types/grail';

/**
 * Global terror zone service instance.
 */
const terrorZoneService = new TerrorZoneService();

/**
 * Initializes IPC handlers for terror zone configuration operations.
 * Sets up handlers for reading zones, managing configuration, and file operations.
 */
export function initializeTerrorZoneHandlers(): void {
  const { handle } = createIpcMainRegistry(ipcMain);
  console.log('[initializeTerrorZoneHandlers] Starting initialization');

  /**
   * IPC handler for retrieving all terror zones from the game file.
   * @returns Promise resolving to array of terror zones
   */
  handle('terrorZone:getZones', async (): Promise<TerrorZone[]> => {
    const settings = grailDatabase.getAllSettings();
    const d2rInstallPath = settings.d2rInstallPath;

    if (!d2rInstallPath) {
      throw new Error('D2R installation path is not configured');
    }

    const gameFilePath = terrorZoneService.getGameDataPath(d2rInstallPath);
    return await terrorZoneService.readZonesFromFile(gameFilePath, { preferBackup: true });
  });

  /**
   * IPC handler for retrieving current terror zone configuration from database.
   * @returns Promise resolving to zone configuration (zone ID -> enabled state)
   */
  handle('terrorZone:getConfig', async (): Promise<Record<string, boolean>> => {
    const settings = grailDatabase.getAllSettings();
    return settings.terrorZoneConfig || {};
  });

  /**
   * IPC handler for updating terror zone configuration.
   * Updates database settings and applies changes to the game file.
   * @param _ - IPC event (unused)
   * @param config - New zone configuration (zone ID -> enabled state)
   * @returns Promise resolving to update result
   */
  handle(
    'terrorZone:updateConfig',
    async (_, config): Promise<{ success: boolean; requiresRestart: boolean }> => {
      const settings = grailDatabase.getAllSettings();
      const d2rInstallPath = settings.d2rInstallPath;

      if (!d2rInstallPath) {
        throw new Error('D2R installation path is not configured');
      }

      const gameFilePath = terrorZoneService.getGameDataPath(d2rInstallPath);

      // Create backup if it doesn't exist
      if (!settings.terrorZoneBackupCreated) {
        const backupResult = await terrorZoneService.createBackup(gameFilePath);
        if (!backupResult.success) {
          throw new Error('Failed to create backup of original file');
        }

        // Mark backup as created in settings
        grailDatabase.setSetting('terrorZoneBackupCreated', 'true');
      }

      // Read current zones from file
      const zones = await terrorZoneService.readZonesFromFile(gameFilePath, {
        preferBackup: true,
      });

      // Convert config to Set of enabled zone IDs
      const enabledZoneIds = new Set<string>();
      for (const [zoneId, enabled] of Object.entries(config)) {
        if (enabled) {
          enabledZoneIds.add(zoneId);
        }
      }

      // Write modified zones to file
      await terrorZoneService.writeZonesToFile(gameFilePath, zones, enabledZoneIds);

      // Update configuration in database
      grailDatabase.setSetting('terrorZoneConfig', JSON.stringify(config));

      return { success: true, requiresRestart: true };
    },
  );

  /**
   * IPC handler for restoring the original desecratedzones.json file from backup.
   * @returns Promise resolving to restore result
   */
  handle('terrorZone:restoreOriginal', async (): Promise<{ success: boolean }> => {
    const settings = grailDatabase.getAllSettings();
    const d2rInstallPath = settings.d2rInstallPath;

    if (!d2rInstallPath) {
      throw new Error('D2R installation path is not configured');
    }

    const gameFilePath = terrorZoneService.getGameDataPath(d2rInstallPath);
    const backupPath = terrorZoneService.getBackupPath();

    if (!terrorZoneService.backupExists()) {
      throw new Error('No backup file found to restore from');
    }

    const result = await terrorZoneService.restoreFromBackup(backupPath, gameFilePath);

    if (result.success) {
      // Clear the configuration from database
      grailDatabase.setSetting('terrorZoneConfig', '');
    }

    return result;
  });

  /**
   * IPC handler for validating the D2R installation path.
   * @returns Promise resolving to validation result
   */
  handle('terrorZone:validatePath', async (): Promise<TerrorZoneValidationResult> => {
    try {
      const settings = grailDatabase.getAllSettings();
      const d2rInstallPath = settings.d2rInstallPath;

      if (!d2rInstallPath) {
        return {
          valid: false,
          error: 'D2R installation path is not configured',
          errorCode: 'pathNotConfigured',
        };
      }

      return await terrorZoneService.validateGameFile(d2rInstallPath);
    } catch (error) {
      console.error('Failed to validate path:', error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: 'unknown',
      };
    }
  });

  console.log('[initializeTerrorZoneHandlers] Initialization complete');
}
