import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VaultItemSearchResult } from '../types/grail';

const mocks = vi.hoisted(() => ({
  handleMock: vi.fn(),
  grailDatabaseMock: {
    addVaultItem: vi.fn(),
    removeVaultItem: vi.fn(),
    setVaultItemCategories: vi.fn(),
    searchVaultItems: vi.fn(),
    addVaultCategory: vi.fn(),
    updateVaultCategory: vi.fn(),
    removeVaultCategory: vi.fn(),
    getAllVaultCategories: vi.fn(),
  },
  saveFileEditorMock: {
    addItemToSaveFile: vi.fn(),
    removeItemFromSaveFile: vi.fn(),
    moveItemBetweenSaveFiles: vi.fn(),
  },
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: mocks.handleMock,
  },
}));

vi.mock('../database/database', () => ({
  grailDatabase: mocks.grailDatabaseMock,
}));

vi.mock('../services/saveFileEditor', () => ({
  addItemToSaveFile: mocks.saveFileEditorMock.addItemToSaveFile,
  removeItemFromSaveFile: mocks.saveFileEditorMock.removeItemFromSaveFile,
  moveItemBetweenSaveFiles: mocks.saveFileEditorMock.moveItemBetweenSaveFiles,
}));

import { initializeVaultHandlers } from './vaultHandlers';

