import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { RunStatistics } from 'electron/types/grail';
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
import { translations } from '@/i18n/translations';
import { RunAnalytics } from './RunAnalytics';

vi.mock('sonner', () => import('@/test/sonnerMock'));

const mockStats: RunStatistics = {
  totalSessions: 3,
  totalRuns: 42,
  totalTime: 3_900_000,
  averageRunDuration: 95_000,
  fastestRun: { runId: 'run-1', duration: 60_000, timestamp: new Date('2024-01-01T00:00:00Z') },
  slowestRun: { runId: 'run-2', duration: 180_000, timestamp: new Date('2024-01-02T00:00:00Z') },
  itemsPerRun: 1.5,
};

const mockElectronAPI = {
  runTracker: {
    getOverallStatistics: vi.fn(),
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
        'Average Run Duration,1:35',
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
    expect(screen.getByText('1:00')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Slowest Run' })).toBeInTheDocument();
    expect(screen.getByText('3:00')).toBeInTheDocument();
    expect(screen.getByText('1.50')).toBeInTheDocument();
    expect(screen.queryByText('Overall Efficiency')).not.toBeInTheDocument();
  });
});
