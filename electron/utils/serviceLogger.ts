/**
 * Payload sent to the renderer process for UI-surfaced errors.
 */
export interface ServiceErrorPayload {
  service: string;
  operation: string;
  severity: 'error' | 'warn';
  message: string;
  timestamp: number;
}

/**
 * Options for controlling whether an error is surfaced to the UI.
 */
interface SurfaceOptions {
  surfaceToUI: true;
  userMessage?: string;
}

type ErrorForwarder = (payload: ServiceErrorPayload) => void;

let errorForwarder: ErrorForwarder | null = null;

/**
 * Registers the callback that sends service errors to the renderer process.
 * Should be called once during app initialization.
 * @param fn - Callback that forwards errors to renderer via IPC
 */
export function setErrorForwarder(fn: ErrorForwarder): void {
  errorForwarder = fn;
}

function formatPrefix(service: string, operation: string): string {
  return `[${service}.${operation}]`;
}

function extractMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function forwardToUI(
  service: string,
  operation: string,
  severity: 'error' | 'warn',
  error: unknown,
  surfaceOptions?: SurfaceOptions,
): void {
  if (!surfaceOptions?.surfaceToUI || !errorForwarder) {
    return;
  }

  errorForwarder({
    service,
    operation,
    severity,
    message: surfaceOptions.userMessage || extractMessage(error),
    timestamp: Date.now(),
  });
}

/**
 * Service logger interface returned by createServiceLogger.
 */
export interface ServiceLogger {
  error(
    operation: string,
    error: unknown,
    context?: Record<string, unknown>,
    surfaceOptions?: SurfaceOptions,
  ): void;
  warn(operation: string, message: string, context?: Record<string, unknown>): void;
  info(operation: string, message: string, context?: Record<string, unknown>): void;
}

/**
 * Creates a logger bound to a specific service name.
 * Log output format: [ServiceName.operation] message
 *
 * @param serviceName - Name of the service (e.g., 'SaveFileMonitor')
 * @returns Logger with error, warn, and info methods
 *
 * @example
 * const log = createServiceLogger('SaveFileMonitor');
 * log.error('parseSaveFile', error, { filePath });
 * log.error('flush', error, { attempt }, { surfaceToUI: true, userMessage: 'Database write failed' });
 * log.warn('validate', 'Invalid interval');
 * log.info('startMonitoring', 'Started', { directory });
 */
export function createServiceLogger(serviceName: string): ServiceLogger {
  return {
    error(
      operation: string,
      error: unknown,
      context?: Record<string, unknown>,
      surfaceOptions?: SurfaceOptions,
    ): void {
      const prefix = formatPrefix(serviceName, operation);
      if (context) {
        console.error(prefix, error, context);
      } else {
        console.error(prefix, error);
      }
      forwardToUI(serviceName, operation, 'error', error, surfaceOptions);
    },

    warn(operation: string, message: string, context?: Record<string, unknown>): void {
      const prefix = formatPrefix(serviceName, operation);
      if (context) {
        console.warn(prefix, message, context);
      } else {
        console.warn(prefix, message);
      }
    },

    info(operation: string, message: string, context?: Record<string, unknown>): void {
      const prefix = formatPrefix(serviceName, operation);
      if (context) {
        console.log(prefix, message, context);
      } else {
        console.log(prefix, message);
      }
    },
  };
}
