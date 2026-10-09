import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initGrailData } from '@/stores/grailStore';
import { useSettingsLanguage } from './useSettingsLanguage';
import { useTheme } from './useTheme';
import { useWindowBootstrap } from './useWindowBootstrap';

vi.mock('@/stores/grailStore', () => ({ initGrailData: vi.fn() }));
vi.mock('./useSettingsLanguage', () => ({ useSettingsLanguage: vi.fn() }));
vi.mock('./useTheme', () => ({ useTheme: vi.fn() }));

describe('When useWindowBootstrap is used', () => {
  const cleanupGrailData = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(initGrailData).mockReturnValue(cleanupGrailData);
  });

  it('If no options are given, Then the grail data is loaded without following settings broadcasts', () => {
    // Arrange & Act
    renderHook(() => useWindowBootstrap());

    // Assert
    expect(initGrailData).toHaveBeenCalledTimes(1);
    expect(initGrailData).toHaveBeenCalledWith({ followSettingsUpdates: false });
  });

  it('If settings updates are followed, Then the option is passed on to the grail data', () => {
    // Arrange & Act
    renderHook(() => useWindowBootstrap({ followSettingsUpdates: true }));

    // Assert
    expect(initGrailData).toHaveBeenCalledWith({ followSettingsUpdates: true });
  });

  it('Then the theme and language are applied', () => {
    // Arrange & Act
    renderHook(() => useWindowBootstrap());

    // Assert
    expect(useTheme).toHaveBeenCalled();
    expect(useSettingsLanguage).toHaveBeenCalled();
  });

  it('If the window re-renders and then unmounts, Then the grail data is loaded once and cleaned up', () => {
    // Arrange
    const { rerender, unmount } = renderHook(() => useWindowBootstrap());

    // Act
    rerender();
    unmount();

    // Assert
    expect(initGrailData).toHaveBeenCalledTimes(1);
    expect(cleanupGrailData).toHaveBeenCalledTimes(1);
  });
});
