import { renderHook, waitFor } from '@testing-library/react';
import type { Item } from 'electron/types/grail';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockStoreState } from '@/test/storeMock';
import { useItemIcon } from './useItemIcon';
import { useSpriteIcon } from './useSpriteIcon';

const { useGrailStoreMock } = vi.hoisted(() => ({ useGrailStoreMock: vi.fn() }));

vi.mock('@/stores/grailStore', () => ({
  useGrailStore: useGrailStoreMock,
}));

const windowGlobals = window as unknown as { electronAPI: unknown };
const originalElectronAPI = windowGlobals.electronAPI;
const getByFilename = vi.fn<(filename: string) => Promise<string | null>>();

const makeItem = (overrides: Partial<Item> = {}): Item =>
  ({ id: 'shako', name: 'Harlequin Crest', imageFilename: 'shako.png', ...overrides }) as Item;

const setShowItemIcons = (showItemIcons: boolean) => {
  mockStoreState(useGrailStoreMock, { settings: { showItemIcons } });
};

describe('When useItemIcon is used', () => {
  beforeEach(() => {
    getByFilename.mockReset();
    // Assign rather than redefine: other suites define `window.electronAPI` as non-configurable
    windowGlobals.electronAPI = { icon: { getByFilename } };
    setShowItemIcons(true);
  });

  afterEach(() => {
    windowGlobals.electronAPI = originalElectronAPI;
  });

  describe('If item icons are disabled in settings', () => {
    it('Then it returns the placeholder without loading the icon', () => {
      // Arrange
      setShowItemIcons(false);

      // Act
      const { result } = renderHook(() => useItemIcon(makeItem()));

      // Assert
      expect(result.current.isLoading).toBe(false);
      expect(result.current.iconUrl).toMatch(/placeholder-item\.svg|data:image\/svg\+xml/);
      expect(getByFilename).not.toHaveBeenCalled();
    });
  });

  describe('If the item has no image filename', () => {
    it('Then it returns the placeholder without loading an icon', () => {
      // Arrange
      const item = makeItem({ imageFilename: undefined });

      // Act
      const { result } = renderHook(() => useItemIcon(item));

      // Assert
      expect(result.current.isLoading).toBe(false);
      expect(result.current.iconUrl).toMatch(/placeholder-item\.svg|data:image\/svg\+xml/);
      expect(getByFilename).not.toHaveBeenCalled();
    });
  });

  describe('If the icon exists', () => {
    it('Then it is loading until the icon is returned', async () => {
      // Arrange
      getByFilename.mockResolvedValue('data:shako');

      // Act
      const { result } = renderHook(() => useItemIcon(makeItem()));

      // Assert
      expect(result.current.isLoading).toBe(true);
      await waitFor(() => expect(result.current.iconUrl).toBe('data:shako'));
      expect(result.current.isLoading).toBe(false);
      expect(getByFilename).toHaveBeenCalledWith('shako.png');
    });
  });

  describe('If a sprite icon loads the same filename at the same time', () => {
    it('Then both hooks share one request and one cache', async () => {
      // Arrange
      getByFilename.mockResolvedValue('data:shako');

      // Act
      const itemIcon = renderHook(() => useItemIcon(makeItem()));
      const spriteIcon = renderHook(() => useSpriteIcon('shako.png', { forceEnabled: true }));

      // Assert
      await waitFor(() => expect(itemIcon.result.current.iconUrl).toBe('data:shako'));
      await waitFor(() => expect(spriteIcon.result.current.iconUrl).toBe('data:shako'));
      expect(getByFilename).toHaveBeenCalledTimes(1);
    });
  });

  describe('If loading the icon fails', () => {
    it('Then it falls back to the placeholder and finishes loading', async () => {
      // Arrange
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      getByFilename.mockRejectedValue(new Error('read failed'));

      // Act
      const { result } = renderHook(() => useItemIcon(makeItem()));

      // Assert
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.iconUrl).toMatch(/placeholder-item\.svg|data:image\/svg\+xml/);
      vi.mocked(console.error).mockRestore();
    });
  });
});
