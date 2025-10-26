import { writeFile } from 'node:fs/promises';
import { dialog, ipcMain } from 'electron';

/**
 * Initializes IPC handlers for native dialog operations.
 * Sets up handlers for save and open dialogs that can be called from the renderer process.
 */
export function initializeDialogHandlers(): void {
  // Save dialog handler
  ipcMain.handle('dialog:showSaveDialog', async (_, options) => {
    try {
      const result = await dialog.showSaveDialog(options);
      return result;
    } catch (error) {
      console.error('Failed to show save dialog:', error);
      throw error;
    }
  });

  // Open dialog handler
  ipcMain.handle('dialog:showOpenDialog', async (_, options) => {
    try {
      const result = await dialog.showOpenDialog(options);
      return result;
    } catch (error) {
      console.error('Failed to show open dialog:', error);
      throw error;
    }
  });

  // Write file handler
  ipcMain.handle('dialog:writeFile', async (_, filePath: string, content: string) => {
    try {
      await writeFile(filePath, content, 'utf-8');
      return { success: true };
    } catch (error) {
      console.error('Failed to write file:', error);
      throw error;
    }
  });

  console.log('Dialog IPC handlers initialized');
}
