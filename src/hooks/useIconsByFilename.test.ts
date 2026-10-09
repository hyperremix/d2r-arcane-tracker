import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearIconCache, forgetMissingIcons } from '@/lib/iconLoader';
import { useIconsByFilename } from './useIconsByFilename';

const windowGlobals = window as unknown as { electronAPI: unknown };
const originalElectronAPI = windowGlobals.electronAPI;
const getByFilename = vi.fn<(filename: string) => Promise<string | null>>();

describe('When icons are loaded by filename', () => {
  beforeEach(() => {
    clearIconCache();
    getByFilename.mockReset();
    // Assign rather than redefine: other suites define `window.electronAPI` as non-configurable
    windowGlobals.electronAPI = { icon: { getByFilename } };
  });

  afterEach(() => {
    windowGlobals.electronAPI = originalElectronAPI;
    vi.restoreAllMocks();
  });

  describe('If several icons are requested', () => {
    it('Then they are requested in parallel and returned by filename', async () => {
      // Arrange
      const resolvers = new Map<string, (url: string) => void>();
      getByFilename.mockImplementation(
        (filename) =>
          new Promise((resolve) => {
            resolvers.set(filename, resolve);
          }),
      );

      // Act
      const { result } = renderHook(() => useIconsByFilename(['ber.png', 'jah.png']));

      // Assert
      await waitFor(() => expect(getByFilename).toHaveBeenCalledTimes(2));
      expect(result.current.isLoading).toBe(true);

      // Act
      resolvers.get('ber.png')?.('data:ber');
      resolvers.get('jah.png')?.('data:jah');

      // Assert
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.icons.get('ber.png')).toBe('data:ber');
      expect(result.current.icons.get('jah.png')).toBe('data:jah');
    });
  });

  describe('If several components request the same icon at the same time', () => {
    it('Then the icon is requested only once', async () => {
      // Arrange
      getByFilename.mockResolvedValue('data:ber');

      // Act
      const first = renderHook(() => useIconsByFilename(['ber.png']));
      const second = renderHook(() => useIconsByFilename(['ber.png', 'ber.png']));

      // Assert
      await waitFor(() => expect(first.result.current.isLoading).toBe(false));
      await waitFor(() => expect(second.result.current.isLoading).toBe(false));
      expect(getByFilename).toHaveBeenCalledTimes(1);
      expect(second.result.current.icons.get('ber.png')).toBe('data:ber');
    });
  });

  describe('If an icon was loaded before', () => {
    it('Then a later component gets it from the cache without loading', async () => {
      // Arrange
      getByFilename.mockResolvedValue('data:ber');
      const first = renderHook(() => useIconsByFilename(['ber.png']));
      await waitFor(() => expect(first.result.current.isLoading).toBe(false));

      // Act
      const { result } = renderHook(() => useIconsByFilename(['ber.png']));

      // Assert
      expect(result.current.isLoading).toBe(false);
      expect(result.current.icons.get('ber.png')).toBe('data:ber');
      expect(getByFilename).toHaveBeenCalledTimes(1);
    });
  });

  describe('If an icon does not exist yet', () => {
    it('Then a later component does not request it again', async () => {
      // Arrange
      getByFilename.mockResolvedValue(null);
      const first = renderHook(() => useIconsByFilename(['ber.png']));
      await waitFor(() => expect(first.result.current.isLoading).toBe(false));
      expect(first.result.current.icons.size).toBe(0);

      // Act
      const { result } = renderHook(() => useIconsByFilename(['ber.png']));

      // Assert
      expect(result.current.isLoading).toBe(false);
      expect(result.current.icons.size).toBe(0);
      expect(getByFilename).toHaveBeenCalledTimes(1);
    });

    it('Then it is requested again once the sprites have been converted', async () => {
      // Arrange
      getByFilename.mockResolvedValueOnce(null).mockResolvedValueOnce('data:ber');
      const first = renderHook(() => useIconsByFilename(['ber.png']));
      await waitFor(() => expect(first.result.current.isLoading).toBe(false));

      // Act
      forgetMissingIcons();
      const { result } = renderHook(() => useIconsByFilename(['ber.png']));

      // Assert
      await waitFor(() => expect(result.current.icons.get('ber.png')).toBe('data:ber'));
      expect(getByFilename).toHaveBeenCalledTimes(2);
    });
  });

  describe('If loading an icon fails', () => {
    it('Then the error is logged and loading finishes without the icon', async () => {
      // Arrange
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      getByFilename.mockRejectedValue(new Error('read failed'));

      // Act
      const { result } = renderHook(() => useIconsByFilename(['ber.png']));

      // Assert
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.icons.size).toBe(0);
      expect(console.error).toHaveBeenCalledWith('Failed to load icon ber.png:', expect.any(Error));
    });
  });
});
