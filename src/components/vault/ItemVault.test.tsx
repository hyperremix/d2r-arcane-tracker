import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ItemVault } from './ItemVault';

const searchMock = vi.fn();
const listCategoriesMock = vi.fn();
const removeItemMock = vi.fn();
const createCategoryMock = vi.fn();
const iconByFilenameMock = vi.fn();

const baseItem = {
  id: 'vault-1',
  fingerprint: 'fp-vault-1',
  itemName: 'Arachnid Mesh',
  quality: 'unique',
  ethereal: false,
  rawItemJson: JSON.stringify({
    name: 'Arachnid Mesh',
    type_name: 'Spiderweb Sash',
    reqstr: 50,
    required_level: 80,
    displayed_combined_magic_attributes: [
      { description: '+1 To All Skills', visible: true },
      { description: '+20% Faster Cast Rate', visible: true },
    ],
  }),
  sourceCharacterName: 'Sorc',
  sourceFileType: 'd2s' as const,
  locationContext: 'inventory' as const,
  gridX: 0,
  gridY: 0,
  gridWidth: 2,
  gridHeight: 1,
  iconFileName: 'invbelt.png',
  isPresentInLatestScan: true,
  created: new Date('2024-01-01T00:00:00.000Z'),
  lastUpdated: new Date('2024-01-01T00:00:00.000Z'),
};

const overlappingInventoryItem = {
  ...baseItem,
  id: 'vault-2',
  fingerprint: 'fp-vault-2',
  itemName: 'Overlap Item',
  gridX: 0,
  gridY: 0,
  gridWidth: 1,
  gridHeight: 1,
  rawItemJson: '{}',
};

const beltItem = {
  ...baseItem,
  id: 'vault-belt-1',
  fingerprint: 'fp-vault-belt-1',
  itemName: 'Super Healing Potion',
  locationContext: 'unknown' as const,
  gridX: 1,
  gridY: 1,
  gridWidth: 1,
  gridHeight: 1,
  rawItemJson: '{"location_id":2,"position_x":5}',
};

const stashOverflowItem = {
  ...baseItem,
  id: 'vault-stash-overflow-1',
  fingerprint: 'fp-vault-stash-overflow-1',
  itemName: 'Overflow Stash Item',
  locationContext: 'stash' as const,
  stashTab: 0,
  gridX: 12,
  gridY: 9,
  gridWidth: 2,
  gridHeight: 3,
  rawItemJson:
    '{"location_id":0,"alt_position_id":5,"position_x":12,"position_y":9,"inv_width":2,"inv_height":3}',
};

const inventoryOverflowItem = {
  ...baseItem,
  id: 'vault-inventory-overflow-1',
  fingerprint: 'fp-vault-inventory-overflow-1',
  itemName: 'Overflow Inventory Item',
  locationContext: 'inventory' as const,
  gridX: 12,
  gridY: 1,
  gridWidth: 2,
  gridHeight: 2,
  rawItemJson:
    '{"location_id":0,"alt_position_id":1,"position_x":12,"position_y":1,"inv_width":2,"inv_height":2}',
};

