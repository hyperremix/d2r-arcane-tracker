import { writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join } from 'node:path';
import { dialog, ipcMain } from 'electron';
import { createIpcMainRegistry } from '../ipc/handle';

/**
 * Directory of the last file or folder the user picked in a native dialog.
 * Since Electron 43, dialogs without a `defaultPath` open in the Downloads folder instead of
 * letting the OS restore the last-used directory, so the previous behavior is kept here.
 * It is kept in memory only: it is remembered per session and resets when the app restarts.
 */
let lastUsedDirectory: string | undefined;

/**
 * Points dialog options at the last-used directory when the caller did not choose a location.
 * A missing `defaultPath` becomes the remembered directory, and a bare file name is placed in it.
 * Options that are not plain objects (including arrays) are returned unchanged so Electron can reject them.
 * @param {T} options - Dialog options received from the renderer process.
 * @returns {T} The options with a resolved `defaultPath` when one could be inferred.
 */
export function applyLastUsedDirectory<T>(options: T): T {
  if (
    !lastUsedDirectory ||
    typeof options !== 'object' ||
    options === null ||
    Array.isArray(options)
  ) {
    return options;
  }

  const { defaultPath } = options as { defaultPath?: unknown };
  if (defaultPath === undefined || defaultPath === '') {
    return { ...options, defaultPath: lastUsedDirectory };
  }
  if (
    typeof defaultPath === 'string' &&
    !isAbsolute(defaultPath) &&
    basename(defaultPath) === defaultPath
  ) {
    return { ...options, defaultPath: join(lastUsedDirectory, defaultPath) };
  }
  return options;
}

/**
 * Remembers the directory containing the path the user picked.
 * @param {string | undefined} selectedPath - The selected file or folder, if any.
 */
function rememberDirectoryOf(selectedPath: string | undefined): void {
  if (selectedPath && isAbsolute(selectedPath)) {
    lastUsedDirectory = dirname(selectedPath);
  }
}

/**
 * Forgets the remembered dialog directory. Intended for tests.
 */
export function resetLastUsedDirectory(): void {
  lastUsedDirectory = undefined;
}

/**
 * Initializes IPC handlers for native dialog operations.
 * Sets up handlers for save and open dialogs that can be called from the renderer process.
 * @returns Function that removes the handlers
 */
export function initializeDialogHandlers(): () => void {
  const { handle, dispose } = createIpcMainRegistry(ipcMain);
  // Save dialog handler
  handle('dialog:showSaveDialog', async (_, options) => {
    const result = await dialog.showSaveDialog(applyLastUsedDirectory(options));
    if (!result.canceled) {
      rememberDirectoryOf(result.filePath);
    }
    return result;
  });

  // Open dialog handler
  handle('dialog:showOpenDialog', async (_, options) => {
    const result = await dialog.showOpenDialog(applyLastUsedDirectory(options));
    if (!result.canceled) {
      rememberDirectoryOf(result.filePaths[0]);
    }
    return result;
  });

  // Write file handler
  // The validator only accepts an absolute file path and string content
  handle('dialog:writeFile', async (_, filePath, content) => {
    await writeFile(filePath, content, 'utf-8');
    return { success: true };
  });

  console.log('Dialog IPC handlers initialized');

  return dispose;
}
