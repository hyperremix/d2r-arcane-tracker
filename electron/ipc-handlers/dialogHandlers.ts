import { dialog, ipcMain } from 'electron';

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

  console.log('Dialog IPC handlers initialized');
}
