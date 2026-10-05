import type { Run, RunItem, Session, SessionStats } from 'electron/types/grail';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

/**
 * User-initiated run tracker actions whose in-flight state is tracked individually,
 * so a single pending action never blanks or disables unrelated parts of the UI.
 */
export type RunTrackerAction =
  | 'startSession'
  | 'endSession'
  | 'archiveSession'
  | 'startRun'
  | 'endRun'
  | 'pauseRun'
  | 'resumeRun'
  | 'addManualRunItem';

/**
 * Lifecycle of the first data load of the run tracker page.
 * Only `idle`/`loading` show a full-page spinner and only `error` shows a full-page error;
 * once `success` is reached all later refreshes happen in the background.
 */
export type InitialLoadStatus = 'idle' | 'loading' | 'success' | 'error';

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
  initialLoadStatus: InitialLoadStatus;
  initialLoadError: string | undefined;
  pendingActions: Partial<Record<RunTrackerAction, boolean>>;
  sessionsLoading: boolean;
  error: string | null;
  errorType: 'network' | 'validation' | 'permission' | 'unknown' | null;
  retryCount: number;
  sessionStatsCache: Map<string, SessionStats>; // sessionId -> stats
  loadingSessions: Set<string>; // sessionId -> tracks in-flight loads
  loadingRunItems: Set<string>; // runId -> tracks in-flight item loads

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
  loadInitialData: () => Promise<void>;
  loadSessions: (includeArchived?: boolean) => Promise<void>;
  loadAllSessions: () => Promise<void>;
  loadSessionById: (sessionId: string) => Promise<void>;
  loadSessionRuns: (sessionId: string) => Promise<void>;
  loadRunItems: (runId: string) => Promise<void>;
  refreshActiveRun: () => Promise<void>;

  // Actions - Manual Item Entry
  addManualRunItem: (name: string) => Promise<void>;

  // Actions - State Management
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
 * Helper function to collect finished runs from a session's run array.
 */
function collectFinishedRuns(
  sessionRuns: Run[],
  sessionId: string,
): Array<{ run: Run; sessionId: string }> {
  const finishedRuns: Array<{ run: Run; sessionId: string }> = [];
  for (const run of sessionRuns) {
    if (run.endTime) {
      finishedRuns.push({ run, sessionId });
    }
  }
  return finishedRuns;
}

/**
 * Helper function to determine which run ID to use for adding a manual item.
 * Returns the active run ID if available, otherwise the latest finished run ID.
 * Works even when sessions array is empty by using the runs map directly.
 */
function getTargetRunId(state: {
  activeRun: Run | null;
  activeSession: Session | null;
  runs: Map<string, Run[]>;
  sessions: Session[];
}): string | null {
  // First, try to use the active run
  if (state.activeRun) {
    return state.activeRun.id;
  }

  // If no active run, find the latest finished run
  const allRuns: Array<{ run: Run; sessionId: string }> = [];

  // First, check the active session if available (most common case in widget)
  if (state.activeSession) {
    const sessionRuns = state.runs.get(state.activeSession.id) || [];
    allRuns.push(...collectFinishedRuns(sessionRuns, state.activeSession.id));
  }

  // Also check all other sessions from the runs map
  // This covers cases where sessions array might be empty but runs map has data
  for (const [sessionId, sessionRuns] of state.runs.entries()) {
    // Skip active session as we already processed it
    if (state.activeSession?.id === sessionId) {
      continue;
    }
    allRuns.push(...collectFinishedRuns(sessionRuns, sessionId));
  }

  // Sort by end time (most recent first), with fallback to run number for same end time
  allRuns.sort((a, b) => {
    const aTime = a.run.endTime?.getTime() || 0;
    const bTime = b.run.endTime?.getTime() || 0;
    if (bTime !== aTime) {
      return bTime - aTime;
    }
    // If same end time, prefer higher run number (more recent)
    return b.run.runNumber - a.run.runNumber;
  });

  return allRuns.length > 0 ? allRuns[0].run.id : null;
}

/**
 * Helper function to upsert a run in a session's run array.
 * Prevents duplicates by replacing existing runs with the same ID.
 * Maintains order by runNumber.
 */
