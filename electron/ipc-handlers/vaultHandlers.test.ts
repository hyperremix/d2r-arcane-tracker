import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VaultItemSearchResult } from '../types/grail';

const mocks = vi.hoisted(() => ({
  handleMock: vi.fn(),
  grailDatabaseMock: {
    addVaultItemWithUndo: vi.fn(),
    unvaultVaultItem: vi.fn(),
    removeVaultItem: vi.fn(),
    getVaultItemById: vi.fn(),
    setVaultItemCategories: vi.fn(),
    searchVaultItems: vi.fn(),
    addVaultCategory: vi.fn(),
    updateVaultCategory: vi.fn(),
    removeVaultCategory: vi.fn(),
    getAllVaultCategories: vi.fn(),
  },
  assertGameNotRunning: vi.fn(),
  saveFileEditorMock: {
    addItemToSaveFile: vi.fn(),
    readSaveFileItem: vi.fn(),
    removeItemFromSaveFile: vi.fn(),
    moveItemBetweenSaveFiles: vi.fn(),
    splitStackInSaveFile: vi.fn(),
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

vi.mock('../services/gameProcessGuard', () => ({
  assertGameNotRunning: mocks.assertGameNotRunning,
}));

vi.mock('../services/saveFileEditor', () => ({
  addItemToSaveFile: mocks.saveFileEditorMock.addItemToSaveFile,
  readSaveFileItem: mocks.saveFileEditorMock.readSaveFileItem,
  removeItemFromSaveFile: mocks.saveFileEditorMock.removeItemFromSaveFile,
  moveItemBetweenSaveFiles: mocks.saveFileEditorMock.moveItemBetweenSaveFiles,
  splitStackInSaveFile: mocks.saveFileEditorMock.splitStackInSaveFile,
}));

import { initializeVaultHandlers } from './vaultHandlers';

function makeVaultItem(overrides: Record<string, unknown>) {
  return {
    id: 'row',
    fingerprint: 'fp',
    itemName: 'Item',
    quality: 'unique',
    ethereal: false,
    stackCount: 1,
    rawItemJson: '{"id":1}',
    sourceFileType: 'd2s',
    locationContext: 'inventory',
    isSocketedItem: false,
    isPresentInLatestScan: true,
    vaultedAt: new Date('2024-01-01T00:00:00.000Z'),
    created: new Date('2024-01-01T00:00:00.000Z'),
    lastUpdated: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('When vault IPC handlers are initialized', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertGameNotRunning.mockResolvedValue(undefined);
    mocks.saveFileEditorMock.readSaveFileItem.mockResolvedValue({ type: 'uap', code: 'uap' });
    mocks.saveFileEditorMock.addItemToSaveFile.mockResolvedValue(undefined);
    mocks.saveFileEditorMock.removeItemFromSaveFile.mockResolvedValue(undefined);
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
      mocks.grailDatabaseMock.addVaultItemWithUndo.mockReturnValue({
        item: { id: 'fp-1' },
        undo: vi.fn(),
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
      expect(mocks.grailDatabaseMock.addVaultItemWithUndo).toHaveBeenCalledWith(
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

  describe('If vault:addItem receives a modern d2i source with coordinate locator', () => {
    it('Then it writes to vault first and removes from source by coordinates', async () => {
      // Arrange
      initializeVaultHandlers(() => undefined);
      mocks.saveFileEditorMock.readSaveFileItem.mockResolvedValue({
        type: 'r19',
        code: 'r19',
        position_x: 2,
        position_y: 1,
      });
      mocks.grailDatabaseMock.addVaultItemWithUndo.mockReturnValue({
        item: { id: 'vault-item-1' },
        undo: vi.fn(),
      });
      const handler = mocks.handleMock.mock.calls.find((call) => call[0] === 'vault:addItem')?.[1];

      // Act
      await handler?.(null, {
        fingerprint: 'fp-rune',
        itemName: 'Fal Rune',
        quality: 'normal',
        ethereal: false,
        rawItemJson: '{"type":"r19","position_x":2,"position_y":1}',
        sourceFileType: 'd2i',
        sourceFilePath: '/tmp/shared-stash.d2i',
        locationContext: 'stash',
        stashTab: 7,
        gridX: 2,
        gridY: 1,
      });

      // Assert
      expect(mocks.saveFileEditorMock.removeItemFromSaveFile).toHaveBeenCalledWith(
        '/tmp/shared-stash.d2i',
        'd2i',
        expect.objectContaining({
          itemId: undefined,
          stashTab: 7,
          gridX: 2,
          gridY: 1,
        }),
      );
      const addOrder = mocks.grailDatabaseMock.addVaultItemWithUndo.mock.invocationCallOrder[0];
      const removeOrder =
        mocks.saveFileEditorMock.removeItemFromSaveFile.mock.invocationCallOrder[0];
      expect(addOrder).toBeLessThan(removeOrder);
    });
  });

  describe('If vault:addItem source removal fails after vault row is written', () => {
    it('Then it reverts vaulted state and returns a clear error', async () => {
      // Arrange
      initializeVaultHandlers(() => undefined);
      const undo = vi.fn();
      mocks.grailDatabaseMock.addVaultItemWithUndo.mockReturnValue({
        item: { id: 'vault-item-2' },
        undo,
      });
      mocks.saveFileEditorMock.removeItemFromSaveFile.mockRejectedValue(
        new Error('disk write failed'),
      );
      const handler = mocks.handleMock.mock.calls.find((call) => call[0] === 'vault:addItem')?.[1];

      // Act
      const promise = handler?.(null, {
        fingerprint: 'fp-shako',
        itemName: 'Shako',
        quality: 'unique',
        ethereal: false,
        rawItemJson: '{"id":42}',
        sourceFileType: 'd2s',
        sourceFilePath: '/tmp/sorc.d2s',
        locationContext: 'inventory',
      });

      // Assert
      await expect(promise).rejects.toThrow('Vault add persisted but source item removal failed');
      expect(undo).toHaveBeenCalledTimes(1);
    });
  });

  describe('If vault:addItem receives invalid raw item JSON for a source-backed item', () => {
    it('Then it rejects before writing to the vault database', async () => {
      // Arrange
      initializeVaultHandlers(() => undefined);
      const handler = mocks.handleMock.mock.calls.find((call) => call[0] === 'vault:addItem')?.[1];

      // Act
      const promise = handler?.(null, {
        fingerprint: 'fp-invalid-json',
        itemName: 'Malformed Item',
        quality: 'normal',
        ethereal: false,
        rawItemJson: '{"id": 42',
        sourceFileType: 'd2s',
        sourceFilePath: '/tmp/sorc.d2s',
        locationContext: 'inventory',
      });

      // Assert
      await expect(promise).rejects.toThrow('rawItemJson must be valid JSON');
      expect(mocks.grailDatabaseMock.addVaultItemWithUndo).not.toHaveBeenCalled();
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

  describe('If inventory:splitStack receives a valid payload', () => {
    it('Then it delegates to splitStackInSaveFile and returns success', async () => {
      // Arrange
      initializeVaultHandlers(() => undefined);
      const handler = mocks.handleMock.mock.calls.find(
        (call) => call[0] === 'inventory:splitStack',
      )?.[1];

      // Act
      const result = await handler?.(null, {
        sourceFilePath: '/tmp/shared.d2i',
        sourceFileType: 'd2i',
        sourceStashTab: 7,
        sourceItemCode: 'r19',
        splitCount: 1,
        targets: [
          {
            targetFilePath: '/tmp/sorc.d2s',
            targetFileType: 'd2s',
            targetLocationContext: 'inventory',
            targetGridX: 3,
            targetGridY: 2,
          },
        ],
      });

      // Assert
      expect(mocks.saveFileEditorMock.splitStackInSaveFile).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceFilePath: '/tmp/shared.d2i',
          sourceFileType: 'd2i',
          sourceStashTab: 7,
          sourceItemCode: 'r19',
          splitCount: 1,
        }),
      );
      expect(result).toEqual({ success: true });
    });
  });

  describe('If inventory:splitStack has a negative target grid coordinate', () => {
    it('Then it rejects the request at IPC validation', async () => {
      // Arrange
      initializeVaultHandlers(() => undefined);
      const handler = mocks.handleMock.mock.calls.find(
        (call) => call[0] === 'inventory:splitStack',
      )?.[1];

      // Act
      const promise = handler?.(null, {
        sourceFilePath: '/tmp/shared.d2i',
        sourceFileType: 'd2i',
        sourceStashTab: 7,
        sourceItemCode: 'r19',
        splitCount: 1,
        targets: [
          {
            targetFilePath: '/tmp/sorc.d2s',
            targetFileType: 'd2s',
            targetLocationContext: 'inventory',
            targetGridX: -1,
            targetGridY: 2,
          },
        ],
      });

      // Assert
      await expect(promise).rejects.toThrow('Each target targetGridX must be >= 0');
    });
  });

  describe('If inventory:splitStack targets a non-d2s file with non-stash context', () => {
    it('Then it rejects the request due to unsafe target context pairing', async () => {
      // Arrange
      initializeVaultHandlers(() => undefined);
      const handler = mocks.handleMock.mock.calls.find(
        (call) => call[0] === 'inventory:splitStack',
      )?.[1];

      // Act
      const promise = handler?.(null, {
        sourceFilePath: '/tmp/shared.d2i',
        sourceFileType: 'd2i',
        sourceStashTab: 7,
        sourceItemCode: 'r19',
        splitCount: 1,
        targets: [
          {
            targetFilePath: '/tmp/shared-target.d2i',
            targetFileType: 'd2i',
            targetLocationContext: 'inventory',
            targetGridX: 1,
            targetGridY: 2,
          },
        ],
      });

      // Assert
      await expect(promise).rejects.toThrow(
        'Shared stash targets must use targetLocationContext=stash',
      );
    });
  });

  describe('If vault:addItem is called for an item that is no longer in the save file', () => {
    it('Then nothing is vaulted and nothing is removed', async () => {
      // Arrange
      initializeVaultHandlers(() => undefined);
      mocks.saveFileEditorMock.readSaveFileItem.mockResolvedValue(undefined);
      const handler = mocks.handleMock.mock.calls.find((call) => call[0] === 'vault:addItem')?.[1];

      // Act
      const promise = handler?.(null, {
        fingerprint: 'fp-stale',
        itemName: 'Shako',
        itemCode: 'uap',
        quality: 'unique',
        ethereal: false,
        rawItemJson: '{"id":42,"code":"uap"}',
        sourceFileType: 'd2s',
        sourceFilePath: '/tmp/sorc.d2s',
        locationContext: 'inventory',
      });

      // Assert
      await expect(promise).rejects.toThrow('no longer in the save file');
      expect(mocks.grailDatabaseMock.addVaultItemWithUndo).not.toHaveBeenCalled();
      expect(mocks.saveFileEditorMock.removeItemFromSaveFile).not.toHaveBeenCalled();
    });
  });

  describe('If vault:addItem is called for a stack whose size changed since the scan', () => {
    it('Then it refuses so the larger real stack is not deleted with a smaller vault copy', async () => {
      // Arrange
      initializeVaultHandlers(() => undefined);
      mocks.saveFileEditorMock.readSaveFileItem.mockResolvedValue({
        type: 'r19',
        code: 'r19',
        quantity: 60,
      });
      const handler = mocks.handleMock.mock.calls.find((call) => call[0] === 'vault:addItem')?.[1];

      // Act
      const promise = handler?.(null, {
        fingerprint: 'fp-stack',
        itemName: 'Fal Rune',
        itemCode: 'r19',
        quality: 'normal',
        ethereal: false,
        rawItemJson: '{"code":"r19","quantity":50,"position_x":1,"position_y":1}',
        sourceFileType: 'd2i',
        sourceFilePath: '/tmp/shared-stash.d2i',
        locationContext: 'stash',
        stashTab: 7,
      });

      // Assert
      await expect(promise).rejects.toThrow('stack size in the save file changed');
      expect(mocks.grailDatabaseMock.addVaultItemWithUndo).not.toHaveBeenCalled();
      expect(mocks.saveFileEditorMock.removeItemFromSaveFile).not.toHaveBeenCalled();
    });
  });

  describe('If vault:addItem finds a different item than the one in the request', () => {
    it('Then it refuses to remove the item from the save file', async () => {
      // Arrange
      initializeVaultHandlers(() => undefined);
      mocks.saveFileEditorMock.readSaveFileItem.mockResolvedValue({ type: 'xea', code: 'xea' });
      const handler = mocks.handleMock.mock.calls.find((call) => call[0] === 'vault:addItem')?.[1];

      // Act
      const promise = handler?.(null, {
        fingerprint: 'fp-changed',
        itemName: 'Shako',
        itemCode: 'uap',
        quality: 'unique',
        ethereal: false,
        rawItemJson: '{"id":42,"code":"uap"}',
        sourceFileType: 'd2s',
        sourceFilePath: '/tmp/sorc.d2s',
        locationContext: 'inventory',
      });

      // Assert
      await expect(promise).rejects.toThrow('item in the save file changed');
      expect(mocks.saveFileEditorMock.removeItemFromSaveFile).not.toHaveBeenCalled();
    });
  });

  describe('If vault:removeItem targets a vaulted item that was taken out of a save file', () => {
    it('Then it refuses, because that row is the only copy of the item', async () => {
      // Arrange
      initializeVaultHandlers(() => undefined);
      mocks.grailDatabaseMock.getVaultItemById.mockReturnValue(
        makeVaultItem({ id: 'row-1', fingerprint: 'fp-real', sourceFilePath: '/tmp/sorc.d2s' }),
      );
      const handler = mocks.handleMock.mock.calls.find(
        (call) => call[0] === 'vault:removeItem',
      )?.[1];

      // Act
      const promise = handler?.(null, 'row-1');

      // Assert
      await expect(promise).rejects.toThrow('Unvault this item before removing');
      expect(mocks.grailDatabaseMock.removeVaultItem).not.toHaveBeenCalled();
    });

    it('Then it still deletes grail bookmarks that hold no item', async () => {
      // Arrange
      initializeVaultHandlers(() => undefined);
      mocks.grailDatabaseMock.getVaultItemById.mockReturnValue(
        makeVaultItem({ id: 'grail:shako', fingerprint: 'grail:shako' }),
      );
      const handler = mocks.handleMock.mock.calls.find(
        (call) => call[0] === 'vault:removeItem',
      )?.[1];

      // Act
      await handler?.(null, 'grail:shako');

      // Assert
      expect(mocks.grailDatabaseMock.removeVaultItem).toHaveBeenCalledWith('grail:shako');
    });

    it('Then it deletes rows that are no longer vaulted', async () => {
      // Arrange
      initializeVaultHandlers(() => undefined);
      mocks.grailDatabaseMock.getVaultItemById.mockReturnValue(
        makeVaultItem({
          id: 'row-2',
          fingerprint: 'fp-old',
          sourceFilePath: '/tmp/sorc.d2s',
          unvaultedAt: new Date('2024-03-01T00:00:00.000Z'),
        }),
      );
      const handler = mocks.handleMock.mock.calls.find(
        (call) => call[0] === 'vault:removeItem',
      )?.[1];

      // Act
      await handler?.(null, 'row-2');

      // Assert
      expect(mocks.grailDatabaseMock.removeVaultItem).toHaveBeenCalledWith('row-2');
    });
  });

  describe('When vault:unvaultItem is invoked', () => {
    const inventoryTarget = {
      targetFilePath: '/tmp/sorc.d2s',
      targetFileType: 'd2s',
      targetLocationContext: 'inventory',
      targetGridX: 4,
      targetGridY: 2,
    };

    function getUnvaultHandler() {
      initializeVaultHandlers(() => undefined);
      return mocks.handleMock.mock.calls.find((call) => call[0] === 'vault:unvaultItem')?.[1];
    }

    it('If the row came from a save file and no target is given, Then it refuses instead of marking it unvaulted without writing it', async () => {
      // Arrange
      mocks.grailDatabaseMock.getVaultItemById.mockReturnValue(
        makeVaultItem({ id: 'row-1', fingerprint: 'fp-real', sourceFilePath: '/tmp/sorc.d2s' }),
      );
      const handler = getUnvaultHandler();

      // Act
      const promise = handler?.(null, 'row-1');

      // Assert
      await expect(promise).rejects.toThrow('target position is required');
      expect(mocks.grailDatabaseMock.unvaultVaultItem).not.toHaveBeenCalled();
    });

    it('If the row is not vaulted anymore, Then it does not write the item a second time', async () => {
      // Arrange
      mocks.grailDatabaseMock.getVaultItemById.mockReturnValue(
        makeVaultItem({
          id: 'row-1',
          fingerprint: 'fp-real',
          sourceFilePath: '/tmp/sorc.d2s',
          unvaultedAt: new Date('2024-03-01T00:00:00.000Z'),
        }),
      );
      const handler = getUnvaultHandler();

      // Act
      const promise = handler?.(null, 'row-1', inventoryTarget);

      // Assert
      await expect(promise).rejects.toThrow('not currently vaulted');
      expect(mocks.saveFileEditorMock.addItemToSaveFile).not.toHaveBeenCalled();
    });

    it('If the row is a grail bookmark, Then it never writes catalog data into a save file', async () => {
      // Arrange
      mocks.grailDatabaseMock.getVaultItemById.mockReturnValue(
        makeVaultItem({ id: 'grail:shako', fingerprint: 'grail:shako' }),
      );
      const handler = getUnvaultHandler();

      // Act
      const promise = handler?.(null, 'grail:shako', inventoryTarget);

      // Assert
      await expect(promise).rejects.toThrow('grail bookmark');
      expect(mocks.saveFileEditorMock.addItemToSaveFile).not.toHaveBeenCalled();
    });

    it('If a rune stack is unvaulted completely, Then the whole stack count is written before the vault row is cleared', async () => {
      // Arrange
      mocks.grailDatabaseMock.getVaultItemById.mockReturnValue(
        makeVaultItem({
          id: 'row-runes',
          fingerprint: 'fp-runes',
          itemCode: 'r19',
          stackCount: 12,
          rawItemJson: JSON.stringify({ code: 'r19', quantity: 3 }),
          sourceFilePath: '/tmp/shared.d2i',
        }),
      );
      const handler = getUnvaultHandler();

      // Act
      await handler?.(null, 'row-runes', {
        targetFilePath: '/tmp/shared.d2i',
        targetFileType: 'd2i',
        targetLocationContext: 'stash',
        targetStashTab: 7,
        targetGridX: 0,
        targetGridY: 0,
      });

      // Assert
      expect(mocks.saveFileEditorMock.addItemToSaveFile).toHaveBeenCalledWith(
        '/tmp/shared.d2i',
        'd2i',
        expect.objectContaining({ code: 'r19' }),
        'stash',
        7,
        0,
        0,
        undefined,
        12,
      );
      expect(mocks.grailDatabaseMock.unvaultVaultItem).toHaveBeenCalledWith('row-runes', 12);
      expect(mocks.saveFileEditorMock.addItemToSaveFile.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.grailDatabaseMock.unvaultVaultItem.mock.invocationCallOrder[0],
      );
    });

    it('If part of a rune stack is withdrawn, Then exactly that many units are written and deducted', async () => {
      // Arrange
      mocks.grailDatabaseMock.getVaultItemById.mockReturnValue(
        makeVaultItem({
          id: 'row-runes',
          fingerprint: 'fp-runes',
          itemCode: 'r19',
          stackCount: 12,
          rawItemJson: JSON.stringify({ code: 'r19', quantity: 3 }),
          sourceFilePath: '/tmp/shared.d2i',
        }),
      );
      const handler = getUnvaultHandler();

      // Act
      await handler?.(
        null,
        'row-runes',
        {
          targetFilePath: '/tmp/shared.d2i',
          targetFileType: 'd2i',
          targetLocationContext: 'stash',
          targetStashTab: 7,
          targetGridX: 0,
          targetGridY: 0,
        },
        5,
      );

      // Assert
      expect(mocks.saveFileEditorMock.addItemToSaveFile.mock.calls[0]?.[8]).toBe(5);
      expect(mocks.grailDatabaseMock.unvaultVaultItem).toHaveBeenCalledWith('row-runes', 5);
    });

    it('If more units are withdrawn than the stack holds, Then it refuses before touching any file', async () => {
      // Arrange
      mocks.grailDatabaseMock.getVaultItemById.mockReturnValue(
        makeVaultItem({
          id: 'row-runes',
          fingerprint: 'fp-runes',
          itemCode: 'r19',
          stackCount: 2,
          rawItemJson: JSON.stringify({ code: 'r19' }),
          sourceFilePath: '/tmp/shared.d2i',
        }),
      );
      const handler = getUnvaultHandler();

      // Act
      const promise = handler?.(null, 'row-runes', inventoryTarget, 3);

      // Assert
      await expect(promise).rejects.toThrow('exceeds the number of items');
      expect(mocks.saveFileEditorMock.addItemToSaveFile).not.toHaveBeenCalled();
    });

    it('If a non-stack item is withdrawn partially, Then it refuses', async () => {
      // Arrange
      mocks.grailDatabaseMock.getVaultItemById.mockReturnValue(
        makeVaultItem({
          id: 'row-arrows',
          fingerprint: 'fp-arrows',
          itemCode: 'aqv',
          stackCount: 80,
          rawItemJson: JSON.stringify({ code: 'aqv', quantity: 80 }),
          sourceFilePath: '/tmp/sorc.d2s',
        }),
      );
      const handler = getUnvaultHandler();

      // Act
      const promise = handler?.(null, 'row-arrows', inventoryTarget, 10);

      // Assert
      await expect(promise).rejects.toThrow('partially');
      expect(mocks.saveFileEditorMock.addItemToSaveFile).not.toHaveBeenCalled();
    });

    it('If writing the item to the save file fails, Then the vault row stays vaulted', async () => {
      // Arrange
      mocks.grailDatabaseMock.getVaultItemById.mockReturnValue(
        makeVaultItem({
          id: 'row-1',
          fingerprint: 'fp-real',
          rawItemJson: '{"id":42,"code":"uap"}',
          sourceFilePath: '/tmp/sorc.d2s',
        }),
      );
      mocks.saveFileEditorMock.addItemToSaveFile.mockRejectedValue(
        new Error('TARGET_CELL_OCCUPIED'),
      );
      const handler = getUnvaultHandler();

      // Act
      const promise = handler?.(null, 'row-1', inventoryTarget);

      // Assert
      await expect(promise).rejects.toThrow('TARGET_CELL_OCCUPIED');
      expect(mocks.grailDatabaseMock.unvaultVaultItem).not.toHaveBeenCalled();
    });

    it('If the same row is unvaulted twice at once, Then the item is written only once', async () => {
      // Arrange
      mocks.grailDatabaseMock.getVaultItemById.mockReturnValue(
        makeVaultItem({
          id: 'row-1',
          fingerprint: 'fp-real',
          rawItemJson: '{"id":42,"code":"uap"}',
          sourceFilePath: '/tmp/sorc.d2s',
        }),
      );
      let finishWrite: () => void = () => undefined;
      mocks.saveFileEditorMock.addItemToSaveFile.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            finishWrite = resolve;
          }),
      );
      const handler = getUnvaultHandler();

      // Act
      const first = handler?.(null, 'row-1', inventoryTarget);
      const second = handler?.(null, 'row-1', inventoryTarget);
      await expect(second).rejects.toThrow('already being unvaulted');
      finishWrite();
      await first;

      // Assert
      expect(mocks.saveFileEditorMock.addItemToSaveFile).toHaveBeenCalledTimes(1);
      expect(mocks.grailDatabaseMock.unvaultVaultItem).toHaveBeenCalledTimes(1);
    });

    it('If an equipped target has no slot, Then it is rejected at IPC validation', async () => {
      // Arrange
      const handler = getUnvaultHandler();

      // Act
      const promise = handler?.(null, 'row-1', {
        ...inventoryTarget,
        targetLocationContext: 'equipped',
      });

      // Assert
      await expect(promise).rejects.toThrow('targetEquippedSlotId must be one of: 1-12');
    });

    it('If a tag-only row without a source file is unvaulted, Then only the vault state changes', async () => {
      // Arrange
      mocks.grailDatabaseMock.getVaultItemById.mockReturnValue(
        makeVaultItem({ id: 'row-tag', fingerprint: 'fp-tag' }),
      );
      const handler = getUnvaultHandler();

      // Act
      await handler?.(null, 'row-tag');

      // Assert
      expect(mocks.grailDatabaseMock.unvaultVaultItem).toHaveBeenCalledWith('row-tag', undefined);
      expect(mocks.saveFileEditorMock.addItemToSaveFile).not.toHaveBeenCalled();
    });
  });

  describe('If inventory:moveItem receives a d2i source without item id and coordinates', () => {
    it('Then it rejects the request instead of searching for nothing after the add', async () => {
      // Arrange
      initializeVaultHandlers(() => undefined);
      const handler = mocks.handleMock.mock.calls.find(
        (call) => call[0] === 'inventory:moveItem',
      )?.[1];

      // Act
      const promise = handler?.(null, {
        sourceFilePath: '/tmp/shared.d2i',
        sourceFileType: 'd2i',
        rawItemJson: JSON.stringify({ code: 'r19' }),
        targetFilePath: '/tmp/shared.d2i',
        targetFileType: 'd2i',
        targetLocationContext: 'stash',
        targetStashTab: 0,
        targetGridX: 1,
        targetGridY: 1,
      });

      // Assert
      await expect(promise).rejects.toThrow('numeric item id or grid coordinates');
      expect(mocks.saveFileEditorMock.moveItemBetweenSaveFiles).not.toHaveBeenCalled();
    });
  });

  describe('If the game is running', () => {
    beforeEach(() => {
      mocks.assertGameNotRunning.mockRejectedValue(new Error('GAME_RUNNING'));
    });

    it('Then inventory:moveItem is refused before any file is touched', async () => {
      // Arrange
      initializeVaultHandlers(() => undefined);
      const handler = mocks.handleMock.mock.calls.find(
        (call) => call[0] === 'inventory:moveItem',
      )?.[1];

      // Act
      const promise = handler?.(null, {
        sourceFilePath: '/tmp/sorc.d2s',
        sourceFileType: 'd2s',
        rawItemJson: JSON.stringify({ id: 42, code: 'uap' }),
        targetFilePath: '/tmp/barb.d2s',
        targetFileType: 'd2s',
        targetLocationContext: 'inventory',
        targetGridX: 3,
        targetGridY: 1,
      });

      // Assert
      await expect(promise).rejects.toThrow('GAME_RUNNING');
      expect(mocks.saveFileEditorMock.moveItemBetweenSaveFiles).not.toHaveBeenCalled();
    });

    it('Then vault:addItem does not vault or remove a source-backed item', async () => {
      // Arrange
      initializeVaultHandlers(() => undefined);
      const handler = mocks.handleMock.mock.calls.find((call) => call[0] === 'vault:addItem')?.[1];

      // Act
      const promise = handler?.(null, {
        fingerprint: 'fp-shako',
        itemName: 'Shako',
        quality: 'unique',
        ethereal: false,
        rawItemJson: '{"id":42}',
        sourceFileType: 'd2s',
        sourceFilePath: '/tmp/sorc.d2s',
        locationContext: 'inventory',
      });

      // Assert
      await expect(promise).rejects.toThrow('GAME_RUNNING');
      expect(mocks.grailDatabaseMock.addVaultItemWithUndo).not.toHaveBeenCalled();
      expect(mocks.saveFileEditorMock.removeItemFromSaveFile).not.toHaveBeenCalled();
    });

    it('Then vault:unvaultItem keeps the item in the vault', async () => {
      // Arrange
      mocks.grailDatabaseMock.getVaultItemById.mockReturnValue(
        makeVaultItem({
          id: 'row-1',
          fingerprint: 'fp-real',
          rawItemJson: '{"id":42,"code":"uap"}',
          sourceFilePath: '/tmp/sorc.d2s',
        }),
      );
      initializeVaultHandlers(() => undefined);
      const handler = mocks.handleMock.mock.calls.find(
        (call) => call[0] === 'vault:unvaultItem',
      )?.[1];

      // Act
      const promise = handler?.(null, 'row-1', {
        targetFilePath: '/tmp/sorc.d2s',
        targetFileType: 'd2s',
        targetLocationContext: 'inventory',
        targetGridX: 0,
        targetGridY: 0,
      });

      // Assert
      await expect(promise).rejects.toThrow('GAME_RUNNING');
      expect(mocks.saveFileEditorMock.addItemToSaveFile).not.toHaveBeenCalled();
      expect(mocks.grailDatabaseMock.unvaultVaultItem).not.toHaveBeenCalled();
    });
  });
});
