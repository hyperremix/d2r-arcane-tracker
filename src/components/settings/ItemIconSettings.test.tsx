import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Settings } from 'electron/types/grail';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearIconCache, isIconMissing, loadIconByFilename } from '@/lib/iconLoader';
import { useGrailStore } from '@/stores/grailStore';
import { ItemIconSettings } from './ItemIconSettings';

vi.mock('@/stores/grailStore');

const windowGlobals = window as unknown as { electronAPI: unknown };
const originalElectronAPI = windowGlobals.electronAPI;
const getByFilename = vi.fn<(filename: string) => Promise<string | null>>();
const convertSprites = vi.fn();

function setupGrailStore(settings: Partial<Settings>) {
  const storeState = { settings, setSettings: vi.fn() };
  vi.mocked(useGrailStore).mockImplementation((selector?: unknown) => {
    if (typeof selector === 'function') {
      return (selector as (s: typeof storeState) => unknown)(storeState);
    }
    return storeState as unknown as ReturnType<typeof useGrailStore>;
  });
}

/** Opens the conversion warning dialog and confirms it, then waits for the conversion to end. */
async function startConversion() {
  const convertButton = await screen.findByRole('button', { name: 'Convert Sprite Files to PNG' });
  await waitFor(() => expect(convertButton).toBeEnabled());
  fireEvent.click(convertButton);
  fireEvent.click(await screen.findByRole('button', { name: 'Start Conversion' }));
  await waitFor(() => expect(convertSprites).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Convert Sprite Files to PNG' })).toBeEnabled(),
  );
}

describe('When a sprite conversion is started from the item icon settings', () => {
  beforeEach(() => {
    clearIconCache();
    getByFilename.mockReset();
    convertSprites.mockReset();
    setupGrailStore({ showItemIcons: true });
    // Assign rather than redefine: other suites define `window.electronAPI` as non-configurable
    windowGlobals.electronAPI = {
      icon: {
        getByFilename,
        convertSprites,
        validatePath: vi.fn().mockResolvedValue({ valid: true, path: 'C:\\Games\\D2R' }),
      },
    };
  });

  afterEach(() => {
    windowGlobals.electronAPI = originalElectronAPI;
    vi.restoreAllMocks();
  });

  describe('If the conversion succeeds', () => {
    it('Then icons that were missing before are requested again', async () => {
      // Arrange
      getByFilename.mockResolvedValue(null);
      await loadIconByFilename('ber.png');
      convertSprites.mockResolvedValue({
        success: true,
        totalFiles: 1,
        convertedFiles: 1,
        skippedFiles: 0,
        errors: [],
      });
      render(<ItemIconSettings />);

      // Act
      await startConversion();

      // Assert
      expect(isIconMissing('ber.png')).toBe(false);
    });
  });

  describe('If the conversion reports failure', () => {
    it('Then icons that were missing before are requested again', async () => {
      // Arrange
      getByFilename.mockResolvedValue(null);
      await loadIconByFilename('ber.png');
      convertSprites.mockResolvedValue({
        success: false,
        totalFiles: 2,
        convertedFiles: 1,
        skippedFiles: 0,
        errors: [{ file: 'jah.sprite', error: 'Unreadable' }],
      });
      render(<ItemIconSettings />);

      // Act
      await startConversion();

      // Assert
      expect(isIconMissing('ber.png')).toBe(false);
    });
  });

  describe('If the conversion throws part-way', () => {
    it('Then icons that were missing before are requested again', async () => {
      // Arrange
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      getByFilename.mockResolvedValue(null);
      await loadIconByFilename('ber.png');
      convertSprites.mockRejectedValue(new Error('Conversion crashed'));
      render(<ItemIconSettings />);

      // Act
      await startConversion();

      // Assert
      expect(isIconMissing('ber.png')).toBe(false);
    });
  });
});
