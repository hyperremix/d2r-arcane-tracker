import { act, renderHook } from '@testing-library/react';
import type { Run, RunItem, Session } from 'electron/types/grail';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GrailProgressBuilder, HolyGrailItemBuilder } from '@/fixtures';
import { useGrailStore } from './grailStore';
import { useRunTrackerStore, useSessionStats, useSessionStatsLookup } from './runTrackerStore';

// Mock the electron API
const mockElectronAPI = {
  runTracker: {
    startSession: vi.fn(),
    endSession: vi.fn(),
    startRun: vi.fn(),
    endRun: vi.fn(),
    pauseRun: vi.fn(),
    resumeRun: vi.fn(),
    getState: vi.fn(),
    getAllSessions: vi.fn(),
    getSessionById: vi.fn(),
    getRunsBySession: vi.fn(),
    getRunItems: vi.fn(),
    addRunItem: vi.fn(),
  },
};

// Mock window.electronAPI (restored afterwards because test files share one window)
const originalElectronAPI = window.electronAPI;
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  configurable: true,
  writable: true,
});

afterAll(() => {
  Object.defineProperty(window, 'electronAPI', {
    value: originalElectronAPI,
    configurable: true,
    writable: true,
  });
});

describe('runTrackerStore duplicate prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset store state
    act(() => {
      const store = useRunTrackerStore.getState();
      store.handleSessionEnded();
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should prevent duplicate runs when handleRunStarted is called multiple times with the same run', () => {
    const session: Session = {
      id: 'session-1',
      startTime: new Date(),
      totalRunTime: 0,
      totalSessionTime: 0,
      runCount: 1,
      archived: false,
      created: new Date(),
      lastUpdated: new Date(),
    };

    const run: Run = {
      id: 'run-1',
      sessionId: session.id,
      runNumber: 1,
      startTime: new Date(),
      created: new Date(),
      lastUpdated: new Date(),
    };

    const { result } = renderHook(() => useRunTrackerStore());

    // Set up initial session
    act(() => {
      result.current.handleSessionStarted(session);
    });

    // Call handleRunStarted first time
    act(() => {
      result.current.handleRunStarted(run, session);
    });

    // Verify run was added
    const runsAfterFirst = result.current.runs.get(session.id) || [];
    expect(runsAfterFirst).toHaveLength(1);
    expect(runsAfterFirst[0].id).toBe(run.id);

    // Call handleRunStarted again with the same run (simulating duplicate event)
    act(() => {
      result.current.handleRunStarted(run, session);
    });

    // Verify only one run exists (no duplicate)
    const runsAfterSecond = result.current.runs.get(session.id) || [];
    expect(runsAfterSecond).toHaveLength(1);
    expect(runsAfterSecond[0].id).toBe(run.id);
  });

  it('should prevent duplicate runs when handleRunEnded is called multiple times with the same run', async () => {
    const session: Session = {
      id: 'session-1',
      startTime: new Date(),
      totalRunTime: 0,
      totalSessionTime: 0,
      runCount: 1,
      archived: false,
      created: new Date(),
      lastUpdated: new Date(),
    };

    const run: Run = {
      id: 'run-1',
      sessionId: session.id,
      runNumber: 1,
      startTime: new Date(),
      endTime: new Date(),
      duration: 1000,
      created: new Date(),
      lastUpdated: new Date(),
    };

    const { result } = renderHook(() => useRunTrackerStore());

    // Set up initial session and run
    act(() => {
      result.current.handleSessionStarted(session);
      result.current.handleRunStarted(run, session);
    });

    // Mock getRunsBySession to return the run
    mockElectronAPI.runTracker.getRunsBySession.mockResolvedValue([run]);

    // Call handleRunEnded first time
    await act(async () => {
      await result.current.handleRunEnded(run, session);
    });

    // Verify run was updated
    const runsAfterFirst = result.current.runs.get(session.id) || [];
    expect(runsAfterFirst).toHaveLength(1);
    expect(runsAfterFirst[0].id).toBe(run.id);
    expect(runsAfterFirst[0].endTime).toBeDefined();

    // Call handleRunEnded again with the same run (simulating duplicate event)
    await act(async () => {
      await result.current.handleRunEnded(run, session);
    });

    // Verify only one run exists (no duplicate)
    const runsAfterSecond = result.current.runs.get(session.id) || [];
    expect(runsAfterSecond).toHaveLength(1);
    expect(runsAfterSecond[0].id).toBe(run.id);
  });

  it('should maintain run order by runNumber when upserting runs', () => {
    const session: Session = {
      id: 'session-1',
      startTime: new Date(),
      totalRunTime: 0,
      totalSessionTime: 0,
      runCount: 3,
      archived: false,
      created: new Date(),
      lastUpdated: new Date(),
    };

    const run1: Run = {
      id: 'run-1',
      sessionId: session.id,
      runNumber: 1,
      startTime: new Date(),
      created: new Date(),
      lastUpdated: new Date(),
    };

    const run2: Run = {
      id: 'run-2',
      sessionId: session.id,
      runNumber: 2,
      startTime: new Date(),
      created: new Date(),
      lastUpdated: new Date(),
    };

    const run3: Run = {
      id: 'run-3',
      sessionId: session.id,
      runNumber: 3,
      startTime: new Date(),
      created: new Date(),
      lastUpdated: new Date(),
    };

    const { result } = renderHook(() => useRunTrackerStore());

    // Set up initial session
    act(() => {
      result.current.handleSessionStarted(session);
    });

    // Add runs in non-sequential order
    act(() => {
      result.current.handleRunStarted(run3, session);
      result.current.handleRunStarted(run1, session);
      result.current.handleRunStarted(run2, session);
    });

    // Verify runs are in order by runNumber
    const runs = result.current.runs.get(session.id) || [];
    expect(runs).toHaveLength(3);
    expect(runs[0].runNumber).toBe(1);
    expect(runs[1].runNumber).toBe(2);
    expect(runs[2].runNumber).toBe(3);
  });

  it('should find latest finished run when sessions array is empty but runs map has data with active session', async () => {
    const session: Session = {
      id: 'session-1',
      startTime: new Date(),
      totalRunTime: 0,
      totalSessionTime: 0,
      runCount: 2,
      archived: false,
      created: new Date(),
      lastUpdated: new Date(),
    };

    const now = new Date();
    const earlier = new Date(now.getTime() - 5000); // 5 seconds earlier

    const run1: Run = {
      id: 'run-1',
      sessionId: session.id,
      runNumber: 1,
      startTime: earlier,
      endTime: earlier,
      duration: 1000,
      created: earlier,
      lastUpdated: earlier,
    };

    const run2: Run = {
      id: 'run-2',
      sessionId: session.id,
      runNumber: 2,
      startTime: now,
      endTime: now,
      duration: 2000,
      created: now,
      lastUpdated: now,
    };

    const { result } = renderHook(() => useRunTrackerStore());

    // Set up session and runs, but don't populate sessions array (simulating widget scenario)
    act(() => {
      result.current.handleSessionStarted(session);
      // Manually add runs to the map
      const runs = new Map(result.current.runs);
      runs.set(session.id, [run1, run2]);
      // Clear sessions array to simulate widget not loading full sessions list
      useRunTrackerStore.setState({ runs, sessions: [], activeSession: session, activeRun: null });
    });

    // Mock addRunItem to succeed
    mockElectronAPI.runTracker.addRunItem.mockResolvedValue({
      success: true,
      runItem: {
        id: 'run-item-1',
        runId: run2.id,
        name: 'Test Item',
        foundTime: new Date(),
        created: new Date(),
      },
    });

    mockElectronAPI.runTracker.getRunItems.mockResolvedValue([
      {
        id: 'run-item-1',
        runId: run2.id,
        name: 'Test Item',
        foundTime: new Date(),
        created: new Date(),
      },
    ]);

    // Try to add manual item
    await act(async () => {
      await result.current.addManualRunItem('Test Item');
    });

    // Verify it used the latest finished run (run2, which has later endTime)
    expect(mockElectronAPI.runTracker.addRunItem).toHaveBeenCalledWith({
      runId: run2.id,
      name: 'Test Item',
    });
  });

  it('should find latest finished run across all sessions when sessions array is empty', async () => {
    const session1: Session = {
      id: 'session-1',
      startTime: new Date(),
      totalRunTime: 0,
      totalSessionTime: 0,
      runCount: 1,
      archived: false,
      created: new Date(),
      lastUpdated: new Date(),
    };

    const session2: Session = {
      id: 'session-2',
      startTime: new Date(),
      totalRunTime: 0,
      totalSessionTime: 0,
      runCount: 1,
      archived: false,
      created: new Date(),
      lastUpdated: new Date(),
    };

    const now = new Date();
    const earlier = new Date(now.getTime() - 5000); // 5 seconds earlier

    const run1: Run = {
      id: 'run-1',
      sessionId: session1.id,
      runNumber: 1,
      startTime: earlier,
      endTime: earlier,
      duration: 1000,
      created: earlier,
      lastUpdated: earlier,
    };

    const run2: Run = {
      id: 'run-2',
      sessionId: session2.id,
      runNumber: 1,
      startTime: now,
      endTime: now,
      duration: 2000,
      created: now,
      lastUpdated: now,
    };

    const { result } = renderHook(() => useRunTrackerStore());

    // Set up runs in map but clear sessions array and set no active session
    act(() => {
      const runs = new Map<string, Run[]>();
      runs.set(session1.id, [run1]);
      runs.set(session2.id, [run2]);
      // Clear sessions array to simulate widget not loading full sessions list
      // And no active session
      const currentState = useRunTrackerStore.getState();
      useRunTrackerStore.setState({
        ...currentState,
        runs,
        sessions: [],
        activeSession: null,
        activeRun: null,
      });
    });

    // Mock addRunItem to succeed
    mockElectronAPI.runTracker.addRunItem.mockResolvedValue({
      success: true,
      runItem: {
        id: 'run-item-1',
        runId: run2.id,
        name: 'Test Item',
        foundTime: new Date(),
        created: new Date(),
      },
    });

    mockElectronAPI.runTracker.getRunItems.mockResolvedValue([
      {
        id: 'run-item-1',
        runId: run2.id,
        name: 'Test Item',
        foundTime: new Date(),
        created: new Date(),
      },
    ]);

    // Try to add manual item
    await act(async () => {
      await result.current.addManualRunItem('Test Item');
    });

    // Verify it used the latest finished run across all sessions (run2, which has later endTime)
    expect(mockElectronAPI.runTracker.addRunItem).toHaveBeenCalledWith({
      runId: run2.id,
      name: 'Test Item',
    });
  });

  it('should prefer active run over finished runs', async () => {
    const session: Session = {
      id: 'session-1',
      startTime: new Date(),
      totalRunTime: 0,
      totalSessionTime: 0,
      runCount: 2,
      archived: false,
      created: new Date(),
      lastUpdated: new Date(),
    };

    const now = new Date();

    const finishedRun: Run = {
      id: 'run-finished',
      sessionId: session.id,
      runNumber: 1,
      startTime: new Date(now.getTime() - 10000),
      endTime: new Date(now.getTime() - 5000),
      duration: 5000,
      created: new Date(),
      lastUpdated: new Date(),
    };

    const activeRun: Run = {
      id: 'run-active',
      sessionId: session.id,
      runNumber: 2,
      startTime: now,
      created: new Date(),
      lastUpdated: new Date(),
    };

    const { result } = renderHook(() => useRunTrackerStore());

    act(() => {
      result.current.handleSessionStarted(session);
      result.current.handleRunStarted(activeRun, session);
      // Manually add finished run to the map
      const runs = new Map(result.current.runs);
      const sessionRuns = runs.get(session.id) || [];
      runs.set(session.id, [...sessionRuns, finishedRun]);
      useRunTrackerStore.setState({ runs, sessions: [], activeRun, activeSession: session });
    });

    // Mock addRunItem to succeed
    mockElectronAPI.runTracker.addRunItem.mockResolvedValue({
      success: true,
      runItem: {
        id: 'run-item-1',
        runId: activeRun.id,
        name: 'Test Item',
        foundTime: new Date(),
        created: new Date(),
      },
    });

    mockElectronAPI.runTracker.getRunItems.mockResolvedValue([
      {
        id: 'run-item-1',
        runId: activeRun.id,
        name: 'Test Item',
        foundTime: new Date(),
        created: new Date(),
      },
    ]);

    // Try to add manual item
    await act(async () => {
      await result.current.addManualRunItem('Test Item');
    });

    // Verify it used the active run, not the finished run
    expect(mockElectronAPI.runTracker.addRunItem).toHaveBeenCalledWith({
      runId: activeRun.id,
      name: 'Test Item',
    });
  });
});

