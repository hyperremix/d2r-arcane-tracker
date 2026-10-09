import { ipcMain, webContents } from 'electron';
import { createRendererBroadcaster } from '../ipc/broadcast';
import { createIpcMainRegistry } from '../ipc/handle';
import type { EventBus } from '../services/EventBus';
import type { RunTrackerService } from '../services/runTracker';
import type { RunItem } from '../types/grail';

/** Sends an event from the IPC contract to every renderer window. */
const broadcastToRenderers = createRendererBroadcaster(() => webContents.getAllWebContents());

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
  const { handle } = createIpcMainRegistry(ipcMain);
  runTracker = runTrackerInstance;

  // Session management handlers
  handle('run-tracker:start-session', async (_event) => {
    if (!runTracker) {
      throw new Error('Run tracker not initialized');
    }
    return runTracker.startSession();
  });

  handle('run-tracker:end-session', async (_event) => {
    if (!runTracker) {
      throw new Error('Run tracker not initialized');
    }
    runTracker.endSession();
    return { success: true };
  });

  handle('run-tracker:archive-session', async (_event, sessionId) => {
    if (!runTracker) {
      throw new Error('Run tracker not initialized');
    }
    runTracker.archiveSession(sessionId);
    return { success: true };
  });

  // Run management handlers
  handle('run-tracker:start-run', async (_event, characterId) => {
    if (!runTracker) {
      throw new Error('Run tracker not initialized');
    }
    return runTracker.startRun(characterId, true);
  });

  handle('run-tracker:end-run', async (_event) => {
    if (!runTracker) {
      throw new Error('Run tracker not initialized');
    }
    runTracker.endRun(true);
    return { success: true };
  });

  handle('run-tracker:pause', async (_event) => {
    if (!runTracker) {
      throw new Error('Run tracker not initialized');
    }
    runTracker.pauseRun();
    return { success: true };
  });

  handle('run-tracker:resume', async (_event) => {
    if (!runTracker) {
      throw new Error('Run tracker not initialized');
    }
    runTracker.resumeRun();
    return { success: true };
  });

  // State query handlers
  handle('run-tracker:get-state', async (_event) => {
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

  // Statistics and data query handlers
  handle('run-tracker:get-all-sessions', async (_event, includeArchived = false) => {
    if (!runTracker) {
      throw new Error('Run tracker not initialized');
    }
    // Access database through runTracker service
    const database = runTracker.getDatabase();
    return database.getAllSessions(includeArchived);
  });

  handle('run-tracker:get-session-by-id', async (_event, sessionId) => {
    if (!runTracker) {
      throw new Error('Run tracker not initialized');
    }
    const database = runTracker.getDatabase();
    return database.getSessionById(sessionId);
  });

  handle('run-tracker:get-runs-by-session', async (_event, sessionId) => {
    if (!runTracker) {
      throw new Error('Run tracker not initialized');
    }
    const database = runTracker.getDatabase();
    return database.getRunsBySession(sessionId);
  });

  handle('run-tracker:get-run-items', async (_event, runId) => {
    if (!runTracker) {
      throw new Error('Run tracker not initialized');
    }
    const database = runTracker.getDatabase();
    return database.getRunItems(runId);
  });

  handle('run-tracker:get-session-items', async (_event, sessionId) => {
    if (!runTracker) {
      throw new Error('Run tracker not initialized');
    }
    const database = runTracker.getDatabase();
    return database.getSessionItems(sessionId);
  });

  handle('run-tracker:add-run-item', async (_event, data) => {
    if (!runTracker) {
      throw new Error('Run tracker not initialized');
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
  });

  handle('run-tracker:get-overall-statistics', async (_event) => {
    if (!runTracker) {
      throw new Error('Run tracker not initialized');
    }

    const database = runTracker.getDatabase();
    return database.getOverallRunStatistics();
  });

  handle('run-tracker:get-memory-status', async (_event) => {
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
    broadcastToRenderers('run-tracker:session-started', payload);
  });
  eventUnsubscribers.push(unsubscribeSessionStarted);

  const unsubscribeSessionEnded = eventBus.on('session-ended', (payload) => {
    broadcastToRenderers('run-tracker:session-ended', payload);
  });
  eventUnsubscribers.push(unsubscribeSessionEnded);

  // Run events
  const unsubscribeRunStarted = eventBus.on('run-started', (payload) => {
    broadcastToRenderers('run-tracker:run-started', payload);
  });
  eventUnsubscribers.push(unsubscribeRunStarted);

  const unsubscribeRunEnded = eventBus.on('run-ended', (payload) => {
    broadcastToRenderers('run-tracker:run-ended', payload);
  });
  eventUnsubscribers.push(unsubscribeRunEnded);

  const unsubscribeRunPaused = eventBus.on('run-paused', (payload) => {
    broadcastToRenderers('run-tracker:run-paused', payload);
  });
  eventUnsubscribers.push(unsubscribeRunPaused);

  const unsubscribeRunResumed = eventBus.on('run-resumed', (payload) => {
    broadcastToRenderers('run-tracker:run-resumed', payload);
  });
  eventUnsubscribers.push(unsubscribeRunResumed);

  const unsubscribeRunItemAdded = eventBus.on('run-item-added', (payload) => {
    broadcastToRenderers('run-tracker:run-item-added', payload);
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
