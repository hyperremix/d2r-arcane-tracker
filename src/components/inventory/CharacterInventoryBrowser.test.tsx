import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Item } from 'electron/types/grail';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { serializeVaultTextPayload, VAULT_DRAG_MIME } from '@/components/inventory/dragPayloads';
import { useGrailStore } from '@/stores/grailStore';
import { CharacterInventoryBrowser } from './CharacterInventoryBrowser';

const { toastErrorMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: toastErrorMock,
  },
}));

const searchAllMock = vi.fn();
const moveInventoryItemMock = vi.fn();
const searchVaultMock = vi.fn();
const addItemMock = vi.fn();
const unvaultItemMock = vi.fn();
const refreshSaveFilesMock = vi.fn();
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
    toastErrorMock.mockReset();
    useGrailStore.setState({ items: [] });

    Object.defineProperty(window, 'electronAPI', {
      writable: true,
      value: {
        inventory: {
          searchAll: searchAllMock,
          moveItem: moveInventoryItemMock,
        },
        vault: {
          addItem: addItemMock,
          search: searchVaultMock,
          unvaultItem: unvaultItemMock,
        },
        saveFile: {
          refreshSaveFiles: refreshSaveFilesMock,
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
    refreshSaveFilesMock.mockResolvedValue({ success: true });
    moveInventoryItemMock.mockResolvedValue({ success: true });

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

  describe('If grail items are not loaded and grail API is available', () => {
    it('Then it hydrates grail items for inventory icon lookup fallbacks', async () => {
      // Arrange
      const grailItems: Item[] = [
        {
          id: 'harlequincrest',
          name: 'Harlequin Crest',
          link: 'https://example.com/item',
          code: 'uap',
          itemBase: 'Shako',
          imageFilename: 'cap_hat.png',
          etherealType: 'optional',
          type: 'unique',
          category: 'armor',
          subCategory: 'helms',
          treasureClass: 'elite',
        },
      ];
      const grailGetItemsMock = vi.fn().mockResolvedValue(grailItems);
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
          grail: {
            getItems: grailGetItemsMock,
          },
        },
      });

      // Act
      render(<CharacterInventoryBrowser />);

      // Assert
      await waitFor(() => {
        expect(grailGetItemsMock).toHaveBeenCalledTimes(1);
      });
      await waitFor(() => {
        expect(useGrailStore.getState().items).toEqual(grailItems);
      });
    });
  });

  describe('If cross-search returns inventory and vault data', () => {
    it('Then it renders board sections with extended inventory cells merged into the main board', async () => {
      // Arrange & Act
      render(<CharacterInventoryBrowser />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Selected Item')).toBeInTheDocument();
      });

      const inventoryBoard = screen.getByTestId('inventory-board-snap-1');
      expect(within(inventoryBoard).getAllByTestId('inventory-board-snap-1-cell')).toHaveLength(56);
      expect(within(inventoryBoard).getAllByTestId('inventory-item-tile')).toHaveLength(2);
      expect(document.querySelector('.max-w-7xl')).not.toBeInTheDocument();

      const snapshotSectionsCardContent = inventoryBoard.closest('[data-slot="card-content"]');
      expect(snapshotSectionsCardContent).not.toBeNull();
      expect(snapshotSectionsCardContent?.className).toContain('columns-1');
      expect(snapshotSectionsCardContent?.className).toContain('sm:columns-[20rem]');
      expect(snapshotSectionsCardContent?.className).toContain('[&>*]:mb-4');
      expect(snapshotSectionsCardContent?.className).toContain('[&>*]:break-inside-avoid');
      expect(snapshotSectionsCardContent?.className).not.toContain(
        'sm:grid-cols-[repeat(auto-fit,minmax(24rem,1fr))]',
      );
      expect(snapshotSectionsCardContent?.className).not.toContain('space-y-4');

      expect(screen.queryByTestId('inventory-board-snap-1-raw-overflow')).not.toBeInTheDocument();

      const beltBoard = screen.getByTestId('belt-board-snap-1');
      expect(within(beltBoard).getAllByTestId('belt-board-snap-1-cell')).toHaveLength(16);
      expect(within(beltBoard).getAllByTestId('inventory-item-tile')).toHaveLength(1);

      const equippedBoard = screen.getByTestId('equipped-board');
      expect(within(equippedBoard).queryAllByTestId('equipped-board-cell')).toHaveLength(0);
      expect(within(equippedBoard).getAllByTestId('equipped-slot-frame')).toHaveLength(10);
      expect(equippedBoard.style.width).toBe('calc(8 * var(--inv-cell-size) + 7px + 16px)');
      expect(equippedBoard.style.minWidth).toBe('calc(8 * var(--inv-cell-size) + 7px + 16px)');
      expect(equippedBoard.style.maxWidth).toBe('calc(8 * var(--inv-cell-size) + 7px + 16px)');
      expect(equippedBoard.style.height).toBe('calc(8 * var(--inv-cell-size) + 7px + 16px)');
      expect(equippedBoard.style.minHeight).toBe('calc(8 * var(--inv-cell-size) + 7px + 16px)');
      expect(equippedBoard.style.maxHeight).toBe('calc(8 * var(--inv-cell-size) + 7px + 16px)');

      expect(screen.getByText('Drop inventory items here to vault')).toBeInTheDocument();
    });

    it('Then it renders extended stash cells in the same stash board without a separate overflow board', async () => {
      // Arrange
      searchAllMock.mockResolvedValueOnce({
        inventory: {
          snapshots: [
            {
              snapshotId: 'stash-snap',
              characterName: 'Sorc',
              characterId: 'char-1',
              sourceFileType: 'd2s',
              sourceFilePath: '/tmp/sorc.d2s',
              capturedAt: new Date('2024-01-01T00:00:00.000Z'),
              items: [
                {
                  fingerprint: 'fp-stash-normal',
                  fingerprintInputs: {
                    sourceFileType: 'd2s',
                    characterName: 'Sorc',
                    locationContext: 'stash',
                    stashTab: 0,
                    quality: 'magic',
                    ethereal: false,
                    socketCount: 0,
                    gridX: 1,
                    gridY: 1,
                    gridWidth: 2,
                    gridHeight: 2,
                    isSocketedItem: false,
                    itemName: 'Stash Normal',
                  },
                  characterName: 'Sorc',
                  characterId: 'char-1',
                  sourceFileType: 'd2s',
                  sourceFilePath: '/tmp/sorc.d2s',
                  locationContext: 'stash',
                  stashTab: 0,
                  type: 'other',
                  gridX: 1,
                  gridY: 1,
                  gridWidth: 2,
                  gridHeight: 2,
                  isSocketedItem: false,
                  itemName: 'Stash Normal',
                  quality: 'magic',
                  ethereal: false,
                  socketCount: 0,
                  iconFileName: 'stashnormal.png',
                  rawItemJson: '{}',
                  rawParsedItem: {},
                  seenAt: new Date('2024-01-01T00:00:00.000Z'),
                },
                {
                  fingerprint: 'fp-stash-expanded',
                  fingerprintInputs: {
                    sourceFileType: 'd2s',
                    characterName: 'Sorc',
                    locationContext: 'stash',
                    stashTab: 0,
                    quality: 'magic',
                    ethereal: false,
                    socketCount: 0,
                    gridX: 12,
                    gridY: 1,
                    gridWidth: 2,
                    gridHeight: 2,
                    isSocketedItem: false,
                    itemName: 'Stash Expanded',
                  },
                  characterName: 'Sorc',
                  characterId: 'char-1',
                  sourceFileType: 'd2s',
                  sourceFilePath: '/tmp/sorc.d2s',
                  locationContext: 'stash',
                  stashTab: 0,
                  type: 'other',
                  gridX: 12,
                  gridY: 1,
                  gridWidth: 2,
                  gridHeight: 2,
                  isSocketedItem: false,
                  itemName: 'Stash Expanded',
                  quality: 'magic',
                  ethereal: false,
                  socketCount: 0,
                  iconFileName: 'stashexpanded.png',
                  rawItemJson: '{}',
                  rawParsedItem: {},
                  seenAt: new Date('2024-01-01T00:00:00.000Z'),
                },
              ],
            },
          ],
          totalSnapshots: 1,
          totalItems: 2,
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
        expect(screen.getByText('Selected Item')).toBeInTheDocument();
      });

      const stashBoard = screen.getByTestId('stash-board-stash-snap-0');
      expect(within(stashBoard).getAllByTestId('stash-board-stash-snap-0-cell')).toHaveLength(140);
      expect(within(stashBoard).getAllByTestId('inventory-item-tile')).toHaveLength(2);
      expect(screen.queryByTestId('stash-board-stash-snap-0-raw-overflow')).not.toBeInTheDocument();
    });

    it('Then stash save snapshots render only stash sections and hide equipped, inventory, mercenary, and corpse', async () => {
      // Arrange
      searchAllMock.mockResolvedValueOnce({
        inventory: {
          snapshots: [
            {
              snapshotId: 'shared-stash-snap',
              characterName: 'Shared Stash Softcore',
              characterId: 'shared-stash',
              sourceFileType: 'd2i',
              sourceFilePath: '/tmp/shared.d2i',
              capturedAt: new Date('2024-01-01T00:00:00.000Z'),
              items: [
                {
                  fingerprint: 'fp-stash-only',
                  fingerprintInputs: {
                    sourceFileType: 'd2i',
                    characterName: 'Shared Stash Softcore',
                    locationContext: 'stash',
                    stashTab: 0,
                    quality: 'magic',
                    ethereal: false,
                    socketCount: 0,
                    gridX: 0,
                    gridY: 0,
                    gridWidth: 2,
                    gridHeight: 2,
                    isSocketedItem: false,
                    itemName: 'Stash Item',
                  },
                  characterName: 'Shared Stash Softcore',
                  characterId: 'shared-stash',
                  sourceFileType: 'd2i',
                  sourceFilePath: '/tmp/shared.d2i',
                  locationContext: 'stash',
                  stashTab: 0,
                  type: 'other',
                  gridX: 0,
                  gridY: 0,
                  gridWidth: 2,
                  gridHeight: 2,
                  isSocketedItem: false,
                  itemName: 'Stash Item',
                  quality: 'magic',
                  ethereal: false,
                  socketCount: 0,
                  iconFileName: 'stashitem.png',
                  rawItemJson: '{}',
                  rawParsedItem: {},
                  seenAt: new Date('2024-01-01T00:00:00.000Z'),
                },
                {
                  fingerprint: 'fp-should-hide-equipped',
                  fingerprintInputs: {
                    sourceFileType: 'd2i',
                    characterName: 'Shared Stash Softcore',
                    locationContext: 'equipped',
                    quality: 'magic',
                    ethereal: false,
                    socketCount: 0,
                    equippedSlotId: 4,
                    isSocketedItem: false,
                    itemName: 'Hidden Equipped',
                  },
                  characterName: 'Shared Stash Softcore',
                  characterId: 'shared-stash',
                  sourceFileType: 'd2i',
                  sourceFilePath: '/tmp/shared.d2i',
                  locationContext: 'equipped',
                  equippedSlotId: 4,
                  type: 'other',
                  isSocketedItem: false,
                  itemName: 'Hidden Equipped',
                  quality: 'magic',
                  ethereal: false,
                  socketCount: 0,
                  iconFileName: 'hidden.png',
                  rawItemJson: '{}',
                  rawParsedItem: {},
                  seenAt: new Date('2024-01-01T00:00:00.000Z'),
                },
                {
                  fingerprint: 'fp-should-hide-inventory',
                  fingerprintInputs: {
                    sourceFileType: 'd2i',
                    characterName: 'Shared Stash Softcore',
                    locationContext: 'inventory',
                    quality: 'magic',
                    ethereal: false,
                    socketCount: 0,
                    gridX: 0,
                    gridY: 0,
                    gridWidth: 1,
                    gridHeight: 1,
                    isSocketedItem: false,
                    itemName: 'Hidden Inventory',
                  },
                  characterName: 'Shared Stash Softcore',
                  characterId: 'shared-stash',
                  sourceFileType: 'd2i',
                  sourceFilePath: '/tmp/shared.d2i',
                  locationContext: 'inventory',
                  type: 'other',
                  gridX: 0,
                  gridY: 0,
                  gridWidth: 1,
                  gridHeight: 1,
                  isSocketedItem: false,
                  itemName: 'Hidden Inventory',
                  quality: 'magic',
                  ethereal: false,
                  socketCount: 0,
                  iconFileName: 'hidden.png',
                  rawItemJson: '{}',
                  rawParsedItem: {},
                  seenAt: new Date('2024-01-01T00:00:00.000Z'),
                },
                {
                  fingerprint: 'fp-should-hide-mercenary',
                  fingerprintInputs: {
                    sourceFileType: 'd2i',
                    characterName: 'Shared Stash Softcore',
                    locationContext: 'mercenary',
                    quality: 'magic',
                    ethereal: false,
                    socketCount: 0,
                    equippedSlotId: 4,
                    isSocketedItem: false,
                    itemName: 'Hidden Mercenary',
                  },
                  characterName: 'Shared Stash Softcore',
                  characterId: 'shared-stash',
                  sourceFileType: 'd2i',
                  sourceFilePath: '/tmp/shared.d2i',
                  locationContext: 'mercenary',
                  equippedSlotId: 4,
                  type: 'other',
                  isSocketedItem: false,
                  itemName: 'Hidden Mercenary',
                  quality: 'magic',
                  ethereal: false,
                  socketCount: 0,
                  iconFileName: 'hidden.png',
                  rawItemJson: '{}',
                  rawParsedItem: {},
                  seenAt: new Date('2024-01-01T00:00:00.000Z'),
                },
                {
                  fingerprint: 'fp-should-hide-corpse',
                  fingerprintInputs: {
                    sourceFileType: 'd2i',
                    characterName: 'Shared Stash Softcore',
                    locationContext: 'corpse',
                    quality: 'magic',
                    ethereal: false,
                    socketCount: 0,
                    gridX: 0,
                    gridY: 0,
                    gridWidth: 1,
                    gridHeight: 1,
                    isSocketedItem: false,
                    itemName: 'Hidden Corpse',
                  },
                  characterName: 'Shared Stash Softcore',
                  characterId: 'shared-stash',
                  sourceFileType: 'd2i',
                  sourceFilePath: '/tmp/shared.d2i',
                  locationContext: 'corpse',
                  type: 'other',
                  gridX: 0,
                  gridY: 0,
                  gridWidth: 1,
                  gridHeight: 1,
                  isSocketedItem: false,
                  itemName: 'Hidden Corpse',
                  quality: 'magic',
                  ethereal: false,
                  socketCount: 0,
                  iconFileName: 'hidden.png',
                  rawItemJson: '{}',
                  rawParsedItem: {},
                  seenAt: new Date('2024-01-01T00:00:00.000Z'),
                },
              ],
            },
          ],
          totalSnapshots: 1,
          totalItems: 5,
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
        expect(screen.getByText('Selected Item')).toBeInTheDocument();
      });
      expect(screen.getByTestId('stash-board-shared-stash-snap-0')).toBeInTheDocument();
      expect(screen.queryByTestId('equipped-board')).not.toBeInTheDocument();
      expect(screen.queryByTestId('inventory-board-shared-stash-snap')).not.toBeInTheDocument();
      expect(screen.queryByTestId('mercenary-board-shared-stash-snap')).not.toBeInTheDocument();
      expect(screen.queryByTestId('corpse-board-shared-stash-snap')).not.toBeInTheDocument();
    });

    it('Then modern stash snapshots show modern tab labels, stack badges, and disable drag', async () => {
      // Arrange
      searchAllMock.mockResolvedValueOnce({
        inventory: {
          snapshots: [
            {
              snapshotId: 'modern-stash-snap',
              characterName: 'Shared Stash Softcore',
              characterId: 'shared-stash',
              sourceFileType: 'd2i',
              sourceFilePath: '/tmp/modern-shared.d2i',
              sourceFileVersion: 105,
              readOnly: true,
              capturedAt: new Date('2024-01-01T00:00:00.000Z'),
              items: [
                {
                  fingerprint: 'fp-gems',
                  fingerprintInputs: {
                    sourceFileType: 'd2i',
                    characterName: 'Shared Stash Softcore',
                    locationContext: 'stash',
                    stashTab: 5,
                    quality: 'normal',
                    ethereal: false,
                    socketCount: 0,
                    gridX: 0,
                    gridY: 0,
                    gridWidth: 1,
                    gridHeight: 1,
                    isSocketedItem: false,
                    itemName: 'Perfect Ruby',
                  },
                  characterName: 'Shared Stash Softcore',
                  sourceFileType: 'd2i',
                  sourceFilePath: '/tmp/modern-shared.d2i',
                  locationContext: 'stash',
                  stashTab: 5,
                  stashTabKind: 'gems',
                  type: 'other',
                  itemCode: 'gpr',
                  gridX: 0,
                  gridY: 0,
                  gridWidth: 1,
                  gridHeight: 1,
                  isSocketedItem: false,
                  itemName: 'Perfect Ruby',
                  quality: 'normal',
                  ethereal: false,
                  socketCount: 0,
                  stackCount: 7,
                  iconFileName: 'gpr.png',
                  rawItemJson: '{"id":301,"type":"gpr"}',
                  rawParsedItem: {},
                  seenAt: new Date('2024-01-01T00:00:00.000Z'),
                },
                {
                  fingerprint: 'fp-material',
                  fingerprintInputs: {
                    sourceFileType: 'd2i',
                    characterName: 'Shared Stash Softcore',
                    locationContext: 'stash',
                    stashTab: 6,
                    quality: 'normal',
                    ethereal: false,
                    socketCount: 0,
                    gridX: 1,
                    gridY: 0,
                    gridWidth: 1,
                    gridHeight: 1,
                    isSocketedItem: false,
                    itemName: 'Terror Key',
                  },
                  characterName: 'Shared Stash Softcore',
                  sourceFileType: 'd2i',
                  sourceFilePath: '/tmp/modern-shared.d2i',
                  locationContext: 'stash',
                  stashTab: 6,
                  stashTabKind: 'materials',
                  type: 'other',
                  itemCode: 'pk1',
                  gridX: 1,
                  gridY: 0,
                  gridWidth: 1,
                  gridHeight: 1,
                  isSocketedItem: false,
                  itemName: 'Terror Key',
                  quality: 'normal',
                  ethereal: false,
                  socketCount: 0,
                  stackCount: 3,
                  iconFileName: 'pk1.png',
                  rawItemJson: '{"id":302,"type":"pk1"}',
                  rawParsedItem: {},
                  seenAt: new Date('2024-01-01T00:00:00.000Z'),
                },
                {
                  fingerprint: 'fp-rune',
                  fingerprintInputs: {
                    sourceFileType: 'd2i',
                    characterName: 'Shared Stash Softcore',
                    locationContext: 'stash',
                    stashTab: 7,
                    quality: 'normal',
                    ethereal: false,
                    socketCount: 0,
                    gridX: 2,
                    gridY: 0,
                    gridWidth: 1,
                    gridHeight: 1,
                    isSocketedItem: false,
                    itemName: 'Fal Rune',
                  },
                  characterName: 'Shared Stash Softcore',
                  sourceFileType: 'd2i',
                  sourceFilePath: '/tmp/modern-shared.d2i',
                  locationContext: 'stash',
                  stashTab: 7,
                  stashTabKind: 'runes',
                  type: 'rune',
                  itemCode: 'r19',
                  gridX: 2,
                  gridY: 0,
                  gridWidth: 1,
                  gridHeight: 1,
                  isSocketedItem: false,
                  itemName: 'Fal Rune',
                  quality: 'normal',
                  ethereal: false,
                  socketCount: 0,
                  stackCount: 2,
                  iconFileName: 'r19.png',
                  rawItemJson: '{"id":303,"type":"r19"}',
                  rawParsedItem: {},
                  seenAt: new Date('2024-01-01T00:00:00.000Z'),
                },
              ],
            },
          ],
          totalSnapshots: 1,
          totalItems: 3,
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
        expect(screen.getByText('Selected Item')).toBeInTheDocument();
      });
      expect(screen.getByText('Gems')).toBeInTheDocument();
      expect(screen.getByText('Materials')).toBeInTheDocument();
      expect(screen.getByText('Runes')).toBeInTheDocument();
      expect(screen.getAllByTestId('inventory-item-stack-count')[0]).toHaveTextContent('7');

      const gemsTile = screen.getByLabelText('Inventory item Perfect Ruby');
      expect(gemsTile).toHaveAttribute('draggable', 'false');
    });

    it('Then modern stash snapshots render all modern tabs even when some are empty', async () => {
      // Arrange
      searchAllMock.mockResolvedValueOnce({
        inventory: {
          snapshots: [
            {
              snapshotId: 'modern-empty-tabs-snap',
              characterName: 'Modern Shared Stash Softcore',
              characterId: 'modern-shared-stash',
              sourceFileType: 'd2i',
              sourceFilePath: '/tmp/modern-empty-tabs.d2i',
              sourceFileVersion: 105,
              readOnly: true,
              capturedAt: new Date('2024-01-01T00:00:00.000Z'),
              items: [
                {
                  fingerprint: 'fp-material',
                  fingerprintInputs: {
                    sourceFileType: 'd2i',
                    characterName: 'Modern Shared Stash Softcore',
                    locationContext: 'stash',
                    stashTab: 6,
                    quality: 'normal',
                    ethereal: false,
                    socketCount: 0,
                    gridX: 1,
                    gridY: 0,
                    gridWidth: 1,
                    gridHeight: 1,
                    isSocketedItem: false,
                    itemName: 'Terror Key',
                  },
                  characterName: 'Modern Shared Stash Softcore',
                  sourceFileType: 'd2i',
                  sourceFilePath: '/tmp/modern-empty-tabs.d2i',
                  locationContext: 'stash',
                  stashTab: 6,
                  stashTabKind: 'materials',
                  type: 'other',
                  itemCode: 'pk1',
                  gridX: 1,
                  gridY: 0,
                  gridWidth: 1,
                  gridHeight: 1,
                  isSocketedItem: false,
                  itemName: 'Terror Key',
                  quality: 'normal',
                  ethereal: false,
                  socketCount: 0,
                  stackCount: 3,
                  iconFileName: 'pk1.png',
                  rawItemJson: '{"id":302,"type":"pk1"}',
                  rawParsedItem: {},
                  seenAt: new Date('2024-01-01T00:00:00.000Z'),
                },
                {
                  fingerprint: 'fp-rune',
                  fingerprintInputs: {
                    sourceFileType: 'd2i',
                    characterName: 'Modern Shared Stash Softcore',
                    locationContext: 'stash',
                    stashTab: 7,
                    quality: 'normal',
                    ethereal: false,
                    socketCount: 0,
                    gridX: 2,
                    gridY: 0,
                    gridWidth: 1,
                    gridHeight: 1,
                    isSocketedItem: false,
                    itemName: 'Fal Rune',
                  },
                  characterName: 'Modern Shared Stash Softcore',
                  sourceFileType: 'd2i',
                  sourceFilePath: '/tmp/modern-empty-tabs.d2i',
                  locationContext: 'stash',
                  stashTab: 7,
                  stashTabKind: 'runes',
                  type: 'rune',
                  itemCode: 'r19',
                  gridX: 2,
                  gridY: 0,
                  gridWidth: 1,
                  gridHeight: 1,
                  isSocketedItem: false,
                  itemName: 'Fal Rune',
                  quality: 'normal',
                  ethereal: false,
                  socketCount: 0,
                  stackCount: 2,
                  iconFileName: 'r19.png',
                  rawItemJson: '{"id":303,"type":"r19"}',
                  rawParsedItem: {},
                  seenAt: new Date('2024-01-01T00:00:00.000Z'),
                },
              ],
            },
          ],
          totalSnapshots: 1,
          totalItems: 2,
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
        expect(screen.getByText('Selected Item')).toBeInTheDocument();
      });
      expect(screen.getByText('Shared Tab 1')).toBeInTheDocument();
      expect(screen.getByText('Shared Tab 2')).toBeInTheDocument();
      expect(screen.getByText('Shared Tab 3')).toBeInTheDocument();
      expect(screen.getByText('Shared Tab 4')).toBeInTheDocument();
      expect(screen.getByText('Shared Tab 5')).toBeInTheDocument();
      expect(screen.getByText('Gems')).toBeInTheDocument();
      expect(screen.getByText('Materials')).toBeInTheDocument();
      expect(screen.getByText('Runes')).toBeInTheDocument();
      expect(screen.getByTestId('stash-board-modern-empty-tabs-snap-5')).toBeInTheDocument();
    });

    it('Then overlapping resource entries are still fully visible in modern stash sections', async () => {
      // Arrange
      searchAllMock.mockResolvedValueOnce({
        inventory: {
          snapshots: [
            {
              snapshotId: 'modern-overlap-snap',
              characterName: 'Modern Shared Stash Softcore',
              characterId: 'modern-shared-stash',
              sourceFileType: 'd2i',
              sourceFilePath: '/tmp/modern-overlap.d2i',
              sourceFileVersion: 105,
              readOnly: true,
              capturedAt: new Date('2024-01-01T00:00:00.000Z'),
              items: [
                {
                  fingerprint: 'fp-rune-1',
                  fingerprintInputs: {
                    sourceFileType: 'd2i',
                    characterName: 'Modern Shared Stash Softcore',
                    locationContext: 'stash',
                    stashTab: 7,
                    quality: 'normal',
                    ethereal: false,
                    socketCount: 0,
                    gridX: 0,
                    gridY: 0,
                    gridWidth: 1,
                    gridHeight: 1,
                    isSocketedItem: false,
                    itemName: 'El Rune',
                  },
                  characterName: 'Modern Shared Stash Softcore',
                  sourceFileType: 'd2i',
                  sourceFilePath: '/tmp/modern-overlap.d2i',
                  locationContext: 'stash',
                  stashTab: 7,
                  stashTabKind: 'runes',
                  type: 'rune',
                  itemCode: 'r01',
                  gridX: 0,
                  gridY: 0,
                  gridWidth: 1,
                  gridHeight: 1,
                  isSocketedItem: false,
                  itemName: 'El Rune',
                  quality: 'normal',
                  ethereal: false,
                  socketCount: 0,
                  stackCount: 1,
                  iconFileName: 'r01.png',
                  rawItemJson: '{"type":"r01"}',
                  rawParsedItem: {},
                  seenAt: new Date('2024-01-01T00:00:00.000Z'),
                },
                {
                  fingerprint: 'fp-rune-2',
                  fingerprintInputs: {
                    sourceFileType: 'd2i',
                    characterName: 'Modern Shared Stash Softcore',
                    locationContext: 'stash',
                    stashTab: 7,
                    quality: 'normal',
                    ethereal: false,
                    socketCount: 0,
                    gridX: 0,
                    gridY: 0,
                    gridWidth: 1,
                    gridHeight: 1,
                    isSocketedItem: false,
                    itemName: 'Eld Rune',
                  },
                  characterName: 'Modern Shared Stash Softcore',
                  sourceFileType: 'd2i',
                  sourceFilePath: '/tmp/modern-overlap.d2i',
                  locationContext: 'stash',
                  stashTab: 7,
                  stashTabKind: 'runes',
                  type: 'rune',
                  itemCode: 'r02',
                  gridX: 0,
                  gridY: 0,
                  gridWidth: 1,
                  gridHeight: 1,
                  isSocketedItem: false,
                  itemName: 'Eld Rune',
                  quality: 'normal',
                  ethereal: false,
                  socketCount: 0,
                  stackCount: 1,
                  iconFileName: 'r02.png',
                  rawItemJson: '{"type":"r02"}',
                  rawParsedItem: {},
                  seenAt: new Date('2024-01-01T00:00:00.000Z'),
                },
              ],
            },
          ],
          totalSnapshots: 1,
          totalItems: 2,
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
        expect(screen.getByText('Selected Item')).toBeInTheDocument();
      });
      expect(screen.getByLabelText('Inventory item El Rune')).toBeInTheDocument();
      expect(screen.getByLabelText('Inventory item Eld Rune')).toBeInTheDocument();
    });
  });

  describe('If mercenary items are rendered in inventory snapshots', () => {
    function createMercenaryItem(params: {
      fingerprint: string;
      itemName: string;
      equippedSlotId: number;
      type?: string;
      quality?: string;
      rawItemJson?: string;
    }) {
      const type = params.type ?? 'other';
      const quality = params.quality ?? type;
      const rawItemJson =
        params.rawItemJson ?? JSON.stringify({ equipped_id: params.equippedSlotId });

      return {
        fingerprint: params.fingerprint,
        fingerprintInputs: {
          sourceFileType: 'd2s',
          characterName: 'Sorc',
          locationContext: 'mercenary',
          quality,
          ethereal: false,
          socketCount: 0,
          equippedSlotId: params.equippedSlotId,
          isSocketedItem: false,
          itemName: params.itemName,
        },
        characterName: 'Sorc',
        characterId: 'char-1',
        sourceFileType: 'd2s',
        sourceFilePath: '/tmp/sorc.d2s',
        locationContext: 'mercenary',
        equippedSlotId: params.equippedSlotId,
        type,
        isSocketedItem: false,
        itemName: params.itemName,
        quality,
        ethereal: false,
        socketCount: 0,
        iconFileName: 'merc-item.png',
        rawItemJson,
        rawParsedItem: {},
        seenAt: new Date('2024-01-01T00:00:00.000Z'),
      };
    }

    it('Then it renders four default mercenary slots and displays Insight in a hand slot', async () => {
      // Arrange
      searchAllMock.mockResolvedValueOnce({
        inventory: {
          snapshots: [
            {
              snapshotId: 'merc-snap',
              characterName: 'Sorc',
              characterId: 'char-1',
              sourceFileType: 'd2s',
              sourceFilePath: '/tmp/sorc.d2s',
              capturedAt: new Date('2024-01-01T00:00:00.000Z'),
              items: [
                createMercenaryItem({
                  fingerprint: 'merc-insight',
                  itemName: 'Insight',
                  equippedSlotId: 4,
                  type: 'runeword',
                  quality: 'runeword',
                }),
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
        expect(screen.getByText('Selected Item')).toBeInTheDocument();
      });
      const mercenaryBoard = screen.getByTestId('mercenary-board-merc-snap');
      expect(within(mercenaryBoard).getAllByTestId('mercenary-slot-frame')).toHaveLength(4);
      expect(screen.getByLabelText('Inventory item Insight')).toBeInTheDocument();
    });

    it('Then it appends only occupied modded extra slots beyond the default four', async () => {
      // Arrange
      searchAllMock.mockResolvedValueOnce({
        inventory: {
          snapshots: [
            {
              snapshotId: 'merc-modded',
              characterName: 'Sorc',
              characterId: 'char-1',
              sourceFileType: 'd2s',
              sourceFilePath: '/tmp/sorc.d2s',
              capturedAt: new Date('2024-01-01T00:00:00.000Z'),
              items: [
                createMercenaryItem({
                  fingerprint: 'merc-weapon',
                  itemName: 'Polearm',
                  equippedSlotId: 4,
                }),
                createMercenaryItem({
                  fingerprint: 'merc-mod-amulet',
                  itemName: 'Modded Amulet',
                  equippedSlotId: 2,
                }),
              ],
            },
          ],
          totalSnapshots: 1,
          totalItems: 2,
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
        expect(screen.getByText('Selected Item')).toBeInTheDocument();
      });
      const mercenaryBoard = screen.getByTestId('mercenary-board-merc-modded');
      expect(within(mercenaryBoard).getAllByTestId('mercenary-slot-frame')).toHaveLength(5);
      expect(screen.getByLabelText('Inventory item Modded Amulet')).toBeInTheDocument();
    });

    it('Then items with unknown mercenary slot IDs are shown in mercenary unplaced output', async () => {
      // Arrange
      searchAllMock.mockResolvedValueOnce({
        inventory: {
          snapshots: [
            {
              snapshotId: 'merc-unknown',
              characterName: 'Sorc',
              characterId: 'char-1',
              sourceFileType: 'd2s',
              sourceFilePath: '/tmp/sorc.d2s',
              capturedAt: new Date('2024-01-01T00:00:00.000Z'),
              items: [
                createMercenaryItem({
                  fingerprint: 'merc-weapon',
                  itemName: 'Eth Thresher',
                  equippedSlotId: 4,
                }),
                createMercenaryItem({
                  fingerprint: 'merc-unknown-slot',
                  itemName: 'Modded Relic',
                  equippedSlotId: 15,
                  rawItemJson: JSON.stringify({ equipped_id: 15 }),
                }),
              ],
            },
          ],
          totalSnapshots: 1,
          totalItems: 2,
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
      const mercenaryBoard = await waitFor(() =>
        screen.getByTestId('mercenary-board-merc-unknown'),
      );
      expect(within(mercenaryBoard).getAllByTestId('mercenary-slot-frame')).toHaveLength(4);
      const unplacedMercenaryItems = screen.getByTestId('mercenary-board-merc-unknown-unplaced');
      expect(
        within(unplacedMercenaryItems).getByLabelText('Inventory item Modded Relic'),
      ).toBeInTheDocument();
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
      expect(within(inventoryBoard).getAllByTestId('inventory-item-tile')).toHaveLength(2);
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

  describe('If a hovered inventory tile has filled and open sockets in raw JSON', () => {
    it('Then it renders socketed item rows and one open-socket row per empty slot', async () => {
      // Arrange
      searchAllMock.mockResolvedValueOnce({
        inventory: {
          snapshots: [
            {
              snapshotId: 'snap-sockets',
              characterName: 'Sorc',
              characterId: 'char-1',
              sourceFileType: 'd2s',
              sourceFilePath: '/tmp/sorc.d2s',
              capturedAt: new Date('2024-01-01T00:00:00.000Z'),
              items: [
                {
                  fingerprint: 'fp-sockets',
                  fingerprintInputs: {
                    sourceFileType: 'd2s',
                    characterName: 'Sorc',
                    locationContext: 'inventory',
                    quality: 'magic',
                    ethereal: false,
                    socketCount: 3,
                    gridX: 1,
                    gridY: 1,
                    gridWidth: 2,
                    gridHeight: 2,
                    isSocketedItem: false,
                    itemName: 'Socketed Circlet',
                  },
                  characterName: 'Sorc',
                  characterId: 'char-1',
                  sourceFileType: 'd2s',
                  sourceFilePath: '/tmp/sorc.d2s',
                  locationContext: 'inventory',
                  type: 'magic',
                  gridX: 1,
                  gridY: 1,
                  gridWidth: 2,
                  gridHeight: 2,
                  isSocketedItem: false,
                  itemName: 'Socketed Circlet',
                  quality: 'magic',
                  ethereal: false,
                  socketCount: 3,
                  iconFileName: 'circlet.png',
                  rawItemJson: JSON.stringify({
                    name: 'Socketed Circlet',
                    type_name: 'Circlet',
                    total_nr_of_sockets: 3,
                    nr_of_items_in_sockets: 1,
                    socketed_items: [{ name: 'Jah Rune', code: 'r31', inv_file: 'invjah' }],
                  }),
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
        expect(screen.getByText('Socketed Circlet')).toBeInTheDocument();
      });
      const inventoryTile = screen.getByLabelText('Inventory item Socketed Circlet');
      expect(within(inventoryTile).queryByTestId('item-socket-overlay')).not.toBeInTheDocument();

      // Act
      fireEvent.mouseEnter(screen.getByLabelText('Inventory item Socketed Circlet'));

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Jah Rune')).toBeInTheDocument();
      });
      expect(within(inventoryTile).getAllByTestId('item-socket-overlay-filled-slot')).toHaveLength(
        1,
      );
      expect(within(inventoryTile).getAllByTestId('item-socket-overlay-open-slot')).toHaveLength(2);
      expect(screen.getAllByText('Open Socket')).toHaveLength(2);
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

    it('Then it passes sourceFilePath from the inventory item to the vault addItem API', async () => {
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
      expect(addItemMock.mock.calls[0]?.[0]?.sourceFilePath).toBe('/tmp/sorc.d2s');
    });
  });

  describe('If vault items are returned in the search response', () => {
    it('Then it renders vault item tiles in the Vaulted Items section', async () => {
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
              vaultedAt: new Date('2024-01-01T00:00:00.000Z'),
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
      await waitFor(() => {
        expect(iconByFilenameMock).toHaveBeenCalledWith('flail.png');
      });
    });

    it('Then hovering the vault tile renders socketed and open socket rows', async () => {
      // Arrange
      searchAllMock.mockResolvedValueOnce({
        inventory: { snapshots: [], totalSnapshots: 0, totalItems: 0 },
        vault: {
          items: [
            {
              id: 'vault-item-socketed',
              fingerprint: 'vfp-socketed',
              itemName: 'Socketed Shield',
              itemCode: 'tow',
              quality: 'normal',
              ethereal: false,
              socketCount: 3,
              rawItemJson: JSON.stringify({
                name: 'Socketed Shield',
                total_nr_of_sockets: 3,
                nr_of_items_in_sockets: 1,
                socketed_items: [{ name: 'Ist Rune', code: 'r24', inv_file: 'invist' }],
              }),
              sourceFileType: 'd2s',
              locationContext: 'stash',
              iconFileName: 'shield.png',
              vaultedAt: new Date('2024-01-01T00:00:00.000Z'),
              created: new Date('2024-01-01T00:00:00.000Z'),
              lastUpdated: new Date('2024-01-01T00:00:00.000Z'),
            },
          ],
          total: 1,
          page: 1,
          pageSize: 200,
        },
      });

      render(<CharacterInventoryBrowser />);
      await waitFor(() => {
        expect(screen.getByLabelText('Vaulted item Socketed Shield')).toBeInTheDocument();
      });
      const vaultTile = screen.getByLabelText('Vaulted item Socketed Shield');
      expect(within(vaultTile).queryByTestId('item-socket-overlay')).not.toBeInTheDocument();

      // Act
      fireEvent.mouseEnter(screen.getByLabelText('Vaulted item Socketed Shield'));

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Ist Rune')).toBeInTheDocument();
      });
      expect(within(vaultTile).getAllByTestId('item-socket-overlay-filled-slot')).toHaveLength(1);
      expect(within(vaultTile).getAllByTestId('item-socket-overlay-open-slot')).toHaveLength(2);
      expect(screen.getAllByText('Open Socket')).toHaveLength(2);
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
            vaultedAt: new Date('2024-01-01T00:00:00.000Z'),
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
      await waitFor(() => {
        expect(screen.getByText('Vaulted Items')).toBeInTheDocument();
      });
    });

    it('Then page-2 vault matches cause the inventory tile to be hidden', async () => {
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
            vaultedAt: new Date('2024-01-01T00:00:00.000Z'),
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
      await waitFor(() => {
        expect(screen.queryByLabelText('Inventory item Page Two Match')).not.toBeInTheDocument();
      });
    });
  });

  describe('If vaulting succeeds and the vault search confirms the item is vaulted', () => {
    it('Then the item is removed from the inventory grid', async () => {
      // Arrange
      const inventoryItem = {
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
      };
      const snapshot = {
        snapshotId: 'snap-success-1',
        characterName: 'Sorc',
        characterId: 'char-1',
        sourceFileType: 'd2s',
        sourceFilePath: '/tmp/sorc.d2s',
        capturedAt: new Date('2024-01-01T00:00:00.000Z'),
        items: [inventoryItem],
      };
      // First response: item in inventory, not yet vaulted
      // Second response (after vault): item still in inventory snapshots (SaveFileMonitor
      // hasn't rescanned yet), but now confirmed in vault.items
      searchAllMock
        .mockResolvedValueOnce({
          inventory: { snapshots: [snapshot], totalSnapshots: 1, totalItems: 1 },
          vault: { items: [], total: 0, page: 1, pageSize: 200 },
        })
        .mockResolvedValueOnce({
          inventory: { snapshots: [snapshot], totalSnapshots: 1, totalItems: 1 },
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
                vaultedAt: new Date('2024-01-03T00:00:00.000Z'),
                created: new Date('2024-01-01T00:00:00.000Z'),
                lastUpdated: new Date('2024-01-03T00:00:00.000Z'),
              },
            ],
            total: 1,
            page: 1,
            pageSize: 200,
          },
        });
      addItemMock.mockResolvedValueOnce({ id: 'vault-success', fingerprint: 'fp-success' });

      render(<CharacterInventoryBrowser />);
      await waitFor(() => {
        expect(screen.getByText('Success Item')).toBeInTheDocument();
      });

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Vault' }));

      // Assert
      await waitFor(() => {
        expect(searchAllMock).toHaveBeenCalledTimes(2);
      });
      await waitFor(() => {
        expect(screen.queryByLabelText('Inventory item Success Item')).not.toBeInTheDocument();
      });
    });

    it('Then the item disappears from the inventory grid immediately while the vault call is in flight', async () => {
      // Arrange
      const inventoryItem = {
        fingerprint: 'fp-optimistic',
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
          itemName: 'Optimistic Item',
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
        itemName: 'Optimistic Item',
        quality: 'unique',
        ethereal: false,
        socketCount: 0,
        iconFileName: 'opt-item.png',
        rawItemJson: '{}',
        rawParsedItem: {},
        seenAt: new Date('2024-01-01T00:00:00.000Z'),
      };
      searchAllMock.mockResolvedValue({
        inventory: {
          snapshots: [
            {
              snapshotId: 'snap-opt',
              characterName: 'Sorc',
              characterId: 'char-1',
              sourceFileType: 'd2s',
              sourceFilePath: '/tmp/sorc.d2s',
              capturedAt: new Date('2024-01-01T00:00:00.000Z'),
              items: [inventoryItem],
            },
          ],
          totalSnapshots: 1,
          totalItems: 1,
        },
        vault: { items: [], total: 0, page: 1, pageSize: 200 },
      });

      // Never resolves during this test — keeps the vault call in flight
      let resolveVault!: () => void;
      addItemMock.mockReturnValueOnce(
        new Promise<void>((resolve) => {
          resolveVault = resolve;
        }),
      );

      render(<CharacterInventoryBrowser />);
      await waitFor(() => {
        expect(screen.getByText('Optimistic Item')).toBeInTheDocument();
      });

      // Act — click vault; the API call hangs (pending)
      fireEvent.click(screen.getByRole('button', { name: 'Vault' }));

      // Assert — item disappears immediately before the API responds
      await waitFor(() => {
        expect(screen.queryByLabelText('Inventory item Optimistic Item')).not.toBeInTheDocument();
      });

      // Cleanup — resolve so pending promises don't leak
      resolveVault();
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

  describe('If a vaulted item payload is dropped on an inventory board without custom MIME data', () => {
    it('Then it unvaults the item to the board coordinates using text payload fallback', async () => {
      // Arrange
      const getComputedStyleSpy = vi
        .spyOn(window, 'getComputedStyle')
        .mockReturnValue({ getPropertyValue: () => '28' } as unknown as CSSStyleDeclaration);
      searchAllMock.mockResolvedValue({
        inventory: {
          snapshots: [
            {
              snapshotId: 'drop-snap-1',
              characterName: 'Sorc',
              characterId: 'char-1',
              sourceFileType: 'd2s',
              sourceFilePath: '/tmp/sorc.d2s',
              capturedAt: new Date('2024-01-01T00:00:00.000Z'),
              items: [
                {
                  fingerprint: 'fp-existing',
                  fingerprintInputs: {
                    sourceFileType: 'd2s',
                    characterName: 'Sorc',
                    locationContext: 'inventory',
                    quality: 'unique',
                    ethereal: false,
                    socketCount: 0,
                    gridX: 4,
                    gridY: 0,
                    gridWidth: 2,
                    gridHeight: 2,
                    isSocketedItem: false,
                    itemName: 'Existing Item',
                  },
                  characterName: 'Sorc',
                  characterId: 'char-1',
                  sourceFileType: 'd2s',
                  sourceFilePath: '/tmp/sorc.d2s',
                  locationContext: 'inventory',
                  type: 'unique',
                  gridX: 4,
                  gridY: 0,
                  gridWidth: 2,
                  gridHeight: 2,
                  isSocketedItem: false,
                  itemName: 'Existing Item',
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

      render(<CharacterInventoryBrowser />);
      const inventoryBoard = await screen.findByTestId('inventory-board-drop-snap-1');
      const payload = serializeVaultTextPayload({
        id: 'vault-cross-window-1',
        gridWidth: 1,
        gridHeight: 1,
      });
      const dataTransfer = {
        getData: (format: string) => (format === 'text/plain' ? payload : ''),
      };

      // Act
      fireEvent.dragOver(inventoryBoard, {
        dataTransfer,
        clientX: 12,
        clientY: 12,
      });
      fireEvent.drop(inventoryBoard, {
        dataTransfer,
        clientX: 12,
        clientY: 12,
      });

      // Assert
      await waitFor(() => {
        expect(unvaultItemMock).toHaveBeenCalledWith(
          'vault-cross-window-1',
          expect.objectContaining({
            targetFilePath: '/tmp/sorc.d2s',
            targetFileType: 'd2s',
            targetLocationContext: 'inventory',
          }),
        );
      });
      getComputedStyleSpy.mockRestore();
    });
  });

  describe('If custom vault MIME data cannot be read during drop', () => {
    it('Then text payload fallback is still used to unvault to the target board', async () => {
      // Arrange
      const getComputedStyleSpy = vi
        .spyOn(window, 'getComputedStyle')
        .mockReturnValue({ getPropertyValue: () => '28' } as unknown as CSSStyleDeclaration);
      searchAllMock.mockResolvedValue({
        inventory: {
          snapshots: [
            {
              snapshotId: 'drop-snap-throw',
              characterName: 'Sorc',
              characterId: 'char-1',
              sourceFileType: 'd2s',
              sourceFilePath: '/tmp/sorc.d2s',
              capturedAt: new Date('2024-01-01T00:00:00.000Z'),
              items: [
                {
                  fingerprint: 'fp-existing-throw',
                  fingerprintInputs: {
                    sourceFileType: 'd2s',
                    characterName: 'Sorc',
                    locationContext: 'inventory',
                    quality: 'unique',
                    ethereal: false,
                    socketCount: 0,
                    gridX: 4,
                    gridY: 0,
                    gridWidth: 2,
                    gridHeight: 2,
                    isSocketedItem: false,
                    itemName: 'Existing Item',
                  },
                  characterName: 'Sorc',
                  characterId: 'char-1',
                  sourceFileType: 'd2s',
                  sourceFilePath: '/tmp/sorc.d2s',
                  locationContext: 'inventory',
                  type: 'unique',
                  gridX: 4,
                  gridY: 0,
                  gridWidth: 2,
                  gridHeight: 2,
                  isSocketedItem: false,
                  itemName: 'Existing Item',
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
          totalItems: 0,
        },
        vault: {
          items: [],
          total: 0,
          page: 1,
          pageSize: 20,
        },
      });

      render(<CharacterInventoryBrowser />);
      const inventoryBoard = await screen.findByTestId('inventory-board-drop-snap-throw');
      const payload = serializeVaultTextPayload({
        id: 'vault-cross-window-throw',
        gridWidth: 1,
        gridHeight: 1,
      });
      const dataTransfer = {
        getData: (format: string) => {
          if (format === VAULT_DRAG_MIME) {
            throw new Error('Blocked MIME read');
          }

          return format === 'text/plain' ? payload : '';
        },
      };

      // Act
      fireEvent.dragOver(inventoryBoard, {
        dataTransfer,
        clientX: 12,
        clientY: 12,
      });
      fireEvent.drop(inventoryBoard, {
        dataTransfer,
        clientX: 12,
        clientY: 12,
      });

      // Assert
      await waitFor(() => {
        expect(unvaultItemMock).toHaveBeenCalledWith(
          'vault-cross-window-throw',
          expect.objectContaining({
            targetFilePath: '/tmp/sorc.d2s',
            targetFileType: 'd2s',
            targetLocationContext: 'inventory',
          }),
        );
      });
      getComputedStyleSpy.mockRestore();
    });
  });

  describe('If the snapshot window opens while a vault drag is already active', () => {
    it('Then drag-over preview outline is rendered using active drag state snapshot fallback', async () => {
      // Arrange
      const getComputedStyleSpy = vi
        .spyOn(window, 'getComputedStyle')
        .mockReturnValue({ getPropertyValue: () => '28' } as unknown as CSSStyleDeclaration);
      const invokeMock = vi.fn().mockResolvedValue({
        vault: {
          active: true,
          id: 'vault-opened-mid-drag',
          gridWidth: 1,
          gridHeight: 1,
        },
      });
      const onMock = vi.fn();
      const offMock = vi.fn();
      const originalIpcRenderer = window.ipcRenderer;
      Object.defineProperty(window, 'ipcRenderer', {
        configurable: true,
        writable: true,
        value: {
          on: onMock,
          off: offMock,
          invoke: invokeMock,
          send: vi.fn(),
        },
      });

      searchAllMock.mockResolvedValue({
        inventory: {
          snapshots: [
            {
              snapshotId: 'drag-open-snap-1',
              characterName: 'Sorc',
              characterId: 'char-1',
              sourceFileType: 'd2s',
              sourceFilePath: '/tmp/sorc.d2s',
              capturedAt: new Date('2024-01-01T00:00:00.000Z'),
              items: [
                {
                  fingerprint: 'fp-existing-open',
                  fingerprintInputs: {
                    sourceFileType: 'd2s',
                    characterName: 'Sorc',
                    locationContext: 'inventory',
                    quality: 'unique',
                    ethereal: false,
                    socketCount: 0,
                    gridX: 4,
                    gridY: 0,
                    gridWidth: 2,
                    gridHeight: 2,
                    isSocketedItem: false,
                    itemName: 'Existing Item',
                  },
                  characterName: 'Sorc',
                  characterId: 'char-1',
                  sourceFileType: 'd2s',
                  sourceFilePath: '/tmp/sorc.d2s',
                  locationContext: 'inventory',
                  type: 'unique',
                  gridX: 4,
                  gridY: 0,
                  gridWidth: 2,
                  gridHeight: 2,
                  isSocketedItem: false,
                  itemName: 'Existing Item',
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

      render(<CharacterInventoryBrowser />);
      const inventoryBoard = await screen.findByTestId('inventory-board-drag-open-snap-1');
      await waitFor(() => {
        expect(invokeMock).toHaveBeenCalledWith('inventory:getActiveDragState');
      });

      const dataTransfer = createBlockedDragDataTransfer();

      // Act
      fireEvent.dragOver(inventoryBoard, {
        dataTransfer,
        clientX: 12,
        clientY: 12,
      });

      // Assert
      await waitFor(() => {
        expect(inventoryBoard.querySelector('.border-emerald-400')).not.toBeNull();
      });
      getComputedStyleSpy.mockRestore();
      Object.defineProperty(window, 'ipcRenderer', {
        configurable: true,
        writable: true,
        value: originalIpcRenderer,
      });
    });
  });

  describe('If an inventory tile is dropped on another inventory board cell', () => {
    it('Then it calls inventory.moveItem with the target board coordinates', async () => {
      // Arrange
      const getComputedStyleSpy = vi
        .spyOn(window, 'getComputedStyle')
        .mockReturnValue({ getPropertyValue: () => '28' } as unknown as CSSStyleDeclaration);
      searchAllMock.mockResolvedValue({
        inventory: {
          snapshots: [
            {
              snapshotId: 'move-snap-1',
              characterName: 'Sorc',
              characterId: 'char-1',
              sourceFileType: 'd2s',
              sourceFilePath: '/tmp/sorc.d2s',
              capturedAt: new Date('2024-01-01T00:00:00.000Z'),
              items: [
                {
                  fingerprint: 'fp-move-1',
                  fingerprintInputs: {
                    sourceFileType: 'd2s',
                    characterName: 'Sorc',
                    locationContext: 'inventory',
                    quality: 'unique',
                    ethereal: false,
                    socketCount: 0,
                    gridX: 1,
                    gridY: 1,
                    gridWidth: 1,
                    gridHeight: 1,
                    isSocketedItem: false,
                    itemName: 'Move Me',
                  },
                  characterName: 'Sorc',
                  characterId: 'char-1',
                  sourceFileType: 'd2s',
                  sourceFilePath: '/tmp/sorc.d2s',
                  locationContext: 'inventory',
                  type: 'unique',
                  itemCode: 'uap',
                  gridX: 1,
                  gridY: 1,
                  gridWidth: 1,
                  gridHeight: 1,
                  isSocketedItem: false,
                  itemName: 'Move Me',
                  quality: 'unique',
                  ethereal: false,
                  socketCount: 0,
                  iconFileName: 'shako.png',
                  rawItemJson: '{"id":101,"type_name":"Shako","code":"uap"}',
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
      const draggedTile = await screen.findByLabelText('Inventory item Move Me');
      const inventoryBoard = await screen.findByTestId('inventory-board-move-snap-1');
      const dataTransfer = createDragDataTransfer();

      // Act
      fireEvent.dragStart(draggedTile, { dataTransfer });
      fireEvent.dragOver(inventoryBoard, { dataTransfer, clientX: 100, clientY: 12 });
      fireEvent.drop(inventoryBoard, { dataTransfer, clientX: 100, clientY: 12 });

      // Assert
      await waitFor(() => {
        expect(moveInventoryItemMock).toHaveBeenCalledWith(
          expect.objectContaining({
            sourceFilePath: '/tmp/sorc.d2s',
            sourceFileType: 'd2s',
            targetFilePath: '/tmp/sorc.d2s',
            targetFileType: 'd2s',
            targetLocationContext: 'inventory',
          }),
        );
      });
      const movePayload = moveInventoryItemMock.mock.calls[0]?.[0];
      expect(Number.isFinite(movePayload?.targetGridX)).toBe(true);
      expect(Number.isFinite(movePayload?.targetGridY)).toBe(true);
      getComputedStyleSpy.mockRestore();
    });

    it('Then it shows a read-only toast when the move API returns MODERN_STASH_READ_ONLY', async () => {
      // Arrange
      const getComputedStyleSpy = vi
        .spyOn(window, 'getComputedStyle')
        .mockReturnValue({ getPropertyValue: () => '28' } as unknown as CSSStyleDeclaration);
      moveInventoryItemMock.mockRejectedValueOnce(new Error('MODERN_STASH_READ_ONLY'));
      searchAllMock.mockResolvedValue({
        inventory: {
          snapshots: [
            {
              snapshotId: 'move-readonly-toast',
              characterName: 'Sorc',
              characterId: 'char-1',
              sourceFileType: 'd2s',
              sourceFilePath: '/tmp/sorc.d2s',
              capturedAt: new Date('2024-01-01T00:00:00.000Z'),
              items: [
                {
                  fingerprint: 'fp-move-readonly-toast',
                  fingerprintInputs: {
                    sourceFileType: 'd2s',
                    characterName: 'Sorc',
                    locationContext: 'inventory',
                    quality: 'unique',
                    ethereal: false,
                    socketCount: 0,
                    gridX: 1,
                    gridY: 1,
                    gridWidth: 1,
                    gridHeight: 1,
                    isSocketedItem: false,
                    itemName: 'Move Me',
                  },
                  characterName: 'Sorc',
                  characterId: 'char-1',
                  sourceFileType: 'd2s',
                  sourceFilePath: '/tmp/sorc.d2s',
                  locationContext: 'inventory',
                  type: 'unique',
                  itemCode: 'uap',
                  gridX: 1,
                  gridY: 1,
                  gridWidth: 1,
                  gridHeight: 1,
                  isSocketedItem: false,
                  itemName: 'Move Me',
                  quality: 'unique',
                  ethereal: false,
                  socketCount: 0,
                  iconFileName: 'shako.png',
                  rawItemJson: '{"id":101,"type_name":"Shako","code":"uap"}',
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
      const draggedTile = await screen.findByLabelText('Inventory item Move Me');
      const inventoryBoard = await screen.findByTestId('inventory-board-move-readonly-toast');
      const dataTransfer = createDragDataTransfer();

      // Act
      fireEvent.dragStart(draggedTile, { dataTransfer });
      fireEvent.dragOver(inventoryBoard, { dataTransfer, clientX: 100, clientY: 12 });
      fireEvent.drop(inventoryBoard, { dataTransfer, clientX: 100, clientY: 12 });

      // Assert
      await waitFor(() => {
        expect(toastErrorMock).toHaveBeenCalledWith(
          'Modern shared stash is read-only in this version.',
        );
      });
      getComputedStyleSpy.mockRestore();
    });
  });

  describe('If an inventory tile is dropped on another character inventory board', () => {
    it('Then it calls inventory.moveItem with the target character save file', async () => {
      // Arrange
      const getComputedStyleSpy = vi
        .spyOn(window, 'getComputedStyle')
        .mockReturnValue({ getPropertyValue: () => '28' } as unknown as CSSStyleDeclaration);
      searchAllMock.mockResolvedValue({
        inventory: {
          snapshots: [
            {
              snapshotId: 'move-source',
              characterName: 'Sorc',
              characterId: 'char-1',
              sourceFileType: 'd2s',
              sourceFilePath: '/tmp/sorc.d2s',
              capturedAt: new Date('2024-01-01T00:00:00.000Z'),
              items: [
                {
                  fingerprint: 'fp-source',
                  fingerprintInputs: {
                    sourceFileType: 'd2s',
                    characterName: 'Sorc',
                    locationContext: 'inventory',
                    quality: 'unique',
                    ethereal: false,
                    socketCount: 0,
                    gridX: 0,
                    gridY: 0,
                    gridWidth: 1,
                    gridHeight: 1,
                    isSocketedItem: false,
                    itemName: 'Source Item',
                  },
                  characterName: 'Sorc',
                  characterId: 'char-1',
                  sourceFileType: 'd2s',
                  sourceFilePath: '/tmp/sorc.d2s',
                  locationContext: 'inventory',
                  type: 'unique',
                  itemCode: 'uap',
                  gridX: 0,
                  gridY: 0,
                  gridWidth: 1,
                  gridHeight: 1,
                  isSocketedItem: false,
                  itemName: 'Source Item',
                  quality: 'unique',
                  ethereal: false,
                  socketCount: 0,
                  iconFileName: 'shako.png',
                  rawItemJson: '{"id":201,"type_name":"Shako","code":"uap"}',
                  rawParsedItem: {},
                  seenAt: new Date('2024-01-01T00:00:00.000Z'),
                },
              ],
            },
            {
              snapshotId: 'move-target',
              characterName: 'Barb',
              characterId: 'char-2',
              sourceFileType: 'd2s',
              sourceFilePath: '/tmp/barb.d2s',
              capturedAt: new Date('2024-01-01T00:00:00.000Z'),
              items: [
                {
                  fingerprint: 'fp-target-existing',
                  fingerprintInputs: {
                    sourceFileType: 'd2s',
                    characterName: 'Barb',
                    locationContext: 'stash',
                    quality: 'unique',
                    ethereal: false,
                    socketCount: 0,
                    stashTab: 0,
                    gridX: 0,
                    gridY: 0,
                    gridWidth: 1,
                    gridHeight: 1,
                    isSocketedItem: false,
                    itemName: 'Target Existing',
                  },
                  characterName: 'Barb',
                  characterId: 'char-2',
                  sourceFileType: 'd2s',
                  sourceFilePath: '/tmp/barb.d2s',
                  locationContext: 'stash',
                  stashTab: 0,
                  type: 'unique',
                  itemCode: 'uap',
                  gridX: 0,
                  gridY: 0,
                  gridWidth: 1,
                  gridHeight: 1,
                  isSocketedItem: false,
                  itemName: 'Target Existing',
                  quality: 'unique',
                  ethereal: false,
                  socketCount: 0,
                  iconFileName: 'shako.png',
                  rawItemJson: '{"id":202,"type_name":"Shako","code":"uap"}',
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
          items: [],
          total: 0,
          page: 1,
          pageSize: 20,
        },
      });

      render(<CharacterInventoryBrowser />);
      const draggedTile = await screen.findByLabelText('Inventory item Source Item');
      const targetBoard = await screen.findByTestId('inventory-board-move-target');
      const dataTransfer = createDragDataTransfer();

      // Act
      fireEvent.dragStart(draggedTile, { dataTransfer });
      fireEvent.dragOver(targetBoard, { dataTransfer, clientX: 100, clientY: 12 });
      fireEvent.drop(targetBoard, { dataTransfer, clientX: 100, clientY: 12 });

      // Assert
      await waitFor(() => {
        expect(moveInventoryItemMock).toHaveBeenCalledWith(
          expect.objectContaining({
            sourceFilePath: '/tmp/sorc.d2s',
            targetFilePath: '/tmp/barb.d2s',
            targetLocationContext: 'inventory',
          }),
        );
      });
      getComputedStyleSpy.mockRestore();
    });
  });

  describe('If an inventory tile is dropped on an equipment slot', () => {
    it('Then it calls inventory.moveItem with equipped target metadata', async () => {
      // Arrange
      searchAllMock.mockResolvedValue({
        inventory: {
          snapshots: [
            {
              snapshotId: 'equip-snap',
              characterName: 'Sorc',
              characterId: 'char-1',
              sourceFileType: 'd2s',
              sourceFilePath: '/tmp/sorc.d2s',
              capturedAt: new Date('2024-01-01T00:00:00.000Z'),
              items: [
                {
                  fingerprint: 'fp-amulet',
                  fingerprintInputs: {
                    sourceFileType: 'd2s',
                    characterName: 'Sorc',
                    locationContext: 'inventory',
                    quality: 'magic',
                    ethereal: false,
                    socketCount: 0,
                    gridX: 1,
                    gridY: 0,
                    gridWidth: 1,
                    gridHeight: 1,
                    isSocketedItem: false,
                    itemName: 'Magic Amulet',
                  },
                  characterName: 'Sorc',
                  characterId: 'char-1',
                  sourceFileType: 'd2s',
                  sourceFilePath: '/tmp/sorc.d2s',
                  locationContext: 'inventory',
                  type: 'other',
                  itemCode: 'amu',
                  gridX: 1,
                  gridY: 0,
                  gridWidth: 1,
                  gridHeight: 1,
                  isSocketedItem: false,
                  itemName: 'Magic Amulet',
                  quality: 'magic',
                  ethereal: false,
                  socketCount: 0,
                  iconFileName: 'amulet.png',
                  rawItemJson: '{"id":301,"type_name":"Amulet","code":"amu"}',
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
      const draggedTile = await screen.findByLabelText('Inventory item Magic Amulet');
      const equippedSlots = await screen.findAllByTestId('equipped-slot-frame');
      const amuletSlot = equippedSlots[1];
      const dataTransfer = createDragDataTransfer();

      // Act
      fireEvent.dragStart(draggedTile, { dataTransfer });
      fireEvent.dragOver(amuletSlot, { dataTransfer });
      fireEvent.drop(amuletSlot, { dataTransfer });

      // Assert
      await waitFor(() => {
        expect(moveInventoryItemMock).toHaveBeenCalledWith(
          expect.objectContaining({
            sourceFilePath: '/tmp/sorc.d2s',
            targetFilePath: '/tmp/sorc.d2s',
            targetLocationContext: 'equipped',
            targetEquippedSlotId: 2,
          }),
        );
      });
    });

    it('Then it shows equip validation toast when backend rejects the move', async () => {
      // Arrange
      moveInventoryItemMock.mockRejectedValueOnce(
        new Error('EQUIP_VALIDATION:TARGET_SLOT_OCCUPIED'),
      );
      searchAllMock.mockResolvedValue({
        inventory: {
          snapshots: [
            {
              snapshotId: 'equip-toast-snap',
              characterName: 'Sorc',
              characterId: 'char-1',
              sourceFileType: 'd2s',
              sourceFilePath: '/tmp/sorc.d2s',
              capturedAt: new Date('2024-01-01T00:00:00.000Z'),
              items: [
                {
                  fingerprint: 'fp-amulet-toast',
                  fingerprintInputs: {
                    sourceFileType: 'd2s',
                    characterName: 'Sorc',
                    locationContext: 'inventory',
                    quality: 'magic',
                    ethereal: false,
                    socketCount: 0,
                    gridX: 1,
                    gridY: 0,
                    gridWidth: 1,
                    gridHeight: 1,
                    isSocketedItem: false,
                    itemName: 'Magic Amulet',
                  },
                  characterName: 'Sorc',
                  characterId: 'char-1',
                  sourceFileType: 'd2s',
                  sourceFilePath: '/tmp/sorc.d2s',
                  locationContext: 'inventory',
                  type: 'other',
                  itemCode: 'amu',
                  gridX: 1,
                  gridY: 0,
                  gridWidth: 1,
                  gridHeight: 1,
                  isSocketedItem: false,
                  itemName: 'Magic Amulet',
                  quality: 'magic',
                  ethereal: false,
                  socketCount: 0,
                  iconFileName: 'amulet.png',
                  rawItemJson: '{"id":302,"type_name":"Amulet","code":"amu"}',
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
      const draggedTile = await screen.findByLabelText('Inventory item Magic Amulet');
      const equippedSlots = await screen.findAllByTestId('equipped-slot-frame');
      const amuletSlot = equippedSlots[1];
      const dataTransfer = createDragDataTransfer();

      // Act
      fireEvent.dragStart(draggedTile, { dataTransfer });
      fireEvent.dragOver(amuletSlot, { dataTransfer });
      fireEvent.drop(amuletSlot, { dataTransfer });

      // Assert
      await waitFor(() => {
        expect(moveInventoryItemMock).toHaveBeenCalledWith(
          expect.objectContaining({
            targetLocationContext: 'equipped',
            targetEquippedSlotId: 2,
          }),
        );
      });
      await waitFor(() => {
        expect(toastErrorMock).toHaveBeenCalledWith('Equip blocked', {
          description: 'That equipment slot is already occupied.',
        });
      });
      expect(refreshSaveFilesMock).not.toHaveBeenCalled();
      expect(searchAllMock).toHaveBeenCalledTimes(1);
    });

    it('Then it maps INVALID_SLOT backend errors to the invalid-slot toast reason', async () => {
      // Arrange
      moveInventoryItemMock.mockRejectedValueOnce(new Error('EQUIP_VALIDATION:INVALID_SLOT'));
      searchAllMock.mockResolvedValue({
        inventory: {
          snapshots: [
            {
              snapshotId: 'equip-toast-invalid-slot-snap',
              characterName: 'Sorc',
              characterId: 'char-1',
              sourceFileType: 'd2s',
              sourceFilePath: '/tmp/sorc.d2s',
              capturedAt: new Date('2024-01-01T00:00:00.000Z'),
              items: [
                {
                  fingerprint: 'fp-amulet-toast-invalid-slot',
                  fingerprintInputs: {
                    sourceFileType: 'd2s',
                    characterName: 'Sorc',
                    locationContext: 'inventory',
                    quality: 'magic',
                    ethereal: false,
                    socketCount: 0,
                    gridX: 1,
                    gridY: 0,
                    gridWidth: 1,
                    gridHeight: 1,
                    isSocketedItem: false,
                    itemName: 'Magic Amulet',
                  },
                  characterName: 'Sorc',
                  characterId: 'char-1',
                  sourceFileType: 'd2s',
                  sourceFilePath: '/tmp/sorc.d2s',
                  locationContext: 'inventory',
                  type: 'other',
                  itemCode: 'amu',
                  gridX: 1,
                  gridY: 0,
                  gridWidth: 1,
                  gridHeight: 1,
                  isSocketedItem: false,
                  itemName: 'Magic Amulet',
                  quality: 'magic',
                  ethereal: false,
                  socketCount: 0,
                  iconFileName: 'amulet.png',
                  rawItemJson: '{"id":303,"type_name":"Amulet","code":"amu"}',
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
      const draggedTile = await screen.findByLabelText('Inventory item Magic Amulet');
      const equippedSlots = await screen.findAllByTestId('equipped-slot-frame');
      const amuletSlot = equippedSlots[1];
      const dataTransfer = createDragDataTransfer();

      // Act
      fireEvent.dragStart(draggedTile, { dataTransfer });
      fireEvent.dragOver(amuletSlot, { dataTransfer });
      fireEvent.drop(amuletSlot, { dataTransfer });

      // Assert
      await waitFor(() => {
        expect(moveInventoryItemMock).toHaveBeenCalledWith(
          expect.objectContaining({
            targetLocationContext: 'equipped',
            targetEquippedSlotId: 2,
          }),
        );
      });
      await waitFor(() => {
        expect(toastErrorMock).toHaveBeenCalledWith('Equip blocked', {
          description: 'This item cannot be equipped in that slot.',
        });
      });
      expect(refreshSaveFilesMock).not.toHaveBeenCalled();
      expect(searchAllMock).toHaveBeenCalledTimes(1);
    });
  });
});
