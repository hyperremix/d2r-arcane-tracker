import { ipcMain, shell } from 'electron';

/**
 * Initializes IPC handlers for shell operations.
 * Sets up handlers for opening external URLs and other shell-related functionality.
 */
export function initializeShellHandlers(): void {
  // Open external URL handler
  ipcMain.handle('shell:openExternal', async (_, url: string) => {
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
