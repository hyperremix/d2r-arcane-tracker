import { ipcMain } from 'electron';
import { grailDatabase } from '../database/database';
import { TerrorZoneService } from '../services/terrorZoneService';
import type { TerrorZone } from '../types/grail';

/**
 * Global terror zone service instance.
 */
const terrorZoneService = new TerrorZoneService();

/**
 * Initializes IPC handlers for terror zone configuration operations.
 * Sets up handlers for reading zones, managing configuration, and file operations.
 */
export function initializeTerrorZoneHandlers(): void {
  console.log('[initializeTerrorZoneHandlers] Starting initialization');

  /**
   * IPC handler for retrieving all terror zones from the game file.
   * @returns Promise resolving to array of terror zones
   */
  ipcMain.handle('terrorZone:getZones', async (): Promise<TerrorZone[]> => {
    try {
      const settings = grailDatabase.getAllSettings();
      const d2rInstallPath = settings.d2rInstallPath;

      if (!d2rInstallPath) {
        throw new Error('D2R installation path is not configured');
      }

      const gameFilePath = terrorZoneService.getGameDataPath(d2rInstallPath);
      return await terrorZoneService.readZonesFromFile(gameFilePath);
    } catch (error) {
      console.error('Failed to get terror zones:', error);
      throw error;
    }
  });

  /**
   * IPC handler for retrieving current terror zone configuration from database.
   * @returns Promise resolving to zone configuration (zone ID -> enabled state)
   */
  ipcMain.handle('terrorZone:getConfig', async (): Promise<Record<number, boolean>> => {
    try {
      const settings = grailDatabase.getAllSettings();
      return settings.terrorZoneConfig || {};
    } catch (error) {
      console.error('Failed to get terror zone config:', error);
      throw error;
    }
  });

  /**
   * IPC handler for updating terror zone configuration.
   * Updates database settings and applies changes to the game file.
   * @param _ - IPC event (unused)
   * @param config - New zone configuration (zone ID -> enabled state)
   * @returns Promise resolving to update result
   */
  ipcMain.handle(
    'terrorZone:updateConfig',
    async (
      _,
      config: Record<number, boolean>,
    ): Promise<{ success: boolean; requiresRestart: boolean }> => {
      try {
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
        const zones = await terrorZoneService.readZonesFromFile(gameFilePath);

        // Convert config to Set of enabled zone IDs
        const enabledZoneIds = new Set<number>();
        for (const [zoneIdStr, enabled] of Object.entries(config)) {
          const zoneId = Number.parseInt(zoneIdStr, 10);
          if (enabled) {
            enabledZoneIds.add(zoneId);
          }
        }

        // Write modified zones to file
        await terrorZoneService.writeZonesToFile(gameFilePath, zones, enabledZoneIds);

        // Update configuration in database
        grailDatabase.setSetting('terrorZoneConfig', JSON.stringify(config));

        return { success: true, requiresRestart: true };
      } catch (error) {
        console.error('Failed to update terror zone config:', error);
        throw error;
      }
    },
  );

  /**
   * IPC handler for restoring the original desecratedzones.json file from backup.
   * @returns Promise resolving to restore result
   */
  ipcMain.handle('terrorZone:restoreOriginal', async (): Promise<{ success: boolean }> => {
    try {
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
    } catch (error) {
      console.error('Failed to restore original file:', error);
      throw error;
    }
  });

  /**
   * IPC handler for validating the D2R installation path.
   * @returns Promise resolving to validation result
   */
  ipcMain.handle(
    'terrorZone:validatePath',
    async (): Promise<{ valid: boolean; path?: string; error?: string }> => {
      try {
        const settings = grailDatabase.getAllSettings();
        const d2rInstallPath = settings.d2rInstallPath;

        if (!d2rInstallPath) {
          return { valid: false, error: 'D2R installation path is not configured' };
        }

        return await terrorZoneService.validateGameFile(d2rInstallPath);
      } catch (error) {
        console.error('Failed to validate path:', error);
        return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    },
  );

  console.log('[initializeTerrorZoneHandlers] Initialization complete');
}
