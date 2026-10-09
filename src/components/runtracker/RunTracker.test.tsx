import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Run, Session } from 'electron/types/grail';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initRunTrackerSync, useRunTrackerStore } from '@/stores/runTrackerStore';
import { mockStoreState } from '@/test/storeMock';
import { RunTracker } from './RunTracker';

// Mock the store
vi.mock('@/stores/runTrackerStore');
const mockUseRunTrackerStore = vi.mocked(useRunTrackerStore);

const mockInitRunTrackerSync = vi.mocked(initRunTrackerSync);
const mockStopRunTrackerSync = vi.fn();

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
    lastFailedAction: undefined,
    loadInitialData: vi.fn().mockResolvedValue(undefined),
    clearError: vi.fn(),
    retryLastAction: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockInitRunTrackerSync.mockReturnValue(mockStopRunTrackerSync);
    mockStoreState(mockUseRunTrackerStore, defaultStoreState);
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
      mockStoreState(mockUseRunTrackerStore, { ...defaultStoreState, ...storeOverrides });

      // Act
      render(<RunTracker />);

      // Assert
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    });

    it('If the main state is shown, Then the level-1 heading is the page title', () => {
      // Arrange
      mockStoreState(mockUseRunTrackerStore, { ...defaultStoreState, activeSession: mockSession });

      // Act
      render(<RunTracker />);

      // Assert
      expect(screen.getByRole('heading', { level: 1, name: 'Run Tracker' })).toBeDefined();
    });
  });

  describe('When the initial load has not completed yet', () => {
    it('Then a full-page loading state is shown', () => {
      // Arrange
      mockStoreState(mockUseRunTrackerStore, {
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
      mockStoreState(mockUseRunTrackerStore, {
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
      mockStoreState(mockUseRunTrackerStore, {
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
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
        error: { code: 'endSessionFailed', detail: 'boom' },
        errorType: 'unknown',
      });

      // Act
      render(<RunTracker />);

      // Assert
      expect(
        screen.getByText('Failed to end session. Your progress has been saved.', { exact: false }),
      ).toBeDefined();
      expect(screen.getByText('boom')).toBeDefined();
      expect(screen.queryByText('Error Loading Run Tracker')).toBeNull();
      expect(screen.getByTestId('session-card')).toBeDefined();
      expect(screen.getByTestId('session-controls')).toBeDefined();
      expect(screen.getByTestId('sessions-list')).toBeDefined();
    });

    it('If the action can be retried, Then Retry runs the failed action again', () => {
      // Arrange
      const retryLastAction = vi.fn();
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        error: { code: 'endSessionFailed', detail: 'boom' },
        errorType: 'unknown',
        lastFailedAction: vi.fn(),
        retryLastAction,
      });
      render(<RunTracker />);

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

      // Assert
      expect(retryLastAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('When a user action is in flight', () => {
    it('Then the page content stays visible', () => {
      // Arrange
      mockStoreState(mockUseRunTrackerStore, {
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

    mockStoreState(mockUseRunTrackerStore, {
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

    mockStoreState(mockUseRunTrackerStore, {
      ...defaultStoreState,
      loadInitialData: mockLoadInitialData,
    });

    render(<RunTracker />);

    await waitFor(() => {
      expect(mockLoadInitialData).toHaveBeenCalled();
    });
  });

  it('When the page mounts, Then the run tracker sync is started once', () => {
    // Act
    render(<RunTracker />);

    // Assert
    expect(mockInitRunTrackerSync).toHaveBeenCalledTimes(1);
    expect(mockStopRunTrackerSync).not.toHaveBeenCalled();
  });

  it('When the page unmounts, Then the run tracker sync is stopped', () => {
    // Arrange
    const { unmount } = render(<RunTracker />);

    // Act
    unmount();

    // Assert
    expect(mockStopRunTrackerSync).toHaveBeenCalledTimes(1);
  });

  it('passes correct props to child components', () => {
    const runsMap = new Map();
    runsMap.set('session-1', mockRuns);

    mockStoreState(mockUseRunTrackerStore, {
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
      mockStoreState(mockUseRunTrackerStore, {
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
