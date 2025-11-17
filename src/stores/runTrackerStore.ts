import type { Run, RunItem, Session, SessionStats } from 'electron/types/grail';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

/**
 * Interface defining the complete state structure and actions for the Run Tracker store.
 * Manages run tracking sessions, runs, and associated items with real-time updates.
 */
interface RunTrackerState {
  // State
  activeSession: Session | null;
  activeRun: Run | null;
  sessions: Session[];
  runs: Map<string, Run[]>; // sessionId -> runs
  runItems: Map<string, RunItem[]>; // runId -> items
  isTracking: boolean;
  isPaused: boolean;
  loading: boolean;
  error: string | null;
  errorType: 'network' | 'validation' | 'permission' | 'unknown' | null;
  retryCount: number;
  sessionStatsCache: Map<string, SessionStats>; // sessionId -> stats
  loadingSessions: Set<string>; // sessionId -> tracks in-flight loads

  // Actions - Session Management
  startSession: () => Promise<void>;
  endSession: () => Promise<void>;
  archiveSession: (sessionId: string) => Promise<void>;
  updateSessionNotes: (sessionId: string, notes: string) => Promise<void>;

  // Actions - Run Management
  startRun: (characterId?: string) => Promise<void>;
  endRun: () => Promise<void>;
  pauseRun: () => Promise<void>;
  resumeRun: () => Promise<void>;

  // Actions - Data Loading
  loadSessions: (includeArchived?: boolean) => Promise<void>;
  loadAllSessions: () => Promise<void>;
  loadSessionById: (sessionId: string) => Promise<void>;
  loadSessionRuns: (sessionId: string) => Promise<void>;
  loadRunItems: (runId: string) => Promise<void>;
  refreshActiveRun: () => Promise<void>;

  // Actions - Manual Item Entry
  addManualRunItem: (name: string) => Promise<void>;

  // Actions - State Management
  setLoading: (loading: boolean) => void;
  setError: (
    error: string | null,
    errorType?: 'network' | 'validation' | 'permission' | 'unknown',
  ) => void;
  clearError: () => void;
  retryLastAction: () => Promise<void>;

  // Internal event handlers (called from components)
  handleSessionStarted: (session: Session) => void;
  handleSessionEnded: () => void;
  handleRunStarted: (run: Run, session: Session) => void;
  handleRunEnded: (run: Run, session: Session) => void;
  handleRunPaused: (session: Session) => void;
  handleRunResumed: (session: Session) => void;

  // Computed/Helper Methods
  getCurrentRunDuration: () => number;
  getSessionStats: (sessionId: string) => SessionStats | null;
}

/**
 * Helper function to determine which run ID to use for adding a manual item.
 * Returns the active run ID if available, otherwise the latest finished run ID.
 */
function getTargetRunId(state: {
  activeRun: Run | null;
  runs: Map<string, Run[]>;
  sessions: Session[];
}): string | null {
  // First, try to use the active run
  if (state.activeRun) {
    return state.activeRun.id;
  }

  // If no active run, find the latest finished run
  const allRuns: Array<{ run: Run; sessionId: string }> = [];
  for (const session of state.sessions) {
    const sessionRuns = state.runs.get(session.id) || [];
    for (const run of sessionRuns) {
      if (run.endTime) {
        // Only consider finished runs
        allRuns.push({ run, sessionId: session.id });
      }
    }
  }

  // Sort by end time (most recent first)
  allRuns.sort((a, b) => {
    const aTime = a.run.endTime?.getTime() || 0;
    const bTime = b.run.endTime?.getTime() || 0;
    return bTime - aTime;
  });

  return allRuns.length > 0 ? allRuns[0].run.id : null;
}

/**
 * Helper function to handle post-add operations after successfully adding a manual item.
 */
async function handleSuccessfulItemAdd(
  targetRunId: string,
  getState: () => {
    loadRunItems: (runId: string) => Promise<void>;
    activeSession: Session | null;
    sessionStatsCache: Map<string, SessionStats>;
  },
  setState: (state: { sessionStatsCache: Map<string, SessionStats> }) => void,
): Promise<void> {
  const state = getState();
  // Refresh run items for the target run
  await state.loadRunItems(targetRunId);

  // Invalidate session stats cache if we have an active session
  if (state.activeSession) {
    const newCache = new Map(state.sessionStatsCache);
    newCache.delete(state.activeSession.id);
    setState({ sessionStatsCache: newCache });
  }
}

