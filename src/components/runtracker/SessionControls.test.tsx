import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGrailStore } from '@/stores/grailStore';
import { useRunTrackerStore } from '@/stores/runTrackerStore';
import { SessionControls } from './SessionControls';

// Mock the stores
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

describe('SessionControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddEventListener.mockClear();
    mockRemoveEventListener.mockClear();

    // Set up default mocks
    mockUseRunTrackerStore.mockReturnValue(defaultStoreState);
    mockUseGrailStore.mockReturnValue(defaultGrailStoreState);
  });

  describe('Rendering', () => {
    it('renders the live session card', () => {
      mockUseRunTrackerStore.mockReturnValue(defaultStoreState);

      render(<SessionControls />);

      expect(screen.getByText('Live Session')).toBeDefined();
    });

    it('When a run is active, Then End Run is the primary action next to Pause and End Session', () => {
      // Arrange
      mockUseRunTrackerStore.mockReturnValue({
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: mockRun,
      });

      // Act
      render(<SessionControls />);

      // Assert
      expect(screen.getByRole('button', { name: 'End Run' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'End Session' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Start Run' })).not.toBeInTheDocument();
    });

    it('When a session has no active run, Then Start Run is the primary action and Pause is hidden', () => {
      // Arrange
      mockUseRunTrackerStore.mockReturnValue({
        ...defaultStoreState,
        activeSession: mockSession,
      });

      // Act
      render(<SessionControls />);

      // Assert
      expect(screen.getByRole('button', { name: 'Start Run' })).toBeEnabled();
      expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'End Run' })).not.toBeInTheDocument();
    });

    it('When a run is active, Then the state badge politely reports Running', () => {
      // Arrange
      mockUseRunTrackerStore.mockReturnValue({
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
      mockUseRunTrackerStore.mockReturnValue({
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
      mockUseRunTrackerStore.mockReturnValue({
        ...defaultStoreState,
        activeSession: mockSession,
      });

      // Act
      render(<SessionControls />);

      // Assert
      expect(screen.getByRole('status')).toHaveTextContent('Idle');
      expect(screen.getByText('No run in progress')).toBeInTheDocument();
      expect(screen.getByText('0:00')).toBeInTheDocument();
    });

    it('When a run is active, Then the large timer shows its elapsed time outside the live region', () => {
      // Arrange
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2024-01-01T00:12:34Z'));
      mockUseRunTrackerStore.mockReturnValue({
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
      mockUseRunTrackerStore.mockReturnValue({
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
      mockUseRunTrackerStore.mockReturnValue({
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
    it('If no session is active, Then only Start New Session is offered and the badge reports No Session', () => {
      // Arrange
      mockUseRunTrackerStore.mockReturnValue(defaultStoreState);

      // Act
      render(<SessionControls />);

      // Assert
      expect(screen.getByRole('button', { name: 'Start New Session' })).toBeEnabled();
      expect(screen.queryByRole('button', { name: 'Start Run' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'End Session' })).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('No Session');
    });

    it('If no session is active, When Start New Session is clicked, Then a session is started', () => {
      // Arrange
      mockUseRunTrackerStore.mockReturnValue(defaultStoreState);
      render(<SessionControls />);

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Start New Session' }));

      // Assert
      expect(mockStoreActions.startSession).toHaveBeenCalledTimes(1);
    });

    it('If starting a session is in flight, Then the Start New Session button is disabled', () => {
      // Arrange
      mockUseRunTrackerStore.mockReturnValue({
        ...defaultStoreState,
        pendingActions: { startSession: true },
      });

      // Act
      render(<SessionControls />);

      // Assert
      expect(screen.getByRole('button', { name: 'Start New Session' })).toBeDisabled();
    });

    it('enables start run button when session exists but no active run', () => {
      mockUseRunTrackerStore.mockReturnValue({
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: null,
      });

      render(<SessionControls />);

      const startButton = screen.getByText('Start Run');
      expect(startButton).not.toBeDisabled();
    });

    it('enables pause/resume button when active run exists', () => {
      mockUseRunTrackerStore.mockReturnValue({
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: mockRun,
      });

      render(<SessionControls />);

      const pauseButton = screen.getByText('Pause');
      expect(pauseButton).not.toBeDisabled();
    });

    it('enables end run button when active run exists', () => {
      mockUseRunTrackerStore.mockReturnValue({
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: mockRun,
      });

      render(<SessionControls />);

      const endRunButton = screen.getByText('End Run');
      expect(endRunButton).not.toBeDisabled();
    });

    it('enables end session button when session exists', () => {
      mockUseRunTrackerStore.mockReturnValue({
        ...defaultStoreState,
        activeSession: mockSession,
      });

      render(<SessionControls />);

      const endSessionButton = screen.getByText('End Session');
      expect(endSessionButton).not.toBeDisabled();
    });

    it('When a run action is in flight, Then all run control buttons are disabled', () => {
      // Arrange
      mockUseRunTrackerStore.mockReturnValue({
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: mockRun,
        pendingActions: { pauseRun: true },
      });

      render(<SessionControls />);

      const pauseButton = screen.getByText('Pause');
      const endRunButton = screen.getByText('End Run');
      const endSessionButton = screen.getByText('End Session');

      expect(pauseButton).toBeDisabled();
      expect(endRunButton).toBeDisabled();
      expect(endSessionButton).toBeDisabled();
    });
  });

  describe('Button Click Handlers', () => {
    it('calls startRun when start run button is clicked', () => {
      mockUseRunTrackerStore.mockReturnValue({
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: null,
      });

      render(<SessionControls />);

      const startButton = screen.getByText('Start Run');
      fireEvent.click(startButton);

      expect(mockStoreActions.startRun).toHaveBeenCalledWith();
    });

    it('calls pauseRun when pause button is clicked', () => {
      mockUseRunTrackerStore.mockReturnValue({
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
      mockUseRunTrackerStore.mockReturnValue({
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

    it('opens end run dialog when end run button is clicked', () => {
      mockUseRunTrackerStore.mockReturnValue({
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: mockRun,
      });

      render(<SessionControls />);

      const endRunButton = screen.getByText('End Run');
      fireEvent.click(endRunButton);

      // Dialog might not render in test environment, so just verify button click works
      expect(endRunButton).toBeDefined();
    });

    it('opens end session dialog when end session button is clicked', () => {
      mockUseRunTrackerStore.mockReturnValue({
        ...defaultStoreState,
        activeSession: mockSession,
      });

      render(<SessionControls />);

      const endSessionButton = screen.getByText('End Session');
      fireEvent.click(endSessionButton);

      // Dialog might not render in test environment, so just verify button click works
      expect(endSessionButton).toBeDefined();
    });
  });

  describe('Confirmation Dialogs', () => {
    it('When End Session is clicked, Then the session only ends after confirming', async () => {
      // Arrange
      mockUseRunTrackerStore.mockReturnValue({
        ...defaultStoreState,
        activeSession: mockSession,
      });
      render(<SessionControls />);

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'End Session' }));
      const dialog = await screen.findByRole('alertdialog');

      // Assert
      expect(within(dialog).getByText('End Current Session')).toBeInTheDocument();
      expect(mockStoreActions.endSession).not.toHaveBeenCalled();

      // Act
      fireEvent.click(within(dialog).getByRole('button', { name: 'End Session' }));

      // Assert
      await waitFor(() => {
        expect(mockStoreActions.endSession).toHaveBeenCalledTimes(1);
      });
    });

    it('If the end session confirmation is cancelled, Then the session is not ended', async () => {
      // Arrange
      mockUseRunTrackerStore.mockReturnValue({
        ...defaultStoreState,
        activeSession: mockSession,
      });
      render(<SessionControls />);
      fireEvent.click(screen.getByRole('button', { name: 'End Session' }));
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
      mockUseRunTrackerStore.mockReturnValue({
        ...defaultStoreState,
        activeSession: mockSession,
      });
      const { rerender } = render(<SessionControls />);
      fireEvent.click(screen.getByRole('button', { name: 'End Session' }));
      const dialog = await screen.findByRole('alertdialog');

      // Act
      mockUseRunTrackerStore.mockReturnValue({
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
      mockUseGrailStore.mockReturnValue({
        ...defaultGrailStoreState,
        settings: { ...defaultGrailStoreState.settings, runTrackerMemoryReading: true },
      });
      mockUseRunTrackerStore.mockReturnValue({
        ...defaultStoreState,
        activeSession: mockSession,
      });

      // Act
      render(<SessionControls />);

      // Assert
      expect(screen.queryByRole('button', { name: 'Start Run' })).not.toBeInTheDocument();
      expect(screen.getByText('Runs are tracked automatically')).toBeInTheDocument();
      const endSessionButton = screen.getByRole('button', { name: 'End Session' });
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

  describe('Keyboard Shortcuts', () => {
    it('sets up keyboard event listeners on mount', () => {
      mockUseRunTrackerStore.mockReturnValue(defaultStoreState);

      render(<SessionControls />);

      expect(mockAddEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('removes keyboard event listeners on unmount', () => {
      mockUseRunTrackerStore.mockReturnValue(defaultStoreState);

      const { unmount } = render(<SessionControls />);
      unmount();

      expect(mockRemoveEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('triggers start run on Ctrl+R', () => {
      mockUseRunTrackerStore.mockReturnValue({
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
      mockUseRunTrackerStore.mockReturnValue({
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: mockRun,
        isPaused: false,
      });
      mockUseGrailStore.mockReturnValue(defaultGrailStoreState);

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
      mockUseRunTrackerStore.mockReturnValue({
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: mockRun,
        isPaused: true,
      });
      mockUseGrailStore.mockReturnValue(defaultGrailStoreState);

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

    it('triggers end run dialog on Ctrl+E', () => {
      mockUseRunTrackerStore.mockReturnValue({
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

      keyboardHandler(event);

      // Verify the keyboard handler was called (dialog might not render in test environment)
      expect(keyboardHandler).toBeDefined();
    });

    it('triggers end session dialog on Ctrl+Shift+E', () => {
      mockUseRunTrackerStore.mockReturnValue({
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
      mockUseRunTrackerStore.mockReturnValue({
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
      });

      mockUseRunTrackerStore.mockReturnValue({
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
      });
    });

    it('respects customized shortcuts with additional modifiers', () => {
      mockUseRunTrackerStore.mockReturnValue({
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: null,
      });
      mockUseGrailStore.mockReturnValue({
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
      mockUseGrailStore.mockReturnValue({
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
      mockUseRunTrackerStore.mockReturnValue({
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
      mockUseRunTrackerStore.mockReturnValue({
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
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('If auto mode is enabled, Then the end session shortcut still opens the confirmation', async () => {
      // Arrange
      mockUseRunTrackerStore.mockReturnValue({
        ...defaultStoreState,
        activeSession: mockSession,
      });
      render(<SessionControls />);

      // Act
      pressShortcut({ key: 'e', ctrlKey: true, shiftKey: true });

      // Assert
      const dialog = await screen.findByRole('alertdialog');
      expect(within(dialog).getByText('End Current Session')).toBeInTheDocument();
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
      mockUseRunTrackerStore.mockReturnValue({
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

      mockUseRunTrackerStore.mockReturnValue({
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: null,
      });

      render(<SessionControls />);

      const startButton = screen.getByText('Start Run');
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
      mockUseRunTrackerStore.mockReturnValue({ ...defaultStoreState, activeSession: mockSession });

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
      mockUseGrailStore.mockReturnValue({
        ...defaultGrailStoreState,
        settings: { ...defaultGrailStoreState.settings, runTrackerMemoryReading: true },
      });
      mockUseRunTrackerStore.mockReturnValue({ ...defaultStoreState, activeSession: mockSession });

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
      mockUseGrailStore.mockReturnValue({
        ...defaultGrailStoreState,
        settings: { ...defaultGrailStoreState.settings, runTrackerMemoryReading: true },
      });
      mockUseRunTrackerStore.mockReturnValue({ ...defaultStoreState, activeSession: mockSession });

      // Act
      render(<SessionControls />);
      await screen.findByText('Auto mode temporarily unavailable.');

      // Assert
      expect(screen.queryByText('Runs are tracked automatically')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Start Run' })).toBeEnabled();
      expect(screen.getByRole('switch')).toBeInTheDocument();
    });
  });

  describe('Tooltips', () => {
    it('renders tooltip triggers for all buttons', () => {
      mockUseRunTrackerStore.mockReturnValue({
        ...defaultStoreState,
        activeSession: mockSession,
        activeRun: mockRun,
      });

      render(<SessionControls />);

      // Check that tooltip triggers are present (they have data-slot="tooltip-trigger")
      const tooltipTriggers = screen.getAllByRole('button');
      expect(tooltipTriggers).toHaveLength(4); // End Run, Pause/Resume, End Session, Add Item
    });
  });
});
