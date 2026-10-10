import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { RunStatistics, Session } from 'electron/types/grail';
import i18n from 'i18next';
import { toast } from 'sonner';
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
import { RunBuilder } from '@/fixtures';
import { translations } from '@/i18n/translations';
import { RunAnalytics } from './RunAnalytics';

vi.mock('sonner', () => import('@/test/sonnerMock'));

const fastestRunTimestamp = new Date('2024-01-01T00:00:00Z');
const slowestRunTimestamp = new Date('2024-01-02T00:00:00Z');

const mockStats: RunStatistics = {
  totalSessions: 3,
  totalRuns: 42,
  totalTime: 3_900_000,
  averageRunDuration: 95_000,
  fastestRun: { runId: 'run-1', duration: 60_000, timestamp: fastestRunTimestamp },
  slowestRun: { runId: 'run-2', duration: 180_000, timestamp: slowestRunTimestamp },
  itemsPerRun: 1.5,
};

const mockElectronAPI = {
  runTracker: {
    getOverallStatistics: vi.fn(),
    getAllSessions: vi.fn(),
    getRunsBySession: vi.fn(),
  },
  dialog: {
    showSaveDialog: vi.fn(),
    writeFile: vi.fn(),
  },
};

const originalElectronAPI: unknown = window.electronAPI;

// Assign rather than redefine: other suites define `window.electronAPI` as non-configurable.
function setElectronAPI(value: unknown) {
  (window as unknown as { electronAPI: unknown }).electronAPI = value;
  // No sessions by default, so the run duration chart shows its empty state
  mockElectronAPI.runTracker.getAllSessions.mockResolvedValue([]);
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

async function renderAndClickExport() {
  render(<RunAnalytics />);
  const exportButton = await screen.findByRole('button', { name: /Export Data/i });
  fireEvent.click(exportButton);
}

describe('When exporting run analytics', () => {
  let consoleErrorSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockElectronAPI.runTracker.getOverallStatistics.mockResolvedValue(mockStats);
    setElectronAPI(mockElectronAPI);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  afterAll(() => {
    setElectronAPI(originalElectronAPI);
  });

  it('If the user picks a location, Then the CSV is written and a success toast is shown', async () => {
    // Arrange
    mockElectronAPI.dialog.showSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: 'C:\\Users\\me\\Documents\\run-analytics.csv',
    });
    mockElectronAPI.dialog.writeFile.mockResolvedValue({ success: true });

    // Act
    await renderAndClickExport();

    // Assert
    await waitFor(() => expect(mockElectronAPI.dialog.writeFile).toHaveBeenCalledTimes(1));
    const [filePath, content] = mockElectronAPI.dialog.writeFile.mock.calls[0];
    expect(filePath).toBe('C:\\Users\\me\\Documents\\run-analytics.csv');
    expect(content).toBe(
      [
        'Metric,Value',
        'Total Sessions,3',
        'Total Runs,42',
        'Total Time,1h 5m',
        'Average Run Duration,1m 35s',
        'Items Per Run,1.50',
      ].join('\n'),
    );
    expect(mockElectronAPI.dialog.showSaveDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Export Analytics Data',
        filters: [{ name: 'CSV Files', extensions: ['csv'] }],
      }),
    );
    expect(toast.success).toHaveBeenCalledWith('Analytics data exported', {
      description: 'Saved to run-analytics.csv',
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('If a CSV label contains a comma and a double quote, Then the exported cell is quoted and escaped', async () => {
    // Arrange
    const labelKey = translations.statistics.runAnalytics.totalSessions;
    const originalLabel = i18n.t(labelKey);
    i18n.addResource('en', 'common', labelKey, 'Sessions, "all"');
    mockElectronAPI.dialog.showSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/tmp/run-analytics.csv',
    });
    mockElectronAPI.dialog.writeFile.mockResolvedValue({ success: true });

    try {
      // Act
      await renderAndClickExport();

      // Assert
      await waitFor(() => expect(mockElectronAPI.dialog.writeFile).toHaveBeenCalledTimes(1));
      const [, content] = mockElectronAPI.dialog.writeFile.mock.calls[0];
      expect(content.split('\n')[1]).toBe('"Sessions, ""all""",3');
    } finally {
      i18n.addResource('en', 'common', labelKey, originalLabel);
    }
  });

  it('If the save dialog is canceled, Then no file is written and no toast is shown', async () => {
    // Arrange
    mockElectronAPI.dialog.showSaveDialog.mockResolvedValue({ canceled: true });

    // Act
    await renderAndClickExport();

    // Assert
    await waitFor(() => expect(mockElectronAPI.dialog.showSaveDialog).toHaveBeenCalled());
    expect(mockElectronAPI.dialog.writeFile).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('If writing the file fails, Then an error toast is shown', async () => {
    // Arrange
    mockElectronAPI.dialog.showSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/readonly/run-analytics.csv',
    });
    mockElectronAPI.dialog.writeFile.mockRejectedValue(new Error('EACCES: permission denied'));

    // Act
    await renderAndClickExport();

    // Assert
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Failed to export analytics data', {
        description: 'EACCES: permission denied',
      }),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe('When run analytics are displayed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI.runTracker.getOverallStatistics.mockResolvedValue(mockStats);
    setElectronAPI(mockElectronAPI);
  });

  afterAll(() => {
    setElectronAPI(originalElectronAPI);
  });

  it('If statistics are loaded, Then durations use the shared formatter and dates use the app locale', async () => {
    // Arrange
    const formatWithAppLocale = (date: Date) =>
      new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(date);

    // Act
    render(<RunAnalytics />);

    // Assert
    expect(await screen.findByText('1m 35s')).toBeInTheDocument();
    expect(screen.getByText('1m')).toBeInTheDocument();
    expect(screen.getByText('3m')).toBeInTheDocument();
    expect(screen.getByText(formatWithAppLocale(fastestRunTimestamp))).toBeInTheDocument();
    expect(screen.getByText(formatWithAppLocale(slowestRunTimestamp))).toBeInTheDocument();
  });
});

