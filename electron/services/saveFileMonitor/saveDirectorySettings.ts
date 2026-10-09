import type { Settings } from '../../types/grail';
import { createServiceLogger } from '../../utils/serviceLogger';
import type { SettingsService } from '../settingsService';

const log = createServiceLogger('SaveFileMonitor');

// Default values for configurable intervals
export const DEFAULT_TICK_INTERVAL = 500;
export const DEFAULT_POLLING_INTERVAL = 1000;
export const DEFAULT_STABILITY_THRESHOLD = 300;
export const DEFAULT_DEBOUNCE_DELAY = 500;

/** Read access to the settings. */
export type SettingsReader = Pick<SettingsService, 'getAll'>;

/** Timing of the file watcher, read from the settings. */
export interface WatcherIntervals {
  pollingInterval: number;
  stabilityThreshold: number;
}

/**
 * Resolves the save directory the app works with (the "effective" save directory). This is the
 * only place that defines its precedence:
 * 1. the `saveDir` setting, trimmed, when it is not blank;
 * 2. otherwise the platform default directory.
 * The save file monitor applies the result when it is created, when monitoring starts and when the
 * save directory changes. Services that act on the watched files use the monitor's directory.
 * @param configuredSaveDir - The stored `saveDir` setting
 * @param defaultDirectory - The platform default save directory
 * @returns The effective save directory, or undefined when neither is known
 */
export function resolveEffectiveSaveDirectory(
  configuredSaveDir: string | undefined,
  defaultDirectory: string | undefined,
): string | undefined {
  const configured = configuredSaveDir?.trim();
  if (configured) {
    return configured;
  }
  return defaultDirectory || undefined;
}

/**
 * Reads the save directory the user configured in the settings.
 * @returns The trimmed directory, or undefined when none is configured or the settings cannot be read.
 */
export function readConfiguredSaveDirectory(settingsReader: SettingsReader): string | undefined {
  try {
    const settings = settingsReader.getAll();
    log.info(
      'initializeSaveDirectories',
      `Settings retrieved: saveDir=${settings.saveDir}, gameMode=${settings.gameMode}`,
    );
    if (settings.saveDir && settings.saveDir.trim() !== '') {
      const customSaveDir = settings.saveDir.trim();
      log.info('initializeSaveDirectories', `Custom save directory found: ${customSaveDir}`);
      return customSaveDir;
    }
    log.info('initializeSaveDirectories', 'No custom save directory in settings');
  } catch (error) {
    log.warn('initializeSaveDirectories', `Failed to read saveDir from settings: ${error}`);
  }
  return undefined;
}

/**
 * Validates an interval value to ensure it's within acceptable bounds.
 * @param {number | undefined} value - The value to validate
 * @param {number} min - Minimum acceptable value
 * @param {number} max - Maximum acceptable value
 * @param {number} defaultValue - Default value to use if validation fails
 * @returns {number} The validated interval value
 */
export function validateInterval(
  value: number | undefined,
  min: number,
  max: number,
  defaultValue: number,
): number {
  if (value === undefined) return defaultValue;
  if (value < min || value > max) {
    log.warn(
      'validateInterval',
      `Invalid interval ${value} (valid range: ${min}-${max}ms), using default ${defaultValue}ms`,
    );
    return defaultValue;
  }
  return value;
}

/**
 * Gets the tick reader interval from settings or returns default.
 * @returns {number} The tick reader interval in milliseconds
 */
export function resolveTickReaderInterval(settingsReader: SettingsReader): number {
  const settings = settingsReader.getAll();
  return validateInterval(
    settings.tickReaderIntervalMs,
    100, // min 100ms
    5000, // max 5 seconds
    DEFAULT_TICK_INTERVAL,
  );
}

/** Gets the polling interval and write stability threshold of the file watcher. */
export function resolveWatcherIntervals(settings: Settings): WatcherIntervals {
  const pollingInterval = validateInterval(
    settings.chokidarPollingIntervalMs,
    500, // min 500ms
    5000, // max 5 seconds
    DEFAULT_POLLING_INTERVAL,
  );
  const stabilityThreshold = validateInterval(
    settings.fileStabilityThresholdMs,
    100, // min 100ms
    2000, // max 2 seconds
    DEFAULT_STABILITY_THRESHOLD,
  );
  return { pollingInterval, stabilityThreshold };
}

/** Gets how long the monitor waits after the last file change before it parses. */
export function resolveDebounceDelay(settings: Settings): number {
  return validateInterval(
    settings.fileChangeDebounceMs,
    500, // min 500ms
    10000, // max 10 seconds
    DEFAULT_DEBOUNCE_DELAY,
  );
}
