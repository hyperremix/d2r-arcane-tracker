import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Session } from 'electron/types/grail';
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import type { SessionDurationSummary } from '@/components/statistics/chartData';
import { RunDurationCard, RunDurationChart } from '@/components/statistics/RunDurationChart';
import { RunBuilder } from '@/fixtures';

const mockElectronAPI = {
  runTracker: {
    getAllSessions: vi.fn(),
    getRunsBySession: vi.fn(),
  },
};

const originalElectronAPI: unknown = window.electronAPI;

// Assign rather than redefine: other suites define `window.electronAPI` as non-configurable.
function setElectronAPI(value: unknown) {
  (window as unknown as { electronAPI: unknown }).electronAPI = value;
}

function buildSession(id: string, startTime: Date, runCount: number): Session {
  return {
    id,
    startTime,
    totalRunTime: 0,
    totalSessionTime: 0,
    runCount,
    archived: false,
    created: startTime,
    lastUpdated: startTime,
  };
}

function buildSummary(index: number, median: number): SessionDurationSummary {
  return {
    sessionId: `s${index}`,
    startTime: new Date(2026, 9, index + 1, 12),
    runCount: 3,
    fastest: median - 20_000,
    lowerQuartile: median - 10_000,
    median,
    upperQuartile: median + 10_000,
    slowest: median + 20_000,
  };
}

function mockRuns(durationsBySession: Record<string, number[]>) {
  mockElectronAPI.runTracker.getRunsBySession.mockImplementation(async (sessionId: string) =>
    (durationsBySession[sessionId] ?? []).map((duration, index) =>
      RunBuilder.new().withId(`${sessionId}-${index}`).withDuration(duration).build(),
    ),
  );
}

describe('When the run duration card loads its sessions', () => {
  let consoleErrorSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    setElectronAPI(mockElectronAPI);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  afterAll(() => {
    setElectronAPI(originalElectronAPI);
  });

  it('If more than 12 sessions have completed runs, Then the 12 most recent are drawn from oldest to newest', async () => {
    // Arrange
    const sessions = Array.from({ length: 15 }, (_, index) =>
      buildSession(`s${index}`, new Date(2026, 8, index + 1, 12), 1),
    );
    mockElectronAPI.runTracker.getAllSessions.mockResolvedValue(sessions);
    mockRuns(Object.fromEntries(sessions.map((session) => [session.id, [60_000]])));

    // Act
    render(<RunDurationCard />);

    // Assert
    const table = await screen.findByRole('table', { name: 'Run Durations by Session' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(13);
    expect(rows[1]).toHaveTextContent('Sep 4, 2026');
    expect(rows[12]).toHaveTextContent('Sep 15, 2026');
  });

  it('If recent sessions only have a run in progress, Then they do not use up the 12 sessions', async () => {
    // Arrange
    const completed = Array.from({ length: 12 }, (_, index) =>
      buildSession(`done${index}`, new Date(2026, 8, index + 1, 12), 1),
    );
    const inProgress = Array.from({ length: 3 }, (_, index) =>
      buildSession(`open${index}`, new Date(2026, 9, index + 1, 12), 1),
    );
    mockElectronAPI.runTracker.getAllSessions.mockResolvedValue([...completed, ...inProgress]);
    mockRuns(Object.fromEntries(completed.map((session) => [session.id, [60_000]])));

    // Act
    render(<RunDurationCard />);

    // Assert
    const table = await screen.findByRole('table', { name: 'Run Durations by Session' });
    expect(within(table).getAllByRole('row')).toHaveLength(13);
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('Sep 1, 2026');
  });

  it('If a session has a single completed run, Then the summary names the only session', async () => {
    // Arrange
    mockElectronAPI.runTracker.getAllSessions.mockResolvedValue([
      buildSession('only', new Date(2026, 9, 1, 12), 1),
    ]);
    mockRuns({ only: [95_000] });

    // Act
    render(<RunDurationCard />);

    // Assert
    expect(
      await screen.findByRole('img', {
        name: 'Run durations of your only session with completed runs: median run 1:35',
      }),
    ).toBeInTheDocument();
  });

  it('If loading fails and the user clicks Retry, Then the chart loads the sessions again', async () => {
    // Arrange
    mockElectronAPI.runTracker.getAllSessions.mockRejectedValueOnce(new Error('database locked'));
    mockElectronAPI.runTracker.getAllSessions.mockResolvedValue([
      buildSession('only', new Date(2026, 9, 1, 12), 1),
    ]);
    mockRuns({ only: [95_000] });
    render(<RunDurationCard />);
    const retry = await screen.findByRole('button', { name: 'Retry' });

    // Act
    fireEvent.click(retry);

    // Assert
    expect(
      await screen.findByRole('img', { name: /^Run durations of your only session/ }),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    await waitFor(() => expect(mockElectronAPI.runTracker.getAllSessions).toHaveBeenCalledTimes(2));
  });
});

describe('When the run duration chart is rendered', () => {
  it('If the user moves through the chart with the keyboard, Then the tooltip follows Home, End, ArrowLeft, ArrowRight and Escape', () => {
    // Arrange
    render(
      <RunDurationChart
        summaries={[buildSummary(0, 60_000), buildSummary(1, 90_000), buildSummary(2, 120_000)]}
      />,
    );
    const chart = screen.getByRole('img', { name: /^Run durations of your last 3 sessions/ });
    const tooltip = () => screen.getByTestId('chart-tooltip');

    // Act & Assert
    fireEvent.focus(chart);
    expect(tooltip()).toHaveTextContent('Oct 3, 2026');
    expect(tooltip()).toHaveTextContent('Median run2:00');
    fireEvent.keyDown(chart, { key: 'ArrowLeft' });
    expect(tooltip()).toHaveTextContent('Median run1:30');
    fireEvent.keyDown(chart, { key: 'Home' });
    expect(tooltip()).toHaveTextContent('Median run1:00');
    fireEvent.keyDown(chart, { key: 'ArrowRight' });
    expect(tooltip()).toHaveTextContent('Median run1:30');
    fireEvent.keyDown(chart, { key: 'End' });
    expect(tooltip()).toHaveTextContent('Median run2:00');
    fireEvent.keyDown(chart, { key: 'Escape' });
    expect(screen.queryByTestId('chart-tooltip')).not.toBeInTheDocument();
  });
});
