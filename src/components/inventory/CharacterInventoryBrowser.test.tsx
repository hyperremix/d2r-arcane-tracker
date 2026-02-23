import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CharacterInventoryBrowser } from './CharacterInventoryBrowser';

const searchAllMock = vi.fn();
const searchVaultMock = vi.fn();
const addItemMock = vi.fn();
const iconByFilenameMock = vi.fn();

function createDragDataTransfer(): DataTransfer {
  const data = new Map<string, string>();

  return {
    effectAllowed: 'all',
    setData: (format: string, value: string) => {
      data.set(format, value);
    },
    getData: (format: string) => data.get(format) ?? '',
  } as unknown as DataTransfer;
}

function createBlockedDragDataTransfer(): DataTransfer {
  return {
    effectAllowed: 'all',
    setData: () => {
      // Simulates environments where custom drag payloads are not preserved.
    },
    getData: () => '',
  } as unknown as DataTransfer;
}

describe('When CharacterInventoryBrowser is rendered', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(window, 'electronAPI', {
      writable: true,
      value: {
        inventory: {
          searchAll: searchAllMock,
        },
        vault: {
          addItem: addItemMock,
          search: searchVaultMock,
        },
        icon: {
          getByFilename: iconByFilenameMock,
        },
      },
    });

    iconByFilenameMock.mockResolvedValue(undefined);
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
                  gridY: 2,
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
                gridY: 2,
                gridWidth: 2,
                gridHeight: 2,
                isSocketedItem: false,
                itemName: 'Shako',
                quality: 'unique',
                ethereal: false,
                socketCount: 0,
                iconFileName: 'shako.png',
                rawItemJson: JSON.stringify({
                  name: 'Harlequin Crest',
                  type_name: 'Shako',
                  reqstr: 50,
                  required_level: 62,
                  displayed_combined_magic_attributes: [
                    { description: '+2 To All Skills', visible: true },
                    { description: '+2 To Mana After Each Kill', visible: true },
                  ],
                }),
                rawParsedItem: {},
                seenAt: new Date('2024-01-01T00:00:00.000Z'),
              },
              {
                fingerprint: 'fp-2',
                fingerprintInputs: {
                  sourceFileType: 'd2s',
                  characterName: 'Sorc',
                  locationContext: 'inventory',
                  quality: 'unique',
                  ethereal: false,
                  socketCount: 0,
                  gridX: 2,
                  gridY: 2,
                  gridWidth: 1,
                  gridHeight: 1,
                  isSocketedItem: false,
                  itemName: 'Overlap Item',
                },
                characterName: 'Sorc',
                characterId: 'char-1',
                sourceFileType: 'd2s',
                sourceFilePath: '/tmp/sorc.d2s',
                locationContext: 'inventory',
                type: 'unique',
                gridX: 2,
                gridY: 2,
                gridWidth: 1,
                gridHeight: 1,
                isSocketedItem: false,
                itemName: 'Overlap Item',
                quality: 'unique',
                ethereal: false,
                socketCount: 0,
                iconFileName: 'shako.png',
                rawItemJson: '{}',
                rawParsedItem: {},
                seenAt: new Date('2024-01-01T00:00:00.000Z'),
              },
              {
                fingerprint: 'fp-belt-1',
                fingerprintInputs: {
                  sourceFileType: 'd2s',
                  characterName: 'Sorc',
                  locationContext: 'unknown',
                  quality: 'magic',
                  ethereal: false,
                  socketCount: 0,
                  gridX: 1,
                  gridY: 1,
                  gridWidth: 1,
                  gridHeight: 1,
                  isSocketedItem: false,
                  itemName: 'Super Healing Potion',
                },
                characterName: 'Sorc',
                characterId: 'char-1',
                sourceFileType: 'd2s',
                sourceFilePath: '/tmp/sorc.d2s',
                locationContext: 'unknown',
                type: 'other',
                gridX: 1,
                gridY: 1,
                gridWidth: 1,
                gridHeight: 1,
                isSocketedItem: false,
                itemName: 'Super Healing Potion',
                quality: 'magic',
                ethereal: false,
                socketCount: 0,
                iconFileName: 'hp5.png',
                rawItemJson: '{"location_id":2,"position_x":5}',
                rawParsedItem: {},
                seenAt: new Date('2024-01-01T00:00:00.000Z'),
              },
              {
                fingerprint: 'fp-inventory-overflow-1',
                fingerprintInputs: {
                  sourceFileType: 'd2s',
                  characterName: 'Sorc',
                  locationContext: 'inventory',
                  quality: 'magic',
                  ethereal: false,
                  socketCount: 0,
                  gridX: 12,
                  gridY: 1,
                  gridWidth: 2,
                  gridHeight: 2,
                  isSocketedItem: false,
                  itemName: 'Expanded Inventory Item',
                },
                characterName: 'Sorc',
                characterId: 'char-1',
                sourceFileType: 'd2s',
                sourceFilePath: '/tmp/sorc.d2s',
                locationContext: 'inventory',
                type: 'other',
                gridX: 12,
                gridY: 1,
                gridWidth: 2,
                gridHeight: 2,
                isSocketedItem: false,
                itemName: 'Expanded Inventory Item',
                quality: 'magic',
                ethereal: false,
                socketCount: 0,
                iconFileName: 'invmisc.png',
                rawItemJson:
                  '{"location_id":0,"alt_position_id":1,"position_x":12,"position_y":1,"inv_width":2,"inv_height":2}',
                rawParsedItem: {},
                seenAt: new Date('2024-01-01T00:00:00.000Z'),
              },
            ],
          },
        ],
        totalSnapshots: 1,
        totalItems: 4,
      },
      vault: {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      },
    });
  });

  describe('If cross-search returns inventory and vault data', () => {
    it('Then it renders fixed board sections with canonical cell counts', async () => {
      // Arrange & Act
      render(<CharacterInventoryBrowser />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Selected Item')).toBeInTheDocument();
      });

      const inventoryBoard = screen.getByTestId('inventory-board-snap-1');
      expect(within(inventoryBoard).getAllByTestId('inventory-board-snap-1-cell')).toHaveLength(40);
      expect(within(inventoryBoard).getAllByTestId('inventory-item-tile')).toHaveLength(1);
      expect(document.querySelector('.max-w-7xl')).not.toBeInTheDocument();

      const snapshotSectionsCardContent = inventoryBoard.closest('[data-slot="card-content"]');
      expect(snapshotSectionsCardContent).not.toBeNull();
      expect(snapshotSectionsCardContent?.className).toContain('columns-1');
      expect(snapshotSectionsCardContent?.className).toContain('sm:columns-[28rem]');
      expect(snapshotSectionsCardContent?.className).toContain('[&>*]:mb-4');
      expect(snapshotSectionsCardContent?.className).toContain('[&>*]:break-inside-avoid');
      expect(snapshotSectionsCardContent?.className).not.toContain(
        'sm:grid-cols-[repeat(auto-fit,minmax(24rem,1fr))]',
      );
      expect(snapshotSectionsCardContent?.className).not.toContain('space-y-4');

      const inventoryOverflowBoard = screen.getByTestId('inventory-board-snap-1-raw-overflow');
      expect(
        within(inventoryOverflowBoard).queryAllByTestId('inventory-board-snap-1-raw-overflow-cell'),
      ).toHaveLength(0);
      expect(within(inventoryOverflowBoard).getAllByTestId('inventory-item-tile')).toHaveLength(1);

      const beltBoard = screen.getByTestId('belt-board-snap-1');
      expect(within(beltBoard).getAllByTestId('belt-board-snap-1-cell')).toHaveLength(16);
      expect(within(beltBoard).getAllByTestId('inventory-item-tile')).toHaveLength(1);

      const equippedBoard = screen.getByTestId('equipped-board');
      expect(within(equippedBoard).queryAllByTestId('equipped-board-cell')).toHaveLength(0);
      expect(within(equippedBoard).getAllByTestId('equipped-slot-frame')).toHaveLength(10);
      expect(equippedBoard.style.width).toBe('calc(12 * var(--inv-cell-size) + 11px + 16px)');
      expect(equippedBoard.style.minWidth).toBe('calc(12 * var(--inv-cell-size) + 11px + 16px)');
      expect(equippedBoard.style.maxWidth).toBe('calc(12 * var(--inv-cell-size) + 11px + 16px)');
      expect(equippedBoard.style.height).toBe('calc(8 * var(--inv-cell-size) + 7px + 16px)');
      expect(equippedBoard.style.minHeight).toBe('calc(8 * var(--inv-cell-size) + 7px + 16px)');
      expect(equippedBoard.style.maxHeight).toBe('calc(8 * var(--inv-cell-size) + 7px + 16px)');

      expect(screen.getByText('Drop inventory items here to vault')).toBeInTheDocument();
    });
  });

  describe('If the board tile is rendered', () => {
    it('Then item text is shown in the selected panel instead of on the grid tile', async () => {
      // Arrange & Act
      render(<CharacterInventoryBrowser />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Shako')).toBeInTheDocument();
      });

      const inventoryBoard = screen.getByTestId('inventory-board-snap-1');
      expect(within(inventoryBoard).queryByText('Shako')).not.toBeInTheDocument();
      expect(within(inventoryBoard).getAllByTestId('inventory-item-tile')).toHaveLength(1);
    });
  });

  describe('If a hovered inventory tile has game tooltip data in raw JSON', () => {
    it('Then it renders the Diablo-style game attribute lines', async () => {
      // Arrange
      render(<CharacterInventoryBrowser />);
      await waitFor(() => {
        expect(screen.getByText('Shako')).toBeInTheDocument();
      });

      // Act
      fireEvent.mouseEnter(screen.getByLabelText('Inventory item Shako'));

      // Assert
      await waitFor(() => {
        expect(screen.getByText('+2 To All Skills')).toBeInTheDocument();
      });
    });
  });

  describe('If a hovered inventory tile has sparse raw JSON', () => {
    it('Then it falls back to the existing metadata tooltip', async () => {
      // Arrange
      render(<CharacterInventoryBrowser />);
      await waitFor(() => {
        expect(screen.getByText('Shako')).toBeInTheDocument();
      });

      // Act
      fireEvent.mouseEnter(screen.getByLabelText('Inventory item Overlap Item'));

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Quality/Type:')).toBeInTheDocument();
      });
    });
  });

  describe('If the vault button is pressed for the selected inventory item', () => {
    it('Then it calls the vault addItem API', async () => {
      // Arrange
      render(<CharacterInventoryBrowser />);
      await waitFor(() => {
        expect(screen.getByText('Shako')).toBeInTheDocument();
      });

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Vault' }));

      // Assert
      await waitFor(() => {
        expect(addItemMock).toHaveBeenCalledTimes(1);
      });
      expect(addItemMock.mock.calls[0]?.[0]?.fingerprint).toBe('fp-1');
    });
  });

  describe('If vault items are returned in the search response', () => {
    it('Then it renders vault item tiles above the dropzone', async () => {
      // Arrange
      searchAllMock.mockResolvedValue({
        inventory: { snapshots: [], totalSnapshots: 0, totalItems: 0 },
        vault: {
          items: [
            {
              id: 'vault-item-1',
              fingerprint: 'vfp-1',
              itemName: 'Flail',
              itemCode: 'fla',
              quality: 'unique',
              ethereal: false,
              socketCount: 0,
              rawItemJson: '{"inv_file":"invfla","name":"Flail"}',
              sourceFileType: 'd2s',
              locationContext: 'stash',
              iconFileName: 'flail.png',
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
      render(<CharacterInventoryBrowser />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Vaulted Items')).toBeInTheDocument();
      });
      expect(screen.getByRole('img', { name: 'Inventory item Flail' })).toBeInTheDocument();
      await waitFor(() => {
        expect(iconByFilenameMock).toHaveBeenCalledWith('flail.png');
      });
    });

    it('Then it fetches remaining vault pages and renders items from later pages', async () => {
      // Arrange
      searchAllMock.mockResolvedValueOnce({
        inventory: { snapshots: [], totalSnapshots: 0, totalItems: 0 },
        vault: {
          items: [],
          total: 201,
          page: 1,
          pageSize: 200,
        },
      });
      searchVaultMock.mockResolvedValueOnce({
        items: [
          {
            id: 'vault-item-page-2',
            fingerprint: 'vfp-page-2',
            itemName: 'Skullder',
            itemCode: 'uar',
            quality: 'unique',
            ethereal: false,
            socketCount: 0,
            rawItemJson: '{"inv_file":"invaar","name":"Skullder"}',
            sourceFileType: 'd2s',
            locationContext: 'stash',
            iconFileName: 'skullder.png',
            isPresentInLatestScan: true,
            created: new Date('2024-01-01T00:00:00.000Z'),
            lastUpdated: new Date('2024-01-02T00:00:00.000Z'),
          },
        ],
        total: 201,
        page: 2,
        pageSize: 200,
      });

      // Act
      render(<CharacterInventoryBrowser />);

      // Assert
      await waitFor(() => {
        expect(searchVaultMock).toHaveBeenCalledWith(
          expect.objectContaining({
            page: 2,
            pageSize: 200,
          }),
        );
      });
      expect(screen.getByRole('img', { name: 'Inventory item Skullder' })).toBeInTheDocument();
    });

    it('Then page-2 vault matches still drive inventory tile present status', async () => {
      // Arrange
      searchAllMock.mockResolvedValueOnce({
        inventory: {
          snapshots: [
            {
              snapshotId: 'snap-page-2-presence',
              characterName: 'Sorc',
              characterId: 'char-1',
              sourceFileType: 'd2s',
              sourceFilePath: '/tmp/sorc.d2s',
              capturedAt: new Date('2024-01-01T00:00:00.000Z'),
              items: [
                {
                  fingerprint: 'fp-page-2',
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
                    itemName: 'Page Two Match',
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
                  itemName: 'Page Two Match',
                  quality: 'unique',
                  ethereal: false,
                  socketCount: 0,
                  iconFileName: 'page-two.png',
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
          total: 201,
          page: 1,
          pageSize: 200,
        },
      });
      searchVaultMock.mockResolvedValueOnce({
        items: [
          {
            id: 'vault-item-page-2-match',
            fingerprint: 'fp-page-2',
            itemName: 'Page Two Match',
            itemCode: 'uap',
            quality: 'unique',
            ethereal: false,
            socketCount: 0,
            rawItemJson: '{"name":"Page Two Match"}',
            sourceFileType: 'd2s',
            locationContext: 'inventory',
            iconFileName: 'page-two.png',
            isPresentInLatestScan: true,
            created: new Date('2024-01-01T00:00:00.000Z'),
            lastUpdated: new Date('2024-01-03T00:00:00.000Z'),
          },
        ],
        total: 201,
        page: 2,
        pageSize: 200,
      });

      // Act
      render(<CharacterInventoryBrowser />);

      // Assert
      await waitFor(() => {
        expect(searchVaultMock).toHaveBeenCalledWith(
          expect.objectContaining({
            page: 2,
          }),
        );
      });
      const tile = screen
        .getAllByLabelText('Inventory item Page Two Match')
        .find((element) => element.tagName.toLowerCase() === 'button');
      await waitFor(() => {
        expect(tile?.className).toContain('border-emerald-500/60');
      });
    });
  });

  describe('If vaulting succeeds but backend returns a non-present state', () => {
    it('Then pending optimistic state is cleared and backend truth is shown', async () => {
      // Arrange
      searchAllMock
        .mockResolvedValueOnce({
          inventory: {
            snapshots: [
              {
                snapshotId: 'snap-success-1',
                characterName: 'Sorc',
                characterId: 'char-1',
                sourceFileType: 'd2s',
                sourceFilePath: '/tmp/sorc.d2s',
                capturedAt: new Date('2024-01-01T00:00:00.000Z'),
                items: [
                  {
                    fingerprint: 'fp-success',
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
                      itemName: 'Success Item',
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
                    itemName: 'Success Item',
                    quality: 'unique',
                    ethereal: false,
                    socketCount: 0,
                    iconFileName: 'success-item.png',
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
        })
        .mockResolvedValueOnce({
          inventory: {
            snapshots: [
              {
                snapshotId: 'snap-success-2',
                characterName: 'Sorc',
                characterId: 'char-1',
                sourceFileType: 'd2s',
                sourceFilePath: '/tmp/sorc.d2s',
                capturedAt: new Date('2024-01-01T00:00:00.000Z'),
                items: [
                  {
                    fingerprint: 'fp-success',
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
                      itemName: 'Success Item',
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
                    itemName: 'Success Item',
                    quality: 'unique',
                    ethereal: false,
                    socketCount: 0,
                    iconFileName: 'success-item.png',
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
            items: [
              {
                id: 'vault-success',
                fingerprint: 'fp-success',
                itemName: 'Success Item',
                itemCode: 'uap',
                quality: 'unique',
                ethereal: false,
                socketCount: 0,
                rawItemJson: '{}',
                sourceFileType: 'd2s',
                locationContext: 'inventory',
                iconFileName: 'success-item.png',
                isPresentInLatestScan: false,
                created: new Date('2024-01-01T00:00:00.000Z'),
                lastUpdated: new Date('2024-01-03T00:00:00.000Z'),
              },
            ],
            total: 1,
            page: 1,
            pageSize: 200,
          },
        });
      addItemMock.mockResolvedValueOnce({
        id: 'vault-success',
        fingerprint: 'fp-success',
      });

      render(<CharacterInventoryBrowser />);
      await waitFor(() => {
        expect(screen.getByText('Success Item')).toBeInTheDocument();
      });

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Vault' }));

      // Assert
      await waitFor(() => {
        expect(addItemMock).toHaveBeenCalledTimes(1);
      });
      await waitFor(() => {
        expect(searchAllMock).toHaveBeenCalledTimes(2);
      });
      const tile = screen
        .getAllByLabelText('Inventory item Success Item')
        .find((element) => element.tagName.toLowerCase() === 'button');
      await waitFor(() => {
        expect(tile?.className).toContain('border-amber-500/60');
      });
      expect(tile?.className).not.toContain('border-emerald-500/60');
    });
  });

  describe('If inventory data has missing source file type metadata', () => {
    it('Then it renders a fallback source label instead of crashing', async () => {
      // Arrange
      searchAllMock.mockResolvedValue({
        inventory: {
          snapshots: [
            {
              snapshotId: 'snap-missing-source',
              characterName: 'Sorc',
              characterId: 'char-1',
              sourceFileType: undefined as unknown as 'd2s',
              sourceFilePath: '/tmp/sorc.d2s',
              capturedAt: new Date('2024-01-01T00:00:00.000Z'),
              items: [
                {
                  fingerprint: 'fp-missing-source',
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
                    itemName: 'Missing Source Item',
                  },
                  characterName: 'Sorc',
                  characterId: 'char-1',
                  sourceFileType: undefined as unknown as 'd2s',
                  sourceFilePath: '/tmp/sorc.d2s',
                  locationContext: 'inventory',
                  type: 'unique',
                  gridX: 1,
                  gridY: 1,
                  gridWidth: 2,
                  gridHeight: 2,
                  isSocketedItem: false,
                  itemName: 'Missing Source Item',
                  quality: 'unique',
                  ethereal: false,
                  socketCount: 0,
                  iconFileName: 'shako.png',
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
          pageSize: 20,
        },
      });

      // Act
      render(<CharacterInventoryBrowser />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Sorc · Unknown source file')).toBeInTheDocument();
      });
    });
  });

  describe('If a stash tile is dragged to the vault dropzone', () => {
    it('Then the dropped item is vaulted with stash metadata', async () => {
      // Arrange
      searchAllMock.mockResolvedValue({
        inventory: {
          snapshots: [
            {
              snapshotId: 'stash-snap-1',
              characterName: 'Sorc',
              characterId: 'char-1',
              sourceFileType: 'd2s',
              sourceFilePath: '/tmp/sorc.d2s',
              capturedAt: new Date('2024-01-01T00:00:00.000Z'),
              items: [
                {
                  fingerprint: 'fp-stash-1',
                  fingerprintInputs: {
                    sourceFileType: 'd2s',
                    characterName: 'Sorc',
                    locationContext: 'stash',
                    quality: 'unique',
                    ethereal: false,
                    socketCount: 0,
                    stashTab: 0,
                    gridX: 1,
                    gridY: 1,
                    gridWidth: 2,
                    gridHeight: 3,
                    isSocketedItem: false,
                    itemName: 'Stash Shako',
                  },
                  characterName: 'Sorc',
                  characterId: 'char-1',
                  sourceFileType: 'd2s',
                  sourceFilePath: '/tmp/sorc.d2s',
                  locationContext: 'stash',
                  stashTab: 0,
                  type: 'unique',
                  gridX: 1,
                  gridY: 1,
                  gridWidth: 2,
                  gridHeight: 3,
                  isSocketedItem: false,
                  itemName: 'Stash Shako',
                  quality: 'unique',
                  ethereal: false,
                  socketCount: 0,
                  iconFileName: 'shako.png',
                  rawItemJson: '{"name":"Harlequin Crest"}',
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
          pageSize: 20,
        },
      });

      render(<CharacterInventoryBrowser />);
      await waitFor(() => {
        expect(screen.getByText('Stash Shako')).toBeInTheDocument();
      });

      const draggedTile = screen.getByLabelText('Inventory item Stash Shako');
      const dropzone = screen.getByText('Drop inventory items here to vault');
      const dataTransfer = createDragDataTransfer();

      // Act
      fireEvent.dragStart(draggedTile, { dataTransfer });
      fireEvent.dragOver(dropzone, { dataTransfer });
      fireEvent.drop(dropzone, { dataTransfer });

      // Assert
      await waitFor(() => {
        expect(addItemMock).toHaveBeenCalledTimes(1);
      });
      expect(addItemMock.mock.calls[0]?.[0]?.fingerprint).toBe('fp-stash-1');
      expect(addItemMock.mock.calls[0]?.[0]?.locationContext).toBe('stash');
      expect(addItemMock.mock.calls[0]?.[0]?.stashTab).toBe(0);
    });

    it('Then it still vaults when drag data cannot be read from dataTransfer', async () => {
      // Arrange
      searchAllMock.mockResolvedValue({
        inventory: {
          snapshots: [
            {
              snapshotId: 'stash-snap-2',
              characterName: 'Sorc',
              characterId: 'char-1',
              sourceFileType: 'd2s',
              sourceFilePath: '/tmp/sorc.d2s',
              capturedAt: new Date('2024-01-01T00:00:00.000Z'),
              items: [
                {
                  fingerprint: 'fp-stash-2',
                  fingerprintInputs: {
                    sourceFileType: 'd2s',
                    characterName: 'Sorc',
                    locationContext: 'stash',
                    quality: 'unique',
                    ethereal: false,
                    socketCount: 0,
                    stashTab: 1,
                    gridX: 2,
                    gridY: 2,
                    gridWidth: 2,
                    gridHeight: 3,
                    isSocketedItem: false,
                    itemName: 'Stash Arach',
                  },
                  characterName: 'Sorc',
                  characterId: 'char-1',
                  sourceFileType: 'd2s',
                  sourceFilePath: '/tmp/sorc.d2s',
                  locationContext: 'stash',
                  stashTab: 1,
                  type: 'unique',
                  gridX: 2,
                  gridY: 2,
                  gridWidth: 2,
                  gridHeight: 3,
                  isSocketedItem: false,
                  itemName: 'Stash Arach',
                  quality: 'unique',
                  ethereal: false,
                  socketCount: 0,
                  iconFileName: 'mesh.png',
                  rawItemJson: '{"name":"Arachnid Mesh"}',
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
          pageSize: 20,
        },
      });

      render(<CharacterInventoryBrowser />);
      await waitFor(() => {
        expect(screen.getByText('Stash Arach')).toBeInTheDocument();
      });

      const draggedTile = screen.getByLabelText('Inventory item Stash Arach');
      const dropzone = screen.getByText('Drop inventory items here to vault');
      const blockedDataTransfer = createBlockedDragDataTransfer();

      // Act
      fireEvent.dragStart(draggedTile, { dataTransfer: blockedDataTransfer });
      fireEvent.dragOver(dropzone, { dataTransfer: blockedDataTransfer });
      fireEvent.drop(dropzone, { dataTransfer: blockedDataTransfer });

      // Assert
      await waitFor(() => {
        expect(addItemMock).toHaveBeenCalledTimes(1);
      });
      expect(addItemMock.mock.calls[0]?.[0]?.fingerprint).toBe('fp-stash-2');
      expect(addItemMock.mock.calls[0]?.[0]?.locationContext).toBe('stash');
      expect(addItemMock.mock.calls[0]?.[0]?.stashTab).toBe(1);
    });
  });
});
