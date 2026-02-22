import { NUMERIC_TO_STRING_ZONE_ID } from '../data/terrorZoneNames';
import type { Settings } from '../types/grail';
import { GameMode, GameVersion } from '../types/grail';
import { schema } from './drizzle';
import type { DatabaseContext } from './types';

const { settings } = schema;

function parseJSON(jsonString: string): unknown {
  if (!jsonString || jsonString === 'undefined' || jsonString === 'null') {
    return undefined;
  }
  if (jsonString === '[object Object]') {
    console.warn(
      '[parseJSON] Detected "[object Object]" string — an object was likely coerced to string before storage.',
    );
    return undefined;
  }
  try {
    return JSON.parse(jsonString);
  } catch {
    console.warn(`Failed to parse JSON setting: "${jsonString}". Using undefined.`);
    return undefined;
  }
}

function parseJSONSetting<T>(value: string | undefined): T | undefined {
  if (!value || value === '') {
    return undefined;
  }
  return parseJSON(value) as T | undefined;
}

function parseIntSetting(value: string | undefined): number | undefined {
  return value ? Number.parseInt(value, 10) : undefined;
}

function parseFloatSetting(value: string | undefined, defaultValue?: number): number | undefined {
  if (!value) {
    return defaultValue;
  }
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

function parseBooleanSetting(value: string | undefined): boolean {
  return value === 'true';
}

function parseEnumSetting<T>(value: string | undefined, defaultValue: T): T {
  return (value as T) || defaultValue;
}

/**
 * Migrates terror zone configuration from old numeric IDs to new string IDs.
 * @param config - The config object that may contain numeric or string keys
 * @returns Migrated config with only string keys
 */
function migrateTerrorZoneConfig(
  config: Record<string | number, boolean> | undefined,
): Record<string, boolean> | undefined {
  if (!config || Object.keys(config).length === 0) {
    return undefined;
  }

  const migrated: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(config)) {
    const numericKey = Number(key);
    // Check if the key is a numeric string and can be converted to a number
    if (!Number.isNaN(numericKey) && NUMERIC_TO_STRING_ZONE_ID[numericKey]) {
      // Migrate from numeric to string ID
      migrated[NUMERIC_TO_STRING_ZONE_ID[numericKey]] = value;
    } else {
      // Already a string ID, keep as is
      migrated[key] = value;
    }
  }

  return migrated;
}

export function getAllSettings(ctx: DatabaseContext): Settings {
  const dbSettings = ctx.db.select().from(settings).all();
  const settingsMap: Record<string, string> = {};
  for (const setting of dbSettings) {
    settingsMap[setting.key] = setting.value ?? '';
  }

  // Convert string values back to their proper types
  const typedSettings: Settings = {
    saveDir: settingsMap.saveDir || '',
    lang: settingsMap.lang || 'en',
    gameMode: parseEnumSetting(settingsMap.gameMode, GameMode.Both),
    grailNormal: parseBooleanSetting(settingsMap.grailNormal),
    grailEthereal: parseBooleanSetting(settingsMap.grailEthereal),
    grailRunes: parseBooleanSetting(settingsMap.grailRunes),
    grailRunewords: parseBooleanSetting(settingsMap.grailRunewords),
    gameVersion: parseEnumSetting(settingsMap.gameVersion, GameVersion.Resurrected),
    enableSounds: parseBooleanSetting(settingsMap.enableSounds),
    notificationVolume: parseFloatSetting(settingsMap.notificationVolume, 0.5) || 0.5,
    inAppNotifications: parseBooleanSetting(settingsMap.inAppNotifications),
    nativeNotifications: parseBooleanSetting(settingsMap.nativeNotifications),
    needsSeeding: parseBooleanSetting(settingsMap.needsSeeding),
    theme: parseEnumSetting(settingsMap.theme, 'system' as const),
    showItemIcons: settingsMap.showItemIcons !== 'false', // Default to true
    // D2R installation settings
    d2rInstallPath: settingsMap.d2rInstallPath || undefined,
    iconConversionStatus: settingsMap.iconConversionStatus as
      | 'not_started'
      | 'in_progress'
      | 'completed'
      | 'failed'
      | undefined,
    iconConversionProgress: parseJSONSetting<{ current: number; total: number }>(
      settingsMap.iconConversionProgress,
    ),
    // Advanced monitoring settings
    tickReaderIntervalMs: parseIntSetting(settingsMap.tickReaderIntervalMs),
    chokidarPollingIntervalMs: parseIntSetting(settingsMap.chokidarPollingIntervalMs),
    fileStabilityThresholdMs: parseIntSetting(settingsMap.fileStabilityThresholdMs),
    fileChangeDebounceMs: parseIntSetting(settingsMap.fileChangeDebounceMs),
    // Widget settings
    widgetEnabled: parseBooleanSetting(settingsMap.widgetEnabled),
    widgetDisplay: parseEnumSetting(settingsMap.widgetDisplay, 'overall' as const),
    widgetPosition: parseJSONSetting<{ x: number; y: number }>(settingsMap.widgetPosition),
    widgetOpacity: parseFloatSetting(settingsMap.widgetOpacity, 0.9) ?? 0.9,
    widgetSizeOverall: parseJSONSetting<{ width: number; height: number }>(
      settingsMap.widgetSizeOverall,
    ),
    widgetSizeSplit: parseJSONSetting<{ width: number; height: number }>(
      settingsMap.widgetSizeSplit,
    ),
    widgetSizeAll: parseJSONSetting<{ width: number; height: number }>(settingsMap.widgetSizeAll),
    // Main window settings
    mainWindowBounds: parseJSONSetting<{
      x: number;
      y: number;
      width: number;
      height: number;
    }>(settingsMap.mainWindowBounds),
    // Wizard settings
    wizardCompleted: parseBooleanSetting(settingsMap.wizardCompleted),
    wizardSkipped: parseBooleanSetting(settingsMap.wizardSkipped),
    // Terror zone configuration (with migration from numeric to string IDs)
    terrorZoneConfig: migrateTerrorZoneConfig(
      parseJSONSetting<Record<string | number, boolean>>(settingsMap.terrorZoneConfig),
    ),
    terrorZoneBackupCreated: parseBooleanSetting(settingsMap.terrorZoneBackupCreated),
    // Run tracker settings
    runTrackerAutoStart: parseBooleanSetting(settingsMap.runTrackerAutoStart),
    runTrackerEndThreshold: parseIntSetting(settingsMap.runTrackerEndThreshold) ?? 10,
    runTrackerMemoryReading: parseBooleanSetting(settingsMap.runTrackerMemoryReading),
    runTrackerMemoryPollingInterval:
      parseIntSetting(settingsMap.runTrackerMemoryPollingInterval) ?? 500,
    runTrackerShortcuts: parseJSONSetting<Settings['runTrackerShortcuts']>(
      settingsMap.runTrackerShortcuts,
    ),
  };

  return typedSettings;
}

export function setSetting(ctx: DatabaseContext, key: keyof Settings, value: string): void {
  ctx.db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value },
    })
    .run();
}
