import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedCallback } from './useDebouncedCallback';

const DELAY_MS = 100;

describe('When useDebouncedCallback is used', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('If it is called several times within the delay', () => {
    it('Then the callback runs once with the last arguments after the delay', () => {
      // Arrange
      const callback = vi.fn();
      const { result } = renderHook(() => useDebouncedCallback(callback, DELAY_MS));

      // Act
      act(() => {
        result.current('a');
        vi.advanceTimersByTime(DELAY_MS - 1);
        result.current('b');
      });
      const pendingBeforeDelay = result.current.isPending();
      act(() => {
        vi.advanceTimersByTime(DELAY_MS);
      });

      // Assert
      expect(pendingBeforeDelay).toBe(true);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('b');
      expect(result.current.isPending()).toBe(false);
    });
  });

  describe('If a pending call is cancelled', () => {
    it('Then the callback does not run', () => {
      // Arrange
      const callback = vi.fn();
      const { result } = renderHook(() => useDebouncedCallback(callback, DELAY_MS));
      act(() => result.current('a'));

      // Act
      act(() => {
        result.current.cancel();
        vi.advanceTimersByTime(DELAY_MS);
      });

      // Assert
      expect(callback).not.toHaveBeenCalled();
      expect(result.current.isPending()).toBe(false);
    });
  });

  describe('If a pending call is flushed', () => {
    it('Then the callback runs immediately and only once', () => {
      // Arrange
      const callback = vi.fn();
      const { result } = renderHook(() => useDebouncedCallback(callback, DELAY_MS));
      act(() => result.current('a'));

      // Act
      act(() => {
        result.current.flush();
        vi.advanceTimersByTime(DELAY_MS);
      });

      // Assert
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('a');
    });
  });

  describe('If the component re-renders with a new callback', () => {
    it('Then the function keeps its identity and calls the latest callback', () => {
      // Arrange
      const first = vi.fn();
      const second = vi.fn();
      const { result, rerender } = renderHook(
        ({ callback }) => useDebouncedCallback(callback, DELAY_MS),
        { initialProps: { callback: first } },
      );
      const debounced = result.current;

      // Act
      rerender({ callback: second });
      act(() => {
        result.current('a');
        vi.advanceTimersByTime(DELAY_MS);
      });

      // Assert
      expect(result.current).toBe(debounced);
      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledWith('a');
    });
  });

  describe('If the component unmounts with a pending call', () => {
    it('Then the call is dropped by default', () => {
      // Arrange
      const callback = vi.fn();
      const { result, unmount } = renderHook(() => useDebouncedCallback(callback, DELAY_MS));
      act(() => result.current('a'));

      // Act
      unmount();
      vi.advanceTimersByTime(DELAY_MS);

      // Assert
      expect(callback).not.toHaveBeenCalled();
    });

    it('Then the call runs immediately if flushOnUnmount is set', () => {
      // Arrange
      const callback = vi.fn();
      const { result, unmount } = renderHook(() =>
        useDebouncedCallback(callback, DELAY_MS, { flushOnUnmount: true }),
      );
      act(() => result.current('a'));

      // Act
      unmount();

      // Assert
      expect(callback).toHaveBeenCalledWith('a');
    });
  });
});
