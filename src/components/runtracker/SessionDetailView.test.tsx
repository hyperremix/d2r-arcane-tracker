import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Session } from 'electron/types/grail';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRunTrackerStore } from '@/stores/runTrackerStore';
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

const mockArchiveSession = vi.fn().mockResolvedValue(undefined);

const createStoreState = (overrides: Record<string, unknown> = {}) =>
  ({
    sessions: [mockSession],
    activeSession: null,
    runs: new Map([['session-1', []]]),
    sessionsLoading: false,
    pendingActions: {},
    archiveSession: mockArchiveSession,
    updateSessionNotes: vi.fn().mockResolvedValue(undefined),
    loadSessionRuns: vi.fn().mockResolvedValue(undefined),
    getSessionStats: vi.fn().mockReturnValue(null),
    ...overrides,
  }) as unknown as ReturnType<typeof useRunTrackerStore>;

describe('SessionDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRunTrackerStore.mockReturnValue(createStoreState());
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

  describe('If archiving is in flight', () => {
    it('Then the Archive Session button is disabled', () => {
      // Arrange
      mockUseRunTrackerStore.mockReturnValue(
        createStoreState({ pendingActions: { archiveSession: true } }),
      );

      // Act
      render(<SessionDetailView sessionId="session-1" onBack={vi.fn()} />);

      // Assert
      expect(screen.getByRole('button', { name: 'Archive Session' })).toBeDisabled();
    });
  });
});
