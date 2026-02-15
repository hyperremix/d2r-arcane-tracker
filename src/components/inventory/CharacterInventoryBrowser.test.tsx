import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CharacterInventoryBrowser } from './CharacterInventoryBrowser';

const searchAllMock = vi.fn();
const addItemMock = vi.fn();
const iconByFilenameMock = vi.fn();

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
        },
        icon: {
          getByFilename: iconByFilenameMock,
        },
      },
    });

    iconByFilenameMock.mockResolvedValue(undefined);

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
});
