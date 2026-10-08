import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Run, Session } from 'electron/types/grail';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

// Mock window.ipcRenderer (restored afterwards because test files share one window)
const originalIpcRenderer = window.ipcRenderer;
Object.defineProperty(window, 'ipcRenderer', {
  value: mockIpcRenderer,
  configurable: true,
  writable: true,
});

afterAll(() => {
  Object.defineProperty(window, 'ipcRenderer', {
    value: originalIpcRenderer,
    configurable: true,
    writable: true,
  });
});

// Mock child components
vi.mock('./SessionCard', () => ({
  SessionCard: ({
    session,
    onViewAllRuns,
  }: {
    session: Session | null;
    onViewAllRuns?: () => void;
  }) => (
    <div data-testid="session-card">
      Session Card - {session ? `Session ${session.id}` : 'No Session'}
      {onViewAllRuns && (
        <button type="button" onClick={onViewAllRuns}>
          View all runs
        </button>
      )}
    </div>
  ),
}));

vi.mock('./SessionControls', () => ({
  SessionControls: () => <div data-testid="session-controls">Session Controls</div>,
}));

vi.mock('./SessionsList', () => ({
  SessionsList: ({
    onSessionSelect: _onSessionSelect,
  }: {
    onSessionSelect: (sessionId: string) => void;
  }) => <div data-testid="sessions-list">Sessions List</div>,
}));

vi.mock('./SessionDetailView', () => ({
  SessionDetailView: ({
    sessionId,
    onBack: _onBack,
  }: {
    sessionId: string;
    onBack: () => void;
  }) => <div data-testid="session-detail-view">Session Detail View - {sessionId}</div>,
}));

