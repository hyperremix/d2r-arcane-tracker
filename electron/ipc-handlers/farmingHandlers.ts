import { ipcMain } from 'electron';
import { createIpcMainRegistry } from '../ipc/handle';
import type { FarmingService } from '../services/farming/farmingService';
import type { SettingsService } from '../services/settingsService';

/** Dependencies of the farming advisor IPC handlers. */
export interface FarmingHandlerDependencies {
  farmingService: FarmingService;
  settings: SettingsService;
}

/**
 * Initializes the IPC handlers of the farming advisor, which read the game data tables of the D2R
 * installation set in the settings.
 * @param deps - The farming service and the settings holding the D2R installation path
 * @returns Function that removes the handlers
 */
export function initializeFarmingHandlers({
  farmingService,
  settings,
}: FarmingHandlerDependencies): () => void {
  const { handle, dispose } = createIpcMainRegistry(ipcMain);

  handle('farming:getOverview', async (_, request) =>
    farmingService.getOverview(settings.getAll().d2rInstallPath, request),
  );

  handle('farming:getItemSources', async (_, request) =>
    farmingService.getItemSources(settings.getAll().d2rInstallPath, request),
  );

  return dispose;
}
