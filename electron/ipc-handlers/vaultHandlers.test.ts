import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      mocks.handlers.set(channel, handler);
    }),
  },
}));

import type { VaultService } from '../services/vaultService';
import { initializeVaultHandlers } from './vaultHandlers';

function createVaultServiceStub() {
  return {
    addItem: vi.fn().mockResolvedValue({ id: 'vault-1' }),
    removeItem: vi.fn(),
    unvaultItem: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockReturnValue({ items: [], total: 0 }),
    searchAll: vi.fn().mockReturnValue({ inventory: {}, vault: {} }),
    moveItem: vi.fn().mockResolvedValue(undefined),
    splitStack: vi.fn().mockResolvedValue(undefined),
  };
}

function invoke(channel: string, ...args: unknown[]) {
  const handler = mocks.handlers.get(channel);
  if (!handler) {
    throw new Error(`No handler registered for ${channel}`);
  }
  return handler({}, ...args);
}

describe('When the vault IPC handlers are initialized', () => {
  let vault: ReturnType<typeof createVaultServiceStub>;

  beforeEach(() => {
    mocks.handlers.clear();
    vault = createVaultServiceStub();
    initializeVaultHandlers(vault as unknown as VaultService);
  });

  it('Then every vault and inventory channel is registered', () => {
    // Arrange
    const expectedChannels = [
      'vault:addItem',
      'vault:removeItem',
      'vault:unvaultItem',
      'vault:search',
      'inventory:searchAll',
      'inventory:moveItem',
      'inventory:splitStack',
    ];

    // Act
    const registeredChannels = [...mocks.handlers.keys()];

    // Assert
    expect(registeredChannels).toEqual(expect.arrayContaining(expectedChannels));
  });

  it('Then channels without a renderer caller are not registered', () => {
    // Arrange
    const removedChannels = [
      'vault:listItems',
      'vault:listCategories',
      'vault:updateItemTags',
      'vault:createCategory',
      'vault:updateCategory',
      'vault:deleteCategory',
      'inventory:listSnapshots',
    ];

    // Act
    const registeredChannels = [...mocks.handlers.keys()];

    // Assert
    for (const channel of removedChannels) {
      expect(registeredChannels).not.toContain(channel);
    }
  });

  describe('If vault:addItem is invoked', () => {
    it('Then the item is passed to the vault service and the stored item returned', async () => {
      // Arrange
      const item = { fingerprint: 'fp-1' };

      // Act
      const result = await invoke('vault:addItem', item);

      // Assert
      expect(vault.addItem).toHaveBeenCalledWith(item);
      expect(result).toEqual({ id: 'vault-1' });
    });
  });

  describe('If vault:unvaultItem is invoked', () => {
    it('Then the item, target and withdraw count are passed on and success is reported', async () => {
      // Arrange
      const target = { targetFilePath: '/tmp/sorc.d2s' };

      // Act
      const result = await invoke('vault:unvaultItem', 'row-1', target, 3);

      // Assert
      expect(vault.unvaultItem).toHaveBeenCalledWith('row-1', target, 3);
      expect(result).toEqual({ success: true });
    });
  });

  describe('If vault:removeItem is refused by the vault service', () => {
    it('Then the invoke rejects with the service error', async () => {
      // Arrange
      vault.removeItem.mockImplementation(() => {
        throw new Error('Unvault this item before removing it from the vault');
      });
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      // Act
      const result = invoke('vault:removeItem', 'row-1');

      // Assert
      await expect(result).rejects.toThrow('Unvault this item before removing it from the vault');
      consoleError.mockRestore();
    });
  });

  describe('If inventory:moveItem and inventory:splitStack are invoked', () => {
    it('Then the inputs are passed to the vault service and success is reported', async () => {
      // Arrange
      const moveInput = { sourceFilePath: '/tmp/a.d2s' };
      const splitInput = { sourceFilePath: '/tmp/b.d2i' };

      // Act
      const moveResult = await invoke('inventory:moveItem', moveInput);
      const splitResult = await invoke('inventory:splitStack', splitInput);

      // Assert
      expect(vault.moveItem).toHaveBeenCalledWith(moveInput);
      expect(vault.splitStack).toHaveBeenCalledWith(splitInput);
      expect(moveResult).toEqual({ success: true });
      expect(splitResult).toEqual({ success: true });
    });
  });

  describe('If vault:search and inventory:searchAll are invoked', () => {
    it('Then the search results of the vault service are returned', async () => {
      // Arrange
      const filter = { text: 'shako' };

      // Act
      const vaultResult = await invoke('vault:search', filter);
      const allResult = await invoke('inventory:searchAll', filter);

      // Assert
      expect(vault.search).toHaveBeenCalledWith(filter);
      expect(vault.searchAll).toHaveBeenCalledWith(filter);
      expect(vaultResult).toEqual({ items: [], total: 0 });
      expect(allResult).toEqual({ inventory: {}, vault: {} });
    });
  });
});
