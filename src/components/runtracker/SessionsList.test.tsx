import { fireEvent, render, screen, within } from '@testing-library/react';
import type { Session } from 'electron/types/grail';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRunTrackerStore, useSessionStatsLookup } from '@/stores/runTrackerStore';
import { SessionsList } from './SessionsList';

vi.mock('@/stores/runTrackerStore');

function createSession(id: string, startHour: number, durationMinutes: number): Session {
  const startTime = new Date(2024, 0, 1, startHour, 0, 0);
  return {
    id,
    startTime,
    endTime: new Date(startTime.getTime() + durationMinutes * 60_000),
    totalRunTime: 0,
    totalSessionTime: durationMinutes * 60_000,
    runCount: 1,
    archived: false,
    created: startTime,
    lastUpdated: startTime,
  };
}

function setupRunTrackerStore(sessions: Session[]) {
  const storeState = {
    sessions,
    loading: false,
    runs: new Map(sessions.map((session) => [session.id, []])),
    loadSessionRuns: vi.fn().mockResolvedValue(undefined),
    loadingSessions: new Set<string>(),
  };
  vi.mocked(useSessionStatsLookup).mockReturnValue(() => undefined);
  vi.mocked(useRunTrackerStore).mockImplementation((selector?: unknown) => {
    if (typeof selector === 'function') {
      return (selector as (s: typeof storeState) => unknown)(storeState);
    }
    return storeState as unknown as ReturnType<typeof useRunTrackerStore>;
  });
}

describe('When SessionsList is rendered with previous sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupRunTrackerStore([createSession('s-1', 10, 30), createSession('s-2', 12, 90)]);
  });

  it('Then translated headings and labels are shown', () => {
    // Arrange & Act
    render(<SessionsList onSessionSelect={vi.fn()} />);

    // Assert
    expect(screen.getByText('Previous Sessions')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Show archived' })).toBeInTheDocument();
  });

  it('Then the show archived switch is labelled', () => {
    // Arrange & Act
    render(<SessionsList onSessionSelect={vi.fn()} />);

    // Assert
    expect(screen.getByLabelText('Show archived')).toHaveAttribute('role', 'switch');
  });

  it('Then the show archived wrapper opts out of the display title font with font-ui', () => {
    // Arrange & Act
    render(<SessionsList onSessionSelect={vi.fn()} />);

    // Assert
    const wrapper = screen.getByText('Show archived').parentElement;
    expect(wrapper).toHaveClass('font-ui', 'font-normal');
  });

  it('Then only the Date column sorts by start time, avoiding duplicate indicators', () => {
    // Arrange & Act
    render(<SessionsList onSessionSelect={vi.fn()} />);

    // Assert
    const dateHeader = screen.getByRole('columnheader', { name: 'Date' });
    const startTimeHeader = screen.getByRole('columnheader', { name: 'Start Time' });
    expect(dateHeader).toHaveAttribute('aria-sort', 'descending');
    expect(within(dateHeader).getByRole('button', { name: 'Date' })).toBeInTheDocument();
    expect(startTimeHeader).not.toHaveAttribute('aria-sort');
    expect(within(startTimeHeader).queryByRole('button')).not.toBeInTheDocument();
  });

  it('Then sort buttons are focusable and update aria-sort when activated', () => {
    // Arrange
    render(<SessionsList onSessionSelect={vi.fn()} />);
    const durationHeader = screen.getByRole('columnheader', { name: 'Duration' });
    const durationButton = within(durationHeader).getByRole('button', { name: 'Duration' });

    // Act
    durationButton.focus();
    fireEvent.click(durationButton);

    // Assert
    expect(durationButton).toHaveFocus();
    expect(durationHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(screen.getByRole('columnheader', { name: 'Date' })).toHaveAttribute('aria-sort', 'none');
  });

  it('Then each session row has a translated accessible name', () => {
    // Arrange & Act
    render(<SessionsList onSessionSelect={vi.fn()} />);

    // Assert
    expect(screen.getAllByRole('row', { name: /^View session from .+ details$/ })).toHaveLength(2);
  });
});

describe('When SessionsList is rendered without previous sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupRunTrackerStore([]);
  });

  it('Then the translated empty state is shown', () => {
    // Arrange & Act
    render(<SessionsList onSessionSelect={vi.fn()} />);

    // Assert
    expect(screen.getByText('No previous sessions')).toBeInTheDocument();
    expect(screen.getByText('Start a session to begin tracking your runs.')).toBeInTheDocument();
  });
});
