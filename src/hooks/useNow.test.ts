import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNow } from './useNow';

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('When enabled, Then the timestamp advances every interval', () => {
    // Arrange
    const start = Date.now();
    const { result } = renderHook(() => useNow(true));

    // Act
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Assert
    expect(result.current).toBe(start + 3000);
  });

  it('If disabled, Then the timestamp does not change', () => {
    // Arrange
    const start = Date.now();
    const { result } = renderHook(() => useNow(false));

    // Act
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // Assert
    expect(result.current).toBe(start);
  });

  it('When unmounted, Then the interval is cleared and no further ticks are scheduled', () => {
    // Arrange
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    const { unmount } = renderHook(() => useNow(true));
    const pendingTimersBeforeUnmount = vi.getTimerCount();

    // Act
    unmount();
    vi.advanceTimersByTime(3000);

    // Assert
    expect(pendingTimersBeforeUnmount).toBe(1);
    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    clearIntervalSpy.mockRestore();
  });
});
