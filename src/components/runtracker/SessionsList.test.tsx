import { fireEvent, render, screen, within } from '@testing-library/react';
import type { Session } from 'electron/types/grail';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    expect(screen.getByText('Previous sessions')).toBeInTheDocument();
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
    const startTimeHeader = screen.getByRole('columnheader', { name: 'Start time' });
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

  it('Then sessions older than a week show a compact date instead of the full weekday date', () => {
    // Arrange & Act
    render(<SessionsList onSessionSelect={vi.fn()} />);

    // Assert
    expect(screen.getAllByRole('cell', { name: 'Jan 1, 2024' })).toHaveLength(2);
    expect(screen.queryByText('Monday, January 1, 2024')).not.toBeInTheDocument();
  });

  it('Then time columns use tabular numerals instead of a monospace font', () => {
    // Arrange & Act
    render(<SessionsList onSessionSelect={vi.fn()} />);

    // Assert
    const [firstRow] = screen.getAllByRole('row', { name: /^View session from .+ details$/ });
    const [, startCell, endCell, durationCell] = within(firstRow).getAllByRole('cell');
    expect(startCell).toHaveClass('tabular-nums');
    expect(startCell).not.toHaveClass('font-mono');
    expect(endCell).toHaveClass('tabular-nums');
    expect(endCell).not.toHaveClass('font-mono');
    expect(durationCell).toHaveClass('tabular-nums');
    expect(durationCell).not.toHaveClass('font-mono');
  });
});

describe('When SessionsList shows the day of a recent session', () => {
  // A fixed "now" (local time) keeps the relative day labels deterministic
  const now = new Date(2024, 0, 15, 12, 0, 0);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ['earlier today', new Date(2024, 0, 15, 8, 0, 0), 'Today'],
    ['the previous calendar day', new Date(2024, 0, 14, 20, 0, 0), 'Yesterday'],
    ['3 days ago', new Date(2024, 0, 12, 12, 0, 0), '3 days ago'],
    ['6 days ago (last day with a relative label)', new Date(2024, 0, 9, 12, 0, 0), '6 days ago'],
    ['7 days ago (first day with a compact date)', new Date(2024, 0, 8, 12, 0, 0), 'Jan 8, 2024'],
  ])('If the session started %s, Then the date cell reads "%s"', (_name, startTime, expected) => {
    // Arrange
    const session = createSession('s-recent', 0, 30);
    session.startTime = startTime;
    session.endTime = new Date(startTime.getTime() + 30 * 60_000);
    setupRunTrackerStore([session]);

    // Act
    render(<SessionsList onSessionSelect={vi.fn()} />);

    // Assert
    expect(screen.getByRole('cell', { name: expected })).toBeInTheDocument();
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
