import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearIconCache,
  forgetMissingIcons,
  isIconMissing,
  isIconSettled,
  loadIconByFilename,
} from './iconLoader';

const windowGlobals = window as unknown as { electronAPI: unknown };
const originalElectronAPI = windowGlobals.electronAPI;
const getByFilename = vi.fn<(filename: string) => Promise<string | null>>();

/** A getByFilename answer the test resolves itself, to control when a request finishes. */
function deferAnswer(): { resolve: (url: string | null) => void } {
  let resolve: (url: string | null) => void = () => undefined;
  getByFilename.mockImplementationOnce(
    () =>
      new Promise((innerResolve) => {
        resolve = innerResolve;
      }),
  );
  return { resolve: (url) => resolve(url) };
}

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

  describe('If the main process has no icon for the filename', () => {
    it('Then the filename is remembered as missing and not requested again', async () => {
      // Arrange
      getByFilename.mockResolvedValue(null);

      // Act
      const first = await loadIconByFilename('ber.png');
      const second = await loadIconByFilename('ber.png');

      // Assert
      expect(first).toBeUndefined();
      expect(second).toBeUndefined();
      expect(isIconMissing('ber.png')).toBe(true);
      expect(getByFilename).toHaveBeenCalledTimes(1);
    });
  });

  describe('If the missing icons are forgotten after a conversion', () => {
    it('Then a missing filename is requested again', async () => {
      // Arrange
      getByFilename.mockResolvedValueOnce(null).mockResolvedValueOnce('data:ber');
      await loadIconByFilename('ber.png');

      // Act
      forgetMissingIcons();
      const iconUrl = await loadIconByFilename('ber.png');

      // Assert
      expect(iconUrl).toBe('data:ber');
      expect(getByFilename).toHaveBeenCalledTimes(2);
    });
  });

  describe('If a request started before the missing icons were forgotten', () => {
    it('Then its late "missing" answer does not mark the filename as missing again', async () => {
      // Arrange
      const answer = deferAnswer();
      const staleRequest = loadIconByFilename('ber.png');

      // Act
      forgetMissingIcons();
      answer.resolve(null);
      await staleRequest;

      // Assert
      expect(isIconMissing('ber.png')).toBe(false);
      expect(isIconSettled('ber.png')).toBe(false);
    });

    it('Then a caller after the clear asks the main process instead of sharing the stale request', async () => {
      // Arrange
      const answer = deferAnswer();
      const staleRequest = loadIconByFilename('ber.png');
      forgetMissingIcons();
      getByFilename.mockResolvedValueOnce('data:ber');

      // Act
      const freshIconUrl = await loadIconByFilename('ber.png');
      answer.resolve(null);
      await staleRequest;

      // Assert
      expect(freshIconUrl).toBe('data:ber');
      expect(getByFilename).toHaveBeenCalledTimes(2);
      expect(isIconMissing('ber.png')).toBe(false);
      expect(await loadIconByFilename('ber.png')).toBe('data:ber');
      expect(getByFilename).toHaveBeenCalledTimes(2);
    });
  });

  describe('If the request fails', () => {
    it('Then the failure is not remembered and the next caller retries', async () => {
      // Arrange
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      getByFilename
        .mockRejectedValueOnce(new Error('IPC failed'))
        .mockResolvedValueOnce('data:ber');

      // Act
      const failed = await loadIconByFilename('ber.png');
      const retried = await loadIconByFilename('ber.png');

      // Assert
      expect(failed).toBeUndefined();
      expect(retried).toBe('data:ber');
      expect(isIconMissing('ber.png')).toBe(false);
      expect(getByFilename).toHaveBeenCalledTimes(2);
    });
  });
});
