import { type IpcMainInvokeEvent, ipcMain } from 'electron';
import type { RuneInventory } from '../../src/lib/runeword-calculator';
import { grailDatabase } from '../database/database';

const RUNE_INVENTORY_KEY = 'runeInventory';

/**
 * Get the rune inventory from the database settings table
 */
async function getRuneInventory(): Promise<RuneInventory> {
  try {
    const settings: any = grailDatabase.getAllSettings();
    const value = settings[RUNE_INVENTORY_KEY];
    if (!value) {
      return {};
    }
    return JSON.parse(value) as RuneInventory;
  } catch (error) {
    console.error('Failed to parse rune inventory:', error);
    return {};
  }
}

/**
 * Save the rune inventory to the database settings table
 */
async function saveRuneInventory(inventory: RuneInventory): Promise<void> {
  const value = JSON.stringify(inventory);
  grailDatabase.setSetting(RUNE_INVENTORY_KEY as any, value);
}

/**
 * Register all runeword-related IPC handlers
 */
export function registerRunewordHandlers(): void {
  ipcMain.handle('runeword:getInventory', async (_event: IpcMainInvokeEvent): Promise<RuneInventory> => {
    return getRuneInventory();
  });

  ipcMain.handle(
    'runeword:saveInventory',
    async (_event: IpcMainInvokeEvent, inventory: RuneInventory): Promise<void> => {
      return saveRuneInventory(inventory);
    }
  );
}
