import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useActiveSection } from './useActiveSection';

describe('When the active section hook is mounted', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('If none of the sections exist on the page, then no section is active and no listeners are added', () => {
    // Arrange
    const addEventListener = vi.spyOn(window, 'addEventListener');

    // Act
    const { result } = renderHook(() => useActiveSection(['missing']));

    // Assert
    expect(result.current).toBeUndefined();
    expect(addEventListener).not.toHaveBeenCalledWith(
      'scroll',
      expect.any(Function),
      expect.anything(),
    );
    expect(addEventListener).not.toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('If the hook is unmounted with a measurement pending, then its listeners are removed and the frame is cancelled', () => {
    // Arrange
    document.body.innerHTML = '<section id="features"></section>';
    const frameId = 42;
    const requestAnimationFrame = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockReturnValue(frameId);
    const cancelAnimationFrame = vi
      .spyOn(window, 'cancelAnimationFrame')
      .mockReturnValue(undefined);
    const addEventListener = vi.spyOn(window, 'addEventListener');
    const removeEventListener = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useActiveSection(['features']));
    const scrollListener = addEventListener.mock.calls.find(([type]) => type === 'scroll')?.[1];
    const resizeListener = addEventListener.mock.calls.find(([type]) => type === 'resize')?.[1];
    window.dispatchEvent(new Event('scroll'));
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);

    // Act
    unmount();

    // Assert
    expect(scrollListener).toBeDefined();
    expect(resizeListener).toBeDefined();
    expect(removeEventListener).toHaveBeenCalledWith('scroll', scrollListener);
    expect(removeEventListener).toHaveBeenCalledWith('resize', resizeListener);
    expect(cancelAnimationFrame).toHaveBeenCalledWith(frameId);
  });

  it('If the hook is unmounted with no measurement pending, then no frame is cancelled', () => {
    // Arrange
    document.body.innerHTML = '<section id="features"></section>';
    const cancelAnimationFrame = vi.spyOn(window, 'cancelAnimationFrame');
    const { unmount } = renderHook(() => useActiveSection(['features']));

    // Act
    unmount();

    // Assert
    expect(cancelAnimationFrame).not.toHaveBeenCalled();
  });
});
