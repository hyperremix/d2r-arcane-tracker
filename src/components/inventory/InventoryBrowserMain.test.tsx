import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { serializeInventoryTextPayload } from '@/components/inventory/dragPayloads';
import { useGrailStore } from '@/stores/grailStore';
import { InventoryBrowserMain } from './InventoryBrowserMain';

const searchAllMock = vi.fn();
const searchVaultMock = vi.fn();
const addItemMock = vi.fn();
const openSnapshotWindowMock = vi.fn();

describe('When InventoryBrowserMain is rendered', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGrailStore.setState({ items: [] });

    Object.defineProperty(window, 'electronAPI', {
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
          unvaultItem: vi.fn(),
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
      expect(screen.getByText('Sorc · D2S')).toBeInTheDocument();
      expect(screen.queryByTestId('inventory-board-snap-1')).not.toBeInTheDocument();
    });
  });

  describe('If a snapshot name is clicked', () => {
    it('Then it opens the snapshot popup window for that target', async () => {
      // Arrange
      render(<InventoryBrowserMain />);

      // Act
      const snapshotButton = await screen.findByRole('button', {
        name: /Sorc · D2S/i,
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
        name: /Sorc · D2S/i,
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
        name: /Sorc · D2S/i,
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
      expect(await screen.findByText('Sorc · D2S')).toBeInTheDocument();
      expect(screen.getByText('Barb · D2S')).toBeInTheDocument();
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
      const dropzone = await screen.findByText('Drop inventory items here to vault');

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