describe('RunTracker', () => {
  const mockSession: Session = {
    id: 'session-1',
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
      startTime: new Date('2024-01-01T10:00:00Z'),
      endTime: new Date('2024-01-01T10:02:00Z'),
      duration: 120000, // 2 minutes
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
    initialLoadStatus: 'success',
    initialLoadError: undefined,
    pendingActions: {},
    sessionsLoading: false,
    loadingRunItems: new Set(),
    error: null,
    errorType: null,
    retryCount: 0,
    loadInitialData: vi.fn().mockResolvedValue(undefined),
    loadRunItems: vi.fn().mockResolvedValue(undefined),
    handleSessionStarted: vi.fn(),
    handleSessionEnded: vi.fn(),
    handleRunStarted: vi.fn(),
    handleRunEnded: vi.fn(),
    handleRunPaused: vi.fn(),
    handleRunResumed: vi.fn(),
    clearError: vi.fn(),
    retryLastAction: vi.fn(),
  };

  const getIpcHandler = (channel: string) => {
    const call = mockIpcRenderer.on.mock.calls.find(([registered]) => registered === channel);
    return call?.[1] as ((event: unknown, payload: unknown) => void) | undefined;
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
    expect(
      screen.getByText((_content, element) => {
        return element?.textContent === 'Session Card - No Session';
      }),
    ).toBeDefined();
  });

  describe('When the page is rendered', () => {
    it.each([
      ['the main state is shown', { activeSession: mockSession }],
      ['the initial load is pending', { initialLoadStatus: 'loading' }],
      [
        'the initial load failed',
        { initialLoadStatus: 'error', initialLoadError: 'Failed to load data' },
      ],
    ])('If %s, Then exactly one level-1 heading is present', (_scenario, storeOverrides) => {
      // Arrange
      mockUseRunTrackerStore.mockReturnValue({ ...defaultStoreState, ...storeOverrides });

      // Act
      render(<RunTracker />);

      // Assert
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    });

    it('If the main state is shown, Then the level-1 heading is the page title', () => {
      // Arrange
      mockUseRunTrackerStore.mockReturnValue({ ...defaultStoreState, activeSession: mockSession });

      // Act
      render(<RunTracker />);

      // Assert
      expect(screen.getByRole('heading', { level: 1, name: 'Run Tracker' })).toBeDefined();
    });
  });

  describe('When the initial load has not completed yet', () => {
    it('Then a full-page loading state is shown', () => {
      // Arrange
      mockUseRunTrackerStore.mockReturnValue({
        ...defaultStoreState,
        initialLoadStatus: 'loading',
      });

      // Act
      render(<RunTracker />);

      // Assert
      expect(screen.getByText('Loading run tracker data...')).toBeDefined();
      expect(screen.queryByTestId('session-card')).toBeNull();
    });
  });

  describe('If the initial load fails', () => {
    it('Then a full-page error with a retry button is shown', () => {
      // Arrange
      const errorMessage = 'Failed to load data';
      mockUseRunTrackerStore.mockReturnValue({
        ...defaultStoreState,
        initialLoadStatus: 'error',
        initialLoadError: errorMessage,
      });

      // Act
      render(<RunTracker />);

      // Assert
      expect(screen.getByText('Error Loading Run Tracker')).toBeDefined();
      expect(screen.getByText(errorMessage)).toBeDefined();
      expect(screen.getByText('Retry')).toBeDefined();
      expect(screen.queryByTestId('session-card')).toBeNull();
    });

    it('Then clicking retry reloads the initial data', async () => {
      // Arrange
      const mockLoadInitialData = vi.fn().mockResolvedValue(undefined);
      mockUseRunTrackerStore.mockReturnValue({
        ...defaultStoreState,
        initialLoadStatus: 'error',
        initialLoadError: 'Test error',
        loadInitialData: mockLoadInitialData,
      });
      render(<RunTracker />);
      mockLoadInitialData.mockClear();

      // Act
      fireEvent.click(screen.getByText('Retry'));

      // Assert
      await waitFor(() => {
        expect(mockLoadInitialData).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('If a user action fails after the initial load', () => {
    it('Then the error is shown inline and the page content stays visible', () => {
      // Arrange
      mockUseRunTrackerStore.mockReturnValue({
        ...defaultStoreState,
        activeSession: mockSession,
        error: 'Failed to end session: boom',
        errorType: 'unknown',
      });

      // Act
      render(<RunTracker />);

      // Assert
      expect(screen.getByText('Failed to end session: boom')).toBeDefined();
      expect(screen.queryByText('Error Loading Run Tracker')).toBeNull();
      expect(screen.getByTestId('session-card')).toBeDefined();
      expect(screen.getByTestId('session-controls')).toBeDefined();
      expect(screen.getByTestId('sessions-list')).toBeDefined();
    });
  });

  describe('When a user action is in flight', () => {
    it('Then the page content stays visible', () => {
      // Arrange
      mockUseRunTrackerStore.mockReturnValue({
        ...defaultStoreState,
        activeSession: mockSession,
        pendingActions: { endRun: true },
      });

      // Act
      render(<RunTracker />);

      // Assert
      expect(screen.queryByText('Loading run tracker data...')).toBeNull();
      expect(screen.getByTestId('session-card')).toBeDefined();
      expect(screen.getByTestId('session-controls')).toBeDefined();
    });
  });

  describe('When a run item is added in the background', () => {
    it('Then run items are refreshed without blanking the page', async () => {
      // Arrange
      const mockLoadRunItems = vi.fn().mockResolvedValue(undefined);
      mockUseRunTrackerStore.mockReturnValue({
        ...defaultStoreState,
        activeSession: mockSession,
        loadRunItems: mockLoadRunItems,
      });
      const { rerender } = render(<RunTracker />);
      const handler = getIpcHandler('run-tracker:run-item-added');

      // Act
      act(() => {
        handler?.({}, { runId: 'run-1' });
      });
      mockUseRunTrackerStore.mockReturnValue({
        ...defaultStoreState,
        activeSession: mockSession,
        loadRunItems: mockLoadRunItems,
        loadingRunItems: new Set(['run-1']),
      });
      rerender(<RunTracker />);

      // Assert
      expect(handler).toBeDefined();
      await waitFor(() => {
        expect(mockLoadRunItems).toHaveBeenCalledWith('run-1');
      });
      expect(screen.queryByText('Loading run tracker data...')).toBeNull();
      expect(screen.getByTestId('session-card')).toBeDefined();
      expect(screen.getByTestId('sessions-list')).toBeDefined();
    });
  });

  it('displays empty state when no active session', () => {
    render(<RunTracker />);
    expect(
      screen.getByText((_content, element) => {
        return element?.textContent === 'Session Card - No Session';
      }),
    ).toBeDefined();
    expect(screen.getByTestId('session-controls')).toBeDefined();
    expect(screen.getByTestId('sessions-list')).toBeDefined();
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
    expect(screen.getByTestId('sessions-list')).toBeDefined();
  });

  it('loads initial data on mount', async () => {
    const mockLoadInitialData = vi.fn().mockResolvedValue(undefined);

    mockUseRunTrackerStore.mockReturnValue({
      ...defaultStoreState,
      loadInitialData: mockLoadInitialData,
    });

    render(<RunTracker />);

    await waitFor(() => {
      expect(mockLoadInitialData).toHaveBeenCalled();
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

    // Check that SessionsList is rendered
    expect(screen.getByTestId('sessions-list')).toBeDefined();
  });
  describe('When View all runs is used for the active session', () => {
    it('Then the session detail view opens for the active session', () => {
      // Arrange
      mockUseRunTrackerStore.mockReturnValue({
        ...defaultStoreState,
        activeSession: mockSession,
      });
      render(<RunTracker />);

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'View all runs' }));

      // Assert
      expect(screen.getByTestId('session-detail-view')).toHaveTextContent(
        'Session Detail View - session-1',
      );
      expect(screen.queryByTestId('session-controls')).toBeNull();
    });
  });

  describe('If no session is active', () => {
    it('Then the session card offers no View all runs action', () => {
      // Arrange & Act
      render(<RunTracker />);

      // Assert
      expect(screen.queryByRole('button', { name: 'View all runs' })).toBeNull();
    });
  });
});
