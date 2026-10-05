import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
import { ExportDialog } from './index';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('./formatters', () => ({
  formatSessionAsCSV: vi.fn(() => 'csv-content'),
  formatSessionAsJSON: vi.fn(() => 'json-content'),
  formatSessionAsTextSummary: vi.fn(() => 'text-content'),
}));

const mockSession = {
  id: 'session-12345678',
  startTime: new Date('2024-01-01T00:00:00Z'),
};

const mockRuns = [{ id: 'run-1', sessionId: 'session-12345678' }];

const mockElectronAPI = {
  runTracker: {
    getSessionById: vi.fn(),
    getRunsBySession: vi.fn(),
    getSessionItems: vi.fn(),
  },
  dialog: {
    showSaveDialog: vi.fn(),
    writeFile: vi.fn(),
  },
};

const mockClipboard = {
  writeText: vi.fn(),
};

const originalElectronAPI: unknown = window.electronAPI;

// Assign rather than redefine: other suites define `window.electronAPI` as non-configurable.
function setElectronAPI(value: unknown) {
  (window as unknown as { electronAPI: unknown }).electronAPI = value;
}
const originalClipboard = navigator.clipboard;

function renderDialog(onOpenChange = vi.fn()) {
  render(<ExportDialog sessionId="session-12345678" open onOpenChange={onOpenChange} />);
  return { onOpenChange };
}

async function waitForExportReady(buttonName: RegExp) {
  const button = await screen.findByRole('button', { name: buttonName });
  await waitFor(() => expect(button).toBeEnabled());
  return button;
}

describe('When using the session export dialog', () => {
  let consoleErrorSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockElectronAPI.runTracker.getSessionById.mockResolvedValue(mockSession);
    mockElectronAPI.runTracker.getRunsBySession.mockResolvedValue(mockRuns);
    mockElectronAPI.runTracker.getSessionItems.mockResolvedValue([]);
    setElectronAPI(mockElectronAPI);
    Object.defineProperty(navigator, 'clipboard', {
      value: mockClipboard,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  afterAll(() => {
    setElectronAPI(originalElectronAPI);
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
  });

  it('If saving to a file succeeds, Then the file is written, a success toast is shown and the dialog closes', async () => {
    // Arrange
    mockElectronAPI.dialog.showSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: 'C:\\exports\\session.csv',
    });
    mockElectronAPI.dialog.writeFile.mockResolvedValue({ success: true });
    const { onOpenChange } = renderDialog();
    const saveButton = await waitForExportReady(/Save to File/i);

    // Act
    fireEvent.click(saveButton);

    // Assert
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(mockElectronAPI.dialog.writeFile).toHaveBeenCalledWith(
      'C:\\exports\\session.csv',
      'csv-content',
    );
    expect(toast.success).toHaveBeenCalledWith('Session data exported', {
      description: 'Saved to session.csv',
    });
  });

  it('If saving to a file fails, Then the dialog stays open with an inline error and the form intact', async () => {
    // Arrange
    mockElectronAPI.dialog.showSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/readonly/session.csv',
    });
    mockElectronAPI.dialog.writeFile.mockRejectedValue(new Error('EACCES: permission denied'));
    const { onOpenChange } = renderDialog();
    const saveButton = await waitForExportReady(/Save to File/i);

    // Act
    fireEvent.click(saveButton);

    // Assert
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Failed to save file');
    expect(alert).toHaveTextContent('EACCES: permission denied');
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByText('Export Format')).toBeInTheDocument();
    expect(screen.getByText('Include items found during runs')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save to File/i })).toBeEnabled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('If the save dialog is canceled, Then nothing is written and the dialog stays open', async () => {
    // Arrange
    mockElectronAPI.dialog.showSaveDialog.mockResolvedValue({ canceled: true });
    const { onOpenChange } = renderDialog();
    const saveButton = await waitForExportReady(/Save to File/i);

    // Act
    fireEvent.click(saveButton);

    // Assert
    await waitFor(() => expect(mockElectronAPI.dialog.showSaveDialog).toHaveBeenCalled());
    expect(mockElectronAPI.dialog.writeFile).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('If copying to the clipboard succeeds, Then a success toast is shown', async () => {
    // Arrange
    mockClipboard.writeText.mockResolvedValue(undefined);
    renderDialog();
    const copyButton = await waitForExportReady(/Copy to Clipboard/i);

    // Act
    fireEvent.click(copyButton);

    // Assert
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Copied to clipboard'));
    expect(mockClipboard.writeText).toHaveBeenCalledWith('csv-content');
  });

  it('If copying to the clipboard fails, Then an inline error is shown and the form is kept', async () => {
    // Arrange
    mockClipboard.writeText.mockRejectedValue(new Error('Clipboard unavailable'));
    renderDialog();
    const copyButton = await waitForExportReady(/Copy to Clipboard/i);

    // Act
    fireEvent.click(copyButton);

    // Assert
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Failed to copy to clipboard');
    expect(screen.getByRole('button', { name: /Copy to Clipboard/i })).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('If the session cannot be loaded, Then an inline error is shown inside the dialog', async () => {
    // Arrange
    mockElectronAPI.runTracker.getSessionById.mockRejectedValue(new Error('DB locked'));

    // Act
    renderDialog();

    // Assert
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Failed to load session data');
    expect(alert).toHaveTextContent('DB locked');
    expect(screen.getByText('Export Format')).toBeInTheDocument();
  });
});
