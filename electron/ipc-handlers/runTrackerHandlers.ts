import { ipcMain, webContents } from 'electron';
import type { EventBus } from '../services/EventBus';
import type { RunTrackerService } from '../services/runTracker';
import type { RunItem } from '../types/grail';

let runTracker: RunTrackerService | null = null;
const eventUnsubscribers: Array<() => void> = [];

/**
 * Initialize run tracker IPC handlers.
 * @param runTrackerInstance - The run tracker service instance
 * @param eventBus - The EventBus instance for event forwarding
 */
export function initializeRunTrackerHandlers(
  runTrackerInstance: RunTrackerService,
  eventBus: EventBus,
): void {
  runTracker = runTrackerInstance;

  // Session management handlers
  ipcMain.handle('run-tracker:start-session', async (_event) => {
    try {
      if (!runTracker) {
        throw new Error('Run tracker not initialized');
      }
      return runTracker.startSession();
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
  ipcMain.handle('run-tracker:start-run', async (_event, characterId?: string) => {
    try {
      if (!runTracker) {
        throw new Error('Run tracker not initialized');
      }
      // characterId is optional - validate only if provided
      if (characterId !== undefined && (typeof characterId !== 'string' || characterId === '')) {
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

  // State query handlers
  ipcMain.handle('run-tracker:get-state', async (_event) => {
    try {
      if (!runTracker) {
        console.warn('[runTrackerHandlers] Run tracker not initialized, returning default state');
        return {
          isRunning: false,
          isPaused: false,
          activeSession: null,
          activeRun: null,
        };
      }
      return runTracker.getState();
    } catch (error) {
      console.error('[runTrackerHandlers] Error getting state:', error);
      return {
        isRunning: false,
        isPaused: false,
        activeSession: null,
        activeRun: null,
      };
    }
  });

  ipcMain.handle('run-tracker:get-active-session', async (_event) => {
    try {
      if (!runTracker) {
        console.warn('[runTrackerHandlers] Run tracker not initialized, returning null');
        return null;
      }
      return runTracker.getActiveSession();
    } catch (error) {
      console.error('[runTrackerHandlers] Error getting active session:', error);
      return null;
    }
  });

  ipcMain.handle('run-tracker:get-active-run', async (_event) => {
    try {
      if (!runTracker) {
        console.warn('[runTrackerHandlers] Run tracker not initialized, returning null');
        return null;
      }
      return runTracker.getActiveRun();
    } catch (error) {
      console.error('[runTrackerHandlers] Error getting active run:', error);
      return null;
    }
  });

  // Statistics and data query handlers
  ipcMain.handle(
    'run-tracker:get-all-sessions',
    async (_event, includeArchived: boolean = false) => {
      try {
        if (!runTracker) {
          throw new Error('Run tracker not initialized');
        }
        // Access database through runTracker service
        const database = runTracker.getDatabase();
        return database.getAllSessions(includeArchived);
      } catch (error) {
        console.error('[runTrackerHandlers] Error getting all sessions:', error);
        throw error;
      }
    },
  );

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

  ipcMain.handle(
    'run-tracker:add-run-item',
    async (
      _event,
      data: {
        runId: string;
        name?: string;
        grailProgressId?: string;
        foundTime?: Date;
      },
    ) => {
      try {
        if (!runTracker) {
          throw new Error('Run tracker not initialized');
        }
        if (!data.runId || typeof data.runId !== 'string') {
          throw new Error('Invalid run ID');
        }
        if (!data.name && !data.grailProgressId) {
          throw new Error('Either name or grailProgressId must be provided');
        }

        const database = runTracker.getDatabase();

        // Verify the run exists by checking if we can get run items for it
        // This is a simple way to verify the run exists
        try {
          database.getRunItems(data.runId);
        } catch {
          // If getRunItems fails, the run might not exist
          // But we'll continue anyway as the foreign key constraint will catch it
        }

        const runItem: RunItem = {
          id: `run_item_${data.runId}_${Date.now()}`,
          runId: data.runId,
          grailProgressId: data.grailProgressId,
          name: data.name,
          foundTime: data.foundTime || new Date(),
          created: new Date(),
        };

        database.addRunItem(runItem);

        // Emit event for UI updates
        eventBus.emit('run-item-added', {
          runId: data.runId,
          name: data.name,
        });

        return { success: true, runItem };
      } catch (error) {
        console.error('[runTrackerHandlers] Error adding run item:', error);
        throw error;
      }
    },
  );

  ipcMain.handle('run-tracker:get-overall-statistics', async (_event) => {
    try {
      if (!runTracker) {
        throw new Error('Run tracker not initialized');
      }

      const database = runTracker.getDatabase();
      return database.getOverallRunStatistics();
    } catch (error) {
      console.error('[runTrackerHandlers] Error getting overall statistics:', error);
      throw error;
    }
  });

  ipcMain.handle('run-tracker:get-memory-status', async (_event) => {
    if (!runTracker) {
      return { available: false, reason: 'not_initialized' };
    }
    const available = runTracker.isMemoryReadingAvailable();
    return {
      available,
      reason: available ? null : 'pattern_not_found',
    };
  });

  // Set up event forwarding to renderer processes
  // Session events
  const unsubscribeSessionStarted = eventBus.on('session-started', (payload) => {
    const allWebContents = webContents.getAllWebContents();
    for (const wc of allWebContents) {
      // Only send to window type (not background pages, webviews, etc.)
      // Dev tools have type 'window' but belong to a parent window, so they'll receive events naturally
      if (!wc.isDestroyed() && wc.getType() === 'window') {
        wc.send('run-tracker:session-started', payload);
      }
    }
  });
  eventUnsubscribers.push(unsubscribeSessionStarted);

  const unsubscribeSessionEnded = eventBus.on('session-ended', (payload) => {
    const allWebContents = webContents.getAllWebContents();
    for (const wc of allWebContents) {
      if (!wc.isDestroyed() && wc.getType() === 'window') {
        wc.send('run-tracker:session-ended', payload);
      }
    }
  });
  eventUnsubscribers.push(unsubscribeSessionEnded);

  // Run events
  const unsubscribeRunStarted = eventBus.on('run-started', (payload) => {
    const allWebContents = webContents.getAllWebContents();
    for (const wc of allWebContents) {
      if (!wc.isDestroyed() && wc.getType() === 'window') {
        wc.send('run-tracker:run-started', payload);
      }
    }
  });
  eventUnsubscribers.push(unsubscribeRunStarted);

  const unsubscribeRunEnded = eventBus.on('run-ended', (payload) => {
    const allWebContents = webContents.getAllWebContents();
    for (const wc of allWebContents) {
      if (!wc.isDestroyed() && wc.getType() === 'window') {
        wc.send('run-tracker:run-ended', payload);
      }
    }
  });
  eventUnsubscribers.push(unsubscribeRunEnded);

  const unsubscribeRunPaused = eventBus.on('run-paused', (payload) => {
    const allWebContents = webContents.getAllWebContents();
    for (const wc of allWebContents) {
      if (!wc.isDestroyed() && wc.getType() === 'window') {
        wc.send('run-tracker:run-paused', payload);
      }
    }
  });
  eventUnsubscribers.push(unsubscribeRunPaused);

  const unsubscribeRunResumed = eventBus.on('run-resumed', (payload) => {
    const allWebContents = webContents.getAllWebContents();
    for (const wc of allWebContents) {
      if (!wc.isDestroyed() && wc.getType() === 'window') {
        wc.send('run-tracker:run-resumed', payload);
      }
    }
  });
  eventUnsubscribers.push(unsubscribeRunResumed);

  const unsubscribeRunItemAdded = eventBus.on('run-item-added', (payload) => {
    const allWebContents = webContents.getAllWebContents();
    for (const wc of allWebContents) {
      if (!wc.isDestroyed() && wc.getType() === 'window') {
        wc.send('run-tracker:run-item-added', payload);
      }
    }
  });
  eventUnsubscribers.push(unsubscribeRunItemAdded);

  console.log('[runTrackerHandlers] IPC handlers initialized');
}

/**
 * Close run tracker service.
 */
export function closeRunTracker(): void {
  // Clean up event listeners
  for (const unsubscribe of eventUnsubscribers) {
    unsubscribe();
  }
  eventUnsubscribers.length = 0;

  if (runTracker) {
    runTracker.shutdown();
    runTracker = null;
    console.log('[runTrackerHandlers] Run tracker closed');
  }
}
