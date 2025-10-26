import { render, screen, waitFor } from '@testing-library/react';
import type { Run, Session } from 'electron/types/grail';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRunTrackerStore } from '@/stores/runTrackerStore';
import { RunTracker } from './RunTracker';

// Mock the store
vi.mock('@/stores/runTrackerStore');
const mockUseRunTrackerStore = vi.mocked(useRunTrackerStore);

// Mock IPC renderer
const mockIpcRenderer = {
  on: vi.fn(),
  off: vi.fn(),
};

// Mock window.electronAPI
Object.defineProperty(window, 'ipcRenderer', {
  value: mockIpcRenderer,
  writable: true,
});

// Mock child components
vi.mock('./SessionCard', () => ({
  SessionCard: ({ session }: { session: Session | null }) => (
    <div data-testid="session-card">
      Session Card - {session ? `Session ${session.id}` : 'No Session'}
    </div>
  ),
}));

vi.mock('./SessionControls', () => ({
  SessionControls: () => <div data-testid="session-controls">Session Controls</div>,
}));

vi.mock('./RunList', () => ({
  RunList: ({ runs }: { runs: Run[] | undefined }) => (
    <div data-testid="run-list">Run List - {runs ? `${runs.length} runs` : 'No runs'}</div>
  ),
}));

