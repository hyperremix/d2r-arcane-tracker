import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHashSelection } from './useHashSelection';

const IDS = ['first', 'second'] as const;

describe('When the hash selection hook is mounted', () => {
  const scrollIntoViewMock = vi.fn();
  const originalScrollIntoView = Element.prototype.scrollIntoView;

  beforeEach(() => {
    scrollIntoViewMock.mockClear();
    Element.prototype.scrollIntoView = scrollIntoViewMock;
    document.body.innerHTML = '<div id="first"></div><div id="second"></div>';
  });

  afterEach(() => {
    Element.prototype.scrollIntoView = originalScrollIntoView;
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('If the same id is shown twice, then its element is scrolled into view both times', () => {
    // Arrange
    const { result } = renderHook(() => useHashSelection(IDS, 'first'));

    // Act
    act(() => result.current.show('second'));
    act(() => result.current.show('second'));

    // Assert
    expect(result.current.selected).toBe('second');
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(2);
    expect(scrollIntoViewMock.mock.contexts).toEqual([
      document.getElementById('second'),
      document.getElementById('second'),
    ]);
  });

  it('If an id is selected, then it is not scrolled into view', () => {
    // Arrange
    const { result } = renderHook(() => useHashSelection(IDS, 'first'));

    // Act
    act(() => result.current.select('second'));

    // Assert
    expect(result.current.selected).toBe('second');
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  it('If the hook is unmounted, then its hashchange listener is removed', () => {
    // Arrange
    const addEventListener = vi.spyOn(window, 'addEventListener');
    const removeEventListener = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useHashSelection(IDS, 'first'));
    const listener = addEventListener.mock.calls.find(([type]) => type === 'hashchange')?.[1];

    // Act
    unmount();

    // Assert
    expect(listener).toBeDefined();
    expect(removeEventListener).toHaveBeenCalledWith('hashchange', listener);
  });
});
