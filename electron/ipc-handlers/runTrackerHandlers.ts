import { ipcMain } from 'electron';
import type { RunTrackerService } from '../services/runTracker';

let runTracker: RunTrackerService | null = null;

/**
 * Initialize run tracker IPC handlers.
 * @param runTrackerInstance - The run tracker service instance
 */
export function initializeRunTrackerHandlers(runTrackerInstance: RunTrackerService): void {
  runTracker = runTrackerInstance;

  // Session management handlers
  ipcMain.handle('run-tracker:start-session', async (_event, characterId?: string) => {
    try {
      if (!runTracker) {
        throw new Error('Run tracker not initialized');
      }
      return runTracker.startSession(characterId);
    } catch (error) {
      console.error('[runTrackerHandlers] Error starting session:', error);
      throw error;
    }
  });

  ipcMain.handle('run-tracker:end-session', async (_event) => {
    try {
      if (!runTracker) {
        throw new Error('Run tracker not initialized');
      }
      runTracker.endSession();
      return { success: true };
    } catch (error) {
      console.error('[runTrackerHandlers] Error ending session:', error);
      throw error;
    }
  });

  ipcMain.handle('run-tracker:archive-session', async (_event, sessionId: string) => {
    try {
      if (!runTracker) {
        throw new Error('Run tracker not initialized');
      }
      if (!sessionId || typeof sessionId !== 'string') {
        throw new Error('Invalid session ID');
      }
      runTracker.archiveSession(sessionId);
      return { success: true };
    } catch (error) {
      console.error('[runTrackerHandlers] Error archiving session:', error);
      throw error;
    }
  });

  // Run management handlers
  ipcMain.handle('run-tracker:start-run', async (_event, characterId: string) => {
    try {
      if (!runTracker) {
        throw new Error('Run tracker not initialized');
      }
      if (!characterId || typeof characterId !== 'string') {
        throw new Error('Invalid character ID');
      }
      return runTracker.startRun(characterId, true);
    } catch (error) {
      console.error('[runTrackerHandlers] Error starting run:', error);
      throw error;
    }
  });

  ipcMain.handle('run-tracker:end-run', async (_event) => {
    try {
      if (!runTracker) {
        throw new Error('Run tracker not initialized');
      }
      runTracker.endRun(true);
      return { success: true };
    } catch (error) {
      console.error('[runTrackerHandlers] Error ending run:', error);
      throw error;
    }
  });

  ipcMain.handle('run-tracker:pause', async (_event) => {
    try {
      if (!runTracker) {
        throw new Error('Run tracker not initialized');
      }
      runTracker.pauseRun();
      return { success: true };
    } catch (error) {
      console.error('[runTrackerHandlers] Error pausing run:', error);
      throw error;
    }
  });

  ipcMain.handle('run-tracker:resume', async (_event) => {
    try {
      if (!runTracker) {
        throw new Error('Run tracker not initialized');
      }
      runTracker.resumeRun();
      return { success: true };
    } catch (error) {
      console.error('[runTrackerHandlers] Error resuming run:', error);
      throw error;
    }
  });

  ipcMain.handle('run-tracker:set-run-type', async (_event, runType: string) => {
    try {
      if (!runTracker) {
        throw new Error('Run tracker not initialized');
      }
      if (!runType || typeof runType !== 'string') {
        throw new Error('Invalid run type');
      }
      runTracker.setRunType(runType);
      return { success: true };
    } catch (error) {
      console.error('[runTrackerHandlers] Error setting run type:', error);
      throw error;
    }
  });

  // State query handlers
  ipcMain.handle('run-tracker:get-state', async (_event) => {
    try {
      if (!runTracker) {
        throw new Error('Run tracker not initialized');
      }
      return runTracker.getState();
    } catch (error) {
      console.error('[runTrackerHandlers] Error getting state:', error);
      throw error;
    }
  });

  ipcMain.handle('run-tracker:get-active-session', async (_event) => {
    try {
      if (!runTracker) {
        throw new Error('Run tracker not initialized');
      }
      return runTracker.getActiveSession();
    } catch (error) {
      console.error('[runTrackerHandlers] Error getting active session:', error);
      throw error;
    }
  });

  ipcMain.handle('run-tracker:get-active-run', async (_event) => {
    try {
      if (!runTracker) {
        throw new Error('Run tracker not initialized');
      }
      return runTracker.getActiveRun();
    } catch (error) {
      console.error('[runTrackerHandlers] Error getting active run:', error);
      throw error;
    }
  });

  // Statistics query handlers
  ipcMain.handle('run-tracker:get-sessions-by-character', async (_event, characterId: string) => {
    try {
      if (!runTracker) {
        throw new Error('Run tracker not initialized');
      }
      if (!characterId || typeof characterId !== 'string') {
        throw new Error('Invalid character ID');
      }
      // Access database through runTracker service
      const database = runTracker.getDatabase();
      return database.getSessionsByCharacter(characterId);
    } catch (error) {
      console.error('[runTrackerHandlers] Error getting sessions by character:', error);
      throw error;
    }
  });

  ipcMain.handle('run-tracker:get-session-by-id', async (_event, sessionId: string) => {
    try {
      if (!runTracker) {
        throw new Error('Run tracker not initialized');
      }
      if (!sessionId || typeof sessionId !== 'string') {
        throw new Error('Invalid session ID');
      }
      const database = runTracker.getDatabase();
      return database.getSessionById(sessionId);
    } catch (error) {
      console.error('[runTrackerHandlers] Error getting session by ID:', error);
      throw error;
    }
  });

  ipcMain.handle('run-tracker:get-runs-by-session', async (_event, sessionId: string) => {
    try {
      if (!runTracker) {
        throw new Error('Run tracker not initialized');
      }
      if (!sessionId || typeof sessionId !== 'string') {
        throw new Error('Invalid session ID');
      }
      const database = runTracker.getDatabase();
      return database.getRunsBySession(sessionId);
    } catch (error) {
      console.error('[runTrackerHandlers] Error getting runs by session:', error);
      throw error;
    }
  });

  ipcMain.handle('run-tracker:get-run-items', async (_event, runId: string) => {
    try {
      if (!runTracker) {
        throw new Error('Run tracker not initialized');
      }
      if (!runId || typeof runId !== 'string') {
        throw new Error('Invalid run ID');
      }
      const database = runTracker.getDatabase();
      return database.getRunItems(runId);
    } catch (error) {
      console.error('[runTrackerHandlers] Error getting run items:', error);
      throw error;
    }
  });

  ipcMain.handle('run-tracker:get-session-items', async (_event, sessionId: string) => {
    try {
      if (!runTracker) {
        throw new Error('Run tracker not initialized');
      }
      if (!sessionId || typeof sessionId !== 'string') {
        throw new Error('Invalid session ID');
      }
      const database = runTracker.getDatabase();
      return database.getSessionItems(sessionId);
    } catch (error) {
      console.error('[runTrackerHandlers] Error getting session items:', error);
      throw error;
    }
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
