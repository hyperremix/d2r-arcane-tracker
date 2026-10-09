import { ipcMain } from 'electron';
import { createIpcMainRegistry } from '../ipc/handle';
import type { VaultService } from '../services/vaultService';

/**
 * Registers the vault and inventory IPC handlers. The vault service validates every
 * renderer-provided argument.
 * @param vault - The vault service
 */
export function initializeVaultHandlers(vault: VaultService): void {
  const { handle } = createIpcMainRegistry(ipcMain);

  handle('vault:addItem', (_, item) => vault.addItem(item));

  handle('vault:removeItem', (_, itemId) => {
    vault.removeItem(itemId);
    return { success: true };
  });

  handle('vault:unvaultItem', async (_, itemId, targetOptions, withdrawCount) => {
    await vault.unvaultItem(itemId, targetOptions, withdrawCount);
    return { success: true };
  });

  handle('vault:search', (_, filter) => vault.search(filter));

  handle('inventory:searchAll', (_, filter) => vault.searchAll(filter));

  handle('inventory:moveItem', async (_, input) => {
    await vault.moveItem(input);
    return { success: true };
  });

  handle('inventory:splitStack', async (_, input) => {
    await vault.splitStack(input);
    return { success: true };
  });
}