/**
 * Zustand store for managing run tracking state including sessions, runs, and items.
 * Provides actions for data manipulation and real-time updates from the Electron backend.
 */
export const useRunTrackerStore = create<RunTrackerState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    activeSession: null,
    activeRun: null,
    sessions: [],
    runs: new Map(),
    runItems: new Map(),
    isTracking: false,
    isPaused: false,
    loading: false,
    error: null,
    errorType: null,
    retryCount: 0,
    sessionStatsCache: new Map(),
    loadingSessions: new Set(),

    // Session management actions
    startSession: async () => {
      set({ loading: true, error: null, errorType: null });
      try {
        const session = await window.electronAPI?.runTracker.startSession();
        if (session) {
          // Initialize runs Map entry for this session
          const { runs } = get();
          const updatedRuns = new Map(runs);
          updatedRuns.set(session.id, []);

          set({
            activeSession: session,
            isTracking: true,
            loading: false,
            runs: updatedRuns,
          });
          console.log('[RunTrackerStore] Session started:', session.id);
        } else {
          set({
            error: 'Unable to start session. Please ensure a character is selected.',
            errorType: 'validation',
            loading: false,
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorType =
          errorMessage.includes('network') || errorMessage.includes('connection')
            ? 'network'
            : 'unknown';
        set({ error: `Failed to start session: ${errorMessage}`, errorType, loading: false });
        console.error('[RunTrackerStore] Error starting session:', error);
      }
    },

    endSession: async () => {
      set({ loading: true, error: null, errorType: null });
      try {
        await window.electronAPI?.runTracker.endSession();
        set({
          activeSession: null,
          activeRun: null,
          isTracking: false,
          isPaused: false,
          loading: false,
        });
        console.log('[RunTrackerStore] Session ended');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set({
          error: `Failed to end session: ${errorMessage}. Your progress has been saved.`,
          errorType: 'network',
          loading: false,
        });
        console.error('[RunTrackerStore] Error ending session:', error);
      }
    },

    archiveSession: async (sessionId) => {
      set({ loading: true, error: null });
      try {
        await window.electronAPI?.runTracker.archiveSession(sessionId);
        set({ loading: false });
        console.log('[RunTrackerStore] Session archived:', sessionId);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set({ error: errorMessage, loading: false });
        console.error('[RunTrackerStore] Error archiving session:', error);
      }
    },

    updateSessionNotes: async (sessionId, notes) => {
      set({ loading: true, error: null });
      try {
        // Note: This would need to be implemented in the IPC handlers if not already available
        // For now, we'll update the local state
        const { sessions } = get();
        const updatedSessions = sessions.map((session) =>
          session.id === sessionId ? { ...session, notes, lastUpdated: new Date() } : session,
        );
        set({ sessions: updatedSessions, loading: false });
        console.log('[RunTrackerStore] Session notes updated:', sessionId);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set({ error: errorMessage, loading: false });
        console.error('[RunTrackerStore] Error updating session notes:', error);
      }
    },

    // Run management actions
    startRun: async (characterId) => {
      set({ loading: true, error: null });
      try {
        const run = await window.electronAPI?.runTracker.startRun(characterId);
        if (run) {
          set({ activeRun: run, isPaused: false, loading: false });
          console.log('[RunTrackerStore] Run started:', run.id);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set({ error: errorMessage, loading: false });
        console.error('[RunTrackerStore] Error starting run:', error);
      }
    },

    endRun: async () => {
      set({ loading: true, error: null });
      try {
        await window.electronAPI?.runTracker.endRun();
        set({ activeRun: null, isPaused: false, loading: false });
        console.log('[RunTrackerStore] Run ended');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set({ error: errorMessage, loading: false });
        console.error('[RunTrackerStore] Error ending run:', error);
      }
    },

    pauseRun: async () => {
      set({ loading: true, error: null });
      try {
        await window.electronAPI?.runTracker.pauseRun();
        set({ isPaused: true, loading: false });
        console.log('[RunTrackerStore] Run paused');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set({ error: errorMessage, loading: false });
        console.error('[RunTrackerStore] Error pausing run:', error);
      }
    },

    resumeRun: async () => {
      set({ loading: true, error: null });
      try {
        await window.electronAPI?.runTracker.resumeRun();
        set({ isPaused: false, loading: false });
        console.log('[RunTrackerStore] Run resumed');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set({ error: errorMessage, loading: false });
        console.error('[RunTrackerStore] Error resuming run:', error);
      }
    },

    // Data loading actions
    loadSessions: async (includeArchived = false) => {
      set({ loading: true, error: null });
      try {
        const sessions = await window.electronAPI?.runTracker.getAllSessions(includeArchived);
        if (sessions) {
          set({ sessions, loading: false });
          console.log(`[RunTrackerStore] Loaded ${sessions.length} sessions`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set({ error: errorMessage, loading: false });
        console.error('[RunTrackerStore] Error loading sessions:', error);
      }
    },

    loadAllSessions: async () => {
      set({ loading: true, error: null });
      try {
        // Load all sessions regardless of character
        const sessions = await window.electronAPI?.runTracker.getAllSessions(true); // Include archived
        if (sessions) {
          set({ sessions, loading: false });
          console.log(`[RunTrackerStore] Loaded ${sessions.length} sessions (all characters)`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set({ error: errorMessage, loading: false });
        console.error('[RunTrackerStore] Error loading all sessions:', error);
      }
    },

    loadSessionById: async (sessionId) => {
      set({ loading: true, error: null });
      try {
        const session = await window.electronAPI?.runTracker.getSessionById(sessionId);
        if (session) {
          const { sessions: currentSessions } = get();
          const sessionExists = currentSessions.some((s) => s.id === sessionId);
          if (!sessionExists) {
            set({ sessions: [...currentSessions, session], loading: false });
            console.log('[RunTrackerStore] Loaded session by ID:', sessionId);
          } else {
            set({ loading: false });
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set({ error: errorMessage, loading: false });
        console.error('[RunTrackerStore] Error loading session by ID:', error);
      }
    },

    loadSessionRuns: async (sessionId) => {
      // Check if runs are already loaded or currently loading to avoid duplicate API calls
      const { runs: currentRuns, loadingSessions } = get();
      if (currentRuns.has(sessionId)) {
        return;
      }
      if (loadingSessions.has(sessionId)) {
        return;
      }

      // Mark this session as loading
      const updatedLoadingSessions = new Set(loadingSessions);
      updatedLoadingSessions.add(sessionId);
      set({ loading: true, error: null, loadingSessions: updatedLoadingSessions });

      try {
        const runs = await window.electronAPI?.runTracker.getRunsBySession(sessionId);
        if (runs) {
          const {
            runs: currentRuns,
            runItems: currentRunItems,
            sessionStatsCache,
            loadingSessions: currentLoadingSessions,
          } = get();
          const newRuns = new Map(currentRuns);
          newRuns.set(sessionId, runs);
          // Invalidate session stats cache since runs have changed
          const newCache = new Map(sessionStatsCache);
          newCache.delete(sessionId);
          // Remove from loading set
          const newLoadingSessions = new Set(currentLoadingSessions);
          newLoadingSessions.delete(sessionId);
          set({
            runs: newRuns,
            sessionStatsCache: newCache,
            loading: false,
            loadingSessions: newLoadingSessions,
          });
          console.log(`[RunTrackerStore] Loaded ${runs.length} runs for session:`, sessionId);

          // Load run items for all runs that don't have items loaded yet
          const runsToLoadItems = runs.filter((run) => !currentRunItems.has(run.id));
          if (runsToLoadItems.length > 0) {
            // Load items in parallel, but don't set loading state (runs are already loaded)
            Promise.all(
              runsToLoadItems.map(async (run) => {
                try {
                  const items = await window.electronAPI?.runTracker.getRunItems(run.id);
                  if (items) {
                    return { runId: run.id, items };
                  }
                  return null;
                } catch (error) {
                  // Don't fail the entire operation if one run fails
                  console.error(`[RunTrackerStore] Error loading items for run ${run.id}:`, error);
                  return null;
                }
              }),
            )
              .then((results) => {
                // Batch update all loaded items at once to avoid race conditions
                const validResults = results.filter(
                  (result): result is { runId: string; items: RunItem[] } => result !== null,
                );
                if (validResults.length > 0) {
                  const { runItems: updatedRunItems, sessionStatsCache } = get();
                  const newRunItems = new Map(updatedRunItems);
                  for (const { runId, items } of validResults) {
                    newRunItems.set(runId, items);
                    console.log(`[RunTrackerStore] Loaded ${items.length} items for run:`, runId);
                  }
                  // Invalidate session stats cache since items have changed
                  const newCache = new Map(sessionStatsCache);
                  newCache.delete(sessionId);
                  set({ runItems: newRunItems, sessionStatsCache: newCache });
                }
              })
              .catch((error) => {
                console.error('[RunTrackerStore] Error loading run items in parallel:', error);
              });
          }
        } else {
          // Remove from loading set even if no runs returned
          const { loadingSessions: currentLoadingSessions } = get();
          const newLoadingSessions = new Set(currentLoadingSessions);
          newLoadingSessions.delete(sessionId);
          set({ loading: false, loadingSessions: newLoadingSessions });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Remove from loading set on error
        const { loadingSessions: currentLoadingSessions } = get();
        const newLoadingSessions = new Set(currentLoadingSessions);
        newLoadingSessions.delete(sessionId);
        set({ error: errorMessage, loading: false, loadingSessions: newLoadingSessions });
        console.error('[RunTrackerStore] Error loading session runs:', error);
      }
    },

    loadRunItems: async (runId) => {
      set({ loading: true, error: null });
      try {
        const items = await window.electronAPI?.runTracker.getRunItems(runId);
        if (items) {
          const { runItems: currentRunItems } = get();
          const newRunItems = new Map(currentRunItems);
          newRunItems.set(runId, items);
          set({ runItems: newRunItems, loading: false });
          console.log(`[RunTrackerStore] Loaded ${items.length} items for run:`, runId);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set({ error: errorMessage, loading: false });
        console.error('[RunTrackerStore] Error loading run items:', error);
      }
    },

    refreshActiveRun: async () => {
      set({ loading: true, error: null });
      try {
        const state = await window.electronAPI?.runTracker.getState();
        if (state) {
          set({
            activeSession: state.activeSession,
            activeRun: state.activeRun,
            isTracking: state.isRunning,
            isPaused: state.isPaused,
            loading: false,
          });
          console.log('[RunTrackerStore] Active run refreshed');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set({ error: errorMessage, loading: false });
        console.error('[RunTrackerStore] Error refreshing active run:', error);
      }
    },

    addManualRunItem: async (name) => {
      if (!name || name.trim() === '') {
        set({ error: 'Item name cannot be empty', errorType: 'validation' });
        return;
      }

      set({ loading: true, error: null, errorType: null });
      try {
        const targetRunId = getTargetRunId(get());
        if (!targetRunId) {
          set({
            error: 'No active run or finished run found. Please start a run first.',
            errorType: 'validation',
            loading: false,
          });
          return;
        }

        const result = await window.electronAPI?.runTracker.addRunItem({
          runId: targetRunId,
          name: name.trim(),
        });

        if (result?.success) {
          await handleSuccessfulItemAdd(targetRunId, get, set);
          set({ loading: false });
          console.log('[RunTrackerStore] Manual run item added:', name);
        } else {
          set({
            error: 'Failed to add manual run item',
            errorType: 'unknown',
            loading: false,
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set({
          error: `Failed to add manual run item: ${errorMessage}`,
          errorType: 'unknown',
          loading: false,
        });
        console.error('[RunTrackerStore] Error adding manual run item:', error);
      }
    },

    // State management actions
    setLoading: (loading) => set({ loading }),

    // Internal event handlers (called from components)
    handleSessionStarted: (session) => {
      // Initialize runs Map entry for this session
      const { runs } = get();
      const updatedRuns = new Map(runs);
      if (!updatedRuns.has(session.id)) {
        updatedRuns.set(session.id, []);
      }

      set({
        activeSession: session,
        isTracking: true,
        runs: updatedRuns,
      });
      console.log('[RunTrackerStore] Session started event:', session.id);
    },

    handleSessionEnded: () => {
      set({
        activeSession: null,
        activeRun: null,
        isTracking: false,
        isPaused: false,
      });
      console.log('[RunTrackerStore] Session ended event');
    },

    handleRunStarted: (run, session) => {
      // Update the runs Map with the new run
      const { runs, sessionStatsCache: oldCache } = get();
      const sessionRuns = runs.get(session.id) || [];

      const updatedRuns = new Map(runs);
      updatedRuns.set(session.id, [...sessionRuns, run]);

      // Invalidate stats cache since run data changed
      const newCache = new Map(oldCache);
      newCache.delete(session.id);

      set({
        activeRun: run,
        activeSession: session,
        isPaused: false,
        runs: updatedRuns,
        sessionStatsCache: newCache,
      });
    },

    handleRunEnded: async (run, session) => {
      // Update the runs Map with the ended run (which includes duration from backend)
      const { runs, sessionStatsCache: oldCache } = get();
      const sessionRuns = runs.get(session.id) || [];

      const updatedSessionRuns = sessionRuns.map((r) => (r.id === run.id ? run : r));
      const updatedRuns = new Map(runs);
      updatedRuns.set(session.id, updatedSessionRuns);

      // Invalidate stats cache since run data changed
      const newCache = new Map(oldCache);
      newCache.delete(session.id);

      set({
        activeRun: null,
        activeSession: session,
        isPaused: false,
        runs: updatedRuns,
        sessionStatsCache: newCache,
      });

      // Reload session runs from database to ensure we have the latest data
      // This is important because the database is the source of truth
      try {
        const freshRuns = await window.electronAPI?.runTracker.getRunsBySession(session.id);
        if (freshRuns) {
          const { runs: currentRuns, sessionStatsCache: currentCache } = get();
          const refreshedRuns = new Map(currentRuns);
          refreshedRuns.set(session.id, freshRuns);
          const refreshedCache = new Map(currentCache);
          refreshedCache.delete(session.id);
          set({ runs: refreshedRuns, sessionStatsCache: refreshedCache });
        }
      } catch (error) {
        console.error('[RunTrackerStore] Failed to reload runs after run ended:', error);
      }
    },

    handleRunPaused: (session) => {
      set({ activeSession: session, isPaused: true });
      console.log('[RunTrackerStore] Run paused event');
    },

    handleRunResumed: (session) => {
      set({ activeSession: session, isPaused: false });
      console.log('[RunTrackerStore] Run resumed event');
    },

    // Computed/Helper methods
    getCurrentRunDuration: () => {
      const { activeRun } = get();
      if (!activeRun || activeRun.endTime) return 0;
      return Date.now() - activeRun.startTime.getTime();
    },

    getSessionStats: (sessionId) => {
      const { sessions, runs, runItems, sessionStatsCache, activeSession } = get();

      // Check cache first
      const cachedStats = sessionStatsCache.get(sessionId);
      if (cachedStats) {
        return cachedStats;
      }

      const session =
        sessions.find((s) => s.id === sessionId) ??
        (activeSession?.id === sessionId ? activeSession : null);
      if (!session) return null;

      const sessionRuns = runs.get(sessionId) || [];
      const totalItems = sessionRuns.reduce((total, run) => {
        const items = runItems.get(run.id) || [];
        return total + items.length;
      }, 0);

      const newGrailItems = sessionRuns.reduce((total, _run) => {
        // Note: RunItem doesn't have isNewGrailItem property, so we'll use 0 for now
        // This would need to be calculated based on grail progress data
        return total;
      }, 0);

      // Calculate run durations
      const runDurations = sessionRuns
        .filter((run) => run.duration !== undefined)
        .map((run) => run.duration as number);

      const averageRunDuration =
        runDurations.length > 0
          ? runDurations.reduce((sum, duration) => sum + duration, 0) / runDurations.length
          : 0;

      const fastestRun = runDurations.length > 0 ? Math.min(...runDurations) : 0;
      const slowestRun = runDurations.length > 0 ? Math.max(...runDurations) : 0;

      const stats = {
        sessionId,
        totalRuns: sessionRuns.length,
        totalTime: session.totalSessionTime,
        totalRunTime: session.totalRunTime,
        averageRunDuration,
        fastestRun,
        slowestRun,
        itemsFound: totalItems,
        newGrailItems,
      };

      // Cache the result
      sessionStatsCache.set(sessionId, stats);
      return stats;
    },

    // Error handling methods
    setError: (error, errorType = 'unknown') => {
      set({ error, errorType, retryCount: 0 });
    },

    clearError: () => {
      set({ error: null, errorType: null, retryCount: 0 });
    },

    retryLastAction: async () => {
      const { retryCount } = get();
      if (retryCount >= 3) {
        set({
          error: 'Maximum retry attempts reached. Please try again later.',
          errorType: 'network',
        });
        return;
      }

      set({ retryCount: retryCount + 1, loading: true, error: null });

      // Simple retry logic - in a real app, you'd store the last action
      try {
        await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
        // Here you would retry the last failed action
        set({ loading: false });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set({ error: errorMessage, errorType: 'network', loading: false });
      }
    },
  })),
);