describe('runTrackerStore loading and error state', () => {
  const session: Session = {
    id: 'session-1',
    startTime: new Date('2024-01-01T10:00:00Z'),
    totalRunTime: 0,
    totalSessionTime: 0,
    runCount: 0,
    archived: false,
    created: new Date('2024-01-01T10:00:00Z'),
    lastUpdated: new Date('2024-01-01T10:00:00Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useRunTrackerStore.setState({
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
      loadingSessions: new Set(),
      loadingRunItems: new Set(),
    });
  });

  describe('When the initial load succeeds', () => {
    it('Then the initial load status is success and data is populated', async () => {
      // Arrange
      mockElectronAPI.runTracker.getAllSessions.mockResolvedValue([session]);
      mockElectronAPI.runTracker.getState.mockResolvedValue({
        activeSession: session,
        activeRun: null,
        isRunning: true,
        isPaused: false,
      });
      mockElectronAPI.runTracker.getRunsBySession.mockResolvedValue([]);

      // Act
      await act(async () => {
        await useRunTrackerStore.getState().loadInitialData();
      });

      // Assert
      const state = useRunTrackerStore.getState();
      expect(state.initialLoadStatus).toBe('success');
      expect(state.initialLoadError).toBeUndefined();
      expect(state.sessions).toEqual([session]);
      expect(state.activeSession).toEqual(session);
      expect(mockElectronAPI.runTracker.getRunsBySession).toHaveBeenCalledWith('session-1');
    });
  });

  describe('When the initial load is requested again while it is still in flight', () => {
    it('Then the in-flight load is reused instead of querying the backend twice', async () => {
      // Arrange
      let resolveSessions: (sessions: Session[]) => void = () => undefined;
      mockElectronAPI.runTracker.getAllSessions.mockReturnValue(
        new Promise<Session[]>((resolve) => {
          resolveSessions = resolve;
        }),
      );
      mockElectronAPI.runTracker.getState.mockResolvedValue(null);

      // Act
      let firstLoad: Promise<void> = Promise.resolve();
      let secondLoad: Promise<void> = Promise.resolve();
      act(() => {
        firstLoad = useRunTrackerStore.getState().loadInitialData();
        secondLoad = useRunTrackerStore.getState().loadInitialData();
      });
      await act(async () => {
        resolveSessions([session]);
        await Promise.all([firstLoad, secondLoad]);
      });

      // Assert
      expect(mockElectronAPI.runTracker.getAllSessions).toHaveBeenCalledTimes(1);
      expect(mockElectronAPI.runTracker.getState).toHaveBeenCalledTimes(1);
      expect(useRunTrackerStore.getState().initialLoadStatus).toBe('success');
    });
  });

  describe('If the initial load fails', () => {
    it('Then the failure is stored as a fatal initial-load error', async () => {
      // Arrange
      mockElectronAPI.runTracker.getAllSessions.mockRejectedValue(new Error('Database offline'));
      mockElectronAPI.runTracker.getState.mockResolvedValue(null);

      // Act
      await act(async () => {
        await useRunTrackerStore.getState().loadInitialData();
      });

      // Assert
      const state = useRunTrackerStore.getState();
      expect(state.initialLoadStatus).toBe('error');
      expect(state.initialLoadError).toBe('Database offline');
      expect(state.error).toBeNull();
    });
  });

  describe('If a background refresh fails after the initial load', () => {
    it('Then the page stays loaded and the error is reported inline', async () => {
      // Arrange
      useRunTrackerStore.setState({ initialLoadStatus: 'success' });
      mockElectronAPI.runTracker.getAllSessions.mockRejectedValue(new Error('Database offline'));
      mockElectronAPI.runTracker.getState.mockResolvedValue(null);

      // Act
      await act(async () => {
        await useRunTrackerStore.getState().loadInitialData();
      });

      // Assert
      const state = useRunTrackerStore.getState();
      expect(state.initialLoadStatus).toBe('success');
      expect(state.initialLoadError).toBeUndefined();
      expect(state.error).toBe('Database offline');
    });
  });

  describe('When run items are refreshed in the background', () => {
    it('Then only the per-run loading flag changes and existing errors are kept', async () => {
      // Arrange
      useRunTrackerStore.setState({
        initialLoadStatus: 'success',
        error: 'Previous action failed',
      });
      let resolveItems: (items: unknown[]) => void = () => undefined;
      mockElectronAPI.runTracker.getRunItems.mockReturnValue(
        new Promise((resolve) => {
          resolveItems = resolve;
        }),
      );

      // Act
      let loadPromise: Promise<void> = Promise.resolve();
      act(() => {
        loadPromise = useRunTrackerStore.getState().loadRunItems('run-1');
      });
      const inFlightState = useRunTrackerStore.getState();
      await act(async () => {
        resolveItems([]);
        await loadPromise;
      });

      // Assert
      expect(inFlightState.loadingRunItems.has('run-1')).toBe(true);
      expect(inFlightState.initialLoadStatus).toBe('success');
      expect(inFlightState.pendingActions).toEqual({});
      const state = useRunTrackerStore.getState();
      expect(state.loadingRunItems.has('run-1')).toBe(false);
      expect(state.runItems.get('run-1')).toEqual([]);
      expect(state.error).toBe('Previous action failed');
    });
  });

  describe('When a user action is in flight', () => {
    it('Then only that action is marked pending until it settles', async () => {
      // Arrange
      let resolveEndRun: () => void = () => undefined;
      mockElectronAPI.runTracker.endRun.mockReturnValue(
        new Promise<void>((resolve) => {
          resolveEndRun = resolve;
        }),
      );

      // Act
      let endRunPromise: Promise<void> = Promise.resolve();
      act(() => {
        endRunPromise = useRunTrackerStore.getState().endRun();
      });
      const inFlightState = useRunTrackerStore.getState();
      await act(async () => {
        resolveEndRun();
        await endRunPromise;
      });

      // Assert
      expect(inFlightState.pendingActions).toEqual({ endRun: true });
      expect(useRunTrackerStore.getState().pendingActions.endRun).toBe(false);
    });

    it('If the action fails, Then the error is reported inline and the pending flag is cleared', async () => {
      // Arrange
      useRunTrackerStore.setState({ initialLoadStatus: 'success' });
      mockElectronAPI.runTracker.pauseRun.mockRejectedValue(new Error('IPC failed'));

      // Act
      await act(async () => {
        await useRunTrackerStore.getState().pauseRun();
      });

      // Assert
      const state = useRunTrackerStore.getState();
      expect(state.error).toBe('IPC failed');
      expect(state.pendingActions.pauseRun).toBe(false);
      expect(state.initialLoadStatus).toBe('success');
    });
  });
});

