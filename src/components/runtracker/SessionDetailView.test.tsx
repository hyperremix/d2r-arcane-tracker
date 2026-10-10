import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Run, Session } from 'electron/types/grail';
import { MAX_SESSION_NOTES_LENGTH } from 'electron/utils/sessionNotes';
import i18n from 'i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRunTrackerStore, useSessionStats } from '@/stores/runTrackerStore';
import { mockStoreState } from '@/test/storeMock';
import { SessionDetailView } from './SessionDetailView';

vi.mock('@/stores/runTrackerStore');
vi.mock('./ExportDialog', () => ({
  ExportDialog: () => null,
}));
vi.mock('./RunList', () => ({
  RunList: () => null,
}));
vi.mock('./SessionControls', () => ({
  SessionControls: () => null,
}));

const mockUseRunTrackerStore = vi.mocked(useRunTrackerStore);

const mockSession: Session = {
  id: 'session-1',
  startTime: new Date('2024-01-01T10:00:00Z'),
  endTime: new Date('2024-01-01T11:00:00Z'),
  totalRunTime: 300000,
  totalSessionTime: 600000,
  runCount: 3,
  archived: false,
  notes: '',
  created: new Date('2024-01-01T10:00:00Z'),
  lastUpdated: new Date('2024-01-01T11:00:00Z'),
};

const mockArchiveSession = vi.fn().mockResolvedValue(true);

const createStoreState = (overrides: Record<string, unknown> = {}) =>
  ({
    sessions: [mockSession],
    activeSession: null,
    runs: new Map([['session-1', []]]),
    activeRun: null,
    sessionsLoading: false,
    pendingActions: {},
    archiveSession: mockArchiveSession,
    updateSessionNotes: vi.fn().mockResolvedValue(true),
    loadSessionRuns: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }) as unknown as ReturnType<typeof useRunTrackerStore>;

