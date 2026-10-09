import type { GrailDatabase } from '../../database/database';
import type { Settings } from '../../types/grail';
import { createServiceLogger } from '../../utils/serviceLogger';

const log = createServiceLogger('SaveFileMonitor');

// Default values for configurable intervals
export const DEFAULT_TICK_INTERVAL = 500;
export const DEFAULT_POLLING_INTERVAL = 1000;
export const DEFAULT_STABILITY_THRESHOLD = 300;
export const DEFAULT_DEBOUNCE_DELAY = 500;

/** Timing of the file watcher, read from the settings. */
export interface WatcherIntervals {
  pollingInterval: number;
  stabilityThreshold: number;
}

/**
 * Reads the save directory the user configured in the settings.
 * @returns The trimmed directory, or undefined when none is configured or the settings cannot be read.
 */
export function readConfiguredSaveDirectory(
  grailDatabase: Pick<GrailDatabase, 'getAllSettings'> | null,
): string | undefined {
  if (!grailDatabase) {
    log.info('initializeSaveDirectories', 'No grail database available');
    return undefined;
  }

  try {
    const settings = grailDatabase.getAllSettings();
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
export function resolveTickReaderInterval(
  grailDatabase: Pick<GrailDatabase, 'getAllSettings'> | null,
): number {
  if (!grailDatabase) {
    return DEFAULT_TICK_INTERVAL;
  }

  const settings = grailDatabase.getAllSettings();
  return validateInterval(
    settings.tickReaderIntervalMs,
    100, // min 100ms
    5000, // max 5 seconds
    DEFAULT_TICK_INTERVAL,
  );
}

/** Gets the polling interval and write stability threshold of the file watcher. */
export function resolveWatcherIntervals(settings: Settings | undefined): WatcherIntervals {
  const pollingInterval = validateInterval(
    settings?.chokidarPollingIntervalMs,
    500, // min 500ms
    5000, // max 5 seconds
    DEFAULT_POLLING_INTERVAL,
  );
  const stabilityThreshold = validateInterval(
    settings?.fileStabilityThresholdMs,
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
