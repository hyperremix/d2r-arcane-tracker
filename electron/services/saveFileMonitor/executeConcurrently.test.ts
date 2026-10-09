import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeConcurrently } from './executeConcurrently';

describe('When concurrent file parsing is used', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Then should execute all tasks with concurrency limit', async () => {
    // Arrange
    let maxConcurrent = 0;
    let currentConcurrent = 0;
    const taskCount = 10;
    const limit = 3;

    const tasks = Array.from({ length: taskCount }, (_, i) => {
      return async () => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        // Simulate async work
        await new Promise((resolve) => setTimeout(resolve, 10));
        currentConcurrent--;
        return i;
      };
    });

    // Act
    const pending = executeConcurrently(tasks, limit);
    // 10 tasks at 3 at a time take 4 rounds of 10 ms
    await vi.advanceTimersByTimeAsync(40);
    const results = await pending;

    // Assert
    expect(results).toHaveLength(taskCount);
    expect(maxConcurrent).toBeLessThanOrEqual(limit);
    expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('Then should preserve result order', async () => {
    // Arrange
    const tasks = [
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 'first';
      },
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'second';
      },
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        return 'third';
      },
    ];

    // Act
    const pending = executeConcurrently(tasks, 5);
    await vi.advanceTimersByTimeAsync(50);
    const results = await pending;

    // Assert - results should be in original order despite different completion times
    expect(results).toEqual(['first', 'second', 'third']);
  });

  it('Then should handle errors in individual tasks gracefully', async () => {
    // Arrange
    const tasks = [
      async () => 'success1',
      async () => {
        throw new Error('Task failed');
      },
      async () => 'success2',
    ];

    // Act
    const results = await executeConcurrently(tasks, 5);

    // Assert - successful tasks should complete, failed task returns undefined
    expect(results[0]).toBe('success1');
    expect(results[1]).toBeUndefined();
    expect(results[2]).toBe('success2');
  });

  it('Then should work with limit greater than task count', async () => {
    // Arrange
    const tasks = [async () => 1, async () => 2, async () => 3];

    // Act
    const results = await executeConcurrently(tasks, 10);

    // Assert
    expect(results).toEqual([1, 2, 3]);
  });

  it('Then should work with limit of 1 (sequential execution)', async () => {
    // Arrange
    let maxConcurrent = 0;
    let currentConcurrent = 0;
    const tasks = Array.from({ length: 5 }, (_, i) => {
      return async () => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        await new Promise((resolve) => setTimeout(resolve, 10));
        currentConcurrent--;
        return i;
      };
    });

    // Act
    const pending = executeConcurrently(tasks, 1);
    // 5 tasks one at a time take 5 rounds of 10 ms
    await vi.advanceTimersByTimeAsync(50);
    const results = await pending;

    // Assert - should execute sequentially (max 1 at a time)
    expect(maxConcurrent).toBe(1);
    expect(results).toEqual([0, 1, 2, 3, 4]);
  });

  it('Then should work with empty task array', async () => {
    // Arrange
    const tasks: Array<() => Promise<number>> = [];

    // Act
    const results = await executeConcurrently(tasks, 5);

    // Assert
    expect(results).toEqual([]);
  });
});
