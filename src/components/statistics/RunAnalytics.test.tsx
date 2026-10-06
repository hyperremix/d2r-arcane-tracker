import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { RunStatistics } from 'electron/types/grail';
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
import { escapeCsvCell, RunAnalytics } from './RunAnalytics';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

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

describe('When escaping CSV cells', () => {
  it.each([
    ['plain text', 'Total Runs', 'Total Runs'],
    ['a number', 42, '42'],
    ['a comma', 'Runs, total', '"Runs, total"'],
    ['a double quote', 'The "best" run', '"The ""best"" run"'],
    ['a newline', 'line one\nline two', '"line one\nline two"'],
    ['a carriage return', 'line one\r\nline two', '"line one\r\nline two"'],
    ['a comma and a quote together', 'a,"b"', '"a,""b"""'],
  ])('If the cell contains %s, Then it is escaped for CSV', (_scenario, value, expected) => {
    // Arrange
    // (value and expected come from the scenario table)

    // Act
    const result = escapeCsvCell(value);

    // Assert
    expect(result).toBe(expected);
  });
});
