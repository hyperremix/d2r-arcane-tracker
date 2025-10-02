import { ipcMain } from 'electron';
import { getItemCode, getPopularItemCodes, itemsByNameSimple } from '../items/indexes';
import { iconService } from '../services/iconService';
import { simplifyItemName } from '../utils/objects';

/**
 * Initializes IPC handlers for icon-related operations.
 */
export function initializeIconHandlers(): void {
  /**
   * Gets an item icon as base64 data URL.
   * Note: Runewords are excluded as they don't have individual item codes or icons.
   * @param _ - IPC event (unused)
   * @param itemName - The display name of the item
   * @returns Base64 data URL or null if not found
   */
  ipcMain.handle('icon:getByName', async (_, itemName: string): Promise<string | null> => {
    try {
      // Check if this is a runeword first - runewords should never have icons
      const simpleName = simplifyItemName(itemName);
      const item = itemsByNameSimple[simpleName];
      if (item?.type === 'runeword') {
        return null; // No icon for runewords
      }

      const itemCode = getItemCode(itemName);
      if (!itemCode) {
        console.warn(`No item code mapping for: ${itemName}`);
        return null;
      }

      return await iconService.getIconAsBase64(itemCode);
    } catch (error) {
      console.error(`Failed to get icon for ${itemName}:`, error);
      return null;
    }
  });

  /**
   * Gets an item icon by D2R item code.
   * @param _ - IPC event (unused)
   * @param itemCode - The D2R internal item code
   * @returns Base64 data URL or null if not found
   */
  ipcMain.handle('icon:getByCode', async (_, itemCode: string): Promise<string | null> => {
    try {
      return await iconService.getIconAsBase64(itemCode);
    } catch (error) {
      console.error(`Failed to get icon for code ${itemCode}:`, error);
      return null;
    }
  });

  /**
   * Preloads popular item icons for faster initial display.
   */
  ipcMain.handle('icon:preloadPopular', async (): Promise<{ success: boolean }> => {
    try {
      const popularCodes = getPopularItemCodes();
      await iconService.preloadIcons(popularCodes);
      return { success: true };
    } catch (error) {
      console.error('Failed to preload icons:', error);
      return { success: false };
    }
  });

  /**
   * Checks if D2R installation is available.
   * @returns True if D2R is found
   */
  ipcMain.handle('icon:isD2RAvailable', async (): Promise<boolean> => {
    try {
      return iconService.isD2RAvailable();
    } catch (error) {
      console.error('Failed to check D2R availability:', error);
      return false;
    }
  });

  /**
   * Clears the icon cache.
   */
  ipcMain.handle('icon:clearCache', async (): Promise<{ success: boolean }> => {
    try {
      iconService.clearCache();
      return { success: true };
    } catch (error) {
      console.error('Failed to clear cache:', error);
      return { success: false };
    }
  });

  /**
   * Gets cache statistics for debugging.
   */
  ipcMain.handle('icon:getCacheStats', async () => {
    try {
      return iconService.getCacheStats();
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      throw error;
    }
  });

  console.log('Icon IPC handlers initialized');
}
