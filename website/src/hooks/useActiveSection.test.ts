import { act, renderHook } from '@testing-library/react';
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

    // Act
    window.dispatchEvent(new Event('scroll'));
    unmount();

    // Assert
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(scrollListener).toBeDefined();
    expect(resizeListener).toBeDefined();
    expect(removeEventListener).toHaveBeenCalledWith('scroll', scrollListener);
    expect(removeEventListener).toHaveBeenCalledWith('resize', resizeListener);
    expect(cancelAnimationFrame).toHaveBeenCalledWith(frameId);
  });

  it('If scroll and resize events fire while a measurement is already pending, then only one frame is requested and one measurement is taken', () => {
    // Arrange
    document.body.innerHTML = '<section id="features"></section>';
    const section = document.getElementById('features') as HTMLElement;
    const getBoundingClientRect = vi.spyOn(section, 'getBoundingClientRect');
    let runFrame: FrameRequestCallback | undefined;
    const requestAnimationFrame = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        runFrame = callback;
        return 1;
      });
    renderHook(() => useActiveSection(['features']));
    getBoundingClientRect.mockClear();

    // Act
    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('resize'));
    const measurementsBeforeFrame = getBoundingClientRect.mock.calls.length;
    act(() => runFrame?.(0));

    // Assert
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(measurementsBeforeFrame).toBe(0);
    expect(getBoundingClientRect).toHaveBeenCalledTimes(1);
  });

  it('If a measurement frame has run, then the next scroll event requests a new frame', () => {
    // Arrange
    document.body.innerHTML = '<section id="features"></section>';
    let runFrame: FrameRequestCallback | undefined;
    const requestAnimationFrame = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        runFrame = callback;
        return 1;
      });
    renderHook(() => useActiveSection(['features']));
    window.dispatchEvent(new Event('scroll'));
    act(() => runFrame?.(0));

    // Act
    window.dispatchEvent(new Event('scroll'));

    // Assert
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
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
