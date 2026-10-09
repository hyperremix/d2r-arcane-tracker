import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Run, RunItem, Session, SessionStats } from 'electron/types/grail';
import { MAX_SESSION_NOTES_LENGTH } from 'electron/utils/sessionNotes';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGrailStore } from '@/stores/grailStore';
import { useRunTrackerStore, useSessionStats } from '@/stores/runTrackerStore';
import { mockStoreState } from '@/test/storeMock';
import { SessionCard } from './SessionCard';

vi.mock('@/stores/runTrackerStore');
vi.mock('@/stores/grailStore');
vi.mock('./ExportDialog', () => ({
  ExportDialog: () => null,
}));

const mockUseRunTrackerStore = vi.mocked(useRunTrackerStore);
const mockUseGrailStore = vi.mocked(useGrailStore);

const mockSession: Session = {
  id: 'session-1',
  startTime: new Date('2024-01-01T10:00:00Z'),
  totalRunTime: 300000,
  totalSessionTime: 600000,
  runCount: 3,
  archived: false,
  notes: '',
  created: new Date('2024-01-01T10:00:00Z'),
  lastUpdated: new Date('2024-01-01T10:00:00Z'),
};

const mockArchiveSession = vi.fn().mockResolvedValue(undefined);
const mockEndSession = vi.fn().mockResolvedValue(undefined);
const mockStartSession = vi.fn().mockResolvedValue(undefined);

const createStoreState = (overrides: Record<string, unknown> = {}) =>
  ({
    activeSession: mockSession,
    activeRun: null,
    pendingActions: {},
    runs: new Map(),
    runItems: new Map(),
    archiveSession: mockArchiveSession,
    endSession: mockEndSession,
    startSession: mockStartSession,
    updateSessionNotes: vi.fn().mockResolvedValue(true),
    ...overrides,
  }) as unknown as ReturnType<typeof useRunTrackerStore>;

