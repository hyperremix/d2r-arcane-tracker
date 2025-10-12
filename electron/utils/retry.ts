/**
 * Retry configuration options for exponential backoff.
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay in milliseconds before first retry */
  initialDelayMs: number;
  /** Maximum delay in milliseconds (caps exponential growth) */
  maxDelayMs: number;
  /** Multiplier for exponential backoff (delay *= multiplier each retry) */
  backoffMultiplier: number;
}

/**
 * Default retry configuration with exponential backoff.
 * Provides 3 attempts with delays: 0ms, 100ms, 200ms (total max 300ms overhead).
 */
export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 2000,
  backoffMultiplier: 2,
};

/**
 * Executes an async function with exponential backoff retry logic.
 * Useful for handling transient errors like file locks, temporary I/O failures, etc.
 *
 * @template T - Return type of the function
 * @param {() => Promise<T>} fn - Async function to execute with retry
 * @param {RetryOptions} options - Retry configuration options
 * @param {string} context - Optional context string for logging
 * @returns {Promise<T>} Promise that resolves with function result or rejects after all retries exhausted
 *
 * @example
 * const data = await retryWithBackoff(
 *   async () => await readFile(path),
 *   DEFAULT_RETRY_OPTIONS,
 *   'Read save file'
 * );
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS,
  context?: string,
): Promise<T> {
  let lastError: Error | undefined;
  let delay = options.initialDelayMs;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      const result = await fn();

      // Log successful retry (but not first attempt)
      if (attempt > 1) {
        console.log(
          `[Retry] ${context || 'Operation'} succeeded on attempt ${attempt}/${options.maxAttempts}`,
        );
      }

      return result;
    } catch (error) {
      lastError = error as Error;

      if (attempt < options.maxAttempts) {
        console.warn(
          `[Retry] ${context || 'Operation'} failed (attempt ${attempt}/${options.maxAttempts}), ` +
            `retrying in ${delay}ms...`,
          error,
        );

        // Wait before next attempt
        await new Promise((resolve) => setTimeout(resolve, delay));

        // Exponential backoff: delay *= backoffMultiplier, capped at maxDelay
        delay = Math.min(delay * options.backoffMultiplier, options.maxDelayMs);
      } else {
        console.error(
          `[Retry] ${context || 'Operation'} failed after ${options.maxAttempts} attempts`,
          error,
        );
      }
    }
  }

  // All retries exhausted, throw the last error
  // lastError is guaranteed to be defined because we entered the loop at least once
  if (!lastError) {
    throw new Error('Retry failed with unknown error');
  }
  throw lastError;
}
