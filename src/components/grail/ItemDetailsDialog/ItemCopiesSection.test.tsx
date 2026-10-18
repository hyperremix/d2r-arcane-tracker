import { render, screen, within } from '@testing-library/react';
import type { ParsedInventoryItem, VaultItem } from 'electron/types/grail';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HolyGrailItemBuilder } from '@/fixtures';
import { createMainEventsMock } from '@/test/mainEventsMock';
import { ItemCopiesSection } from './ItemCopiesSection';

const mainEvents = createMainEventsMock();
const searchAll = vi.fn();
const windowGlobals = window as unknown as { electronAPI: unknown };
let originalElectronAPI: unknown;

/** Raw Annihilus (unique 381) with all stats, resistances and experience rolled as given. */
function rawAnnihilus(statValue: number, experience: number): string {
  return JSON.stringify({
    quality: 7,
    unique_id: 381,
    magic_attributes: [
      { name: 'strength', values: [statValue] },
      { name: 'fireresist', values: [statValue] },
      { name: 'item_addexperience', values: [experience] },
    ],
  });
}

function createInventoryCopy(overrides: Partial<ParsedInventoryItem>): ParsedInventoryItem {
  return {
    fingerprint: 'fp-1',
    characterName: 'Sorc',
    sourceFileType: 'd2s',
    sourceFilePath: '/tmp/sorc.d2s',
    locationContext: 'inventory',
    itemName: 'Annihilus',
    quality: 'unique',
    ethereal: false,
    socketCount: 0,
    grailItemId: 'annihilus',
    rawItemJson: rawAnnihilus(10, 5),
    seenAt: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createVaultCopy(overrides: Partial<VaultItem>): VaultItem {
  return {
    id: 'vault-1',
    fingerprint: 'vfp-1',
    itemName: 'Annihilus',
    quality: 'unique',
    ethereal: false,
    rawItemJson: rawAnnihilus(20, 10),
    sourceFileType: 'd2s',
    locationContext: 'inventory',
    grailItemId: 'annihilus',
    isPresentInLatestScan: false,
    created: new Date('2024-01-01T00:00:00.000Z'),
    lastUpdated: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function mockSearch(inventoryItems: ParsedInventoryItem[], vaultItems: VaultItem[]): void {
  searchAll.mockResolvedValue({
    inventory: {
      snapshots: [
        {
          snapshotId: 'snap-1',
          characterName: 'Sorc',
          sourceFileType: 'd2s',
          sourceFilePath: '/tmp/sorc.d2s',
          capturedAt: new Date('2024-01-01T00:00:00.000Z'),
          items: inventoryItems,
        },
      ],
      totalSnapshots: 1,
      totalItems: inventoryItems.length,
    },
    vault: { items: vaultItems, total: vaultItems.length, page: 1, pageSize: 200 },
  });
}

const annihilus = HolyGrailItemBuilder.new().withId('annihilus').withName('Annihilus').build();

beforeEach(() => {
  originalElectronAPI = windowGlobals.electronAPI;
  mainEvents.reset();
  searchAll.mockReset();
  windowGlobals.electronAPI = {
    on: mainEvents.on,
    inventory: { searchAll },
    vault: { search: vi.fn() },
  };
});

afterEach(() => {
  windowGlobals.electronAPI = originalElectronAPI;
});

describe('When ItemCopiesSection shows the copies of a grail item', () => {
  describe('If copies are in a character and in the vault', () => {
    it('Then the best roll comes first with its location and the other items are left out', async () => {
      // Arrange
      mockSearch(
        [
          createInventoryCopy({ stashTab: 1, locationContext: 'stash', fingerprint: 'fp-low' }),
          createInventoryCopy({ fingerprint: 'fp-other', grailItemId: 'shako', itemName: 'Shako' }),
        ],
        [
          createVaultCopy({}),
          createVaultCopy({
            id: 'bookmark',
            fingerprint: 'grail:annihilus',
            rawItemJson: '{}',
          }),
        ],
      );

      // Act
      render(<ItemCopiesSection item={annihilus} />);

      // Assert
      const list = await screen.findByRole('list');
      const rows = within(list).getAllByRole('listitem');
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveTextContent('Vaulted');
      expect(rows[0]).toHaveTextContent('Best roll');
      expect(rows[0]).toHaveTextContent('Perfect roll');
      expect(rows[1]).toHaveTextContent('Sorc, Stash tab 2');
      expect(rows[1]).toHaveTextContent('0%');
      expect(rows[1]).not.toHaveTextContent('Best roll');
    });
  });

  describe('If the only copy is ethereal', () => {
    it('Then it is marked ethereal and not as the best roll', async () => {
      // Arrange
      mockSearch([createInventoryCopy({ ethereal: true })], []);

      // Act
      render(<ItemCopiesSection item={annihilus} />);

      // Assert
      const row = await screen.findByRole('listitem');
      expect(row).toHaveTextContent('Ethereal');
      expect(row).not.toHaveTextContent('Best roll');
    });
  });

  describe('If the search fails', () => {
    it('Then it says that the copies could not be loaded', async () => {
      // Arrange
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      searchAll.mockRejectedValue(new Error('search failed'));

      // Act
      render(<ItemCopiesSection item={annihilus} />);

      // Assert
      expect(
        await screen.findByText('Could not load your copies of this item.'),
      ).toBeInTheDocument();
    });
  });
});