describe('RunTracker', () => {
  const mockSession: Session = {
    id: 'session-1',
    characterId: 'char-1',
    startTime: new Date('2024-01-01T10:00:00Z'),
    endTime: undefined,
    totalRunTime: 300000, // 5 minutes
    totalSessionTime: 600000, // 10 minutes
    runCount: 3,
    archived: false,
    notes: 'Test session',
    created: new Date('2024-01-01T10:00:00Z'),
    lastUpdated: new Date('2024-01-01T10:00:00Z'),
  };

  const mockRuns: Run[] = [
    {
      id: 'run-1',
      sessionId: 'session-1',
      characterId: 'char-1',
      runNumber: 1,
      runType: 'Mephisto',
      startTime: new Date('2024-01-01T10:00:00Z'),
      endTime: new Date('2024-01-01T10:02:00Z'),
      duration: 120000, // 2 minutes
      area: 'Durance of Hate',
      created: new Date('2024-01-01T10:00:00Z'),
      lastUpdated: new Date('2024-01-01T10:02:00Z'),
    },
  ];

  const defaultStoreState = {
    activeSession: null,
    activeRun: null,
    sessions: [],
    runs: new Map(),
    runItems: new Map(),
    isTracking: false,
    isPaused: false,
    loading: false,
    error: null,
    loadSessions: vi.fn(),
    loadSessionRuns: vi.fn(),
    refreshActiveRun: vi.fn(),
    handleSessionStarted: vi.fn(),
    handleSessionEnded: vi.fn(),
    handleRunStarted: vi.fn(),
    handleRunEnded: vi.fn(),
    handleRunPaused: vi.fn(),
    handleRunResumed: vi.fn(),
    setError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRunTrackerStore.mockReturnValue(defaultStoreState);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('renders without crashing', () => {
    render(<RunTracker />);
    expect(screen.getByText('No Active Session')).toBeDefined();
  });

  it('displays loading state correctly', () => {
    mockUseRunTrackerStore.mockReturnValue({
      ...defaultStoreState,
      loading: true,
    });

    render(<RunTracker />);
    expect(screen.getByText('Loading run tracker data...')).toBeDefined();
  });

  it('displays error state with retry button', () => {
    const errorMessage = 'Failed to load data';
    mockUseRunTrackerStore.mockReturnValue({
      ...defaultStoreState,
      error: errorMessage,
    });

    render(<RunTracker />);
    expect(screen.getByText('Error Loading Run Tracker')).toBeDefined();
    expect(screen.getByText(errorMessage)).toBeDefined();
    expect(screen.getByText('Retry')).toBeDefined();
  });

  it('displays empty state when no active session', () => {
    render(<RunTracker />);
    expect(screen.getByText('No Active Session')).toBeDefined();
    expect(screen.getByText('Start New Session')).toBeDefined();
  });

  it('renders main layout with child components when active session exists', () => {
    const runsMap = new Map();
    runsMap.set('session-1', mockRuns);

    mockUseRunTrackerStore.mockReturnValue({
      ...defaultStoreState,
      activeSession: mockSession,
      runs: runsMap,
    });

    render(<RunTracker />);

    expect(screen.getByTestId('session-card')).toBeDefined();
    expect(screen.getByTestId('session-controls')).toBeDefined();
    expect(screen.getByTestId('run-list')).toBeDefined();
  });

  it('loads initial data on mount', async () => {
    const mockLoadSessions = vi.fn().mockResolvedValue(undefined);
    const mockLoadSessionRuns = vi.fn().mockResolvedValue(undefined);
    const mockRefreshActiveRun = vi.fn().mockResolvedValue(undefined);

    mockUseRunTrackerStore.mockReturnValue({
      ...defaultStoreState,
      loadSessions: mockLoadSessions,
      loadSessionRuns: mockLoadSessionRuns,
      refreshActiveRun: mockRefreshActiveRun,
    });

    render(<RunTracker />);

    await waitFor(() => {
      expect(mockLoadSessions).toHaveBeenCalled();
      expect(mockRefreshActiveRun).toHaveBeenCalled();
    });
  });

  it('loads session runs when active session exists', async () => {
    const mockLoadSessions = vi.fn().mockResolvedValue(undefined);
    const mockLoadSessionRuns = vi.fn().mockResolvedValue(undefined);
    const mockRefreshActiveRun = vi.fn().mockResolvedValue(undefined);

    mockUseRunTrackerStore.mockReturnValue({
      ...defaultStoreState,
      activeSession: mockSession,
      loadSessions: mockLoadSessions,
      loadSessionRuns: mockLoadSessionRuns,
      refreshActiveRun: mockRefreshActiveRun,
    });

    render(<RunTracker />);

    await waitFor(() => {
      expect(mockLoadSessions).toHaveBeenCalled();
      expect(mockLoadSessionRuns).toHaveBeenCalledWith('session-1');
      expect(mockRefreshActiveRun).toHaveBeenCalled();
    });
  });

  it('sets up IPC event listeners on mount', () => {
    render(<RunTracker />);

    expect(mockIpcRenderer.on).toHaveBeenCalledWith(
      'run-tracker:session-started',
      expect.any(Function),
    );
    expect(mockIpcRenderer.on).toHaveBeenCalledWith(
      'run-tracker:session-ended',
      expect.any(Function),
    );
    expect(mockIpcRenderer.on).toHaveBeenCalledWith(
      'run-tracker:run-started',
      expect.any(Function),
    );
    expect(mockIpcRenderer.on).toHaveBeenCalledWith('run-tracker:run-ended', expect.any(Function));
    expect(mockIpcRenderer.on).toHaveBeenCalledWith('run-tracker:run-paused', expect.any(Function));
    expect(mockIpcRenderer.on).toHaveBeenCalledWith(
      'run-tracker:run-resumed',
      expect.any(Function),
    );
  });

  it('cleans up IPC event listeners on unmount', () => {
    const { unmount } = render(<RunTracker />);

    unmount();

    expect(mockIpcRenderer.off).toHaveBeenCalledWith(
      'run-tracker:session-started',
      expect.any(Function),
    );
    expect(mockIpcRenderer.off).toHaveBeenCalledWith(
      'run-tracker:session-ended',
      expect.any(Function),
    );
    expect(mockIpcRenderer.off).toHaveBeenCalledWith(
      'run-tracker:run-started',
      expect.any(Function),
    );
    expect(mockIpcRenderer.off).toHaveBeenCalledWith('run-tracker:run-ended', expect.any(Function));
    expect(mockIpcRenderer.off).toHaveBeenCalledWith(
      'run-tracker:run-paused',
      expect.any(Function),
    );
    expect(mockIpcRenderer.off).toHaveBeenCalledWith(
      'run-tracker:run-resumed',
      expect.any(Function),
    );
  });

  it('passes correct props to child components', () => {
    const runsMap = new Map();
    runsMap.set('session-1', mockRuns);

    mockUseRunTrackerStore.mockReturnValue({
      ...defaultStoreState,
      activeSession: mockSession,
      runs: runsMap,
    });

    render(<RunTracker />);

    // Check that SessionCard receives the session prop
    expect(screen.getByText('Session Card - Session session-1')).toBeDefined();

    // Check that RunList receives the runs prop
    expect(screen.getByText('Run List - 1 runs')).toBeDefined();
  });

  it('handles data loading errors gracefully', async () => {
    const mockSetError = vi.fn();
    const mockLoadSessions = vi.fn().mockRejectedValue(new Error('Network error'));

    mockUseRunTrackerStore.mockReturnValue({
      ...defaultStoreState,
      loadSessions: mockLoadSessions,
      setError: mockSetError,
    });

    render(<RunTracker />);

    await waitFor(() => {
      expect(mockSetError).toHaveBeenCalledWith('Network error');
    });
  });

  it('retry button calls data loading functions', async () => {
    const mockLoadSessions = vi.fn().mockResolvedValue(undefined);
    const mockLoadSessionRuns = vi.fn().mockResolvedValue(undefined);
    const mockRefreshActiveRun = vi.fn().mockResolvedValue(undefined);
    const mockSetError = vi.fn();

    mockUseRunTrackerStore.mockReturnValue({
      ...defaultStoreState,
      error: 'Test error',
      activeSession: mockSession,
      loadSessions: mockLoadSessions,
      loadSessionRuns: mockLoadSessionRuns,
      refreshActiveRun: mockRefreshActiveRun,
      setError: mockSetError,
    });

    render(<RunTracker />);

    const retryButton = screen.getByText('Retry');
    retryButton.click();

    await waitFor(() => {
      expect(mockSetError).toHaveBeenCalledWith(null);
      expect(mockLoadSessions).toHaveBeenCalled();
      expect(mockLoadSessionRuns).toHaveBeenCalledWith('session-1');
      expect(mockRefreshActiveRun).toHaveBeenCalled();
    });
  });
});
