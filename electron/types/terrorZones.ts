/**
 * Terror zone configuration.
 *
 * Shared by the main process and the renderer; re-exported from `./grail`.
 */

/**
 * Interface representing a terror zone configuration.
 */
export interface TerrorZone {
  id: string;
  name: string;
  levels: Array<{ level_id: number; waypoint_level_id?: number }>;
}

/**
 * Machine-readable reasons why terror zone game file validation can fail.
 * The renderer uses these codes to pick translated messages and setup guidance.
 */
export type TerrorZoneValidationErrorCode =
  | 'pathNotConfigured'
  | 'directoryNotFound'
  | 'gameFileNotFound'
  | 'invalidStructure'
  | 'corruptedFile'
  | 'unknown';

/**
 * Result of validating the D2R installation for terror zone configuration.
 */
export type TerrorZoneValidationResult =
  | { valid: true; path?: string; error?: undefined; errorCode?: undefined }
  | { valid: false; path?: string; error?: string; errorCode: TerrorZoneValidationErrorCode };

/**
 * The most windows one schedule request can ask for.
 */
export const MAX_TERROR_ZONE_SCHEDULE_SLOTS = 96;

/**
 * A time in which one zone is the terror zone.
 */
export interface TerrorZoneScheduleSlot {
  /** Start of the window, in milliseconds since the Unix epoch */
  startsAt: number;
  /** End of the window, in milliseconds since the Unix epoch */
  endsAt: number;
  zoneId: string;
  zoneName: string;
}

/**
 * Where a schedule was calculated from: the player's `desecratedzones.json`, or the retail
 * defaults when that file isn't available (`retailDefault`) or is from a D2R version before 3.x
 * and has no usable rotation (`unusableGameFile`).
 */
export type TerrorZoneScheduleSource = 'gameFile' | 'retailDefault' | 'unusableGameFile';

/**
 * The offline terror zone schedule, soonest window first. The first window may already be running.
 * It is empty when the game file schedules no terror zone.
 */
export interface TerrorZoneSchedule {
  source: TerrorZoneScheduleSource;
  slots: TerrorZoneScheduleSlot[];
}
