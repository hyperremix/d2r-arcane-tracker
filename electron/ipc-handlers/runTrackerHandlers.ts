import { ipcMain } from 'electron';
import type { RunTrackerService } from '../services/runTracker';

let runTracker: RunTrackerService | null = null;

/**
 * Initialize run tracker IPC handlers.
 * @param runTrackerInstance - The run tracker service instance
 */
export function initializeRunTrackerHandlers(runTrackerInstance: RunTrackerService): void {
  runTracker = runTrackerInstance;

  ipcMain.handle('run-tracker:start-run', async (_event, characterId: string) => {
    if (!runTracker) {
      throw new Error('Run tracker not initialized');
    }
    return runTracker.startRun(characterId, true);
  });

  ipcMain.handle('run-tracker:end-run', async (_event) => {
    if (!runTracker) {
      throw new Error('Run tracker not initialized');
    }
    runTracker.endRun(true);
  });

  ipcMain.handle('run-tracker:pause', async (_event) => {
    if (!runTracker) {
      throw new Error('Run tracker not initialized');
    }
    runTracker.pauseRun();
  });

  ipcMain.handle('run-tracker:resume', async (_event) => {
    if (!runTracker) {
      throw new Error('Run tracker not initialized');
    }
    runTracker.resumeRun();
  });

  ipcMain.handle('run-tracker:set-run-type', async (_event, runType: string) => {
    if (!runTracker) {
      throw new Error('Run tracker not initialized');
    }
    runTracker.setRunType(runType);
  });

  ipcMain.handle('run-tracker:get-state', async (_event) => {
    if (!runTracker) {
      throw new Error('Run tracker not initialized');
    }
    return runTracker.getState();
  });

  ipcMain.handle('run-tracker:get-active-session', async (_event) => {
    if (!runTracker) {
      throw new Error('Run tracker not initialized');
    }
    return runTracker.getActiveSession();
  });

  ipcMain.handle('run-tracker:get-active-run', async (_event) => {
    if (!runTracker) {
      throw new Error('Run tracker not initialized');
    }
    return runTracker.getActiveRun();
  });

  console.log('[runTrackerHandlers] IPC handlers initialized');
}

/**
 * Close run tracker service.
 */
export function closeRunTracker(): void {
  if (runTracker) {
    runTracker.shutdown();
    runTracker = null;
    console.log('[runTrackerHandlers] Run tracker closed');
  }
}
