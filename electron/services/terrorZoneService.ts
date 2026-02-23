import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { NUMERIC_TO_STRING_ZONE_ID, TERROR_ZONE_NAMES } from '../data/terrorZoneNames';
import { stripJsonComments } from '../lib/jsonUtils';
import type { TerrorZone } from '../types/grail';

import { createServiceLogger } from '../utils/serviceLogger';

const log = createServiceLogger('TerrorZoneService');

/**
 * Service for managing terror zone configuration by modifying the game's desecratedzones.json file.
 * Handles backup creation, zone reading/writing, and validation.
 */
export class TerrorZoneService {
  private readonly userDataPath: string;

  constructor() {
    this.userDataPath = app.getPath('userData');
  }

  /**
   * Gets the path to the desecratedzones.json file in the D2R installation.
   * @param d2rInstallPath - Path to D2R installation
   * @returns Path to the desecratedzones.json file
   */
  getGameDataPath(d2rInstallPath: string): string {
    return path.join(d2rInstallPath, 'Data', 'hd', 'global', 'excel', 'desecratedzones.json');
  }

  /**
   * Creates an immutable backup of the original desecratedzones.json file.
   * Only creates backup if it doesn't already exist.
   * @param sourcePath - Path to the original game file
   * @returns Promise resolving to backup result
   */
  async createBackup(sourcePath: string): Promise<{ success: boolean; backupPath: string }> {
    try {
      const backupPath = path.join(this.userDataPath, 'desecratedzones.json.original');

      // Only create backup if it doesn't exist
      if (existsSync(backupPath)) {
        return { success: true, backupPath };
      }

      if (!existsSync(sourcePath)) {
        throw new Error('Source file does not exist');
      }

      copyFileSync(sourcePath, backupPath);
      return { success: true, backupPath };
    } catch (error) {
      log.error('createBackup', error);
      return { success: false, backupPath: '' };
    }
  }

  /**
   * Reads terror zones from the desecratedzones.json file.
   * @param filePath - Path to the desecratedzones.json file
   * @returns Promise resolving to array of terror zones
   */
  async readZonesFromFile(
    filePath: string,
    options: { preferBackup?: boolean } = {},
  ): Promise<TerrorZone[]> {
    try {
      if (!existsSync(filePath)) {
        throw new Error('Game file does not exist');
      }

      const preferBackup = options.preferBackup ?? false;

      // Ensure a backup exists before we potentially rely on it
      if (!this.backupExists()) {
        await this.createBackup(filePath);
      }

      const sourcePath = preferBackup && this.backupExists() ? this.getBackupPath() : filePath;

      const fileContent = readFileSync(sourcePath, 'utf-8');
      const data = JSON.parse(stripJsonComments(fileContent));

      if (
        !data.desecrated_zones ||
        !Array.isArray(data.desecrated_zones) ||
        data.desecrated_zones.length === 0
      ) {
        throw new Error('Invalid desecratedzones.json structure');
      }

      const zones = data.desecrated_zones[0]?.zones;
      if (!zones || !Array.isArray(zones)) {
        throw new Error('No zones found in desecratedzones.json');
      }

      return zones.map(
        (zone: {
          type?: string;
          name?: string;
          id: string | number;
          levels?: Array<{
            type?: string;
            name?: string;
            level_id: number;
            waypoint_level_id?: number;
          }>;
        }) => {
          // Convert numeric IDs to string IDs if needed
          let zoneId: string;
          let zoneName: string;

          if (typeof zone.id === 'number') {
            // Numeric ID - convert to string ID first, then get name
            const stringId = NUMERIC_TO_STRING_ZONE_ID[zone.id];
            zoneId = stringId || String(zone.id);
            zoneName = stringId
              ? TERROR_ZONE_NAMES[stringId] || `Zone ${zone.id}`
              : `Zone ${zone.id}`;
          } else {
            // String ID - use directly
            zoneId = zone.id;
            zoneName = TERROR_ZONE_NAMES[zone.id] || `Zone ${zone.id}`;
          }

          return {
            id: zoneId,
            name: zoneName,
            levels:
              zone.levels?.map((level) => ({
                level_id: level.level_id,
                waypoint_level_id: level.waypoint_level_id,
              })) || [],
          };
        },
      );
    } catch (error) {
      log.error('readZonesFromFile', error);
      throw error;
    }
  }

