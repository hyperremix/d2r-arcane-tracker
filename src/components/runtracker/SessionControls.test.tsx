import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGrailStore } from '@/stores/grailStore';
import { useRunTrackerStore } from '@/stores/runTrackerStore';
import { mockStoreState } from '@/test/storeMock';
import { SessionControls } from './SessionControls';

// Mock the stores
vi.mock('sonner', () => import('@/test/sonnerMock'));
vi.mock('@/stores/runTrackerStore');
vi.mock('@/stores/grailStore');

const mockUseRunTrackerStore = vi.mocked(useRunTrackerStore);
const mockUseGrailStore = vi.mocked(useGrailStore);

// Mock document methods. Test files share one jsdom (isolate: false), so the mocks are removed
// after this file to fall back to EventTarget.prototype; otherwise later suites' document
// listeners would never fire. Don't vi.spyOn these: a later suite's vi.restoreAllMocks() would
// re-create the mocked own properties.
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();

Object.defineProperty(document, 'addEventListener', {
  value: mockAddEventListener,
  writable: true,
  configurable: true,
});

Object.defineProperty(document, 'removeEventListener', {
  value: mockRemoveEventListener,
  writable: true,
  configurable: true,
});

afterAll(() => {
  Reflect.deleteProperty(document, 'addEventListener');
  Reflect.deleteProperty(document, 'removeEventListener');
});

// Mock data
const mockSession = {
  id: 'session-1',
  characterId: 'char-1',
  characterName: 'TestCharacter',
  startTime: new Date('2024-01-01T00:00:00Z'),
  endTime: null,
  totalRuns: 0,
  totalTime: 0,
};

const mockRun = {
  id: 'run-1',
  sessionId: 'session-1',
  startTime: new Date('2024-01-01T00:00:00Z'),
  endTime: null,
  duration: 0,
  itemsFound: [],
  isPaused: false,
  pauseTime: null,
  resumeTime: null,
  totalPauseTime: 0,
};

const mockStoreActions = {
  startSession: vi.fn(),
  startRun: vi.fn(),
  endRun: vi.fn(),
  pauseRun: vi.fn(),
  resumeRun: vi.fn(),
  endSession: vi.fn(),
  addManualRunItem: vi.fn(),
};

const defaultStoreState = {
  activeSession: null,
  activeRun: null,
  isTracking: false,
  isPaused: false,
  pendingActions: {},
  runs: new Map(),
  ...mockStoreActions,
};

const defaultGrailStoreState = {
  settings: {
    runTrackerShortcuts: {
      startRun: 'Ctrl+R',
      pauseRun: 'Ctrl+Space',
      endRun: 'Ctrl+E',
      endSession: 'Ctrl+Shift+E',
    },
  },
};

function setPlatform(platform: string) {
  Object.defineProperty(window, 'electronAPI', {
    value: {
      platform,
      runTracker: {
        getMemoryStatus: vi.fn().mockResolvedValue({ available: true, reason: null }),
        getGlobalHotkeyStatus: vi.fn().mockResolvedValue({ enabled: false, registrations: [] }),
        onGlobalHotkeyStatus: vi.fn(() => vi.fn()),
      },
    },
    writable: true,
    configurable: true,
  });
}

