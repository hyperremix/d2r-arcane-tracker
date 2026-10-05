import type { VaultItem } from 'electron/types/grail';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildInventorySearchFilter,
  type InventorySearchAllResponse,
  loadInventorySearchResponse,
} from './inventorySearch';

function makeVaultItem(overrides: Partial<VaultItem>): VaultItem {
  return {
    id: 'row-1',
    fingerprint: 'fp-1',
    itemName: 'Item',
    quality: 'unique',
    ethereal: false,
    rawItemJson: '{}',
    sourceFileType: 'd2s',
    locationContext: 'inventory',
    isPresentInLatestScan: true,
    created: new Date('2024-01-01T00:00:00.000Z'),
    lastUpdated: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  } as VaultItem;
}

function makeResponse(
  vault: Partial<InventorySearchAllResponse['vault']>,
): InventorySearchAllResponse {
  return {
    inventory: { snapshots: [], totalSnapshots: 0, totalItems: 0 },
    vault: { items: [], total: 0, page: 1, pageSize: 200, ...vault },
  };
}

describe('When buildInventorySearchFilter is called', () => {
  describe('If the search text has surrounding whitespace', () => {
    it('Then the text is trimmed', () => {
      // Arrange
      const searchText = '  Shako  ';

      // Act
      const filter = buildInventorySearchFilter(searchText, 'all', 'all');

      // Assert
      expect(filter.text).toBe('Shako');
    });
  });

  describe('If the search text is blank', () => {
    it('Then no text filter is applied', () => {
      // Arrange
      const searchText = '   ';

      // Act
      const filter = buildInventorySearchFilter(searchText, 'all', 'all');

      // Assert
      expect(filter.text).toBeUndefined();
    });
  });

  describe('If the character is "all"', () => {
    it('Then no character filter is applied', () => {
      // Arrange
      const text = '';
      const characterId = 'all';
      const location = 'all';

      // Act
      const filter = buildInventorySearchFilter(text, characterId, location);

      // Assert
      expect(filter.characterId).toBeUndefined();
    });
  });

  describe('If the character id uses the name: prefix', () => {
    it('Then the prefix is stripped', () => {
      // Arrange
      const text = '';
      const characterId = 'name:Sorc';
      const location = 'all';

      // Act
      const filter = buildInventorySearchFilter(text, characterId, location);

      // Assert
      expect(filter.characterId).toBe('Sorc');
    });
  });

  describe('If the character id is a plain id', () => {
    it('Then it is passed through unchanged', () => {
      // Arrange
      const text = '';
      const characterId = 'char-7';
      const location = 'all';

      // Act
      const filter = buildInventorySearchFilter(text, characterId, location);

      // Assert
      expect(filter.characterId).toBe('char-7');
    });
  });

  describe('If the location is "all"', () => {
    it('Then no location filter is applied', () => {
      // Arrange
      const text = '';
      const characterId = 'all';
      const location = 'all';

      // Act
      const filter = buildInventorySearchFilter(text, characterId, location);

      // Assert
      expect(filter.locationContext).toBeUndefined();
    });
  });

  describe('If a specific location is chosen', () => {
    it('Then the filter targets only vaulted, non-socketed items in that location', () => {
      // Arrange
      const text = '';
      const characterId = 'all';
      const location = 'stash';

      // Act
      const filter = buildInventorySearchFilter(text, characterId, location);

      // Assert
      expect(filter).toMatchObject({
        locationContext: 'stash',
        includeSocketed: false,
        vaultedState: 'vaulted',
        page: 1,
        pageSize: 200,
      });
    });
  });
});

describe('When loadInventorySearchResponse is called', () => {
  const searchAll = vi.fn();
  const vaultSearch = vi.fn();

  beforeEach(() => {
    searchAll.mockReset();
    vaultSearch.mockReset();
    Object.defineProperty(window, 'electronAPI', {
      value: { inventory: { searchAll }, vault: { search: vaultSearch } },
      writable: true,
    });
  });

  describe('If all vault items fit on the first page', () => {
    it('Then no further pages are requested', async () => {
      // Arrange
      const filter = buildInventorySearchFilter('', 'all', 'all');
      searchAll.mockResolvedValue(
        makeResponse({ items: [makeVaultItem({ id: 'a', fingerprint: 'fp-a' })], total: 1 }),
      );

      // Act
      const response = await loadInventorySearchResponse(filter);

      // Assert
      expect(vaultSearch).not.toHaveBeenCalled();
      expect(response.vault.items.map((item) => item.id)).toEqual(['a']);
    });
  });

  describe('If the vault results span several pages', () => {
    it('Then the remaining pages are fetched and merged newest first', async () => {
      // Arrange
      const filter = buildInventorySearchFilter('', 'all', 'all');
      searchAll.mockResolvedValue(
        makeResponse({
          items: [
            makeVaultItem({
              id: 'old',
              fingerprint: 'fp-old',
              lastUpdated: new Date('2024-01-01T00:00:00.000Z'),
            }),
          ],
          total: 3,
          pageSize: 1,
        }),
      );
      vaultSearch.mockImplementation(async ({ page }: { page: number }) => ({
        items: [
          page === 2
            ? makeVaultItem({
                id: 'newest',
                fingerprint: 'fp-newest',
                lastUpdated: new Date('2024-03-01T00:00:00.000Z'),
              })
            : makeVaultItem({
                id: 'middle',
                fingerprint: 'fp-middle',
                lastUpdated: new Date('2024-02-01T00:00:00.000Z'),
              }),
        ],
        total: 3,
        page,
        pageSize: 1,
      }));

      // Act
      const response = await loadInventorySearchResponse(filter);

      // Assert
      expect(vaultSearch).toHaveBeenCalledTimes(2);
      expect(vaultSearch).toHaveBeenCalledWith(expect.objectContaining({ page: 2, pageSize: 1 }));
      expect(vaultSearch).toHaveBeenCalledWith(expect.objectContaining({ page: 3, pageSize: 1 }));
      expect(response.vault.items.map((item) => item.id)).toEqual(['newest', 'middle', 'old']);
    });
  });

  describe('If the same vault row is returned on two pages', () => {
    it('Then it appears once in the merged result', async () => {
      // Arrange
      const filter = buildInventorySearchFilter('', 'all', 'all');
      const duplicate = makeVaultItem({ id: 'dup', fingerprint: 'fp-dup' });
      searchAll.mockResolvedValue(makeResponse({ items: [duplicate], total: 2, pageSize: 1 }));
      vaultSearch.mockResolvedValue({ items: [duplicate], total: 2, page: 2, pageSize: 1 });

      // Act
      const response = await loadInventorySearchResponse(filter);

      // Assert
      expect(response.vault.items).toHaveLength(1);
    });
  });

  describe('If two rows share the same update time', () => {
    it('Then they are ordered by fingerprint', async () => {
      // Arrange
      const filter = buildInventorySearchFilter('', 'all', 'all');
      searchAll.mockResolvedValue(
        makeResponse({
          items: [
            makeVaultItem({ id: 'b', fingerprint: 'fp-b' }),
            makeVaultItem({ id: 'a', fingerprint: 'fp-a' }),
          ],
          total: 2,
          pageSize: 200,
        }),
      );

      // Act
      const response = await loadInventorySearchResponse(filter);

      // Assert
      expect(response.vault.items.map((item) => item.fingerprint)).toEqual(['fp-a', 'fp-b']);
    });
  });
});
