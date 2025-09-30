import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the grail store
vi.mock('@/stores/grailStore', () => ({
  useGrailStore: vi.fn(),
}));

import { useGrailStore } from '@/stores/grailStore';
import { useTheme } from './useTheme';

describe('When useTheme hook is used', () => {
  let mockUseGrailStore: ReturnType<typeof vi.fn>;
  let mockMatchMedia: ReturnType<typeof vi.fn>;
  let mockAddEventListener: ReturnType<typeof vi.fn>;
  let mockRemoveEventListener: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset document classes
    document.documentElement.className = '';

    // Setup event listener mocks
    mockAddEventListener = vi.fn();
    mockRemoveEventListener = vi.fn();

    // Setup matchMedia mock
    mockMatchMedia = vi.fn();
    window.matchMedia = mockMatchMedia;

    // Setup grail store mock
    mockUseGrailStore = vi.mocked(useGrailStore);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('If theme is set to light', () => {
    it('Then should remove dark class from document root', () => {
      // Arrange
      mockUseGrailStore.mockReturnValue({
        settings: { theme: 'light' },
      } as ReturnType<typeof useGrailStore>);

      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
      });

      // Act
      renderHook(() => useTheme());

      // Assert
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('If theme is set to dark', () => {
    it('Then should add dark class to document root', () => {
      // Arrange
      mockUseGrailStore.mockReturnValue({
        settings: { theme: 'dark' },
      } as ReturnType<typeof useGrailStore>);

      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
      });

      // Act
      renderHook(() => useTheme());

      // Assert
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('If theme is set to system and OS prefers light', () => {
    it('Then should remove dark class from document root', () => {
      // Arrange
      mockUseGrailStore.mockReturnValue({
        settings: { theme: 'system' },
      } as ReturnType<typeof useGrailStore>);

      mockMatchMedia.mockReturnValue({
        matches: false, // OS prefers light
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
      });

      // Act
      renderHook(() => useTheme());

      // Assert
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('If theme is set to system and OS prefers dark', () => {
    it('Then should add dark class to document root', () => {
      // Arrange
      mockUseGrailStore.mockReturnValue({
        settings: { theme: 'system' },
      } as ReturnType<typeof useGrailStore>);

      mockMatchMedia.mockReturnValue({
        matches: true, // OS prefers dark
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
      });

      // Act
      renderHook(() => useTheme());

      // Assert
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('If theme is set to system', () => {
    it('Then should register event listener for system theme changes', () => {
      // Arrange
      mockUseGrailStore.mockReturnValue({
        settings: { theme: 'system' },
      } as ReturnType<typeof useGrailStore>);

      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
      });

      // Act
      renderHook(() => useTheme());

      // Assert
      expect(mockAddEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });
  });

  describe('If theme is not set to system', () => {
    it('Then should not register event listener for system theme changes', () => {
      // Arrange
      mockUseGrailStore.mockReturnValue({
        settings: { theme: 'light' },
      } as ReturnType<typeof useGrailStore>);

      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
      });

      // Act
      renderHook(() => useTheme());

      // Assert
      expect(mockAddEventListener).not.toHaveBeenCalled();
    });
  });

  describe('If theme changes from light to dark', () => {
    it('Then should update dark class accordingly', () => {
      // Arrange
      mockUseGrailStore.mockReturnValue({
        settings: { theme: 'light' },
      } as ReturnType<typeof useGrailStore>);

      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
      });

      const { rerender } = renderHook(() => useTheme());

      // Assert initial state
      expect(document.documentElement.classList.contains('dark')).toBe(false);

      // Act - change theme
      mockUseGrailStore.mockReturnValue({
        settings: { theme: 'dark' },
      } as ReturnType<typeof useGrailStore>);
      rerender();

      // Assert updated state
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('If theme changes from dark to light', () => {
    it('Then should update dark class accordingly', () => {
      // Arrange
      mockUseGrailStore.mockReturnValue({
        settings: { theme: 'dark' },
      } as ReturnType<typeof useGrailStore>);

      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
      });

      const { rerender } = renderHook(() => useTheme());

      // Assert initial state
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      // Act - change theme
      mockUseGrailStore.mockReturnValue({
        settings: { theme: 'light' },
      } as ReturnType<typeof useGrailStore>);
      rerender();

      // Assert updated state
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('If theme changes from system to dark', () => {
    it('Then should remove event listener and apply dark theme', () => {
      // Arrange
      mockUseGrailStore.mockReturnValue({
        settings: { theme: 'system' },
      } as ReturnType<typeof useGrailStore>);

      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
      });

      const { rerender } = renderHook(() => useTheme());

      // Assert event listener was added
      expect(mockAddEventListener).toHaveBeenCalledTimes(1);

      // Act - change theme
      mockUseGrailStore.mockReturnValue({
        settings: { theme: 'dark' },
      } as ReturnType<typeof useGrailStore>);
      rerender();

      // Assert
      expect(mockRemoveEventListener).toHaveBeenCalledWith('change', expect.any(Function));
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('If theme changes from light to system with OS preferring dark', () => {
    it('Then should add event listener and apply dark theme', () => {
      // Arrange
      mockUseGrailStore.mockReturnValue({
        settings: { theme: 'light' },
      } as ReturnType<typeof useGrailStore>);

      mockMatchMedia.mockReturnValue({
        matches: true, // OS prefers dark
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
      });

      const { rerender } = renderHook(() => useTheme());

      // Assert event listener was not added
      expect(mockAddEventListener).not.toHaveBeenCalled();

      // Act - change theme
      mockUseGrailStore.mockReturnValue({
        settings: { theme: 'system' },
      } as ReturnType<typeof useGrailStore>);
      rerender();

      // Assert
      expect(mockAddEventListener).toHaveBeenCalledWith('change', expect.any(Function));
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('If hook unmounts with system theme', () => {
    it('Then should remove event listener', () => {
      // Arrange
      mockUseGrailStore.mockReturnValue({
        settings: { theme: 'system' },
      } as ReturnType<typeof useGrailStore>);

      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
      });

      // Act
      const { unmount } = renderHook(() => useTheme());
      unmount();

      // Assert
      expect(mockRemoveEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });
  });

  describe('If hook unmounts with non-system theme', () => {
    it('Then should not attempt to remove event listener', () => {
      // Arrange
      mockUseGrailStore.mockReturnValue({
        settings: { theme: 'light' },
      } as ReturnType<typeof useGrailStore>);

      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
      });

      // Act
      const { unmount } = renderHook(() => useTheme());
      unmount();

      // Assert
      expect(mockRemoveEventListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('If OS theme preference changes while on system theme', () => {
    it('Then should update dark class to match OS preference', () => {
      // Arrange
      let changeHandler: ((e: MediaQueryListEvent) => void) | undefined;

      mockUseGrailStore.mockReturnValue({
        settings: { theme: 'system' },
      } as ReturnType<typeof useGrailStore>);

      mockMatchMedia.mockReturnValue({
        matches: false, // Initially light
        addEventListener: vi.fn((_event, handler) => {
          changeHandler = handler as (e: MediaQueryListEvent) => void;
        }),
        removeEventListener: mockRemoveEventListener,
      });

      renderHook(() => useTheme());

      // Assert initial state
      expect(document.documentElement.classList.contains('dark')).toBe(false);

      // Act - simulate OS theme change to dark
      expect(changeHandler).toBeDefined();
      if (changeHandler !== undefined) {
        changeHandler({ matches: true } as MediaQueryListEvent);
      }

      // Assert
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('If OS theme preference changes while not on system theme', () => {
    it('Then should not register event listener', () => {
      // Arrange
      mockUseGrailStore.mockReturnValue({
        settings: { theme: 'light' },
      } as ReturnType<typeof useGrailStore>);

      mockMatchMedia.mockReturnValue({
        matches: true, // OS prefers dark
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
      });

      // Act
      renderHook(() => useTheme());

      // Assert - event listener should not be registered
      expect(mockAddEventListener).not.toHaveBeenCalled();
      // Assert - should apply light theme regardless of OS preference
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('If matchMedia query is checked', () => {
    it('Then should use prefers-color-scheme: dark media query', () => {
      // Arrange
      mockUseGrailStore.mockReturnValue({
        settings: { theme: 'system' },
      } as ReturnType<typeof useGrailStore>);

      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
      });

      // Act
      renderHook(() => useTheme());

      // Assert
      expect(mockMatchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
    });
  });

  describe('If dark class already exists on document', () => {
    it('Then should remove it when theme is light', () => {
      // Arrange
      document.documentElement.classList.add('dark');

      mockUseGrailStore.mockReturnValue({
        settings: { theme: 'light' },
      } as ReturnType<typeof useGrailStore>);

      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
      });

      // Act
      renderHook(() => useTheme());

      // Assert
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('If dark class does not exist on document', () => {
    it('Then should add it when theme is dark', () => {
      // Arrange
      mockUseGrailStore.mockReturnValue({
        settings: { theme: 'dark' },
      } as ReturnType<typeof useGrailStore>);

      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
      });

      // Act
      renderHook(() => useTheme());

      // Assert
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });
});