describe('SessionDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSessionStats).mockReturnValue(undefined);
    mockStoreState(mockUseRunTrackerStore, createStoreState());
  });

  describe('When Archive Session is clicked', () => {
    it('Then the session is only archived after confirming', async () => {
      // Arrange
      const onBack = vi.fn();
      render(<SessionDetailView sessionId="session-1" onBack={onBack} />);

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Archive Session' }));
      const dialog = await screen.findByRole('alertdialog');

      // Assert
      expect(mockArchiveSession).not.toHaveBeenCalled();

      // Act
      fireEvent.click(within(dialog).getByRole('button', { name: 'Archive' }));

      // Assert
      await waitFor(() => {
        expect(mockArchiveSession).toHaveBeenCalledWith('session-1');
        expect(onBack).toHaveBeenCalled();
      });
    });

    it('If the confirmation is cancelled, Then the session is not archived', async () => {
      // Arrange
      const onBack = vi.fn();
      render(<SessionDetailView sessionId="session-1" onBack={onBack} />);
      fireEvent.click(screen.getByRole('button', { name: 'Archive Session' }));
      const dialog = await screen.findByRole('alertdialog');

      // Act
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      // Assert
      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      });
      expect(mockArchiveSession).not.toHaveBeenCalled();
      expect(onBack).not.toHaveBeenCalled();
    });
  });

  describe('If archiving fails', () => {
    it('Then the view stays open instead of navigating back', async () => {
      // Arrange
      mockArchiveSession.mockResolvedValueOnce(false);
      const onBack = vi.fn();
      render(<SessionDetailView sessionId="session-1" onBack={onBack} />);
      fireEvent.click(screen.getByRole('button', { name: 'Archive Session' }));
      const dialog = await screen.findByRole('alertdialog');

      // Act
      fireEvent.click(within(dialog).getByRole('button', { name: 'Archive' }));

      // Assert
      await waitFor(() => {
        expect(mockArchiveSession).toHaveBeenCalledWith('session-1');
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      });
      expect(onBack).not.toHaveBeenCalled();
    });
  });

  describe('If a run of the session is in progress', () => {
    const activeRun: Run = {
      id: 'run-1',
      sessionId: 'session-1',
      runNumber: 1,
      startTime: new Date('2024-01-01T10:10:00Z'),
      created: new Date('2024-01-01T10:10:00Z'),
      lastUpdated: new Date('2024-01-01T10:10:00Z'),
    };
    const activeSession: Session = { ...mockSession, endTime: undefined };

    it('Then the Archive Session button is disabled with a hint to end the run first', () => {
      // Arrange
      mockStoreState(
        mockUseRunTrackerStore,
        createStoreState({ activeSession, activeRun, sessions: [activeSession] }),
      );

      // Act
      render(<SessionDetailView sessionId="session-1" onBack={vi.fn()} />);

      // Assert
      const button = screen.getByRole('button', { name: 'Archive Session' });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('title', 'End the current run before archiving the session');
    });

    it('If the run starts while the confirmation is open, Then confirming does not archive the session', async () => {
      // Arrange
      const onBack = vi.fn();
      const { rerender } = render(<SessionDetailView sessionId="session-1" onBack={onBack} />);
      fireEvent.click(screen.getByRole('button', { name: 'Archive Session' }));
      const dialog = await screen.findByRole('alertdialog');
      mockStoreState(
        mockUseRunTrackerStore,
        createStoreState({ activeSession, activeRun, sessions: [activeSession] }),
      );
      rerender(<SessionDetailView sessionId="session-1" onBack={onBack} />);

      // Act
      fireEvent.click(within(dialog).getByRole('button', { name: 'Archive' }));

      // Assert
      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      });
      expect(mockArchiveSession).not.toHaveBeenCalled();
      expect(onBack).not.toHaveBeenCalled();
    });

    it('If the active run belongs to another session, Then the button stays enabled', () => {
      // Arrange
      mockStoreState(
        mockUseRunTrackerStore,
        createStoreState({
          activeSession: { ...mockSession, id: 'session-other' },
          activeRun: { ...activeRun, sessionId: 'session-other' },
        }),
      );

      // Act
      render(<SessionDetailView sessionId="session-1" onBack={vi.fn()} />);

      // Assert
      expect(screen.getByRole('button', { name: 'Archive Session' })).toBeEnabled();
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
      render(<SessionDetailView sessionId="session-1" onBack={vi.fn()} />);

      // Assert
      expect(screen.getByRole('button', { name: 'Archive Session' })).toBeDisabled();
    });
  });

  describe('When an archived session is shown', () => {
    const archivedSession: Session = {
      id: 'session-archived',
      startTime: new Date(2024, 0, 1, 14, 5, 6),
      endTime: new Date(2024, 0, 1, 15, 7, 8),
      totalRunTime: 0,
      totalSessionTime: 0,
      runCount: 0,
      archived: true,
      created: new Date(2024, 0, 1, 14, 5, 6),
      lastUpdated: new Date(2024, 0, 1, 15, 7, 8),
    };

    beforeEach(() => {
      mockStoreState(
        mockUseRunTrackerStore,
        createStoreState({
          sessions: [archivedSession],
          runs: new Map([[archivedSession.id, []]]),
        }),
      );
    });

    afterEach(async () => {
      await i18n.changeLanguage('en');
    });

    it('Then translated labels are shown', () => {
      // Arrange & Act
      render(<SessionDetailView sessionId={archivedSession.id} onBack={vi.fn()} />);

      // Assert
      expect(screen.getByText('Session Details')).toBeInTheDocument();
      expect(screen.getByText('Session Information')).toBeInTheDocument();
      expect(screen.getByText('Archived')).toBeInTheDocument();
      expect(screen.getByText('Session Duration')).toBeInTheDocument();
      expect(screen.getByLabelText('Session Notes')).toHaveAttribute(
        'placeholder',
        'Add notes about this session...',
      );
      expect(screen.getByRole('button', { name: /Export/ })).toHaveAttribute(
        'title',
        'No runs to export',
      );
    });

    it('If the active language is English, Then session times are shown in 12-hour format', () => {
      // Arrange & Act
      render(<SessionDetailView sessionId={archivedSession.id} onBack={vi.fn()} />);

      // Assert
      expect(screen.getByText(/^0?2:05:06\sPM$/)).toBeInTheDocument();
      expect(screen.getByText(/^0?3:07:08\sPM$/)).toBeInTheDocument();
    });

    it('If the active language changes to Swedish, Then session times are shown in 24-hour format', async () => {
      // Arrange
      await i18n.changeLanguage('sv');

      // Act
      render(<SessionDetailView sessionId={archivedSession.id} onBack={vi.fn()} />);

      // Assert
      expect(screen.getByText('14:05:06')).toBeInTheDocument();
      expect(screen.getByText('15:07:08')).toBeInTheDocument();
    });
  });

  describe('When the session is missing', () => {
    it('Then the translated not-found state is shown', () => {
      // Arrange
      mockStoreState(mockUseRunTrackerStore, createStoreState({ sessions: [] }));

      // Act
      render(<SessionDetailView sessionId="missing" onBack={vi.fn()} />);

      // Assert
      expect(screen.getByText('Session Not Found')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Go Back' })).toBeInTheDocument();
    });
  });

  describe('When the active session is not in the loaded sessions list yet', () => {
    it('Then the active session details are shown instead of the not-found state', () => {
      // Arrange
      const activeSession: Session = { ...mockSession, id: 'session-live', endTime: undefined };
      mockStoreState(mockUseRunTrackerStore, createStoreState({ sessions: [], activeSession }));

      // Act
      render(<SessionDetailView sessionId="session-live" onBack={vi.fn()} />);

      // Assert
      expect(screen.getByText('Session Information')).toBeInTheDocument();
      expect(screen.queryByText('Session Not Found')).not.toBeInTheDocument();
    });
  });

  describe('When edited session notes lose focus', () => {
    it('Then the notes are saved for the session', async () => {
      // Arrange
      const updateSessionNotes = vi.fn().mockResolvedValue(true);
      mockStoreState(mockUseRunTrackerStore, createStoreState({ updateSessionNotes }));
      render(<SessionDetailView sessionId="session-1" onBack={vi.fn()} />);
      const textarea = screen.getByLabelText('Session Notes');

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
      render(<SessionDetailView sessionId="session-1" onBack={vi.fn()} />);
      const textarea = screen.getByLabelText('Session Notes');

      // Act
      fireEvent.change(textarea, { target: { value: 'Cow runs' } });
      fireEvent.blur(textarea);

      // Assert
      await waitFor(() => {
        expect(textarea).toHaveValue('');
      });
      expect(updateSessionNotes).toHaveBeenCalledTimes(1);
    });
  });

  describe('When the notes editor is shown', () => {
    it('Then it limits the notes to the maximum length the main process accepts', () => {
      // Arrange
      mockStoreState(mockUseRunTrackerStore, createStoreState());

      // Act
      render(<SessionDetailView sessionId="session-1" onBack={vi.fn()} />);

      // Assert
      expect(screen.getByLabelText('Session Notes')).toHaveAttribute(
        'maxlength',
        String(MAX_SESSION_NOTES_LENGTH),
      );
    });
  });

  describe('When the active session also exists in the loaded sessions list as a stale snapshot', () => {
    it('Then the live active session values are shown instead of the stale snapshot', () => {
      // Arrange
      const staleSession: Session = {
        ...mockSession,
        id: 'session-live',
        endTime: undefined,
        runCount: 3,
        totalRunTime: 300000,
        totalSessionTime: 600000,
        notes: 'stale notes',
      };
      const activeSession: Session = {
        ...staleSession,
        runCount: 7,
        totalRunTime: 900000,
        totalSessionTime: 1000000,
        notes: 'live notes',
      };
      mockStoreState(
        mockUseRunTrackerStore,
        createStoreState({ sessions: [staleSession], activeSession }),
      );

      // Act
      render(<SessionDetailView sessionId="session-live" onBack={vi.fn()} />);

      // Assert
      const runCountStat = screen.getByText('Run Count').parentElement as HTMLElement;
      expect(within(runCountStat).getByText('7')).toBeInTheDocument();
      expect(within(runCountStat).queryByText('3')).not.toBeInTheDocument();
      expect(screen.getByText('90.0%')).toBeInTheDocument();
      expect(screen.getByLabelText('Session Notes')).toHaveValue('live notes');
    });
  });
});
