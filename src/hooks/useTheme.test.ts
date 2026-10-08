import { act, renderHook } from '@testing-library/react';
import type { Settings } from 'electron/types/grail';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the grail store
vi.mock('@/stores/grailStore', () => ({
  useGrailStore: vi.fn(),
}));

import { THEME_PREFERENCE_STORAGE_KEY } from '@/lib/theme';
import { useGrailStore } from '@/stores/grailStore';
import { useResolvedTheme, useTheme } from './useTheme';

interface MockStoreState {
  settings: Pick<Settings, 'theme'>;
  settingsHydrated: boolean;
}

/**
 * Makes the mocked store answer selectors from the given theme state.
 */
function mockStore(theme: Settings['theme'], settingsHydrated = true): void {
  const state: MockStoreState = { settings: { theme }, settingsHydrated };
  vi.mocked(useGrailStore).mockImplementation(((selector: (s: MockStoreState) => unknown) =>
    selector(state)) as unknown as typeof useGrailStore);
}

describe('When useTheme hook is used', () => {
  let mockMatchMedia: ReturnType<typeof vi.fn>;
  const originalMatchMedia = window.matchMedia;
  let mockAddEventListener: ReturnType<typeof vi.fn>;
  let mockRemoveEventListener: ReturnType<typeof vi.fn>;

  /**
   * Makes matchMedia report the given OS dark preference.
   */
  function mockSystemPrefersDark(matches: boolean): void {
    mockMatchMedia.mockReturnValue({
      matches,
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener,
    });
  }

  beforeEach(() => {
    // Reset document classes and the startup theme cache
    document.documentElement.className = '';
    localStorage.removeItem(THEME_PREFERENCE_STORAGE_KEY);

    // Setup event listener mocks
    mockAddEventListener = vi.fn();
    mockRemoveEventListener = vi.fn();

    // Setup matchMedia mock
    mockMatchMedia = vi.fn();
    window.matchMedia = mockMatchMedia;
    mockSystemPrefersDark(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem(THEME_PREFERENCE_STORAGE_KEY);
    // Tests share one window (isolate: false), so don't leak the mock to other files
    window.matchMedia = originalMatchMedia;
  });

  describe('If theme is set to light', () => {
    it('Then should remove dark class from document root', () => {
      // Arrange
      mockStore('light');

      // Act
      renderHook(() => useTheme());

      // Assert
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('If theme is set to dark', () => {
    it('Then should add dark class to document root', () => {
      // Arrange
      mockStore('dark');

      // Act
      renderHook(() => useTheme());

      // Assert
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('If theme is set to system with OS preferring dark', () => {
    it('Then should add dark class to document root', () => {
      // Arrange
      mockStore('system');
      mockSystemPrefersDark(true);

      // Act
      renderHook(() => useTheme());

      // Assert
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('If theme is set to system with OS preferring light', () => {
    it('Then should remove dark class from document root', () => {
      // Arrange
      document.documentElement.classList.add('dark');
      mockStore('system');
      mockSystemPrefersDark(false);

      // Act
      renderHook(() => useTheme());

      // Assert
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('If theme is set to system', () => {
    it('Then should listen for OS preference changes via the dark color scheme query', () => {
      // Arrange
      mockStore('system');

      // Act
      renderHook(() => useTheme());

      // Assert
      expect(mockMatchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
      expect(mockAddEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });
  });

  describe('If theme is not set to system', () => {
    it('Then should not register an OS preference listener', () => {
      // Arrange
      mockStore('light');
      mockSystemPrefersDark(true);

      // Act
      renderHook(() => useTheme());

      // Assert
      expect(mockAddEventListener).not.toHaveBeenCalled();
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('If theme changes from light to dark', () => {
    it('Then should update dark class accordingly', () => {
      // Arrange
      mockStore('light');
      const { rerender } = renderHook(() => useTheme());
      expect(document.documentElement.classList.contains('dark')).toBe(false);

      // Act
      mockStore('dark');
      rerender();

      // Assert
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('If theme changes from dark to light', () => {
    it('Then should update dark class accordingly', () => {
      // Arrange
      mockStore('dark');
      const { rerender } = renderHook(() => useTheme());
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      // Act
      mockStore('light');
      rerender();

      // Assert
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('If theme changes from system to dark', () => {
    it('Then should remove the OS preference listener and apply dark theme', () => {
      // Arrange
      mockStore('system');
      const { rerender } = renderHook(() => useTheme());
      expect(mockAddEventListener).toHaveBeenCalledTimes(1);

      // Act
      mockStore('dark');
      rerender();

      // Assert
      expect(mockRemoveEventListener).toHaveBeenCalledWith('change', expect.any(Function));
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('If theme changes from light to system with OS preferring dark', () => {
    it('Then should add the OS preference listener and apply dark theme', () => {
      // Arrange
      mockStore('light');
      mockSystemPrefersDark(true);
      const { rerender } = renderHook(() => useTheme());
      expect(mockAddEventListener).not.toHaveBeenCalled();

      // Act
      mockStore('system');
      rerender();

      // Assert
      expect(mockAddEventListener).toHaveBeenCalledWith('change', expect.any(Function));
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('If hook unmounts with system theme', () => {
    it('Then should remove the OS preference listener', () => {
      // Arrange
      mockStore('system');
      const { unmount } = renderHook(() => useTheme());

      // Act
      unmount();

      // Assert
      expect(mockRemoveEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });
  });

  describe('If OS theme preference changes while on system theme', () => {
    it('Then should update dark class to match OS preference', () => {
      // Arrange
      let changeHandler: ((e: MediaQueryListEvent) => void) | undefined;
      mockStore('system');
      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: vi.fn((_event, handler) => {
          changeHandler = handler as (e: MediaQueryListEvent) => void;
        }),
        removeEventListener: mockRemoveEventListener,
      });
      renderHook(() => useTheme());
      expect(document.documentElement.classList.contains('dark')).toBe(false);

      // Act
      act(() => {
        changeHandler?.({ matches: true } as MediaQueryListEvent);
      });

      // Assert
      expect(changeHandler).toBeDefined();
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('If settings have loaded with an explicit theme', () => {
    it('Then should cache that preference for the next startup', () => {
      // Arrange
      mockStore('dark');

      // Act
      renderHook(() => useTheme());

      // Assert
      expect(localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)).toBe('dark');
    });
  });

  describe('If settings have loaded with the system theme and the OS prefers dark', () => {
    it('Then should cache system rather than the resolved dark theme', () => {
      // Arrange
      mockStore('system');
      mockSystemPrefersDark(true);

      // Act
      renderHook(() => useTheme());

      // Assert
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)).toBe('system');
    });
  });

  describe('If settings have not loaded yet and an explicit theme was cached', () => {
    it('Then should keep the cached theme instead of the default and not overwrite the cache', () => {
      // Arrange
      localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, 'dark');
      mockStore('system', false);
      mockSystemPrefersDark(false);

      // Act
      renderHook(() => useTheme());

      // Assert
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)).toBe('dark');
    });
  });

  describe('If settings have not loaded yet and system was cached while the OS now prefers light', () => {
    it('Then should re-resolve against the current OS preference', () => {
      // Arrange
      localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, 'system');
      document.documentElement.classList.add('dark');
      mockStore('system', false);
      mockSystemPrefersDark(false);

      // Act
      renderHook(() => useTheme());

      // Assert
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)).toBe('system');
    });
  });

  describe('If settings have not loaded yet and nothing was cached', () => {
    it('Then should follow the OS preference without caching it', () => {
      // Arrange
      mockStore('system', false);
      mockSystemPrefersDark(true);

      // Act
      renderHook(() => useTheme());

      // Assert
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)).toBeNull();
    });
  });

  describe('If settings load after startup with a different theme than cached', () => {
    it('Then should switch to the loaded theme and update the cache', () => {
      // Arrange
      localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, 'dark');
      mockStore('system', false);
      const { rerender } = renderHook(() => useTheme());
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      // Act
      mockStore('light', true);
      rerender();

      // Assert
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)).toBe('light');
    });
  });

  describe('If running on Windows', () => {
    const originalElectronAPI = window.electronAPI;

    afterEach(() => {
      window.electronAPI = originalElectronAPI;
    });

    it('Then should update the title bar overlay colors to match the theme', () => {
      // Arrange
      const updateTitleBarOverlay = vi.fn();
      window.electronAPI = {
        platform: 'win32',
        updateTitleBarOverlay,
      } as unknown as typeof window.electronAPI;
      mockStore('light');

      // Act
      renderHook(() => useTheme());

      // Assert
      expect(updateTitleBarOverlay).toHaveBeenCalledWith({
        backgroundColor: '#ffffff',
        symbolColor: '#000000',
      });
    });
  });
});

describe('When useResolvedTheme hook is used', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    localStorage.removeItem(THEME_PREFERENCE_STORAGE_KEY);
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    window.matchMedia = originalMatchMedia;
  });

  describe('If theme is system and the OS prefers dark', () => {
    it('Then should resolve to dark', () => {
      // Arrange
      mockStore('system');

      // Act
      const { result } = renderHook(() => useResolvedTheme());

      // Assert
      expect(result.current).toBe('dark');
    });
  });

  describe('If theme is light and the OS prefers dark', () => {
    it('Then should resolve to light', () => {
      // Arrange
      mockStore('light');

      // Act
      const { result } = renderHook(() => useResolvedTheme());

      // Assert
      expect(result.current).toBe('light');
    });
  });

  describe('If matchMedia is unavailable', () => {
    it('Then should resolve system to light without throwing', () => {
      // Arrange
      window.matchMedia = undefined as unknown as typeof window.matchMedia;
      mockStore('system');

      // Act
      const { result } = renderHook(() => useResolvedTheme());

      // Assert
      expect(result.current).toBe('light');
    });
  });
});