describe('When ItemVault is rendered', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(window, 'electronAPI', {
      writable: true,
      value: {
        vault: {
          search: searchMock,
          listCategories: listCategoriesMock,
          removeItem: removeItemMock,
          createCategory: createCategoryMock,
          deleteCategory: vi.fn(),
          updateItemTags: vi.fn(),
        },
        icon: {
          getByFilename: iconByFilenameMock,
        },
      },
    });

    iconByFilenameMock.mockResolvedValue(undefined);

    searchMock.mockResolvedValue({
      items: [
        baseItem,
        overlappingInventoryItem,
        beltItem,
        stashOverflowItem,
        inventoryOverflowItem,
      ],
      total: 5,
      page: 1,
      pageSize: 20,
    });

    listCategoriesMock.mockResolvedValue([
      {
        id: 'cat-1',
        name: 'Trade',
        created: new Date('2024-01-01T00:00:00.000Z'),
        lastUpdated: new Date('2024-01-01T00:00:00.000Z'),
      },
    ]);
  });

  describe('If items are loaded from vault search', () => {
    it('Then it renders canonical board cells and keeps details in the selected panel', async () => {
      // Arrange & Act
      render(<ItemVault />);
      await waitFor(() => {
        expect(screen.getByText('Arachnid Mesh')).toBeInTheDocument();
      });

      // Assert
      const inventoryBoardId = 'vault-inventory-board-Sorc:d2s';
      const inventoryBoard = screen.getByTestId(inventoryBoardId);
      expect(within(inventoryBoard).getAllByTestId(`${inventoryBoardId}-cell`)).toHaveLength(40);
      expect(within(inventoryBoard).getAllByTestId('vault-item-tile')).toHaveLength(1);
      const inventoryRawOverflowBoard = screen.getByTestId(
        'vault-inventory-board-Sorc:d2s-raw-overflow',
      );
      expect(
        within(inventoryRawOverflowBoard).queryAllByTestId(
          'vault-inventory-board-Sorc:d2s-raw-overflow-cell',
        ),
      ).toHaveLength(0);
      expect(within(inventoryRawOverflowBoard).getAllByTestId('vault-item-tile')).toHaveLength(1);

      const beltBoardId = 'vault-belt-board-Sorc:d2s';
      const beltBoard = screen.getByTestId(beltBoardId);
      expect(within(beltBoard).getAllByTestId(`${beltBoardId}-cell`)).toHaveLength(16);
      expect(within(beltBoard).getAllByTestId('vault-item-tile')).toHaveLength(1);

      const stashRawOverflowBoard = screen.getByTestId('vault-stash-board-Sorc:d2s-0-raw-overflow');
      expect(
        within(stashRawOverflowBoard).queryAllByTestId(
          'vault-stash-board-Sorc:d2s-0-raw-overflow-cell',
        ),
      ).toHaveLength(0);
      expect(within(stashRawOverflowBoard).getAllByTestId('vault-item-tile')).toHaveLength(1);

      const equippedBoard = screen.getByTestId('vault-equipped-board');
      expect(within(equippedBoard).queryAllByTestId('vault-equipped-board-cell')).toHaveLength(0);
      expect(within(equippedBoard).getAllByTestId('vault-equipped-slot-frame')).toHaveLength(10);

      expect(within(inventoryBoard).queryByText('Arachnid Mesh')).not.toBeInTheDocument();
    });
  });

  describe('If a hovered tile has game tooltip data in raw JSON', () => {
    it('Then it renders the Diablo-style game attribute lines', async () => {
      // Arrange
      render(<ItemVault />);
      await waitFor(() => {
        expect(screen.getByText('Arachnid Mesh')).toBeInTheDocument();
      });

      // Act
      fireEvent.mouseEnter(screen.getByLabelText('Vault item Arachnid Mesh'));

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Spiderweb Sash')).toBeInTheDocument();
      });
    });
  });

  describe('If a hovered tile has sparse raw JSON', () => {
    it('Then it falls back to the existing metadata tooltip', async () => {
      // Arrange
      render(<ItemVault />);
      await waitFor(() => {
        expect(screen.getByText('Arachnid Mesh')).toBeInTheDocument();
      });

      // Act
      fireEvent.mouseEnter(screen.getByLabelText('Vault item Overlap Item'));

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Quality/Type:')).toBeInTheDocument();
      });
    });
  });

  describe('If unvault is clicked in the selected-item panel', () => {
    it('Then it calls the removeItem API with the selected item id', async () => {
      // Arrange
      render(<ItemVault />);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Unvault' })).toBeInTheDocument();
      });

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Unvault' }));

      // Assert
      await waitFor(() => {
        expect(removeItemMock).toHaveBeenCalledWith('vault-1');
      });
    });
  });

  describe('If category form is submitted', () => {
    it('Then it calls createCategory API', async () => {
      // Arrange
      render(<ItemVault />);
      await waitFor(() => {
        expect(screen.getByText('Manage Categories')).toBeInTheDocument();
      });

      // Act
      fireEvent.change(screen.getByPlaceholderText('New category name'), {
        target: { value: 'Grailers' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save Category' }));

      // Assert
      await waitFor(() => {
        expect(createCategoryMock).toHaveBeenCalledTimes(1);
      });
      expect(createCategoryMock.mock.calls[0]?.[0]?.name).toBe('Grailers');
    });
  });
});
