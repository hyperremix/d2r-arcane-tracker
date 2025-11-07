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
  recentRunTypes: string[];
  recentRunTypesLoading?: boolean;
  isTracking: boolean;
  isPaused: boolean;
  loading: boolean;
  error: string | null;
  errorType: 'network' | 'validation' | 'permission' | 'unknown' | null;
  retryCount: number;
  sessionStatsCache: Map<string, SessionStats>; // sessionId -> stats

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
  setRunType: (runType: string) => Promise<void>;

  // Actions - Data Loading
  loadSessions: (includeArchived?: boolean) => Promise<void>;
  loadAllSessions: () => Promise<void>;
  loadSessionById: (sessionId: string) => Promise<void>;
  loadSessionRuns: (sessionId: string) => Promise<void>;
  loadRunItems: (runId: string) => Promise<void>;
  refreshActiveRun: () => Promise<void>;
  loadRecentRunTypes: () => Promise<void>;
  saveRunType: (runType: string) => Promise<void>;

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
    recentRunTypes: [],
    recentRunTypesLoading: false,
    isTracking: false,
    isPaused: false,
    loading: false,
    error: null,
    errorType: null,
    retryCount: 0,
    sessionStatsCache: new Map(),

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

    setRunType: async (runType) => {
      set({ loading: true, error: null });
      try {
        await window.electronAPI?.runTracker.setRunType(runType);
        set({ loading: false });
        console.log('[RunTrackerStore] Run type set:', runType);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set({ error: errorMessage, loading: false });
        console.error('[RunTrackerStore] Error setting run type:', error);
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
      set({ loading: true, error: null });
      try {
        const runs = await window.electronAPI?.runTracker.getRunsBySession(sessionId);
        if (runs) {
          const { runs: currentRuns } = get();
          const newRuns = new Map(currentRuns);
          newRuns.set(sessionId, runs);
          set({ runs: newRuns, loading: false });
          console.log(`[RunTrackerStore] Loaded ${runs.length} runs for session:`, sessionId);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set({ error: errorMessage, loading: false });
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

    // Recent run types actions
    loadRecentRunTypes: async () => {
      // Skip if already loaded (prevents excessive loading)
      const { recentRunTypes, recentRunTypesLoading } = get();
      if (recentRunTypes.length > 0 || recentRunTypesLoading) {
        return;
      }

      set({ recentRunTypesLoading: true, error: null });
      try {
        const recentTypes = await window.electronAPI?.runTracker.getRecentRunTypes();
        if (recentTypes) {
          set({ recentRunTypes: recentTypes, recentRunTypesLoading: false });
          console.log('[RunTrackerStore] Loaded recent run types:', recentTypes.length);
        } else {
          set({ recentRunTypesLoading: false });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Silently handle "not initialized" errors to prevent spam
        if (errorMessage.includes('not initialized')) {
          console.log(
            '[RunTrackerStore] Run tracker not initialized yet, skipping recent run types load',
          );
          set({ recentRunTypesLoading: false });
          return;
        }

        set({ error: errorMessage, recentRunTypesLoading: false });
        console.error('[RunTrackerStore] Error loading recent run types:', error);
      }
    },

    saveRunType: async (runType) => {
      set({ error: null });
      try {
        await window.electronAPI?.runTracker.saveRunType(runType);
        // Reload recent run types to get updated list
        const recentTypes = await window.electronAPI?.runTracker.getRecentRunTypes();
        if (recentTypes) {
          set({ recentRunTypes: recentTypes });
          console.log('[RunTrackerStore] Saved run type and reloaded recent types');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        set({ error: errorMessage });
        console.error('[RunTrackerStore] Error saving run type:', error);
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
      const { sessions, runs, runItems, sessionStatsCache } = get();

      // Check cache first
      const cachedStats = sessionStatsCache.get(sessionId);
      if (cachedStats) {
        return cachedStats;
      }

      const session = sessions.find((s) => s.id === sessionId);
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
