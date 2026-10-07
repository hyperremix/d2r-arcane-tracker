import type {
  ServiceErrorCode,
  ServiceErrorParams,
  ServiceErrorPayload,
} from 'electron/types/serviceError';
import { isServiceErrorCode } from 'electron/types/serviceError';
import { translations } from '@/i18n/translations';

/**
 * Service error payload as received over IPC. The code is kept as a plain string because
 * the main process may send a code this renderer build does not know yet.
 */
export interface IncomingServiceError extends Omit<ServiceErrorPayload, 'code'> {
  code: string;
}

/**
 * Contextual action offered on a service error toast.
 */
export type ServiceErrorAction = 'openSettings' | 'copyDetails';

/**
 * Translation keys for the title and description of a service error toast.
 */
export interface ServiceErrorCopy {
  titleKey: string;
  descriptionKey: string;
}

const SEVERITIES: readonly string[] = ['error', 'warn'];

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Keeps only string and finite number entries of untrusted interpolation params.
 * @param value - Untrusted params value
 * @returns Sanitized params, or undefined when none remain
 */
function sanitizeParams(value: unknown): ServiceErrorParams | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }

  const params: ServiceErrorParams = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string' || (typeof entry === 'number' && Number.isFinite(entry))) {
      params[key] = entry;
    }
  }
  return Object.keys(params).length > 0 ? params : undefined;
}

/**
 * Validates an untrusted `service-error` IPC payload.
 * @param value - Value received from the main process
 * @returns The validated payload, or undefined when it is malformed
 */
export function parseServiceErrorPayload(value: unknown): IncomingServiceError | undefined {
  if (!isPlainObject(value)) {
    return undefined;
  }

  const { service, operation, severity, code, params, detail, timestamp } = value;
  if (
    !isNonEmptyString(service) ||
    !isNonEmptyString(operation) ||
    !isNonEmptyString(code) ||
    typeof severity !== 'string' ||
    !SEVERITIES.includes(severity) ||
    typeof timestamp !== 'number' ||
    !Number.isFinite(timestamp)
  ) {
    return undefined;
  }

  const sanitizedParams = sanitizeParams(params);
  return {
    service,
    operation,
    severity: severity as IncomingServiceError['severity'],
    code,
    ...(sanitizedParams && { params: sanitizedParams }),
    ...(typeof detail === 'string' && detail.length > 0 && { detail }),
    timestamp,
  };
}

const SERVICE_ERROR_COPY: Record<ServiceErrorCode, ServiceErrorCopy> = {
  saveFileParseFailed: {
    titleKey: translations.serviceErrors.saveFileParseFailed.title,
    descriptionKey: translations.serviceErrors.saveFileParseFailed.description,
  },
  databaseWriteFailed: {
    titleKey: translations.serviceErrors.databaseWriteFailed.title,
    descriptionKey: translations.serviceErrors.databaseWriteFailed.description,
  },
  terrorZoneWriteFailed: {
    titleKey: translations.serviceErrors.terrorZoneWriteFailed.title,
    descriptionKey: translations.serviceErrors.terrorZoneWriteFailed.description,
  },
  spriteConversionFailed: {
    titleKey: translations.serviceErrors.spriteConversionFailed.title,
    descriptionKey: translations.serviceErrors.spriteConversionFailed.description,
  },
};

const UNKNOWN_SERVICE_ERROR_COPY: ServiceErrorCopy = {
  titleKey: translations.serviceErrors.unknown.title,
  descriptionKey: translations.serviceErrors.unknown.description,
};

const SERVICE_ERROR_ACTIONS: Record<ServiceErrorCode, ServiceErrorAction> = {
  // Usually a wrong save directory or an unsupported file in it
  saveFileParseFailed: 'openSettings',
  // Sprites are read from the D2R installation path configured in settings
  spriteConversionFailed: 'openSettings',
  databaseWriteFailed: 'copyDetails',
  terrorZoneWriteFailed: 'copyDetails',
};

/**
 * Returns the translation keys for a service error code, falling back to generic copy.
 * @param code - Service error code
 * @returns Title and description translation keys
 */
export function getServiceErrorCopy(code: string): ServiceErrorCopy {
  return isServiceErrorCode(code) ? SERVICE_ERROR_COPY[code] : UNKNOWN_SERVICE_ERROR_COPY;
}

/**
 * Returns the contextual action for a service error code.
 * @param code - Service error code
 * @returns The action to offer on the toast
 */
export function getServiceErrorAction(code: string): ServiceErrorAction {
  return isServiceErrorCode(code) ? SERVICE_ERROR_ACTIONS[code] : 'copyDetails';
}

/**
 * Returns the toast id used to deduplicate repeated errors of the same service operation.
 * @param payload - Service error payload
 * @returns Stable toast id
 */
export function getServiceErrorToastId(payload: IncomingServiceError): string {
  return `${payload.service}.${payload.operation}`;
}

/**
 * Formats a service error as plain technical text for bug reports.
 * @param payload - Service error payload
 * @returns Multi-line technical description of the error
 */
export function formatServiceErrorDetails(payload: IncomingServiceError): string {
  const time = new Date(payload.timestamp);
  const lines = [
    `[${payload.service}.${payload.operation}] ${payload.code} (${payload.severity})`,
    `Time: ${Number.isNaN(time.getTime()) ? payload.timestamp : time.toISOString()}`,
  ];
  if (payload.params) {
    lines.push(`Params: ${JSON.stringify(payload.params)}`);
  }
  if (payload.detail) {
    lines.push(`Detail: ${payload.detail}`);
  }
  return lines.join('\n');
}
