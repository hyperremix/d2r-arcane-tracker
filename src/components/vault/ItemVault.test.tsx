import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ItemVault } from './ItemVault';

const searchMock = vi.fn();
const listCategoriesMock = vi.fn();
const removeItemMock = vi.fn();
const createCategoryMock = vi.fn();

const baseItem = {
  id: 'vault-1',
  fingerprint: 'fp-vault-1',
  itemName: 'Arachnid Mesh',
  quality: 'unique',
  ethereal: false,
  rawItemJson: '{}',
  sourceFileType: 'd2s' as const,
  locationContext: 'inventory' as const,
  isPresentInLatestScan: true,
  created: new Date('2024-01-01T00:00:00.000Z'),
  lastUpdated: new Date('2024-01-01T00:00:00.000Z'),
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
      },
    });

    searchMock.mockResolvedValue({
      items: [baseItem],
      total: 1,
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
    it('Then it shows item cards and allows unvault action', async () => {
      // Arrange & Act
      render(<ItemVault />);
      await waitFor(() => {
        expect(screen.getByText('Arachnid Mesh')).toBeInTheDocument();
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
