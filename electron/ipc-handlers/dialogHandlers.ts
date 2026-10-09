import { writeFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { dialog, ipcMain } from 'electron';
import { createIpcMainRegistry } from '../ipc/handle';

/**
 * Initializes IPC handlers for native dialog operations.
 * Sets up handlers for save and open dialogs that can be called from the renderer process.
 */
export function initializeDialogHandlers(): void {
  const { handle } = createIpcMainRegistry(ipcMain);
  // Save dialog handler
  handle('dialog:showSaveDialog', async (_, options) => {
    return await dialog.showSaveDialog(options);
  });

  // Open dialog handler
  handle('dialog:showOpenDialog', async (_, options) => {
    return await dialog.showOpenDialog(options);
  });

  // Write file handler
  handle('dialog:writeFile', async (_, filePath: unknown, content: unknown) => {
    if (typeof filePath !== 'string' || filePath.trim().length === 0 || !isAbsolute(filePath)) {
      throw new Error('Invalid file path');
    }
    if (typeof content !== 'string') {
      throw new Error('Invalid file content');
    }

    await writeFile(filePath, content, 'utf-8');
    return { success: true };
  });

  console.log('Dialog IPC handlers initialized');
}
