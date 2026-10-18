import { ipcMain } from 'electron';
import { createIpcMainRegistry } from '../ipc/handle';
import type { SaveFileSnapshotService } from '../services/saveFileSnapshots';

/**
 * Initializes the IPC handlers that list save file snapshots and restore a save file from one.
 * @param snapshots - The snapshot service
 * @returns Function that removes the handlers
 */
export function initializeSaveFileSnapshotHandlers(
  snapshots: Pick<SaveFileSnapshotService, 'list' | 'restore'>,
): () => void {
  const { handle, dispose } = createIpcMainRegistry(ipcMain);

  handle('saveSnapshots:list', () => snapshots.list());

  // The validator only accepts the ID format of listed snapshots; the service checks the folder
  handle('saveSnapshots:restore', async (_, snapshotId) => {
    await snapshots.restore(snapshotId);
    return { success: true };
  });

  return dispose;
}
