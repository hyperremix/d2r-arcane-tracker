import { act, renderHook } from '@testing-library/react';
import type { Run, Session } from 'electron/types/grail';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRunTrackerStore } from './runTrackerStore';

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

// Mock window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
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
