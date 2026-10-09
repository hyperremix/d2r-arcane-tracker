import { ipcMain } from 'electron';
import type { GrailDatabase } from '../database/database';
import type { BroadcastToRenderers } from '../ipc/broadcast';
import { createIpcMainRegistry } from '../ipc/handle';
import type { EventBus } from '../services/EventBus';
import type { RunTrackerService } from '../services/runTracker';
import type { RunItem } from '../types/grail';

/** Run tracker queries and writes the handlers read from the database directly. */
export type RunTrackerDatabase = Pick<
  GrailDatabase,
  | 'addRunItem'
  | 'getAllSessions'
  | 'getOverallRunStatistics'
  | 'getRunItems'
  | 'getRunsBySession'
  | 'getSessionById'
  | 'getSessionItems'
>;

/** Dependencies of the run tracker IPC handlers. */
export interface RunTrackerHandlerDependencies {
  runTracker: RunTrackerService;
  database: RunTrackerDatabase;
  eventBus: EventBus;
  broadcastToRenderers: BroadcastToRenderers;
}

/**
 * Registers the run tracker IPC handlers and forwards run tracker events to the renderers.
 * @param deps - The run tracker, the database and the event bus
 * @returns Function that stops forwarding the run tracker events
 */
export function initializeRunTrackerHandlers({
  runTracker,
  database,
  eventBus,
  broadcastToRenderers,
}: RunTrackerHandlerDependencies): () => void {
  const { handle } = createIpcMainRegistry(ipcMain);

  // Session management handlers
  handle('run-tracker:start-session', () => runTracker.startSession());

  handle('run-tracker:end-session', () => {
    runTracker.endSession();
    return { success: true };
  });

  handle('run-tracker:archive-session', (_event, sessionId) => {
    runTracker.archiveSession(sessionId);
    return { success: true };
  });

  handle('run-tracker:update-session-notes', (_event, sessionId, notes) =>
    runTracker.updateSessionNotes(sessionId, notes),
  );

  // Run management handlers
  handle('run-tracker:start-run', (_event, characterId) => runTracker.startRun(characterId, true));

  handle('run-tracker:end-run', () => {
    runTracker.endRun(true);
    return { success: true };
  });

  handle('run-tracker:pause', () => {
    runTracker.pauseRun();
    return { success: true };
  });

  handle('run-tracker:resume', () => {
    runTracker.resumeRun();
    return { success: true };
  });

  // State query handlers
  handle('run-tracker:get-state', () => runTracker.getState());

  // Statistics and data query handlers
  handle('run-tracker:get-all-sessions', (_event, includeArchived = false) =>
    database.getAllSessions(includeArchived),
  );

  handle('run-tracker:get-session-by-id', (_event, sessionId) =>
    database.getSessionById(sessionId),
  );

  handle('run-tracker:get-runs-by-session', (_event, sessionId) =>
    database.getRunsBySession(sessionId),
  );

  handle('run-tracker:get-run-items', (_event, runId) => database.getRunItems(runId));

  handle('run-tracker:get-session-items', (_event, sessionId) =>
    database.getSessionItems(sessionId),
  );

  handle('run-tracker:add-run-item', (_event, data) => {
    const runItem: RunItem = {
      id: `run_item_${data.runId}_${Date.now()}`,
      runId: data.runId,
      grailProgressId: data.grailProgressId,
      name: data.name,
      foundTime: data.foundTime || new Date(),
      created: new Date(),
    };

    // The run_items foreign key rejects items of unknown runs
    database.addRunItem(runItem);

    // Emit event for UI updates
    eventBus.emit('run-item-added', {
      runId: data.runId,
      name: data.name,
    });

    return { success: true, runItem };
  });

  handle('run-tracker:get-overall-statistics', () => database.getOverallRunStatistics());

  handle('run-tracker:get-memory-status', () => {
    const available = runTracker.isMemoryReadingAvailable();
    return {
      available,
      reason: available ? null : 'pattern_not_found',
    };
  });

  // Forward run tracker events to the renderers
  const eventUnsubscribers = [
    eventBus.on('session-started', (payload) => {
      broadcastToRenderers('run-tracker:session-started', payload);
    }),
    eventBus.on('session-ended', (payload) => {
      broadcastToRenderers('run-tracker:session-ended', payload);
    }),
    eventBus.on('run-started', (payload) => {
      broadcastToRenderers('run-tracker:run-started', payload);
    }),
    eventBus.on('run-ended', (payload) => {
      broadcastToRenderers('run-tracker:run-ended', payload);
    }),
    eventBus.on('run-paused', (payload) => {
      broadcastToRenderers('run-tracker:run-paused', payload);
    }),
    eventBus.on('run-resumed', (payload) => {
      broadcastToRenderers('run-tracker:run-resumed', payload);
    }),
    eventBus.on('run-item-added', (payload) => {
      broadcastToRenderers('run-tracker:run-item-added', payload);
    }),
  ];

  console.log('[runTrackerHandlers] IPC handlers initialized');

  return () => {
    for (const unsubscribe of eventUnsubscribers) {
      unsubscribe();
    }
  };
}