function upsertRunEntry(sessionRuns: Run[], run: Run): Run[] {
  // Remove any existing runs with the same ID to prevent duplicates
  const filteredRuns = sessionRuns.filter((r) => r.id !== run.id);

  // Add the new/updated run
  const updatedRuns = [...filteredRuns, run];

  // Sort by runNumber to maintain order
  return updatedRuns.sort((a, b) => a.runNumber - b.runNumber);
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

type InitialDataUpdate = Partial<
  Pick<RunTrackerState, 'sessions' | 'activeSession' | 'activeRun' | 'isTracking' | 'isPaused'>
>;

/**
 * Builds the state update applied after the initial sessions and tracker state were fetched.
 * Missing responses (e.g. no Electron API) leave the existing state untouched.
 */
function buildInitialDataUpdate(
  sessions: Session[] | undefined,
  trackerState:
    | {
        isRunning: boolean;
        isPaused: boolean;
        activeSession: Session | null;
        activeRun: Run | null;
      }
    | undefined,
): InitialDataUpdate {
  const update: InitialDataUpdate = {};
  if (sessions) {
    update.sessions = sessions;
  }
  if (trackerState) {
    update.activeSession = trackerState.activeSession;
    update.activeRun = trackerState.activeRun;
    update.isTracking = trackerState.isRunning;
    update.isPaused = trackerState.isPaused;
  }
  return update;
}

/**
 * Returns a state updater that marks a single user action as pending or settled.
 */
function setActionPending(action: RunTrackerAction, pending: boolean) {
  return (state: { pendingActions: Partial<Record<RunTrackerAction, boolean>> }) => ({
    pendingActions: { ...state.pendingActions, [action]: pending },
  });
}

// Tracks the first (blocking) initial load so overlapping calls share one request
let initialLoadInFlight: Promise<void> | undefined;

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
    initialLoadStatus: 'idle',
    initialLoadError: undefined,
    pendingActions: {},
    sessionsLoading: false,
    error: null,
    errorType: null,
    retryCount: 0,
    sessionStatsCache: new Map(),
    loadingSessions: new Set(),
    loadingRunItems: new Set(),

    // Session management actions
    startSession: async () => {
      set({ error: null, errorType: null });
      set(setActionPending('startSession', true));
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
            runs: updatedRuns,
          });
          console.log('[RunTrackerStore] Session started:', session.id);
        } else {
          set({
            error: 'Unable to start session. Please ensure a character is selected.',
            errorType: 'validation',
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorType =
          errorMessage.includes('network') || errorMessage.includes('connection')
            ? 'network'
            : 'unknown';
        set({ error: `Failed to start session: ${errorMessage}`, errorType });
        console.error('[RunTrackerStore] Error starting session:', error);
      } finally {
        set(setActionPending('startSession', false));
      }
    },

    endSession: async () => {
      set({ error: null, errorType: null });
      set(setActionPending('endSession', true));
      try {
        await window.electronAPI?.runTracker.endSession();
        set({
          activeSession: null,
          activeRun: null,
          isTracking: false,
          isPaused: false,
        });
        console.log('[RunTrackerStore] Session ended');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set({
          error: `Failed to end session: ${errorMessage}. Your progress has been saved.`,
          errorType: 'network',
        });
        console.error('[RunTrackerStore] Error ending session:', error);
      } finally {
        set(setActionPending('endSession', false));
      }
    },

    archiveSession: async (sessionId) => {
      set({ error: null });
      set(setActionPending('archiveSession', true));
      try {
        await window.electronAPI?.runTracker.archiveSession(sessionId);
        console.log('[RunTrackerStore] Session archived:', sessionId);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set({ error: errorMessage });
        console.error('[RunTrackerStore] Error archiving session:', error);
      } finally {
        set(setActionPending('archiveSession', false));
      }
    },

    updateSessionNotes: async (sessionId, notes) => {
      set({ error: null });
      try {
        // Note: This would need to be implemented in the IPC handlers if not already available
        // For now, we'll update the local state
        const { sessions } = get();
        const updatedSessions = sessions.map((session) =>
          session.id === sessionId ? { ...session, notes, lastUpdated: new Date() } : session,
        );
        set({ sessions: updatedSessions });
        console.log('[RunTrackerStore] Session notes updated:', sessionId);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set({ error: errorMessage });
        console.error('[RunTrackerStore] Error updating session notes:', error);
      }
    },

    // Run management actions
    startRun: async (characterId) => {
      set({ error: null });
      set(setActionPending('startRun', true));
      try {
        const run = await window.electronAPI?.runTracker.startRun(characterId);
        if (run) {
          set({ activeRun: run, isPaused: false });
          console.log('[RunTrackerStore] Run started:', run.id);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set({ error: errorMessage });
        console.error('[RunTrackerStore] Error starting run:', error);
      } finally {
        set(setActionPending('startRun', false));
      }
    },

    endRun: async () => {
      set({ error: null });
      set(setActionPending('endRun', true));
      try {
        await window.electronAPI?.runTracker.endRun();
        set({ activeRun: null, isPaused: false });
        console.log('[RunTrackerStore] Run ended');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set({ error: errorMessage });
        console.error('[RunTrackerStore] Error ending run:', error);
      } finally {
        set(setActionPending('endRun', false));
      }
    },

    pauseRun: async () => {
      set({ error: null });
      set(setActionPending('pauseRun', true));
      try {
        await window.electronAPI?.runTracker.pauseRun();
        set({ isPaused: true });
        console.log('[RunTrackerStore] Run paused');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set({ error: errorMessage });
        console.error('[RunTrackerStore] Error pausing run:', error);
      } finally {
        set(setActionPending('pauseRun', false));
      }
    },

    resumeRun: async () => {
      set({ error: null });
      set(setActionPending('resumeRun', true));
      try {
        await window.electronAPI?.runTracker.resumeRun();
        set({ isPaused: false });
        console.log('[RunTrackerStore] Run resumed');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set({ error: errorMessage });
        console.error('[RunTrackerStore] Error resuming run:', error);
      } finally {
        set(setActionPending('resumeRun', false));
      }
    },

    // Data loading actions
    loadInitialData: () => {
      // Only the very first load (or a retry after it failed) blocks the page.
      // Later calls refresh in the background and report failures inline.
      const isFirstLoad = get().initialLoadStatus !== 'success';
      if (isFirstLoad && initialLoadInFlight) {
        return initialLoadInFlight;
      }

      const load = runInitialLoad(isFirstLoad);
      if (isFirstLoad) {
        initialLoadInFlight = load.finally(() => {
          initialLoadInFlight = undefined;
        });
        return initialLoadInFlight;
      }
      return load;
    },

    loadSessions: async (includeArchived = false) => {
      set({ sessionsLoading: true });
      try {
        const sessions = await window.electronAPI?.runTracker.getAllSessions(includeArchived);
        if (sessions) {
          set({ sessions });
          console.log(`[RunTrackerStore] Loaded ${sessions.length} sessions`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set({ error: errorMessage });
        console.error('[RunTrackerStore] Error loading sessions:', error);
      } finally {
        set({ sessionsLoading: false });
      }
    },

    loadAllSessions: async () => {
      set({ sessionsLoading: true });
      try {
        // Load all sessions regardless of character
        const sessions = await window.electronAPI?.runTracker.getAllSessions(true); // Include archived
        if (sessions) {
          set({ sessions });
          console.log(`[RunTrackerStore] Loaded ${sessions.length} sessions (all characters)`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set({ error: errorMessage });
        console.error('[RunTrackerStore] Error loading all sessions:', error);
      } finally {
        set({ sessionsLoading: false });
      }
    },

    loadSessionById: async (sessionId) => {
      try {
        const session = await window.electronAPI?.runTracker.getSessionById(sessionId);
        if (session) {
          const { sessions: currentSessions } = get();
          const sessionExists = currentSessions.some((s) => s.id === sessionId);
          if (!sessionExists) {
            set({ sessions: [...currentSessions, session] });
            console.log('[RunTrackerStore] Loaded session by ID:', sessionId);
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set({ error: errorMessage });
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
      set({ loadingSessions: updatedLoadingSessions });

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
          set({ loadingSessions: newLoadingSessions });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Remove from loading set on error
        const { loadingSessions: currentLoadingSessions } = get();
        const newLoadingSessions = new Set(currentLoadingSessions);
        newLoadingSessions.delete(sessionId);
        set({ error: errorMessage, loadingSessions: newLoadingSessions });
        console.error('[RunTrackerStore] Error loading session runs:', error);
      }
    },

    loadRunItems: async (runId) => {
      const updatedLoadingRunItems = new Set(get().loadingRunItems);
      updatedLoadingRunItems.add(runId);
      set({ loadingRunItems: updatedLoadingRunItems });
      try {
        const items = await window.electronAPI?.runTracker.getRunItems(runId);
        if (items) {
          const { runItems: currentRunItems } = get();
          const newRunItems = new Map(currentRunItems);
          newRunItems.set(runId, items);
          set({ runItems: newRunItems });
          console.log(`[RunTrackerStore] Loaded ${items.length} items for run:`, runId);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set({ error: errorMessage });
        console.error('[RunTrackerStore] Error loading run items:', error);
      } finally {
        const newLoadingRunItems = new Set(get().loadingRunItems);
        newLoadingRunItems.delete(runId);
        set({ loadingRunItems: newLoadingRunItems });
      }
    },

    refreshActiveRun: async () => {
      try {
        const state = await window.electronAPI?.runTracker.getState();
        if (state) {
          set({
            activeSession: state.activeSession,
            activeRun: state.activeRun,
            isTracking: state.isRunning,
            isPaused: state.isPaused,
          });
          console.log('[RunTrackerStore] Active run refreshed');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set({ error: errorMessage });
        console.error('[RunTrackerStore] Error refreshing active run:', error);
      }
    },

    addManualRunItem: async (name) => {
      if (!name || name.trim() === '') {
        set({ error: 'Item name cannot be empty', errorType: 'validation' });
        return;
      }

      set({ error: null, errorType: null });
      set(setActionPending('addManualRunItem', true));
      try {
        const targetRunId = getTargetRunId(get());
        if (!targetRunId) {
          set({
            error: 'No active run or finished run found. Please start a run first.',
            errorType: 'validation',
          });
          return;
        }

        const result = await window.electronAPI?.runTracker.addRunItem({
          runId: targetRunId,
          name: name.trim(),
        });

        if (result?.success) {
          await handleSuccessfulItemAdd(targetRunId, get, set);
          console.log('[RunTrackerStore] Manual run item added:', name);
        } else {
          set({
            error: 'Failed to add manual run item',
            errorType: 'unknown',
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set({
          error: `Failed to add manual run item: ${errorMessage}`,
          errorType: 'unknown',
        });
        console.error('[RunTrackerStore] Error adding manual run item:', error);
      } finally {
        set(setActionPending('addManualRunItem', false));
      }
    },

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
      // Update the runs Map with the new run (upsert to prevent duplicates)
      const { runs, sessionStatsCache: oldCache } = get();
      const sessionRuns = runs.get(session.id) || [];

      const updatedRuns = new Map(runs);
      updatedRuns.set(session.id, upsertRunEntry(sessionRuns, run));

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
      // Use upsert to prevent duplicates in case of multiple event firings
      const { runs, sessionStatsCache: oldCache } = get();
      const sessionRuns = runs.get(session.id) || [];

      const updatedRuns = new Map(runs);
      updatedRuns.set(session.id, upsertRunEntry(sessionRuns, run));

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

      set({ retryCount: retryCount + 1, error: null });

      // Simple retry logic - in a real app, you'd store the last action
      try {
        await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
        // Here you would retry the last failed action
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set({ error: errorMessage, errorType: 'network' });
      }
    },
  })),
);

/**
 * Fetches sessions and tracker state, then the active session's runs.
 * Only a first load reports failures as a fatal initial-load error; refreshes report them inline.
 */
async function runInitialLoad(isFirstLoad: boolean): Promise<void> {
  const { setState: set, getState: get } = useRunTrackerStore;
  if (isFirstLoad) {
    set({ initialLoadStatus: 'loading', initialLoadError: undefined });
  }
  set({ sessionsLoading: true });

  try {
    const [sessions, trackerState] = await Promise.all([
      window.electronAPI?.runTracker.getAllSessions(true), // Include archived
      window.electronAPI?.runTracker.getState(),
    ]);
    set({ ...buildInitialDataUpdate(sessions, trackerState), sessionsLoading: false });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[RunTrackerStore] Error loading initial data:', error);
    set(
      isFirstLoad
        ? {
            initialLoadStatus: 'error',
            initialLoadError: errorMessage,
            sessionsLoading: false,
          }
        : { error: errorMessage, errorType: 'unknown', sessionsLoading: false },
    );
    return;
  }

  // Load runs for the active session; failures here are reported inline
  const activeSessionId = get().activeSession?.id;
  if (activeSessionId) {
    await get().loadSessionRuns(activeSessionId);
  }

  set({ initialLoadStatus: 'success', initialLoadError: undefined });
}
