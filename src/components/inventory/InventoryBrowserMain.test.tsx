import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { VaultItem } from 'electron/types/grail';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { serializeInventoryTextPayload } from '@/components/inventory/dragPayloads';
import { useGrailStore } from '@/stores/grailStore';
import { InventoryBrowserMain } from './InventoryBrowserMain';

const searchAllMock = vi.fn();
const searchVaultMock = vi.fn();
const addItemMock = vi.fn();
const openSnapshotWindowMock = vi.fn();
const unvaultItemMock = vi.fn();

const EMPTY_INVENTORY = { snapshots: [], totalSnapshots: 0, totalItems: 0 };

function createVaultItem(overrides: Partial<VaultItem>): VaultItem {
  return {
    id: 'vault-1',
    fingerprint: 'vfp-1',
    itemName: 'Shako',
    quality: 'unique',
    ethereal: false,
    rawItemJson: '{}',
    sourceFileType: 'd2s',
    locationContext: 'inventory',
    isPresentInLatestScan: false,
    created: new Date('2024-01-01T00:00:00.000Z'),
    lastUpdated: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function mockVaultOnly(items: VaultItem[]): void {
  searchAllMock.mockResolvedValue({
    inventory: EMPTY_INVENTORY,
    vault: { items, total: items.length, page: 1, pageSize: 200 },
  });
}

describe('When InventoryBrowserMain is rendered', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGrailStore.setState({ items: [] });

    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      writable: true,
      value: {
        grail: {
          getItems: vi.fn().mockResolvedValue([]),
        },
        inventory: {
          searchAll: searchAllMock,
          openSnapshotWindow: openSnapshotWindowMock,
        },
        vault: {
          search: searchVaultMock,
          addItem: addItemMock,
          unvaultItem: unvaultItemMock,
        },
        saveFile: {
          refreshSaveFiles: vi.fn().mockResolvedValue({ success: true }),
        },
      },
    });

    searchVaultMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 200,
    });

    searchAllMock.mockResolvedValue({
      inventory: {
        snapshots: [
          {
            snapshotId: 'snap-1',
            characterName: 'Sorc',
            characterId: 'char-1',
            sourceFileType: 'd2s',
            sourceFilePath: '/tmp/sorc.d2s',
            capturedAt: new Date('2024-01-01T00:00:00.000Z'),
            items: [
              {
                fingerprint: 'fp-1',
                fingerprintInputs: {
                  sourceFileType: 'd2s',
                  characterName: 'Sorc',
                  locationContext: 'inventory',
                  quality: 'unique',
                  ethereal: false,
                  socketCount: 0,
                  gridX: 1,
                  gridY: 1,
                  gridWidth: 2,
                  gridHeight: 2,
                  isSocketedItem: false,
                  itemName: 'Shako',
                },
                characterName: 'Sorc',
                characterId: 'char-1',
                sourceFileType: 'd2s',
                sourceFilePath: '/tmp/sorc.d2s',
                locationContext: 'inventory',
                type: 'unique',
                gridX: 1,
                gridY: 1,
                gridWidth: 2,
                gridHeight: 2,
                isSocketedItem: false,
                itemName: 'Shako',
                quality: 'unique',
                ethereal: false,
                socketCount: 0,
                rawItemJson: '{}',
                rawParsedItem: {},
                seenAt: new Date('2024-01-01T00:00:00.000Z'),
              },
            ],
          },
        ],
        totalSnapshots: 1,
        totalItems: 1,
      },
      vault: {
        items: [],
        total: 0,
        page: 1,
        pageSize: 200,
      },
    });

    addItemMock.mockResolvedValue({ id: 'vault-1' });
    openSnapshotWindowMock.mockResolvedValue({ success: true });
    unvaultItemMock.mockResolvedValue({ success: true });
    for (const method of ['success', 'error'] as const) {
      vi.spyOn(toast, method).mockImplementation(() => 'toast-id');
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('If the page is shown', () => {
    it('Then it has the shared page heading and the save file notice', async () => {
      // Arrange

      // Act
      render(<InventoryBrowserMain />);

      // Assert
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Inventory Browser' }),
      ).toBeInTheDocument();
      expect(screen.getByTestId('save-write-notice')).toHaveTextContent(
        'Changes are written to your save files',
      );
    });

    it('Then each filter dropdown has a label and shows the selected option', async () => {
      // Arrange

      // Act
      render(<InventoryBrowserMain />);

      // Assert
      expect(await screen.findByRole('combobox', { name: 'Character' })).toHaveTextContent(
        'All Characters',
      );
      expect(screen.getByRole('combobox', { name: 'Location' })).toHaveTextContent('All Locations');
      expect(screen.getByRole('combobox', { name: 'Type' })).toHaveTextContent('All Types');
    });

    it('Then the vault drop area is a labelled region and not a button', async () => {
      // Arrange
      const dropText = 'Drop an item here to remove it from its save file and keep it in the vault';

      // Act
      render(<InventoryBrowserMain />);

      // Assert
      expect(await screen.findByRole('region', { name: dropText })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: dropText })).not.toBeInTheDocument();
    });
  });

  describe('If the inventory is still loading', () => {
    it('Then a loading status is shown instead of an empty list', async () => {
      // Arrange
      searchAllMock.mockReturnValue(new Promise(() => undefined));

      // Act
      render(<InventoryBrowserMain />);

      // Assert
      const loadingText = await screen.findByText('Loading...');
      expect(loadingText.closest('output')).not.toBeNull();
      expect(
        screen.queryByText('No character or stash snapshots match your current filters.'),
      ).not.toBeInTheDocument();
    });
  });

  describe('If a snapshot holds a single item', () => {
    it('Then its count uses the singular form and the row names the file kind in plain words', async () => {
      // Arrange

      // Act
      render(<InventoryBrowserMain />);

      // Assert
      const row = await screen.findByRole('button', { name: /Sorc · Character/ });
      expect(within(row).getByText('1 item')).toBeInTheDocument();
      expect(within(row).queryByText(/Captured/)).not.toBeInTheDocument();
    });
  });

  describe('If a vaulted item is shown', () => {
    it('Then its tile is named after the item', async () => {
      // Arrange
      mockVaultOnly([createVaultItem({})]);

      // Act
      render(<InventoryBrowserMain />);

      // Assert
      expect(await screen.findByRole('button', { name: 'Vaulted item Shako' })).toBeInTheDocument();
    });
  });

  describe('If a vaulted item that came from an inventory cell is selected', () => {
    it('Then putting it back writes it to its original cell', async () => {
      // Arrange
      mockVaultOnly([createVaultItem({ sourceFilePath: '/tmp/sorc.d2s', gridX: 4, gridY: 2 })]);
      render(<InventoryBrowserMain />);
      fireEvent.click(await screen.findByRole('button', { name: 'Vaulted item Shako' }));

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Put back where it was' }));

      // Assert
      await waitFor(() => {
        expect(unvaultItemMock).toHaveBeenCalledWith('vault-1', {
          targetFilePath: '/tmp/sorc.d2s',
          targetFileType: 'd2s',
          targetLocationContext: 'inventory',
          targetGridX: 4,
          targetGridY: 2,
        });
      });
      expect(screen.queryByRole('button', { name: 'Unvault' })).not.toBeInTheDocument();
    });
  });

  describe('If a vaulted item that came from an equipped slot is selected', () => {
    it('Then there is no unvault button, only how to drag it into a character', async () => {
      // Arrange
      mockVaultOnly([
        createVaultItem({
          sourceFilePath: '/tmp/sorc.d2s',
          locationContext: 'equipped',
          equippedSlotId: 1,
        }),
      ]);
      render(<InventoryBrowserMain />);

      // Act
      fireEvent.click(await screen.findByRole('button', { name: 'Vaulted item Shako' }));

      // Assert
      expect(
        screen.getByText(
          'To take this item out of the vault, open a character or stash and drag the item onto a free spot.',
        ),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Unvault' })).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Put back where it was' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('If a vaulted item that was not taken out of a save file is selected', () => {
    it('Then the unvault button unvaults it without a target', async () => {
      // Arrange
      mockVaultOnly([createVaultItem({})]);
      render(<InventoryBrowserMain />);
      fireEvent.click(await screen.findByRole('button', { name: 'Vaulted item Shako' }));

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Unvault' }));

      // Assert
      await waitFor(() => {
        expect(unvaultItemMock).toHaveBeenCalledWith('vault-1');
      });
    });
  });

  describe('If snapshot data is available', () => {
    it('Then it renders snapshot names and not inline inventory boards', async () => {
      // Arrange

      // Act
      render(<InventoryBrowserMain />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Characters & Stashes')).toBeInTheDocument();
      });
      expect(screen.getByText('Sorc · Character')).toBeInTheDocument();
      expect(screen.queryByTestId('inventory-board-snap-1')).not.toBeInTheDocument();
    });
  });

  describe('If a snapshot name is clicked', () => {
    it('Then it opens the snapshot popup window for that target', async () => {
      // Arrange
      render(<InventoryBrowserMain />);

      // Act
      const snapshotButton = await screen.findByRole('button', {
        name: /Sorc · Character/i,
      });
      fireEvent.click(snapshotButton);

      // Assert
      await waitFor(() => {
        expect(openSnapshotWindowMock).toHaveBeenCalledWith({
          sourceFilePath: '/tmp/sorc.d2s',
          sourceFileType: 'd2s',
          characterName: 'Sorc',
        });
      });
    });
  });

  describe('If an item is dragged over a snapshot name', () => {
    it('Then it opens the snapshot popup after a hover delay', async () => {
      // Arrange
      render(<InventoryBrowserMain />);
      const snapshotButton = await screen.findByRole('button', {
        name: /Sorc · Character/i,
      });
      vi.useFakeTimers();

      const payload = {
        fingerprint: 'fp-hover',
        itemName: 'Harlequin Crest',
        quality: 'unique',
        ethereal: false,
        socketCount: 0,
        rawItemJson: '{"id":321}',
        sourceFileType: 'd2s' as const,
        sourceFilePath: '/tmp/sorc.d2s',
        locationContext: 'inventory' as const,
      };

      // Act
      fireEvent.dragOver(snapshotButton, {
        dataTransfer: {
          types: ['text/plain'],
          getData: (format: string) =>
            format === 'text/plain' ? serializeInventoryTextPayload(payload) : '',
        },
      });
      try {
        await vi.advanceTimersByTimeAsync(649);

        // Assert
        expect(openSnapshotWindowMock).not.toHaveBeenCalled();

        // Act
        await vi.advanceTimersByTimeAsync(1);
        await Promise.resolve();

        // Assert
        expect(openSnapshotWindowMock).toHaveBeenCalledWith({
          sourceFilePath: '/tmp/sorc.d2s',
          sourceFileType: 'd2s',
          characterName: 'Sorc',
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it('Then it does not open the snapshot popup if hover ends before delay', async () => {
      // Arrange
      render(<InventoryBrowserMain />);
      const snapshotButton = await screen.findByRole('button', {
        name: /Sorc · Character/i,
      });
      vi.useFakeTimers();

      const payload = {
        fingerprint: 'fp-hover-cancel',
        itemName: 'Harlequin Crest',
        quality: 'unique',
        ethereal: false,
        socketCount: 0,
        rawItemJson: '{"id":654}',
        sourceFileType: 'd2s' as const,
        sourceFilePath: '/tmp/sorc.d2s',
        locationContext: 'inventory' as const,
      };

      // Act
      fireEvent.dragOver(snapshotButton, {
        dataTransfer: {
          types: ['text/plain'],
          getData: (format: string) =>
            format === 'text/plain' ? serializeInventoryTextPayload(payload) : '',
        },
      });
      try {
        await vi.advanceTimersByTimeAsync(300);
        fireEvent.dragLeave(snapshotButton);
        await vi.advanceTimersByTimeAsync(1000);

        // Assert
        expect(openSnapshotWindowMock).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('If vault search includes an item with a matching fingerprint', () => {
    it('Then matching snapshot names still remain visible in the main list', async () => {
      // Arrange
      searchAllMock.mockResolvedValueOnce({
        inventory: {
          snapshots: [
            {
              snapshotId: 'snap-sorc',
              characterName: 'Sorc',
              characterId: 'char-1',
              sourceFileType: 'd2s',
              sourceFilePath: '/tmp/sorc.d2s',
              capturedAt: new Date('2024-01-01T00:00:00.000Z'),
              items: [
                {
                  fingerprint: 'fp-sorc',
                  fingerprintInputs: {
                    sourceFileType: 'd2s',
                    characterName: 'Sorc',
                    locationContext: 'inventory',
                    quality: 'unique',
                    ethereal: false,
                    socketCount: 0,
                    gridX: 0,
                    gridY: 0,
                    gridWidth: 2,
                    gridHeight: 2,
                    isSocketedItem: false,
                    itemName: 'Shako',
                  },
                  characterName: 'Sorc',
                  characterId: 'char-1',
                  sourceFileType: 'd2s',
                  sourceFilePath: '/tmp/sorc.d2s',
                  locationContext: 'inventory',
                  type: 'unique',
                  gridX: 0,
                  gridY: 0,
                  gridWidth: 2,
                  gridHeight: 2,
                  isSocketedItem: false,
                  itemName: 'Shako',
                  quality: 'unique',
                  ethereal: false,
                  socketCount: 0,
                  rawItemJson: '{}',
                  rawParsedItem: {},
                  seenAt: new Date('2024-01-01T00:00:00.000Z'),
                },
              ],
            },
            {
              snapshotId: 'snap-barb',
              characterName: 'Barb',
              characterId: 'char-2',
              sourceFileType: 'd2s',
              sourceFilePath: '/tmp/barb.d2s',
              capturedAt: new Date('2024-01-01T00:00:00.000Z'),
              items: [
                {
                  fingerprint: 'fp-barb',
                  fingerprintInputs: {
                    sourceFileType: 'd2s',
                    characterName: 'Barb',
                    locationContext: 'inventory',
                    quality: 'set',
                    ethereal: false,
                    socketCount: 0,
                    gridX: 0,
                    gridY: 0,
                    gridWidth: 2,
                    gridHeight: 2,
                    isSocketedItem: false,
                    itemName: "Arreat's Face",
                  },
                  characterName: 'Barb',
                  characterId: 'char-2',
                  sourceFileType: 'd2s',
                  sourceFilePath: '/tmp/barb.d2s',
                  locationContext: 'inventory',
                  type: 'set',
                  gridX: 0,
                  gridY: 0,
                  gridWidth: 2,
                  gridHeight: 2,
                  isSocketedItem: false,
                  itemName: "Arreat's Face",
                  quality: 'set',
                  ethereal: false,
                  socketCount: 0,
                  rawItemJson: '{}',
                  rawParsedItem: {},
                  seenAt: new Date('2024-01-01T00:00:00.000Z'),
                },
              ],
            },
          ],
          totalSnapshots: 2,
          totalItems: 2,
        },
        vault: {
          items: [
            {
              id: 'vault-1',
              fingerprint: 'fp-sorc',
              itemName: 'Shako',
              quality: 'unique',
              ethereal: false,
              rawItemJson: '{}',
              sourceFileType: 'd2s',
              locationContext: 'inventory',
              isPresentInLatestScan: true,
              created: new Date('2024-01-01T00:00:00.000Z'),
              lastUpdated: new Date('2024-01-01T00:00:00.000Z'),
            },
          ],
          total: 1,
          page: 1,
          pageSize: 200,
        },
      });

      // Act
      render(<InventoryBrowserMain />);

      // Assert
      expect(await screen.findByText('Sorc · Character')).toBeInTheDocument();
      expect(screen.getByText('Barb · Character')).toBeInTheDocument();
    });
  });

  describe('If an inventory payload is dropped onto the vault dropzone', () => {
    it('Then it vaults the dropped item using the serialized text payload', async () => {
      // Arrange
      render(<InventoryBrowserMain />);
      const payload = {
        fingerprint: 'fp-drop',
        itemName: 'Harlequin Crest',
        quality: 'unique',
        ethereal: false,
        socketCount: 0,
        rawItemJson: '{"id":123}',
        sourceFileType: 'd2s' as const,
        sourceFilePath: '/tmp/sorc.d2s',
        locationContext: 'inventory' as const,
      };
      const dropzone = await screen.findByText(
        'Drop an item here to remove it from its save file and keep it in the vault',
      );

      // Act
      fireEvent.drop(dropzone, {
        dataTransfer: {
          getData: (format: string) =>
            format === 'text/plain' ? serializeInventoryTextPayload(payload) : '',
        },
      });

      // Assert
      await waitFor(() => {
        expect(addItemMock).toHaveBeenCalledWith(payload);
      });
    });
  });
});
