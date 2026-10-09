import { ipcMain, shell } from 'electron';
import { createIpcMainRegistry } from '../ipc/handle';

/**
 * Initializes IPC handlers for shell operations.
 * Sets up handlers for opening external URLs and other shell-related functionality.
 */
export function initializeShellHandlers(): void {
  const { handle } = createIpcMainRegistry(ipcMain);
  // Open external URL handler
  handle('shell:openExternal', async (_, url) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      console.error('Failed to open external URL:', error);
      return { success: false, error: String(error) };
    }
  });

  console.log('Shell IPC handlers initialized');
}