describe('When vault IPC handlers are initialized', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('If initializeVaultHandlers is called', () => {
    it('Then all required vault and inventory channels are registered', () => {
      // Arrange
      const getSaveFileMonitor = vi.fn(() => undefined);

      // Act
      initializeVaultHandlers(
        getSaveFileMonitor as unknown as Parameters<typeof initializeVaultHandlers>[0],
      );

      // Assert
      expect(mocks.handleMock).toHaveBeenCalledWith('vault:addItem', expect.any(Function));
      expect(mocks.handleMock).toHaveBeenCalledWith('vault:removeItem', expect.any(Function));
      expect(mocks.handleMock).toHaveBeenCalledWith('vault:updateItemTags', expect.any(Function));
      expect(mocks.handleMock).toHaveBeenCalledWith('vault:listItems', expect.any(Function));
      expect(mocks.handleMock).toHaveBeenCalledWith('vault:search', expect.any(Function));
      expect(mocks.handleMock).toHaveBeenCalledWith('vault:createCategory', expect.any(Function));
      expect(mocks.handleMock).toHaveBeenCalledWith('vault:updateCategory', expect.any(Function));
      expect(mocks.handleMock).toHaveBeenCalledWith('vault:deleteCategory', expect.any(Function));
      expect(mocks.handleMock).toHaveBeenCalledWith('vault:listCategories', expect.any(Function));
      expect(mocks.handleMock).toHaveBeenCalledWith(
        'inventory:listSnapshots',
        expect.any(Function),
      );
      expect(mocks.handleMock).toHaveBeenCalledWith('inventory:searchAll', expect.any(Function));
      expect(mocks.handleMock).toHaveBeenCalledWith('inventory:moveItem', expect.any(Function));
    });
  });

  describe('If vault:addItem receives date fields as ISO strings', () => {
    it('Then the handler normalizes them to Date instances before database writes', async () => {
      // Arrange
      initializeVaultHandlers(() => undefined);
      mocks.grailDatabaseMock.addVaultItem.mockReturnValue({
        id: 'fp-1',
      });
      const handler = mocks.handleMock.mock.calls.find((call) => call[0] === 'vault:addItem')?.[1];

      // Act
      await handler?.(null, {
        fingerprint: 'fp-1',
        itemName: 'Shako',
        quality: 'unique',
        ethereal: false,
        rawItemJson: '{}',
        sourceFileType: 'd2s',
        locationContext: 'inventory',
        lastSeenAt: '2024-01-01T10:00:00.000Z',
        vaultedAt: '2024-01-01T10:01:00.000Z',
      });

      // Assert
      expect(mocks.grailDatabaseMock.addVaultItem).toHaveBeenCalledWith(
        expect.objectContaining({
          lastSeenAt: expect.any(Date),
          vaultedAt: expect.any(Date),
        }),
      );
    });
  });

  describe('If vault:addItem receives an invalid date string', () => {
    it('Then the handler rejects the request with a validation error', async () => {
      // Arrange
      initializeVaultHandlers(() => undefined);
      const handler = mocks.handleMock.mock.calls.find((call) => call[0] === 'vault:addItem')?.[1];

      // Act
      const promise = handler?.(null, {
        fingerprint: 'fp-1',
        itemName: 'Shako',
        quality: 'unique',
        ethereal: false,
        rawItemJson: '{}',
        sourceFileType: 'd2s',
        locationContext: 'inventory',
        lastSeenAt: 'invalid-date-value',
      });

      // Assert
      await expect(promise).rejects.toThrow('lastSeenAt must be a valid date');
    });
  });

  describe('If inventory:searchAll is invoked', () => {
    it('Then it returns combined inventory and vault search results', async () => {
      // Arrange
      const snapshots = [
        {
          snapshotId: 's1',
          characterName: 'Sorc',
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
              sourceFileType: 'd2s',
              sourceFilePath: '/tmp/sorc.d2s',
              locationContext: 'inventory',
              itemName: 'Shako',
              quality: 'unique',
              ethereal: false,
              socketCount: 0,
              rawItemJson: '{}',
              rawParsedItem: {} as never,
              seenAt: new Date('2024-01-01T00:00:00.000Z'),
            },
          ],
        },
      ];

      const getSaveFileMonitor = vi.fn(() => ({
        getInventorySearchResult: vi.fn(() => ({
          snapshots,
          totalSnapshots: 1,
          totalItems: 1,
        })),
      }));

      const vaultResult: VaultItemSearchResult = {
        items: [],
        page: 1,
        pageSize: 20,
        total: 0,
      };
      mocks.grailDatabaseMock.searchVaultItems.mockReturnValue(vaultResult);

      initializeVaultHandlers(
        getSaveFileMonitor as unknown as Parameters<typeof initializeVaultHandlers>[0],
      );
      const handler = mocks.handleMock.mock.calls.find(
        (call) => call[0] === 'inventory:searchAll',
      )?.[1];

      // Act
      const result = await handler?.(null, { text: 'shako', page: 1, pageSize: 20 });

      // Assert
      expect(mocks.grailDatabaseMock.searchVaultItems).toHaveBeenCalledWith({
        text: 'shako',
        page: 1,
        pageSize: 20,
      });
      expect(result).toEqual({
        inventory: {
          snapshots,
          totalSnapshots: 1,
          totalItems: 1,
        },
        vault: vaultResult,
      });
    });
  });

  describe('If inventory:searchAll receives a characterId filter', () => {
    it('Then it filters inventory items by characterId', async () => {
      // Arrange
      const snapshots = [
        {
          snapshotId: 's1',
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
              rawParsedItem: {} as never,
              seenAt: new Date('2024-01-01T00:00:00.000Z'),
            },
            {
              fingerprint: 'fp-2',
              fingerprintInputs: {
                sourceFileType: 'd2s',
                characterName: 'Barb',
                locationContext: 'inventory',
                quality: 'unique',
                ethereal: false,
                socketCount: 0,
                itemName: 'Arreat',
              },
              characterName: 'Barb',
              characterId: 'char-2',
              sourceFileType: 'd2s',
              sourceFilePath: '/tmp/barb.d2s',
              locationContext: 'inventory',
              itemName: 'Arreat',
              quality: 'unique',
              ethereal: false,
              socketCount: 0,
              rawItemJson: '{}',
              rawParsedItem: {} as never,
              seenAt: new Date('2024-01-01T00:00:00.000Z'),
            },
          ],
        },
      ];

      const getSaveFileMonitor = vi.fn(() => ({
        getInventorySearchResult: vi.fn(() => ({
          snapshots,
          totalSnapshots: 1,
          totalItems: 2,
        })),
      }));

      mocks.grailDatabaseMock.searchVaultItems.mockReturnValue({
        items: [],
        page: 1,
        pageSize: 20,
        total: 0,
      });

      initializeVaultHandlers(
        getSaveFileMonitor as unknown as Parameters<typeof initializeVaultHandlers>[0],
      );
      const handler = mocks.handleMock.mock.calls.find(
        (call) => call[0] === 'inventory:searchAll',
      )?.[1];

      // Act
      const result = await handler?.(null, { characterId: 'char-1', page: 1, pageSize: 20 });

      // Assert
      expect(result.inventory.totalItems).toBe(1);
    });
  });

  describe('If invalid search text is provided', () => {
    it('Then the handler rejects the request via defensive validation', async () => {
      // Arrange
      initializeVaultHandlers(() => undefined);
      const handler = mocks.handleMock.mock.calls.find((call) => call[0] === 'vault:search')?.[1];

      // Act
      const promise = handler?.(null, { text: 'x'.repeat(121) });

      // Assert
      await expect(promise).rejects.toThrow('Search text must be <= 120 characters');
    });
  });

  describe('If inventory:moveItem receives a valid move payload', () => {
    it('Then it delegates to save-file move logic and returns success', async () => {
      // Arrange
      initializeVaultHandlers(() => undefined);
      const handler = mocks.handleMock.mock.calls.find(
        (call) => call[0] === 'inventory:moveItem',
      )?.[1];
      const movePayload = {
        sourceFilePath: '/tmp/sorc.d2s',
        sourceFileType: 'd2s',
        rawItemJson: JSON.stringify({ id: 42, code: 'uap' }),
        targetFilePath: '/tmp/barb.d2s',
        targetFileType: 'd2s',
        targetLocationContext: 'inventory',
        targetGridX: 3,
        targetGridY: 1,
      };

      // Act
      const result = await handler?.(null, movePayload);

      // Assert
      expect(mocks.saveFileEditorMock.moveItemBetweenSaveFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceFilePath: '/tmp/sorc.d2s',
          sourceFileType: 'd2s',
          sourceItemId: 42,
          targetFilePath: '/tmp/barb.d2s',
          targetFileType: 'd2s',
          targetLocationContext: 'inventory',
          targetGridX: 3,
          targetGridY: 1,
        }),
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('If inventory:moveItem receives an invalid equipped target', () => {
    it('Then it rejects the request', async () => {
      // Arrange
      initializeVaultHandlers(() => undefined);
      const handler = mocks.handleMock.mock.calls.find(
        (call) => call[0] === 'inventory:moveItem',
      )?.[1];
      const movePayload = {
        sourceFilePath: '/tmp/sorc.d2s',
        sourceFileType: 'd2s',
        rawItemJson: JSON.stringify({ id: 42, code: 'uap' }),
        targetFilePath: '/tmp/barb.d2s',
        targetFileType: 'd2s',
        targetLocationContext: 'equipped',
        targetGridX: 0,
        targetGridY: 0,
      };

      // Act
      const promise = handler?.(null, movePayload);

      // Assert
      await expect(promise).rejects.toThrow('targetEquippedSlotId must be one of: 1-12');
    });
  });
});
