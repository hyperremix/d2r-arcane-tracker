import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSpriteIcon } from './useSpriteIcon';

const { getByFilenameMock, useGrailStoreMock } = vi.hoisted(() => ({
  useGrailStoreMock: vi.fn(() => ({
    settings: {
      showItemIcons: true,
    },
  })),
  getByFilenameMock: vi.fn(),
}));

vi.mock('@/stores/grailStore', () => ({
  useGrailStore: useGrailStoreMock,
}));

describe('When useSpriteIcon is used', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGrailStoreMock.mockImplementation(() => ({
      settings: {
        showItemIcons: true,
      },
    }));

    Object.defineProperty(window, 'electronAPI', {
      writable: true,
      value: {
        icon: {
          getByFilename: getByFilenameMock,
        },
      },
    });
  });

  describe('If item icons are disabled in settings', () => {
    it('Then it returns the placeholder icon without loading filename icons', () => {
      // Arrange
      useGrailStoreMock.mockReturnValue({
        settings: {
          showItemIcons: false,
        },
      });

      // Act
      const { result } = renderHook(() => useSpriteIcon('unused.png'));

      // Assert
      expect(result.current.iconsEnabled).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.iconUrl).toMatch(/placeholder-item\.svg|data:image\/svg\+xml/);
      expect(getByFilenameMock).not.toHaveBeenCalled();
    });
  });

  describe('If forced mode is used while global icons are disabled', () => {
    it('Then it resolves and returns a sprite icon', async () => {
      // Arrange
      useGrailStoreMock.mockReturnValue({
        settings: {
          showItemIcons: false,
        },
      });
      const dataUrl = 'data:image/png;base64,forced';
      getByFilenameMock.mockResolvedValue(dataUrl);

      // Act
      const { result } = renderHook(() => useSpriteIcon('forced-icon', { forceEnabled: true }));

      // Assert
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.iconsEnabled).toBe(true);
      expect(result.current.iconUrl).toBe(dataUrl);
    });
  });

  describe('If normalized filename variants are required', () => {
    it('Then it tries normalized candidates until one resolves', async () => {
      // Arrange
      const dataUrl = 'data:image/png;base64,normalized';
      getByFilenameMock.mockImplementation(async (candidate: string) => {
        if (candidate === 'arreatface.png') {
          return dataUrl;
        }

        return undefined;
      });

      // Act
      const { result } = renderHook(() => useSpriteIcon('  ArreatFace  ', { forceEnabled: true }));

      // Assert
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.iconUrl).toBe(dataUrl);
      expect(getByFilenameMock).toHaveBeenCalledWith('arreatface.png');
    });
  });

  describe('If multiple filename candidates are provided', () => {
    it('Then it resolves using later candidates when earlier candidates miss', async () => {
      // Arrange
      const dataUrl = 'data:image/png;base64,fallback';
      getByFilenameMock.mockImplementation(async (candidate: string) => {
        if (candidate === 'war_hammer.png') {
          return dataUrl;
        }

        return undefined;
      });

      // Act
      const { result } = renderHook(() =>
        useSpriteIcon(['invwhm.png', 'war_hammer.png'], { forceEnabled: true }),
      );

      // Assert
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.iconUrl).toBe(dataUrl);
    });
  });

  describe('If placeholder is cached for an early candidate', () => {
    it('Then it retries newly added candidates and resolves a real icon', async () => {
      // Arrange
      const earlyCandidate = `early-candidate-${Date.now()}.png`;
      const lateCandidate = `late-candidate-${Date.now()}.png`;
      const resolvedIcon = 'data:image/png;base64,resolved-after-placeholder';
      getByFilenameMock.mockImplementation(async (candidate: string) => {
        if (candidate === lateCandidate) {
          return resolvedIcon;
        }

        return undefined;
      });

      // Act
      const firstHook = renderHook(() => useSpriteIcon(earlyCandidate, { forceEnabled: true }));
      await waitFor(() => {
        expect(firstHook.result.current.isLoading).toBe(false);
      });
      firstHook.unmount();

      getByFilenameMock.mockClear();

      const secondHook = renderHook(() =>
        useSpriteIcon([earlyCandidate, lateCandidate], { forceEnabled: true }),
      );

      // Assert
      await waitFor(() => {
        expect(secondHook.result.current.iconUrl).toBe(resolvedIcon);
      });
      expect(getByFilenameMock).toHaveBeenCalledWith(lateCandidate);
    });
  });

  describe('If the icon API returns no sprite for a filename', () => {
    it('Then it falls back to the placeholder icon', async () => {
      // Arrange
      getByFilenameMock.mockResolvedValue(undefined);

      // Act
      const { result } = renderHook(() => useSpriteIcon(`missing-icon-${Date.now()}.png`));

      // Assert
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.iconUrl).toMatch(/placeholder-item\.svg|data:image\/svg\+xml/);
    });
  });

  describe('If the same filename is loaded more than once', () => {
    it('Then it serves the cached icon without calling icon API again', async () => {
      // Arrange
      const cachedIcon = 'data:image/png;base64,cachedicon';
      const cacheKey = `cache-hit-${Date.now()}.png`;
      getByFilenameMock.mockResolvedValue(cachedIcon);

      // Act
      const firstHook = renderHook(() => useSpriteIcon(cacheKey, { forceEnabled: true }));
      await waitFor(() => {
        expect(firstHook.result.current.iconUrl).toBe(cachedIcon);
      });
      firstHook.unmount();
      getByFilenameMock.mockClear();

      const secondHook = renderHook(() => useSpriteIcon(cacheKey, { forceEnabled: true }));

      // Assert
      expect(secondHook.result.current.iconUrl).toBe(cachedIcon);
      expect(secondHook.result.current.isLoading).toBe(false);
      expect(getByFilenameMock).not.toHaveBeenCalled();
    });
  });
});
