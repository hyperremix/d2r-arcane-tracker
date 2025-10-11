import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_RETRY_OPTIONS, type RetryOptions, retryWithBackoff } from './retry';

describe('When retryWithBackoff is used', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('If operation succeeds on first attempt', () => {
    it('Then should return result without retry', async () => {
      // Arrange
      const mockFn = vi.fn().mockResolvedValue('success');

      // Act
      const promise = retryWithBackoff(mockFn, DEFAULT_RETRY_OPTIONS, 'Test operation');
      await vi.runAllTimersAsync();
      const result = await promise;

      // Assert
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('If operation succeeds on second attempt', () => {
    it('Then should retry once with initial delay', async () => {
      // Arrange
      let attemptCount = 0;
      const mockFn = vi.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('Transient error');
        }
        return 'success';
      });

      // Act
      const promise = retryWithBackoff(mockFn, DEFAULT_RETRY_OPTIONS, 'Test operation');
      await vi.runAllTimersAsync();
      const result = await promise;

      // Assert
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('If operation succeeds on third attempt', () => {
    it('Then should retry twice with exponential backoff', async () => {
      // Arrange
      let attemptCount = 0;
      const mockFn = vi.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Transient error');
        }
        return 'success';
      });

      // Act
      const promise = retryWithBackoff(mockFn, DEFAULT_RETRY_OPTIONS, 'Test operation');
      await vi.runAllTimersAsync();
      const result = await promise;

      // Assert
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });
  });

  describe('If operation fails all attempts', () => {
    it('Then should throw last error after max attempts', async () => {
      // Arrange
      const testError = new Error('Persistent error');
      const mockFn = vi.fn().mockRejectedValue(testError);

      // Act & Assert
      const promise = retryWithBackoff(mockFn, DEFAULT_RETRY_OPTIONS, 'Test operation');

      // Run timers and await the rejection
      const timerPromise = vi.runAllTimersAsync();
      await expect(promise).rejects.toThrow('Persistent error');
      await timerPromise;

      expect(mockFn).toHaveBeenCalledTimes(3);
    });
  });

  describe('If exponential backoff is used', () => {
    it('Then should increase delay by backoff multiplier', async () => {
      // Arrange
      const delays: number[] = [];
      let attemptCount = 0;
      const mockFn = vi.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 4) {
          throw new Error('Retry needed');
        }
        return 'success';
      });

      const customOptions: RetryOptions = {
        maxAttempts: 4,
        initialDelayMs: 100,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
      };

      // Act
      const promise = retryWithBackoff(mockFn, customOptions, 'Backoff test');

      // Manually advance timers and track delays
      // Attempt 1: immediate
      await vi.advanceTimersByTimeAsync(0);
      // Attempt 2: after 100ms
      delays.push(100);
      await vi.advanceTimersByTimeAsync(100);
      // Attempt 3: after 200ms (100 * 2)
      delays.push(200);
      await vi.advanceTimersByTimeAsync(200);
      // Attempt 4: after 400ms (200 * 2)
      delays.push(400);
      await vi.advanceTimersByTimeAsync(400);

      await promise;

      // Assert - delays follow exponential backoff pattern
      expect(delays).toEqual([100, 200, 400]);
      expect(mockFn).toHaveBeenCalledTimes(4);
    });
  });

  describe('If max delay cap is applied', () => {
    it('Then should not exceed maxDelayMs', async () => {
      // Arrange
      let attemptCount = 0;
      const mockFn = vi.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount < 4) {
          throw new Error('Retry needed');
        }
        return 'success';
      });

      const customOptions: RetryOptions = {
        maxAttempts: 4,
        initialDelayMs: 1000,
        maxDelayMs: 1500, // Cap at 1500ms
        backoffMultiplier: 2,
      };

      // Act
      const promise = retryWithBackoff(mockFn, customOptions, 'Max delay test');
      await vi.runAllTimersAsync();
      await promise;

      // Assert
      expect(mockFn).toHaveBeenCalledTimes(4);
      // Delays should be: 1000, 1500 (capped from 2000), 1500 (capped from 3000)
    });
  });

  describe('If custom retry options are provided', () => {
    it('Then should use custom max attempts', async () => {
      // Arrange
      const mockFn = vi.fn().mockRejectedValue(new Error('Always fails'));
      const customOptions: RetryOptions = {
        maxAttempts: 5,
        initialDelayMs: 50,
        maxDelayMs: 1000,
        backoffMultiplier: 2,
      };

      // Act & Assert
      const promise = retryWithBackoff(mockFn, customOptions, 'Custom attempts test');

      // Run timers and await the rejection
      const timerPromise = vi.runAllTimersAsync();
      await expect(promise).rejects.toThrow('Always fails');
      await timerPromise;

      expect(mockFn).toHaveBeenCalledTimes(5);
    });
  });

  describe('If context is not provided', () => {
    it('Then should use default context in logs', async () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        // Mock console.error to prevent test output pollution
      });
      const mockFn = vi.fn().mockRejectedValue(new Error('Test error'));

      // Act & Assert
      const promise = retryWithBackoff(mockFn, DEFAULT_RETRY_OPTIONS); // No context

      // Run timers and await the rejection
      const timerPromise = vi.runAllTimersAsync();
      await expect(promise).rejects.toThrow('Test error');
      await timerPromise;

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