describe('SessionCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSessionStats).mockReturnValue(undefined);
    mockStoreState(mockUseRunTrackerStore, createStoreState());
    mockStoreState(mockUseGrailStore, {
      items: [],
      progress: [],
      settings: {},
    } as unknown as ReturnType<typeof useGrailStore>);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('When an active session is shown', () => {
    it('Then the card does not render its own End Session button', () => {
      // Arrange & Act
      render(<SessionCard session={mockSession} />);

      // Assert
      expect(screen.queryByRole('button', { name: 'End Session' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Archive Session' })).toBeInTheDocument();
    });
  });

  describe('When Archive Session is clicked', () => {
    it('Then a confirmation dialog opens and the session is not archived yet', async () => {
      // Arrange
      render(<SessionCard session={mockSession} />);

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Archive Session' }));

      // Assert
      const dialog = await screen.findByRole('alertdialog');
      expect(within(dialog).getByText(/Are you sure you want to archive/)).toBeInTheDocument();
      expect(mockArchiveSession).not.toHaveBeenCalled();
    });

    it('Then confirming archives the session', async () => {
      // Arrange
      render(<SessionCard session={mockSession} />);
      fireEvent.click(screen.getByRole('button', { name: 'Archive Session' }));
      const dialog = await screen.findByRole('alertdialog');

      // Act
      fireEvent.click(within(dialog).getByRole('button', { name: 'Archive' }));

      // Assert
      await waitFor(() => {
        expect(mockArchiveSession).toHaveBeenCalledWith('session-1');
      });
    });

    it('If the confirmation is cancelled, Then the session is not archived', async () => {
      // Arrange
      render(<SessionCard session={mockSession} />);
      fireEvent.click(screen.getByRole('button', { name: 'Archive Session' }));
      const dialog = await screen.findByRole('alertdialog');

      // Act
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      // Assert
      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      });
      expect(mockArchiveSession).not.toHaveBeenCalled();
    });
  });

  describe('If archiving is in flight', () => {
    it('Then the Archive Session button is disabled', () => {
      // Arrange
      mockStoreState(
        mockUseRunTrackerStore,
        createStoreState({ pendingActions: { archiveSession: true } }),
      );

      // Act
      render(<SessionCard session={mockSession} />);

      // Assert
      expect(screen.getByRole('button', { name: 'Archive Session' })).toBeDisabled();
    });
  });

  describe('If no session is active', () => {
    it('Then the card renders nothing because starting a session lives in the session controls', () => {
      // Arrange
      mockStoreState(mockUseRunTrackerStore, createStoreState({ activeSession: null }));

      // Act
      const { container } = render(<SessionCard session={null} />);

      // Assert
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('When efficiency is calculated for a live session', () => {
    it('If no run has finished yet, Then the in-progress run already counts towards efficiency', () => {
      // Arrange
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2024-01-01T10:20:00Z'));
      const freshSession: Session = {
        ...mockSession,
        totalRunTime: 0,
        totalSessionTime: 0,
        runCount: 1,
      };
      const activeRun: Run = {
        id: 'run-1',
        sessionId: 'session-1',
        runNumber: 1,
        startTime: new Date('2024-01-01T10:10:00Z'),
        created: new Date('2024-01-01T10:10:00Z'),
        lastUpdated: new Date('2024-01-01T10:10:00Z'),
      };
      mockStoreState(
        mockUseRunTrackerStore,
        createStoreState({ activeSession: freshSession, activeRun }),
      );

      // Act
      render(<SessionCard session={freshSession} />);

      // Assert
      expect(screen.getByText('50.0%')).toBeInTheDocument();
      expect(screen.getByText('20m')).toBeInTheDocument();
    });

    it('If runs have finished, Then efficiency uses the live session time instead of the last backend snapshot', () => {
      // Arrange
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2024-01-01T10:20:00Z'));
      // Backend snapshot from the last run end: 5m of 10m, but 20m have elapsed by now
      mockStoreState(mockUseRunTrackerStore, createStoreState({ activeRun: null }));

      // Act
      render(<SessionCard session={mockSession} />);

      // Assert
      expect(screen.getByText('25.0%')).toBeInTheDocument();
    });
  });

  describe('When the active session has finished runs', () => {
    const makeRun = (runNumber: number, overrides: Partial<Run> = {}): Run => ({
      id: `run-${runNumber}`,
      sessionId: 'session-1',
      runNumber,
      startTime: new Date('2024-01-01T10:00:00Z'),
      endTime: new Date('2024-01-01T10:01:00Z'),
      duration: 60000 + runNumber * 1000,
      created: new Date('2024-01-01T10:00:00Z'),
      lastUpdated: new Date('2024-01-01T10:01:00Z'),
      ...overrides,
    });

    const makeItem = (runId: string, name: string): RunItem => ({
      id: `${runId}-${name}`,
      runId,
      name,
      foundTime: new Date('2024-01-01T10:00:30Z'),
      created: new Date('2024-01-01T10:00:30Z'),
    });

    it('Then the five most recent runs are listed newest first with duration and found items', () => {
      // Arrange
      const sessionRuns = [
        ...Array.from({ length: 7 }, (_, index) => makeRun(index + 1)),
        makeRun(8, { endTime: undefined, duration: undefined }),
      ];
      const runItems = new Map([['run-7', [makeItem('run-7', 'Shako'), makeItem('run-7', 'Ber')]]]);
      mockStoreState(
        mockUseRunTrackerStore,
        createStoreState({ runs: new Map([['session-1', sessionRuns]]), runItems }),
      );

      // Act
      render(<SessionCard session={mockSession} />);

      // Assert
      const list = screen.getByRole('region', { name: 'Recent Runs' });
      const rows = within(list).getAllByRole('listitem');
      expect(rows.map((row) => within(row).getByText(/^Run #/).textContent)).toEqual([
        'Run #7',
        'Run #6',
        'Run #5',
        'Run #4',
        'Run #3',
      ]);
      expect(within(rows[0]).getByText('1m 7s')).toBeInTheDocument();
      expect(within(rows[0]).getByText('2 items')).toBeInTheDocument();
      expect(within(rows[0]).getByText('Shako, Ber')).toBeInTheDocument();
      expect(within(rows[1]).getByText('No items')).toBeInTheDocument();
    });

    it('If an item was detected from save files, Then its grail item name is shown and unresolved items are labelled', () => {
      // Arrange
      const detectedItem: RunItem = {
        id: 'item-1',
        runId: 'run-1',
        grailProgressId: 'progress-1',
        foundTime: new Date('2024-01-01T10:00:30Z'),
        created: new Date('2024-01-01T10:00:30Z'),
      };
      const unresolvedItem: RunItem = { ...detectedItem, id: 'item-2', grailProgressId: undefined };
      mockStoreState(mockUseGrailStore, {
        items: [{ id: 'harlequin-crest', name: 'Harlequin Crest' }],
        progress: [{ id: 'progress-1', itemId: 'harlequin-crest' }],
      } as unknown as ReturnType<typeof useGrailStore>);
      mockStoreState(
        mockUseRunTrackerStore,
        createStoreState({
          runs: new Map([['session-1', [makeRun(1)]]]),
          runItems: new Map([['run-1', [detectedItem, unresolvedItem]]]),
        }),
      );

      // Act
      render(<SessionCard session={mockSession} />);

      // Assert
      expect(screen.getByText('Harlequin Crest, Unknown Item')).toBeInTheDocument();
    });

    it('If no View all runs handler is given, Then the action is not shown', () => {
      // Arrange
      mockStoreState(
        mockUseRunTrackerStore,
        createStoreState({ runs: new Map([['session-1', [makeRun(1)]]]) }),
      );

      // Act
      render(<SessionCard session={mockSession} />);

      // Assert
      expect(screen.queryByRole('button', { name: 'View all runs' })).not.toBeInTheDocument();
    });

    it('When View all runs is clicked, Then the full run history is requested', () => {
      // Arrange
      const onViewAllRuns = vi.fn();
      mockStoreState(
        mockUseRunTrackerStore,
        createStoreState({ runs: new Map([['session-1', [makeRun(1)]]]) }),
      );
      render(<SessionCard session={mockSession} onViewAllRuns={onViewAllRuns} />);

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'View all runs' }));

      // Assert
      expect(onViewAllRuns).toHaveBeenCalledTimes(1);
    });
  });

  describe('When items found in the session were new to the grail', () => {
    it('Then the number of new grail items is shown next to the items found', () => {
      // Arrange
      const stats: SessionStats = {
        sessionId: 'session-1',
        totalRuns: 1,
        totalTime: 600000,
        totalRunTime: 300000,
        averageRunDuration: 60000,
        fastestRun: 60000,
        slowestRun: 60000,
        itemsFound: 2,
        newGrailItems: 1,
      };
      vi.mocked(useSessionStats).mockReturnValue(stats);

      // Act
      render(<SessionCard session={mockSession} />);

      // Assert
      expect(useSessionStats).toHaveBeenCalledWith(mockSession);
      expect(screen.getByText('Items Found').nextElementSibling).toHaveTextContent('2');
      expect(screen.getByText('New Grail Items').nextElementSibling).toHaveTextContent('1');
    });
  });

  describe('If no run has finished yet', () => {
    it('Then the recent runs list explains that completed runs will appear', () => {
      // Arrange & Act
      render(<SessionCard session={mockSession} />);

      // Assert
      expect(
        screen.getByText('No finished runs yet. Completed runs will appear here.'),
      ).toBeInTheDocument();
    });
  });

  describe('When session notes are shown', () => {
    it('Then they start collapsed and expand from the Session Notes toggle', async () => {
      // Arrange
      render(<SessionCard session={mockSession} />);
      const toggle = screen.getByRole('button', { name: 'Session Notes' });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByRole('textbox', { name: 'Session Notes' })).not.toBeInTheDocument();

      // Act
      fireEvent.click(toggle);

      // Assert
      expect(await screen.findByRole('textbox', { name: 'Session Notes' })).toBeInTheDocument();
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('When edited session notes lose focus', () => {
    const openNotes = async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Session Notes' }));
      return screen.findByRole('textbox', { name: 'Session Notes' });
    };

    it('Then the notes are saved for the session', async () => {
      // Arrange
      const updateSessionNotes = vi.fn().mockResolvedValue(true);
      mockStoreState(mockUseRunTrackerStore, createStoreState({ updateSessionNotes }));
      render(<SessionCard session={mockSession} />);
      const textarea = await openNotes();

      // Act
      fireEvent.change(textarea, { target: { value: 'Cow runs' } });
      fireEvent.blur(textarea);

      // Assert
      await waitFor(() => {
        expect(updateSessionNotes).toHaveBeenCalledWith('session-1', 'Cow runs');
      });
      expect(textarea).toHaveValue('Cow runs');
    });

    it('If saving fails, Then the saved notes are shown again', async () => {
      // Arrange
      const updateSessionNotes = vi.fn().mockResolvedValue(false);
      mockStoreState(mockUseRunTrackerStore, createStoreState({ updateSessionNotes }));
      render(<SessionCard session={mockSession} />);
      const textarea = await openNotes();

      // Act
      fireEvent.change(textarea, { target: { value: 'Cow runs' } });
      fireEvent.blur(textarea);

      // Assert
      await waitFor(() => {
        expect(textarea).toHaveValue('');
      });
      expect(updateSessionNotes).toHaveBeenCalledTimes(1);
    });

    it('Then the editor limits the notes to the maximum length the main process accepts', async () => {
      // Arrange
      render(<SessionCard session={mockSession} />);

      // Act
      const textarea = await openNotes();

      // Assert
      expect(textarea).toHaveAttribute('maxlength', String(MAX_SESSION_NOTES_LENGTH));
    });
  });

  describe('When the icon-only export button is shown', () => {
    it('If the session has runs, Then the button is enabled and named "Export session data"', () => {
      // Arrange & Act
      render(<SessionCard session={mockSession} />);

      // Assert
      expect(screen.getByRole('button', { name: 'Export session data' })).toBeEnabled();
    });

    it('If the session has no runs, Then the title explains why but the accessible name stays "Export session data"', () => {
      // Arrange
      const emptySession: Session = { ...mockSession, runCount: 0 };
      mockStoreState(mockUseRunTrackerStore, createStoreState({ activeSession: emptySession }));

      // Act
      render(<SessionCard session={emptySession} />);

      // Assert
      const exportButton = screen.getByRole('button', { name: 'Export session data' });
      expect(exportButton).toHaveAttribute('title', 'No runs to export');
      expect(exportButton).toBeDisabled();
    });
  });
});