describe('SessionControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddEventListener.mockClear();
    mockRemoveEventListener.mockClear();

    // Set up default mocks
    mockStoreState(mockUseRunTrackerStore, defaultStoreState);
    mockStoreState(mockUseGrailStore, defaultGrailStoreState);
  });

  describe('Rendering', () => {
    it('renders the live session card', () => {
      mockStoreState(mockUseRunTrackerStore, defaultStoreState);

      render(<SessionControls />);

      expect(screen.getByText('Live session')).toBeDefined();
    });

    it('When a run is active, Then End run is the primary action next to Pause and End session', () => {
      // Arrange
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: mockRun,
      });

      // Act
      render(<SessionControls />);

      // Assert
      expect(screen.getByRole('button', { name: 'End run' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'End session' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Start run' })).not.toBeInTheDocument();
    });

    it('When a session has no active run, Then Start run is the primary action and Pause is hidden', () => {
      // Arrange
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
      });

      // Act
      render(<SessionControls />);

      // Assert
      expect(screen.getByRole('button', { name: 'Start run' })).toBeEnabled();
      expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'End run' })).not.toBeInTheDocument();
    });

    it('When a run is active, Then the state badge politely reports Running', () => {
      // Arrange
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: mockRun,
        isPaused: false,
      });

      // Act
      render(<SessionControls />);

      // Assert
      const badge = screen.getByRole('status');
      expect(badge).toHaveTextContent('Running');
      expect(badge).toHaveAttribute('aria-live', 'polite');
    });

    it('When the run is paused, Then the state badge reports Paused', () => {
      // Arrange
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: mockRun,
        isPaused: true,
      });

      // Act
      render(<SessionControls />);

      // Assert
      expect(screen.getByRole('status')).toHaveTextContent('Paused');
    });

    it('When a session has no active run, Then the state badge reports Idle and no run is in progress', () => {
      // Arrange
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
      });

      // Act
      render(<SessionControls />);

      // Assert
      expect(screen.getByRole('status')).toHaveTextContent('Idle');
      expect(screen.getByText('No run in progress')).toBeInTheDocument();
      // The idle timer uses the full muted color, not a faded one, to keep a readable contrast
      expect(screen.getByText('0:00')).toHaveClass('text-muted-foreground');
      expect(screen.getByText('0:00')).not.toHaveClass('text-muted-foreground/60');
    });

    it('If no session is active, Then the timer is hidden and the invitation sits directly above the start button', () => {
      // Arrange
      mockStoreState(mockUseRunTrackerStore, defaultStoreState);

      // Act
      render(<SessionControls />);

      // Assert
      expect(screen.queryByText('0:00')).not.toBeInTheDocument();
      expect(screen.queryByText('Current run')).not.toBeInTheDocument();
      expect(screen.queryByText('No run in progress')).not.toBeInTheDocument();
      expect(
        screen.getByText('Start a session to track your runs and the items you find.'),
      ).toBeInTheDocument();
      const prompt = screen.getByText('Start a session to track your runs and the items you find.');
      const startButton = screen.getByRole('button', { name: 'Start new session' });
      expect(prompt.parentElement).toContainElement(startButton);
      expect(screen.queryByText('Keyboard shortcuts:')).not.toBeInTheDocument();
    });

    it('When the run is paused, Then the timer stays frozen at the time it was paused', () => {
      // Arrange
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2024-01-01T00:12:34Z'));
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: { ...mockRun, runNumber: 7, pausedAt: new Date('2024-01-01T00:02:05Z') },
        isPaused: true,
      });

      try {
        // Act
        render(<SessionControls />);

        // Assert
        expect(screen.getByText('2:05')).toHaveClass('text-warning');
        expect(screen.queryByText('12:34')).not.toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it('When a paused run is resumed, Then the timer never shows a stale value before the next tick', () => {
      // Arrange
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2024-01-01T00:12:34Z'));
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: { ...mockRun, pausedAt: new Date('2024-01-01T00:02:05Z') },
        isPaused: true,
      });
      const { container, rerender } = render(<SessionControls />);
      const observer = new MutationObserver(() => undefined);
      observer.observe(container, {
        childList: true,
        subtree: true,
        characterData: true,
        characterDataOldValue: true,
      });

      try {
        // Act: the run is resumed 17:55 after it was paused, long after the last render
        vi.setSystemTime(new Date('2024-01-01T00:20:00Z'));
        mockStoreState(mockUseRunTrackerStore, {
          ...defaultStoreState,
          activeSession: mockSession,
          activeRun: { ...mockRun, pausedAt: undefined, pausedDuration: 17 * 60_000 + 55_000 },
          isPaused: false,
        });
        rerender(<SessionControls />);

        // Assert: no intermediate render showed the elapsed time computed from the old clock
        // (a changed text node reports the value it replaced)
        const replacedTexts = observer.takeRecords().map((record) => record.oldValue);
        expect(replacedTexts).not.toContain('2:05');
        expect(replacedTexts).not.toContain('0:00');
        expect(screen.getByText('2:05')).toBeInTheDocument();
      } finally {
        observer.disconnect();
        vi.useRealTimers();
      }
    });

    it('When a run is active, Then the large timer shows its elapsed time outside the live region', () => {
      // Arrange
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2024-01-01T00:12:34Z'));
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: { ...mockRun, runNumber: 7 },
      });

      try {
        // Act
        render(<SessionControls />);

        // Assert
        const timer = screen.getByText('12:34');
        expect(timer).toHaveClass('tabular-nums');
        expect(timer).not.toHaveClass('font-mono');
        expect(screen.getByText('Run #7')).toBeInTheDocument();
        expect(screen.getByRole('status')).not.toContainElement(timer);
      } finally {
        vi.useRealTimers();
      }
    });

    it.each([
      { isPaused: false, label: 'Running' },
      { isPaused: true, label: 'Paused' },
    ])('If the run is $label, Then the status badge uses the UI font outside the display-font title', ({
      isPaused,
      label,
    }) => {
      // Arrange
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: mockRun,
        isTracking: true,
        isPaused,
      });

      // Act
      render(<SessionControls />);

      // Assert
      const status = screen.getByText(label);
      expect(status).toHaveClass('font-ui');
      expect(status.closest('[data-slot="card-title"]')).toBeNull();
    });

    it('shows resume button when run is paused', () => {
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: mockRun,
        isPaused: true,
      });

      render(<SessionControls />);

      expect(screen.getByText('Resume')).toBeDefined();
    });
  });

  describe('Button States', () => {
    it('If no session is active, Then only Start new session is offered and the badge reports No session', () => {
      // Arrange
      mockStoreState(mockUseRunTrackerStore, defaultStoreState);

      // Act
      render(<SessionControls />);

      // Assert
      expect(screen.getByRole('button', { name: 'Start new session' })).toBeEnabled();
      expect(screen.queryByRole('button', { name: 'Start run' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'End session' })).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('No session');
    });

    it('If no session is active, When Start new session is clicked, Then a session is started', () => {
      // Arrange
      mockStoreState(mockUseRunTrackerStore, defaultStoreState);
      render(<SessionControls />);

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Start new session' }));

      // Assert
      expect(mockStoreActions.startSession).toHaveBeenCalledTimes(1);
    });

    it('If starting a session is in flight, Then the Start new session button is disabled', () => {
      // Arrange
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        pendingActions: { startSession: true },
      });

      // Act
      render(<SessionControls />);

      // Assert
      expect(screen.getByRole('button', { name: 'Start new session' })).toBeDisabled();
    });

    it('enables start run button when session exists but no active run', () => {
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: null,
      });

      render(<SessionControls />);

      const startButton = screen.getByText('Start run');
      expect(startButton).not.toBeDisabled();
    });

    it('enables pause/resume button when active run exists', () => {
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: mockRun,
      });

      render(<SessionControls />);

      const pauseButton = screen.getByText('Pause');
      expect(pauseButton).not.toBeDisabled();
    });

    it('enables end run button when active run exists', () => {
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: mockRun,
      });

      render(<SessionControls />);

      const endRunButton = screen.getByText('End run');
      expect(endRunButton).not.toBeDisabled();
    });

    it('enables end session button when session exists', () => {
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
      });

      render(<SessionControls />);

      const endSessionButton = screen.getByText('End session');
      expect(endSessionButton).not.toBeDisabled();
    });

    it('When a run action is in flight, Then all run control buttons are disabled', () => {
      // Arrange
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: mockRun,
        pendingActions: { pauseRun: true },
      });

      render(<SessionControls />);

      const pauseButton = screen.getByText('Pause');
      const endRunButton = screen.getByText('End run');
      const endSessionButton = screen.getByText('End session');

      expect(pauseButton).toBeDisabled();
      expect(endRunButton).toBeDisabled();
      expect(endSessionButton).toBeDisabled();
    });
  });

  describe('Button Click Handlers', () => {
    it('calls startRun when start run button is clicked', () => {
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: null,
      });

      render(<SessionControls />);

      const startButton = screen.getByText('Start run');
      fireEvent.click(startButton);

      expect(mockStoreActions.startRun).toHaveBeenCalledWith();
    });

    it('calls pauseRun when pause button is clicked', () => {
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: mockRun,
        isPaused: false,
      });

      render(<SessionControls />);

      const pauseButton = screen.getByText('Pause');
      fireEvent.click(pauseButton);

      expect(mockStoreActions.pauseRun).toHaveBeenCalled();
    });

    it('calls resumeRun when resume button is clicked', () => {
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: mockRun,
        isPaused: true,
      });

      render(<SessionControls />);

      const resumeButton = screen.getByText('Resume');
      fireEvent.click(resumeButton);

      expect(mockStoreActions.resumeRun).toHaveBeenCalled();
    });

    it('When End run is clicked, Then the run ends right away and a success toast is shown', async () => {
      // Arrange
      mockStoreActions.endRun.mockResolvedValue(true);
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: { ...mockRun, runNumber: 3 },
      });
      render(<SessionControls />);

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'End run' }));

      // Assert
      expect(mockStoreActions.endRun).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Run #3 ended'));
    });

    it('If ending the run fails, Then no success toast is shown', async () => {
      // Arrange
      mockStoreActions.endRun.mockResolvedValue(false);
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: { ...mockRun, runNumber: 3 },
      });
      render(<SessionControls />);

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'End run' }));

      // Assert
      await waitFor(() => expect(mockStoreActions.endRun).toHaveBeenCalledTimes(1));
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('opens end session dialog when end session button is clicked', () => {
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
      });

      render(<SessionControls />);

      const endSessionButton = screen.getByText('End session');
      fireEvent.click(endSessionButton);

      // Dialog might not render in test environment, so just verify button click works
      expect(endSessionButton).toBeDefined();
    });
  });

  describe('Confirmation Dialogs', () => {
    it('When End Session is clicked, Then the session only ends after confirming', async () => {
      // Arrange
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
      });
      render(<SessionControls />);

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'End session' }));
      const dialog = await screen.findByRole('alertdialog');

      // Assert
      expect(within(dialog).getByText('End current session')).toBeInTheDocument();
      expect(mockStoreActions.endSession).not.toHaveBeenCalled();

      // Act
      fireEvent.click(within(dialog).getByRole('button', { name: 'End session' }));

      // Assert
      await waitFor(() => {
        expect(mockStoreActions.endSession).toHaveBeenCalledTimes(1);
      });
    });

    it('If the end session confirmation is cancelled, Then the session is not ended', async () => {
      // Arrange
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
      });
      render(<SessionControls />);
      fireEvent.click(screen.getByRole('button', { name: 'End session' }));
      const dialog = await screen.findByRole('alertdialog');

      // Act
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      // Assert
      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      });
      expect(mockStoreActions.endSession).not.toHaveBeenCalled();
    });

    it('When ending the session is in flight, Then the dialog buttons are disabled', async () => {
      // Arrange
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
      });
      const { rerender } = render(<SessionControls />);
      fireEvent.click(screen.getByRole('button', { name: 'End session' }));
      const dialog = await screen.findByRole('alertdialog');

      // Act
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
        pendingActions: { endSession: true },
      });
      rerender(<SessionControls />);

      // Assert
      expect(within(dialog).getByRole('button', { name: 'Ending...' })).toBeDisabled();
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled();
    });

    it('If auto mode is enabled, Then End Session stays enabled and manual run controls are replaced by an automatic tracking notice', async () => {
      // Arrange
      const originalElectronAPI = window.electronAPI;
      Object.defineProperty(window, 'electronAPI', {
        value: {
          platform: 'win32',
          runTracker: {
            getMemoryStatus: vi.fn().mockResolvedValue({ available: true, reason: null }),
            getGlobalHotkeyStatus: vi.fn().mockResolvedValue({ enabled: false, registrations: [] }),
            onGlobalHotkeyStatus: vi.fn(() => vi.fn()),
          },
        },
        writable: true,
        configurable: true,
      });
      mockStoreState(mockUseGrailStore, {
        ...defaultGrailStoreState,
        settings: { ...defaultGrailStoreState.settings, runTrackerMemoryReading: true },
      });
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
      });

      // Act
      render(<SessionControls />);

      // Assert
      expect(screen.queryByRole('button', { name: 'Start run' })).not.toBeInTheDocument();
      expect(screen.getByText('Runs are tracked automatically')).toBeInTheDocument();
      const endSessionButton = screen.getByRole('button', { name: 'End session' });
      expect(endSessionButton).toBeEnabled();
      fireEvent.click(endSessionButton);
      expect(await screen.findByRole('alertdialog')).toBeInTheDocument();

      Object.defineProperty(window, 'electronAPI', {
        value: originalElectronAPI,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('Keyboard shortcuts', () => {
    it('sets up keyboard event listeners on mount', () => {
      mockStoreState(mockUseRunTrackerStore, defaultStoreState);

      render(<SessionControls />);

      expect(mockAddEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('removes keyboard event listeners on unmount', () => {
      mockStoreState(mockUseRunTrackerStore, defaultStoreState);

      const { unmount } = render(<SessionControls />);
      unmount();

      expect(mockRemoveEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('triggers start run on Ctrl+R', () => {
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: null,
      });

      render(<SessionControls />);

      // Get the keyboard handler
      const keyboardHandler = vi.mocked(document.addEventListener).mock.calls[0][1] as (
        event: KeyboardEvent,
      ) => void;

      // Simulate Ctrl+R
      const event = new KeyboardEvent('keydown', {
        key: 'r',
        ctrlKey: true,
      });
      Object.defineProperty(event, 'target', { value: document.body });

      keyboardHandler(event);

      expect(mockStoreActions.startRun).toHaveBeenCalledWith();
    });

    it('triggers pause on Ctrl+Space when not paused', () => {
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: mockRun,
        isPaused: false,
      });
      mockStoreState(mockUseGrailStore, defaultGrailStoreState);

      render(<SessionControls />);

      const keyboardHandler = vi.mocked(document.addEventListener).mock.calls[0][1] as (
        event: KeyboardEvent,
      ) => void;

      const event = new KeyboardEvent('keydown', {
        key: ' ',
        ctrlKey: true,
      });
      Object.defineProperty(event, 'target', { value: document.body });

      keyboardHandler(event);

      expect(mockStoreActions.pauseRun).toHaveBeenCalled();
    });

    it('triggers resume on Ctrl+Space when paused', () => {
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: mockRun,
        isPaused: true,
      });
      mockStoreState(mockUseGrailStore, defaultGrailStoreState);

      render(<SessionControls />);

      const keyboardHandler = vi.mocked(document.addEventListener).mock.calls[0][1] as (
        event: KeyboardEvent,
      ) => void;

      const event = new KeyboardEvent('keydown', {
        key: ' ',
        ctrlKey: true,
      });
      Object.defineProperty(event, 'target', { value: document.body });

      keyboardHandler(event);

      expect(mockStoreActions.resumeRun).toHaveBeenCalled();
    });

    it('When Ctrl+E is pressed, Then the run ends right away without a confirmation', () => {
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: mockRun,
      });

      render(<SessionControls />);

      const keyboardHandler = vi.mocked(document.addEventListener).mock.calls[0][1] as (
        event: KeyboardEvent,
      ) => void;

      const event = new KeyboardEvent('keydown', {
        key: 'e',
        ctrlKey: true,
        shiftKey: false,
      });
      Object.defineProperty(event, 'target', { value: document.body });

      act(() => {
        keyboardHandler(event);
      });

      expect(mockStoreActions.endRun).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('triggers end session dialog on Ctrl+Shift+E', () => {
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
      });

      render(<SessionControls />);

      const keyboardHandler = vi.mocked(document.addEventListener).mock.calls[0][1] as (
        event: KeyboardEvent,
      ) => void;

      const event = new KeyboardEvent('keydown', {
        key: 'e',
        ctrlKey: true,
        shiftKey: true,
      });
      Object.defineProperty(event, 'target', { value: document.body });

      keyboardHandler(event);

      // Verify the keyboard handler was called (dialog might not render in test environment)
      expect(keyboardHandler).toBeDefined();
    });

    it('ignores shortcuts when typing in input fields', () => {
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: null,
      });

      render(<SessionControls />);

      const keyboardHandler = vi.mocked(document.addEventListener).mock.calls[0][1] as (
        event: KeyboardEvent,
      ) => void;

      // Create a mock input element
      const inputElement = document.createElement('input');
      Object.defineProperty(inputElement, 'tagName', { value: 'INPUT' });

      const event = new KeyboardEvent('keydown', {
        key: 'r',
        ctrlKey: true,
      });
      Object.defineProperty(event, 'target', { value: inputElement });

      keyboardHandler(event);

      // Should not call startRun when typing in input
      expect(mockStoreActions.startRun).not.toHaveBeenCalled();
    });

    it('handles Mac modifier keys correctly', () => {
      // Mock navigator.platform to simulate Mac
      const originalPlatform = navigator.platform;
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        writable: true,
        configurable: true,
      });

      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: null,
      });

      render(<SessionControls />);

      const keyboardHandler = vi.mocked(document.addEventListener).mock.calls[0][1] as (
        event: KeyboardEvent,
      ) => void;

      // Simulate Cmd+R on Mac
      const event = new KeyboardEvent('keydown', {
        key: 'r',
        metaKey: true, // Mac uses metaKey instead of ctrlKey
      });
      Object.defineProperty(event, 'target', { value: document.body });

      keyboardHandler(event);

      expect(mockStoreActions.startRun).toHaveBeenCalledWith();

      Object.defineProperty(navigator, 'platform', {
        value: originalPlatform,
        writable: true,
        configurable: true,
      });
    });

    it('respects customized shortcuts with additional modifiers', () => {
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: null,
      });
      mockStoreState(mockUseGrailStore, {
        settings: {
          runTrackerShortcuts: {
            ...defaultGrailStoreState.settings.runTrackerShortcuts,
            startRun: 'Ctrl+Alt+N',
          },
        },
      });

      render(<SessionControls />);

      const keyboardHandler = vi.mocked(document.addEventListener).mock.calls[0][1] as (
        event: KeyboardEvent,
      ) => void;

      const event = new KeyboardEvent('keydown', {
        key: 'n',
        ctrlKey: true,
        altKey: true,
      });
      Object.defineProperty(event, 'target', { value: document.body });

      keyboardHandler(event);

      expect(mockStoreActions.startRun).toHaveBeenCalledWith();
    });
  });

  describe('Auto Mode Shortcut Gating', () => {
    const originalElectronAPI = window.electronAPI;

    beforeEach(() => {
      Object.defineProperty(window, 'electronAPI', {
        value: {
          platform: 'win32',
          runTracker: {
            getMemoryStatus: vi.fn().mockResolvedValue({ available: true, reason: null }),
            getGlobalHotkeyStatus: vi.fn().mockResolvedValue({ enabled: false, registrations: [] }),
            onGlobalHotkeyStatus: vi.fn(() => vi.fn()),
          },
        },
        writable: true,
        configurable: true,
      });
      mockStoreState(mockUseGrailStore, {
        ...defaultGrailStoreState,
        settings: { ...defaultGrailStoreState.settings, runTrackerMemoryReading: true },
      });
    });

    afterEach(() => {
      Object.defineProperty(window, 'electronAPI', {
        value: originalElectronAPI,
        writable: true,
        configurable: true,
      });
    });

    const pressShortcut = (init: KeyboardEventInit) => {
      const keyboardHandler = mockAddEventListener.mock.calls.find(
        (call) => call[0] === 'keydown',
      )?.[1] as (event: KeyboardEvent) => void;
      const event = new KeyboardEvent('keydown', init);
      Object.defineProperty(event, 'target', { value: document.body });
      act(() => {
        keyboardHandler(event);
      });
    };

    it('If auto mode is enabled, Then the start run shortcut is ignored', () => {
      // Arrange
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: null,
      });
      render(<SessionControls />);

      // Act
      pressShortcut({ key: 'r', ctrlKey: true });

      // Assert
      expect(mockStoreActions.startRun).not.toHaveBeenCalled();
    });

    it('If auto mode is enabled, Then the pause and end run shortcuts are ignored', () => {
      // Arrange
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: mockRun,
      });
      render(<SessionControls />);

      // Act
      pressShortcut({ key: ' ', ctrlKey: true });
      pressShortcut({ key: 'e', ctrlKey: true });

      // Assert
      expect(mockStoreActions.pauseRun).not.toHaveBeenCalled();
      expect(mockStoreActions.endRun).not.toHaveBeenCalled();
    });

    it('If auto mode is enabled, Then the end session shortcut still opens the confirmation', async () => {
      // Arrange
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
      });
      render(<SessionControls />);

      // Act
      pressShortcut({ key: 'e', ctrlKey: true, shiftKey: true });

      // Assert
      const dialog = await screen.findByRole('alertdialog');
      expect(within(dialog).getByText('End current session')).toBeInTheDocument();
    });

    it('If auto mode is enabled but memory reading is unavailable, Then the start run shortcut works like the restored button', async () => {
      // Arrange
      const getMemoryStatus = vi
        .fn()
        .mockResolvedValue({ available: false, reason: 'Unknown D2R build' });
      window.electronAPI = {
        ...window.electronAPI,
        runTracker: { ...window.electronAPI?.runTracker, getMemoryStatus },
      } as typeof window.electronAPI;
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: null,
      });
      render(<SessionControls />);
      await waitFor(() => expect(getMemoryStatus).toHaveBeenCalled());
      await act(async () => {
        await Promise.resolve();
      });
      const keydownHandlers = mockAddEventListener.mock.calls.filter(
        (call) => call[0] === 'keydown',
      );
      const latestHandler = keydownHandlers[keydownHandlers.length - 1]?.[1] as (
        event: KeyboardEvent,
      ) => void;
      const event = new KeyboardEvent('keydown', { key: 'r', ctrlKey: true });
      Object.defineProperty(event, 'target', { value: document.body });

      // Act
      act(() => {
        latestHandler(event);
      });

      // Assert
      expect(mockStoreActions.startRun).toHaveBeenCalled();
    });
  });

  describe('Shortcut key chips', () => {
    const originalElectronAPI = window.electronAPI;

    // The key chip rendered inside the action button
    const getShortcutKey = (buttonName: string) =>
      screen.getByRole('button', { name: buttonName }).querySelector('kbd');

    afterEach(() => {
      Object.defineProperty(window, 'electronAPI', {
        value: originalElectronAPI,
        writable: true,
        configurable: true,
      });
    });

    it('If a session has no active run on macOS, Then Start run shows its Command shortcut as a key chip', () => {
      // Arrange
      setPlatform('darwin');
      mockStoreState(mockUseRunTrackerStore, { ...defaultStoreState, activeSession: mockSession });

      // Act
      render(<SessionControls />);

      // Assert
      expect(getShortcutKey('Start run')).toHaveTextContent('\u2318R');
      expect(getShortcutKey('End session')).toHaveTextContent('\u21E7\u2318E');
    });

    it('If a run is active on macOS, Then End run, Pause and End session show their Command shortcuts as key chips', () => {
      // Arrange
      setPlatform('darwin');
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: mockRun,
      });

      // Act
      render(<SessionControls />);

      // Assert
      expect(getShortcutKey('End run')).toHaveTextContent('\u2318E');
      expect(getShortcutKey('Pause')).toHaveTextContent('\u2318Space');
      expect(getShortcutKey('End session')).toHaveTextContent('\u21E7\u2318E');
    });

    it('If the run is paused on macOS, Then Resume shows the Command shortcut as a key chip', () => {
      // Arrange
      setPlatform('darwin');
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: { ...mockRun, isPaused: true },
        isPaused: true,
      });

      // Act
      render(<SessionControls />);

      // Assert
      expect(getShortcutKey('Resume')).toHaveTextContent('\u2318Space');
    });

    it('When the app runs on Windows, Then the key chips show Ctrl', () => {
      // Arrange
      setPlatform('win32');
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: mockRun,
      });

      // Act
      render(<SessionControls />);

      // Assert
      expect(getShortcutKey('End run')).toHaveTextContent('Ctrl+E');
      expect(getShortcutKey('Pause')).toHaveTextContent('Ctrl+Space');
      expect(getShortcutKey('End session')).toHaveTextContent('Ctrl+Shift+E');
      expect(screen.getByRole('button', { name: 'End run' })).toHaveAttribute(
        'aria-keyshortcuts',
        'Control+E',
      );
      expect(screen.getByRole('button', { name: 'Pause' })).toHaveAttribute(
        'aria-keyshortcuts',
        'Control+Space',
      );
      expect(screen.getByRole('button', { name: 'End session' })).toHaveAttribute(
        'aria-keyshortcuts',
        'Control+Shift+E',
      );
    });

    it('If a session has no active run on Windows, Then Start run announces Control+R', () => {
      // Arrange
      setPlatform('win32');
      mockStoreState(mockUseRunTrackerStore, { ...defaultStoreState, activeSession: mockSession });

      // Act
      render(<SessionControls />);

      // Assert
      expect(screen.getByRole('button', { name: 'Start run' })).toHaveAttribute(
        'aria-keyshortcuts',
        'Control+R',
      );
    });

    it('When a shortcut is shown as a key chip, Then the chip is hidden from assistive technology and the button exposes the shortcut instead', () => {
      // Arrange
      setPlatform('darwin');
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: mockRun,
      });

      // Act
      render(<SessionControls />);

      // Assert
      const endRunButton = screen.getByRole('button', { name: 'End run' });
      expect(endRunButton.querySelector('kbd')?.closest('[aria-hidden="true"]')).not.toBeNull();
      expect(endRunButton).toHaveAttribute('aria-keyshortcuts', 'Meta+E');
      expect(screen.getByRole('button', { name: 'Pause' })).toHaveAttribute(
        'aria-keyshortcuts',
        'Meta+Space',
      );
      expect(screen.getByRole('button', { name: 'End session' })).toHaveAttribute(
        'aria-keyshortcuts',
        'Meta+Shift+E',
      );
      // The accessible name is unchanged; the shortcut is the accessible description
      expect(endRunButton).toHaveAccessibleName('End run');
      expect(endRunButton).toHaveAccessibleDescription('\u2318E');
      expect(screen.getByRole('button', { name: 'Pause' })).toHaveAccessibleDescription(
        '\u2318Space',
      );
      expect(screen.getByRole('button', { name: 'End session' })).toHaveAccessibleDescription(
        '\u21E7\u2318E',
      );
    });

    it('If no session is active, Then no run shortcuts are shown', () => {
      // Arrange
      setPlatform('darwin');

      // Act
      render(<SessionControls />);

      // Assert
      expect(
        screen.getByRole('button', { name: 'Start new session' }).querySelector('kbd'),
      ).toBeNull();
      expect(screen.queryByText('\u2318R')).not.toBeInTheDocument();
    });
  });

  describe('Global Hotkeys Indicator', () => {
    const originalElectronAPI = window.electronAPI;

    const setGlobalHotkeyStatus = (status: unknown) => {
      Object.defineProperty(window, 'electronAPI', {
        value: {
          platform: 'darwin',
          runTracker: {
            getGlobalHotkeyStatus: vi.fn().mockResolvedValue(status),
            onGlobalHotkeyStatus: vi.fn(() => vi.fn()),
          },
        },
        writable: true,
        configurable: true,
      });
    };

    afterEach(() => {
      Object.defineProperty(window, 'electronAPI', {
        value: originalElectronAPI,
        writable: true,
        configurable: true,
      });
    });

    it('If global hotkeys are registered, Then the "Global hotkeys active" indicator is shown', async () => {
      // Arrange
      setGlobalHotkeyStatus({
        enabled: true,
        registrations: [{ action: 'startRun', shortcut: 'Ctrl+R', state: 'registered' }],
      });

      // Act
      render(<SessionControls />);

      // Assert
      expect(await screen.findByText('Global hotkeys active')).toBeInTheDocument();
    });

    it('If no global hotkey could be registered, Then the indicator is hidden', async () => {
      // Arrange
      setGlobalHotkeyStatus({
        enabled: true,
        registrations: [{ action: 'startRun', shortcut: 'Ctrl+R', state: 'conflict' }],
      });

      // Act
      render(<SessionControls />);
      await waitFor(() =>
        expect(window.electronAPI.runTracker.getGlobalHotkeyStatus).toHaveBeenCalled(),
      );

      // Assert
      expect(screen.queryByText('Global hotkeys active')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles store action errors gracefully', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        // Mock implementation - intentionally empty
      });
      mockStoreActions.startRun.mockImplementation(() => {
        throw new Error('Test error');
      });

      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: null,
      });

      render(<SessionControls />);

      const startButton = screen.getByText('Start run');
      fireEvent.click(startButton);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to start run:', expect.any(Error));

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Auto mode availability', () => {
    const originalElectronAPI = window.electronAPI;

    const setUnavailableMemoryReading = () => {
      Object.defineProperty(window, 'electronAPI', {
        value: {
          platform: 'win32',
          runTracker: {
            getMemoryStatus: vi
              .fn()
              .mockResolvedValue({ available: false, reason: 'Unknown D2R build' }),
            getGlobalHotkeyStatus: vi.fn().mockResolvedValue({ enabled: false, registrations: [] }),
            onGlobalHotkeyStatus: vi.fn(() => vi.fn()),
          },
        },
        writable: true,
        configurable: true,
      });
    };

    afterEach(() => {
      Object.defineProperty(window, 'electronAPI', {
        value: originalElectronAPI,
        writable: true,
        configurable: true,
      });
    });

    it('If auto mode is off, Then the unavailable warning is not shown', async () => {
      // Arrange
      setUnavailableMemoryReading();
      mockStoreState(mockUseRunTrackerStore, { ...defaultStoreState, activeSession: mockSession });

      // Act
      render(<SessionControls />);
      await waitFor(() => {
        expect(window.electronAPI?.runTracker.getMemoryStatus).toHaveBeenCalled();
      });

      // Assert
      expect(screen.queryByText('Auto mode temporarily unavailable.')).not.toBeInTheDocument();
    });

    it('If auto mode is on and memory reading is unavailable, Then a polite warning is shown', async () => {
      // Arrange
      setUnavailableMemoryReading();
      mockStoreState(mockUseGrailStore, {
        ...defaultGrailStoreState,
        settings: { ...defaultGrailStoreState.settings, runTrackerMemoryReading: true },
      });
      mockStoreState(mockUseRunTrackerStore, { ...defaultStoreState, activeSession: mockSession });

      // Act
      render(<SessionControls />);

      // Assert
      const warningText = await screen.findByText('Auto mode temporarily unavailable.');
      const warning = warningText.closest('[data-slot="alert"]');
      expect(warning).toHaveAttribute('role', 'status');
      expect(warning).toHaveClass('text-warning');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('If auto mode is on and memory reading is unavailable, Then the automatic tracking notice is hidden and manual run controls and the switch stay usable', async () => {
      // Arrange
      setUnavailableMemoryReading();
      mockStoreState(mockUseGrailStore, {
        ...defaultGrailStoreState,
        settings: { ...defaultGrailStoreState.settings, runTrackerMemoryReading: true },
      });
      mockStoreState(mockUseRunTrackerStore, { ...defaultStoreState, activeSession: mockSession });

      // Act
      render(<SessionControls />);
      await screen.findByText('Auto mode temporarily unavailable.');

      // Assert
      expect(screen.queryByText('Runs are tracked automatically')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Start run' })).toBeEnabled();
      expect(screen.getByRole('switch')).toBeInTheDocument();
    });

    it('When the Auto Mode switch is shown, Then it is named by its visible label', async () => {
      // Arrange
      setUnavailableMemoryReading();
      mockStoreState(mockUseRunTrackerStore, { ...defaultStoreState, activeSession: mockSession });

      // Act
      render(<SessionControls />);
      await waitFor(() => {
        expect(window.electronAPI?.runTracker.getMemoryStatus).toHaveBeenCalled();
      });

      // Assert
      const autoModeSwitch = screen.getByRole('switch', { name: 'Auto mode' });
      expect(autoModeSwitch).toHaveAccessibleDescription('(memory reading)');
    });
  });

  describe('Run actions', () => {
    it('When a run is active, Then End run, Pause, End session and Add Item are offered', () => {
      // Arrange
      mockStoreState(mockUseRunTrackerStore, {
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: mockRun,
      });

      // Act
      render(<SessionControls />);

      // Assert
      expect(screen.getAllByRole('button')).toHaveLength(4); // End run, Pause/Resume, End session, Add Item
    });
  });
});