describe('When displaying run analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setElectronAPI(mockElectronAPI);
  });

  afterAll(() => {
    setElectronAPI(originalElectronAPI);
  });

  it('If no runs have been tracked, Then the empty state is shown instead of zeroed statistics', async () => {
    // Arrange
    mockElectronAPI.runTracker.getOverallStatistics.mockResolvedValue({
      totalSessions: 1,
      totalRuns: 0,
      totalTime: 0,
      averageRunDuration: 0,
      itemsPerRun: 0,
    } satisfies RunStatistics);

    // Act
    render(<RunAnalytics />);

    // Assert
    expect(await screen.findByRole('heading', { name: 'No Data Available' })).toBeInTheDocument();
    expect(
      screen.getByText('Start tracking runs to see analytics and statistics.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Fastest Run')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Export Data/i })).not.toBeInTheDocument();
  });

  it('If runs exist but none has been completed, Then the performance highlights are hidden', async () => {
    // Arrange
    mockElectronAPI.runTracker.getOverallStatistics.mockResolvedValue({
      ...mockStats,
      totalRuns: 1,
      averageRunDuration: 0,
      fastestRun: undefined,
      slowestRun: undefined,
    } satisfies RunStatistics);

    // Act
    render(<RunAnalytics />);

    // Assert
    expect(await screen.findByText('Total Sessions')).toBeInTheDocument();
    expect(screen.queryByText('Performance Highlights')).not.toBeInTheDocument();
    expect(screen.queryByText('Fastest Run')).not.toBeInTheDocument();
  });

  it('If runs have been completed, Then the fastest and slowest runs are shown without a duplicate efficiency card', async () => {
    // Arrange
    mockElectronAPI.runTracker.getOverallStatistics.mockResolvedValue(mockStats);

    // Act
    render(<RunAnalytics />);

    // Assert
    expect(await screen.findByText('Performance Highlights')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Fastest Run' })).toBeInTheDocument();
    expect(screen.getByText('1m')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Slowest Run' })).toBeInTheDocument();
    expect(screen.getByText('3m')).toBeInTheDocument();
    expect(screen.getByText('1.50')).toBeInTheDocument();
    expect(screen.queryByText('Overall Efficiency')).not.toBeInTheDocument();
  });
});

