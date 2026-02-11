import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CharacterInventoryBrowser } from './CharacterInventoryBrowser';

const searchAllMock = vi.fn();
const addItemMock = vi.fn();

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
      },
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
                  itemName: 'Shako',
                },
                characterName: 'Sorc',
                characterId: 'char-1',
                sourceFileType: 'd2s',
                sourceFilePath: '/tmp/sorc.d2s',
                locationContext: 'inventory',
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
        pageSize: 20,
      },
    });
  });

  describe('If cross-search returns inventory and vault data', () => {
    it('Then it renders the unified inventory list and vault status', async () => {
      // Arrange & Act
      render(<CharacterInventoryBrowser />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Shako')).toBeInTheDocument();
      });
      expect(screen.getByText('Vault Status')).toBeInTheDocument();
      expect(screen.getByText('Untracked')).toBeInTheDocument();
    });
  });

  describe('If the vault button is pressed for an inventory item', () => {
    it('Then it calls the vault addItem API', async () => {
      // Arrange
      render(<CharacterInventoryBrowser />);
      await waitFor(() => {
        expect(screen.getByText('Shako')).toBeInTheDocument();
      });

      // Act
      fireEvent.click(screen.getAllByRole('button', { name: 'Vault' })[0]);

      // Assert
      await waitFor(() => {
        expect(addItemMock).toHaveBeenCalledTimes(1);
      });
      expect(addItemMock.mock.calls[0]?.[0]?.fingerprint).toBe('fp-1');
    });
  });
});