  /**
   * Writes modified zones back to the desecratedzones.json file.
   * @param filePath - Path to the desecratedzones.json file
   * @param zones - Array of all zones
   * @param enabledZoneIds - Set of enabled zone IDs
   */
  async writeZonesToFile(
    filePath: string,
    zones: TerrorZone[],
    enabledZoneIds: Set<string>,
  ): Promise<void> {
    try {
      if (!existsSync(filePath)) {
        throw new Error('Game file does not exist');
      }

      const fileContent = readFileSync(filePath, 'utf-8');
      const data = JSON.parse(stripJsonComments(fileContent));

      if (
        !data.desecrated_zones ||
        !Array.isArray(data.desecrated_zones) ||
        data.desecrated_zones.length === 0
      ) {
        throw new Error('Invalid desecratedzones.json structure');
      }

      // Read the original structure to preserve type and name fields
      const originalZones = data.desecrated_zones[0]?.zones || [];
      const originalZonesMap = new Map<string, { type?: string; name?: string }>(
        originalZones.map((zone: { id: string; type?: string; name?: string }) => [
          zone.id,
          { type: zone.type, name: zone.name },
        ]),
      );

      // Filter zones to only include enabled ones
      const enabledZones = zones.filter((zone) => enabledZoneIds.has(zone.id));

      // Update the zones array in the data structure, preserving type and name fields
      data.desecrated_zones[0].zones = enabledZones.map((zone) => {
        const original = originalZonesMap.get(zone.id) || {};
        return {
          ...(original.type && { type: original.type }),
          ...(original.name && { name: original.name }),
          id: zone.id,
          levels: zone.levels.map((level) => ({
            type: 'DesecratedLevel',
            name: `desecratedzones_desecrated_zones_0_zones_${zone.id}_levels_${level.level_id}`,
            level_id: level.level_id,
            ...(level.waypoint_level_id !== undefined && {
              waypoint_level_id: level.waypoint_level_id,
            }),
          })),
        };
      });

      // Write back to file with proper formatting
      writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf-8');
    } catch (error) {
      log.error('writeZonesToFile', error, undefined, {
        surfaceToUI: true,
        userMessage: 'Failed to update terror zone configuration',
      });
      throw error;
    }
  }

  /**
   * Restores the original desecratedzones.json file from backup.
   * @param backupPath - Path to the backup file
   * @param targetPath - Path to restore to
   * @returns Promise resolving to restore result
   */
  async restoreFromBackup(backupPath: string, targetPath: string): Promise<{ success: boolean }> {
    try {
      if (!existsSync(backupPath)) {
        throw new Error('Backup file does not exist');
      }

      copyFileSync(backupPath, targetPath);
      return { success: true };
    } catch (error) {
      log.error('restoreFromBackup', error);
      return { success: false };
    }
  }

  /**
   * Validates that the D2R installation path contains the required game file.
   * @param d2rInstallPath - Path to D2R installation
   * @returns Promise resolving to validation result
   */
  async validateGameFile(
    d2rInstallPath: string,
  ): Promise<{ valid: boolean; path?: string; error?: string }> {
    try {
      if (!d2rInstallPath || d2rInstallPath.trim() === '') {
        return { valid: false, error: 'D2R installation path is not set' };
      }

      if (!existsSync(d2rInstallPath)) {
        return { valid: false, error: 'D2R installation directory does not exist' };
      }

      const gameFilePath = this.getGameDataPath(d2rInstallPath);

      if (!existsSync(gameFilePath)) {
        return { valid: false, error: 'desecratedzones.json file not found in D2R installation' };
      }

      // Create backup before parsing if it doesn't exist
      if (!this.backupExists()) {
        await this.createBackup(gameFilePath);
      }

      // Try to read and parse the file to ensure it's valid
      try {
        const fileContent = readFileSync(gameFilePath, 'utf-8');
        const strippedContent = stripJsonComments(fileContent);
        const data = JSON.parse(strippedContent);

        if (!data.desecrated_zones || !Array.isArray(data.desecrated_zones)) {
          return { valid: false, error: 'Invalid desecratedzones.json file structure' };
        }
      } catch (parseError) {
        log.error('validateGameFile', parseError);
        const errorMessage =
          parseError instanceof Error ? parseError.message : 'Unknown parsing error';
        return {
          valid: false,
          error: `desecratedzones.json file is corrupted or invalid: ${errorMessage}`,
        };
      }

      return { valid: true, path: gameFilePath };
    } catch (error) {
      log.error('validateGameFile', error);
      return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Gets the path to the backup file.
   * @returns Path to the backup file
   */
  getBackupPath(): string {
    return path.join(this.userDataPath, 'desecratedzones.json.original');
  }

  /**
   * Checks if a backup exists.
   * @returns True if backup exists
   */
  backupExists(): boolean {
    return existsSync(this.getBackupPath());
  }
}