describe('When run analytics show their headline statistics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setElectronAPI(mockElectronAPI);
    mockElectronAPI.runTracker.getOverallStatistics.mockResolvedValue(mockStats);
  });

  afterAll(() => {
    setElectronAPI(originalElectronAPI);
  });

  it('If statistics are loaded, Then items per run is described as an average of items found', async () => {
    // Arrange & Act
    render(<RunAnalytics />);

    // Assert
    expect(await screen.findByText('Average items found per run')).toBeInTheDocument();
    expect(screen.queryByText('Average efficiency')).not.toBeInTheDocument();
  });

  it('If the language changes the time units, Then the total time uses the translated units', async () => {
    // Arrange
    const key = translations.statistics.runAnalytics.hoursMinutes;
    const original = i18n.t(key);
    i18n.addResource('en', 'common', key, '{{hours}} Std. {{minutes}} Min.');

    try {
      // Act
      render(<RunAnalytics />);

      // Assert
      expect(await screen.findByText('1 Std. 5 Min.')).toBeInTheDocument();
    } finally {
      i18n.addResource('en', 'common', key, original);
    }
  });
});

describe('When run analytics show the run durations by session', () => {
  let consoleErrorSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    setElectronAPI(mockElectronAPI);
    mockElectronAPI.runTracker.getOverallStatistics.mockResolvedValue(mockStats);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  afterAll(() => {
    setElectronAPI(originalElectronAPI);
  });

  it('If sessions have completed runs, Then the chart summarizes the median trend of the most recent sessions', async () => {
    // Arrange
    mockElectronAPI.runTracker.getAllSessions.mockResolvedValue([
      buildSession('newer', new Date(2026, 9, 9, 20), 2),
      buildSession('empty', new Date(2026, 9, 10, 20), 0),
      buildSession('older', new Date(2026, 9, 1, 20), 2),
    ]);
    mockElectronAPI.runTracker.getRunsBySession.mockImplementation(async (sessionId: string) =>
      (sessionId === 'older' ? [100_000, 140_000] : [80_000, 100_000]).map((duration, index) =>
        RunBuilder.new().withId(`${sessionId}-${index}`).withDuration(duration).build(),
      ),
    );

    // Act
    render(<RunAnalytics />);

    // Assert
    expect(
      await screen.findByRole('img', {
        name: 'Run durations of your last 2 sessions with completed runs: the median run went from 2:00 in the earliest to 1:30 in the latest',
      }),
    ).toBeInTheDocument();
    expect(mockElectronAPI.runTracker.getAllSessions).toHaveBeenCalledWith(false);
    expect(mockElectronAPI.runTracker.getRunsBySession).not.toHaveBeenCalledWith('empty');
    const table = screen.getByRole('table', { name: 'Run Durations by Session' });
    expect(within(table).getAllByRole('row')).toHaveLength(3);
  });

  it('If no session has a completed run, Then the chart shows an empty state', async () => {
    // Arrange
    mockElectronAPI.runTracker.getAllSessions.mockResolvedValue([]);

    // Act
    render(<RunAnalytics />);

    // Assert
    expect(await screen.findByText('No completed runs yet')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('If loading the run durations fails, Then only the chart shows an error with a retry', async () => {
    // Arrange
    mockElectronAPI.runTracker.getAllSessions.mockRejectedValue(new Error('database locked'));

    // Act
    render(<RunAnalytics />);

    // Assert
    expect(await screen.findByText('Could not load the run durations')).toBeInTheDocument();
    expect(screen.getByText('Total Sessions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
