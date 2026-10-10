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
