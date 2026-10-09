import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCurrentDay } from './useCurrentDay';

describe('When useCurrentDay is used', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 5, 15, 23, 59, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('If time passes within the same day', () => {
    it('Then the day key stays the same', () => {
      // Arrange
      const { result } = renderHook(() => useCurrentDay());
      const before = result.current;

      // Act
      act(() => {
        vi.advanceTimersByTime(30_000);
      });

      // Assert
      expect(result.current).toBe(before);
    });
  });

  describe('If local midnight passes', () => {
    it('Then the day key changes', () => {
      // Arrange
      const { result } = renderHook(() => useCurrentDay());
      const before = result.current;

      // Act
      act(() => {
        vi.advanceTimersByTime(61_000);
      });

      // Assert
      expect(result.current).not.toBe(before);
    });

    it('Then the next midnight is scheduled as well', () => {
      // Arrange
      const { result } = renderHook(() => useCurrentDay());
      act(() => {
        vi.advanceTimersByTime(61_000);
      });
      const afterFirstMidnight = result.current;

      // Act
      act(() => {
        vi.advanceTimersByTime(24 * 60 * 60 * 1000);
      });

      // Assert
      expect(result.current).not.toBe(afterFirstMidnight);
    });
  });

  describe('If the component using it unmounts', () => {
    it('Then no timer is left running', () => {
      // Arrange
      const { unmount } = renderHook(() => useCurrentDay());
      expect(vi.getTimerCount()).toBe(1);

      // Act
      unmount();

      // Assert
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
