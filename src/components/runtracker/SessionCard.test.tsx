import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Session } from 'electron/types/grail';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRunTrackerStore } from '@/stores/runTrackerStore';
import { SessionCard } from './SessionCard';

vi.mock('@/stores/runTrackerStore');
vi.mock('./ExportDialog', () => ({
  ExportDialog: () => null,
}));

const mockUseRunTrackerStore = vi.mocked(useRunTrackerStore);

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
    archiveSession: mockArchiveSession,
    endSession: mockEndSession,
    startSession: mockStartSession,
    updateSessionNotes: vi.fn().mockResolvedValue(undefined),
    getSessionStats: vi.fn().mockReturnValue(null),
    ...overrides,
  }) as unknown as ReturnType<typeof useRunTrackerStore>;

describe('SessionCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRunTrackerStore.mockReturnValue(createStoreState());
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
      mockUseRunTrackerStore.mockReturnValue(
        createStoreState({ pendingActions: { archiveSession: true } }),
      );

      // Act
      render(<SessionCard session={mockSession} />);

      // Assert
      expect(screen.getByRole('button', { name: 'Archive Session' })).toBeDisabled();
    });
  });

  describe('If starting a session is in flight', () => {
    it('Then the Start New Session button is disabled', () => {
      // Arrange
      mockUseRunTrackerStore.mockReturnValue(
        createStoreState({ activeSession: null, pendingActions: { startSession: true } }),
      );

      // Act
      render(<SessionCard session={null} />);

      // Assert
      expect(screen.getByRole('button', { name: 'Start New Session' })).toBeDisabled();
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
      mockUseRunTrackerStore.mockReturnValue(createStoreState({ activeSession: emptySession }));

      // Act
      render(<SessionCard session={emptySession} />);

      // Assert
      const exportButton = screen.getByRole('button', { name: 'Export session data' });
      expect(exportButton).toHaveAttribute('title', 'No runs to export');
      expect(exportButton).toBeDisabled();
    });
  });
});
