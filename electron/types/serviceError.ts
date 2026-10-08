/**
 * Stable codes for service errors that are surfaced to the user.
 * The renderer maps each code to translated toast copy, so main-process emitters
 * never send user-facing sentences over IPC.
 */
export const SERVICE_ERROR_CODES = [
  'saveFileParseFailed',
  'databaseWriteFailed',
  'terrorZoneWriteFailed',
  'spriteConversionFailed',
] as const;

/**
 * Union of all known service error codes.
 */
export type ServiceErrorCode = (typeof SERVICE_ERROR_CODES)[number];

/**
 * Severity of a surfaced service error. Only errors are surfaced to the UI.
 */
export type ServiceErrorSeverity = 'error';

/**
 * Interpolation parameters for the translated error copy (e.g. `{ fileName: 'Sorc.d2s' }`).
 */
export type ServiceErrorParams = Record<string, string | number>;

/**
 * Payload sent from the main process to the renderer over the `service-error` IPC channel.
 */
export interface ServiceErrorPayload {
  /** Name of the emitting service (e.g. `ItemDetection`). */
  service: string;
  /** Operation that failed (e.g. `extractItemsFromSaveFile`). */
  operation: string;
  severity: ServiceErrorSeverity;
  /** Stable error code used by the renderer to pick translated copy and an action. */
  code: ServiceErrorCode;
  /** Optional interpolation parameters for the translated copy. */
  params?: ServiceErrorParams;
  /** Optional raw technical detail (untranslated) for logs and "Copy details". */
  detail?: string;
  timestamp: number;
}

/**
 * Returns whether a value is one of the known service error codes.
 * @param value - Value to check
 * @returns True when the value is a known service error code
 */
export function isServiceErrorCode(value: unknown): value is ServiceErrorCode {
  return typeof value === 'string' && (SERVICE_ERROR_CODES as readonly string[]).includes(value);
}
