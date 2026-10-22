import { ipcMain } from 'electron';
import { createIpcMainRegistry } from '../ipc/handle';
import type { D2RLoaderBridge } from '../services/d2rLoader/d2rLoaderBridge';
import type { PluginInstaller } from '../services/d2rLoader/pluginInstaller';
import {
  importRunCounterData,
  type RunCounterImportDatabase,
  resolveRunCounterFolder,
} from '../services/d2rLoader/runCounterImport';

/** Dependencies of the D2RLoader IPC handlers. */
export interface D2RLoaderHandlerDependencies {
  bridge: Pick<D2RLoaderBridge, 'getStatus'>;
  installer: Pick<PluginInstaller, 'getInstallation' | 'install' | 'uninstall'>;
  database: RunCounterImportDatabase;
  /** The D2R folder from the settings. */
  getGameFolder: () => string | undefined;
}

/**
 * Registers the IPC handlers of the D2RLoader plugin: its connection state, installing it into
 * the D2R folder and importing Run Counter's history.
 * @param deps - The bridge, the plugin installer, the database and the D2R folder
 * @returns Function that removes the handlers
 */
export function initializeD2RLoaderHandlers({
  bridge,
  installer,
  database,
  getGameFolder,
}: D2RLoaderHandlerDependencies): () => void {
  const { handle, dispose } = createIpcMainRegistry(ipcMain);

  handle('d2rLoader:getStatus', () => bridge.getStatus());
  handle('d2rLoader:getInstallation', () => installer.getInstallation());
  handle('d2rLoader:installPlugin', () => installer.install());
  handle('d2rLoader:uninstallPlugin', () => installer.uninstall());
  handle('d2rLoader:importRunCounter', async () => {
    const gameFolder = getGameFolder();
    if (!gameFolder) {
      throw new Error('The D2R folder is not set');
    }
    return importRunCounterData(database, await resolveRunCounterFolder(gameFolder));
  });

  return dispose;
}