describe('When session statistics are read from the stores', () => {
  const session: Session = {
    id: 'stats-session',
    startTime: new Date(2024, 5, 15, 10),
    totalRunTime: 120_000,
    totalSessionTime: 300_000,
    runCount: 1,
    archived: false,
    created: new Date(2024, 5, 15, 10),
    lastUpdated: new Date(2024, 5, 15, 10),
  };
  const run: Run = {
    id: 'stats-run',
    sessionId: session.id,
    runNumber: 1,
    startTime: new Date(2024, 5, 15, 10, 1),
    duration: 120_000,
    created: new Date(2024, 5, 15, 10, 1),
    lastUpdated: new Date(2024, 5, 15, 10, 3),
  };
  const runItem = (id: string, grailProgressId: string): RunItem => ({
    id,
    runId: run.id,
    grailProgressId,
    foundTime: new Date(2024, 5, 15, 10, 2),
    created: new Date(2024, 5, 15, 10, 2),
  });
  const initialGrailState = useGrailStore.getInitialState();
  const initialRunTrackerState = useRunTrackerStore.getInitialState();

  beforeEach(() => {
    act(() => {
      useGrailStore.setState({
        items: [
          HolyGrailItemBuilder.new().withId('shako').build(),
          HolyGrailItemBuilder.new().withId('soj').build(),
        ],
        progress: [
          GrailProgressBuilder.new()
            .withId('p-shako')
            .withCharacterId('c1')
            .withItemId('shako')
            .withFoundDate(new Date(2024, 5, 15, 10, 2))
            .withFromInitialScan(false)
            .build(),
          GrailProgressBuilder.new()
            .withId('p-soj')
            .withCharacterId('c1')
            .withItemId('soj')
            .withFoundDate(new Date(2023, 0, 1))
            .withFromInitialScan(false)
            .build(),
        ],
      });
      useRunTrackerStore.setState({
        sessions: [session],
        runs: new Map([[session.id, [run]]]),
        runItems: new Map([[run.id, [runItem('i1', 'p-shako'), runItem('i2', 'p-soj')]]]),
      });
    });
  });

  afterEach(() => {
    act(() => {
      useGrailStore.setState(initialGrailState, true);
      useRunTrackerStore.setState(initialRunTrackerState, true);
    });
  });

  describe('If items found in a run were new to the grail', () => {
    it('Then useSessionStats counts them as new grail items', () => {
      // Arrange & Act
      const { result } = renderHook(() => useSessionStats(session));

      // Assert
      expect(result.current).toMatchObject({ itemsFound: 2, newGrailItems: 1, totalRuns: 1 });
    });
  });

  describe('If an ethereal item is found in a run while ethereal tracking is off', () => {
    it('Then useSessionStats does not count it as a new grail item', () => {
      // Arrange
      act(() => {
        useGrailStore.setState({
          settings: {
            ...useGrailStore.getState().settings,
            grailNormal: true,
            grailEthereal: false,
          },
          progress: [
            GrailProgressBuilder.new()
              .withId('p-shako')
              .withCharacterId('c1')
              .withItemId('shako')
              .withFoundDate(new Date(2024, 5, 15, 10, 2))
              .withFromInitialScan(false)
              .asEthereal()
              .build(),
          ],
        });
      });

      // Act
      const { result } = renderHook(() => useSessionStats(session));

      // Assert
      expect(result.current).toMatchObject({ newGrailItems: 0 });
    });
  });

  describe('If a normal item is found in a run while only ethereal tracking is on', () => {
    it('Then useSessionStats does not count it as a new grail item', () => {
      // Arrange
      act(() => {
        useGrailStore.setState({
          settings: {
            ...useGrailStore.getState().settings,
            grailNormal: false,
            grailEthereal: true,
          },
          progress: [
            GrailProgressBuilder.new()
              .withId('p-shako')
              .withCharacterId('c1')
              .withItemId('shako')
              .withFoundDate(new Date(2024, 5, 15, 10, 2))
              .withFromInitialScan(false)
              .asNormal()
              .build(),
          ],
        });
      });

      // Act
      const { result } = renderHook(() => useSessionStats(session));

      // Assert
      expect(result.current).toMatchObject({ newGrailItems: 0 });
    });
  });

  describe('If unrelated run tracker state changes', () => {
    it('Then useSessionStats reuses the previous statistics object', () => {
      // Arrange
      const { result } = renderHook(() => useSessionStats(session));
      const first = result.current;

      // Act
      act(() => {
        useRunTrackerStore.setState({ pendingActions: { startRun: true } });
      });

      // Assert
      expect(result.current).toBe(first);
    });
  });

  describe('If the sessions are reloaded with a new total time', () => {
    it('Then useSessionStatsLookup returns the new total time', () => {
      // Arrange
      const { result } = renderHook(() => useSessionStatsLookup());
      expect(result.current(session.id)?.totalTime).toBe(300_000);

      // Act
      act(() => {
        useRunTrackerStore.setState({ sessions: [{ ...session, totalSessionTime: 600_000 }] });
      });

      // Assert
      expect(result.current(session.id)?.totalTime).toBe(600_000);
    });
  });

  describe('If a session is not loaded', () => {
    it('Then useSessionStatsLookup returns null for it', () => {
      // Arrange & Act
      const { result } = renderHook(() => useSessionStatsLookup());

      // Assert
      expect(result.current('unknown-session')).toBeNull();
    });
  });
});
