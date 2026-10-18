import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedValue } from './useDebouncedValue';

const DELAY_MS = 100;

describe('When useDebouncedValue is used', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('If it is rendered for the first time, Then the first value is returned immediately', () => {
    // Arrange & Act
    const { result } = renderHook(() => useDebouncedValue(5, DELAY_MS));

    // Assert
    expect(result.current).toBe(5);
  });

  it('If the value changes several times within the delay, Then only the last one is returned after the delay', () => {
    // Arrange
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, DELAY_MS), {
      initialProps: { value: 1 },
    });

    // Act
    rerender({ value: 2 });
    act(() => {
      vi.advanceTimersByTime(DELAY_MS - 1);
    });
    rerender({ value: 3 });
    act(() => {
      vi.advanceTimersByTime(DELAY_MS - 1);
    });
    const beforeDelay = result.current;
    act(() => {
      vi.advanceTimersByTime(1);
    });

    // Assert
    expect(beforeDelay).toBe(1);
    expect(result.current).toBe(3);
  });

  it('If the component unmounts while a change is pending, Then no timer is left', () => {
    // Arrange
    const { rerender, unmount } = renderHook(({ value }) => useDebouncedValue(value, DELAY_MS), {
      initialProps: { value: 1 },
    });
    rerender({ value: 2 });

    // Act
    unmount();

    // Assert
    expect(vi.getTimerCount()).toBe(0);
  });
});
