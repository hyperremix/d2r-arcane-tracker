import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
import { useGrailStore } from '@/stores/grailStore';
import { mockStoreState } from '@/test/storeMock';
import { DatabaseCard } from './Database';

vi.mock('sonner', () => import('@/test/sonnerMock'));

vi.mock('@/stores/grailStore');

const mockReloadData = vi.fn();

const mockElectronAPI = {
  dialog: {
    showSaveDialog: vi.fn(),
    showOpenDialog: vi.fn(),
  },
  grail: {
    backup: vi.fn(),
    restore: vi.fn(),
    restoreFromBuffer: vi.fn(),
  },
};

const originalElectronAPI: unknown = window.electronAPI;

// Assign rather than redefine: other suites define `window.electronAPI` as non-configurable.
function setElectronAPI(value: unknown) {
  (window as unknown as { electronAPI: unknown }).electronAPI = value;
}

async function openRestoreConfirmation() {
  mockElectronAPI.dialog.showOpenDialog.mockResolvedValue({
    canceled: false,
    filePaths: ['/backups/holy-grail-backup.db'],
  });
  fireEvent.click(screen.getByRole('button', { name: /click to browse/i }));
  return screen.findByRole('button', { name: 'Back up first' });
}

describe('When managing database backups', () => {
  let consoleErrorSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockStoreState(vi.mocked(useGrailStore), { reloadData: mockReloadData });
    mockReloadData.mockResolvedValue(undefined);
    setElectronAPI(mockElectronAPI);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  afterAll(() => {
    setElectronAPI(originalElectronAPI);
  });

  it('If the backup succeeds on Windows, Then a success toast and the file name are shown', async () => {
    // Arrange
    mockElectronAPI.dialog.showSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: 'C:\\Users\\me\\Documents\\holy-grail-backup.db',
    });
    mockElectronAPI.grail.backup.mockResolvedValue({ success: true });
    render(<DatabaseCard />);

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Backup Database' }));

    // Assert
    expect(await screen.findByText('Last backup: holy-grail-backup.db')).toBeInTheDocument();
    expect(mockElectronAPI.grail.backup).toHaveBeenCalledWith(
      'C:\\Users\\me\\Documents\\holy-grail-backup.db',
    );
    expect(toast.success).toHaveBeenCalledWith('Database backed up', {
      description: 'Saved to holy-grail-backup.db',
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('If the backup throws, Then an error toast is shown', async () => {
    // Arrange
    mockElectronAPI.dialog.showSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/backups/holy-grail-backup.db',
    });
    mockElectronAPI.grail.backup.mockRejectedValue(new Error('Disk full'));
    render(<DatabaseCard />);

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Backup Database' }));

    // Assert
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Failed to back up database', {
        description: 'Disk full',
      }),
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByText(/Last backup:/)).not.toBeInTheDocument();
  });

  it('If the backup reports failure, Then an error toast is shown', async () => {
    // Arrange
    mockElectronAPI.dialog.showSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/backups/holy-grail-backup.db',
    });
    mockElectronAPI.grail.backup.mockResolvedValue({ success: false });
    render(<DatabaseCard />);

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Backup Database' }));

    // Assert
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to back up database'));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('If "Back up first" is clicked in the restore confirmation, Then the backup runs and the user can continue restoring', async () => {
    // Arrange
    mockElectronAPI.dialog.showSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/backups/pre-restore.db',
    });
    mockElectronAPI.grail.backup.mockResolvedValue({ success: true });
    mockElectronAPI.grail.restore.mockResolvedValue({ success: true });
    render(<DatabaseCard />);
    const backupFirstButton = await openRestoreConfirmation();

    // Act
    fireEvent.click(backupFirstButton);

    // Assert
    expect(
      await screen.findByText('Backup created. You can now continue with the restore.'),
    ).toBeInTheDocument();
    expect(mockElectronAPI.grail.backup).toHaveBeenCalledWith('/backups/pre-restore.db');
    expect(mockElectronAPI.grail.restore).not.toHaveBeenCalled();

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Restore Database' }));

    // Assert
    await waitFor(() =>
      expect(mockElectronAPI.grail.restore).toHaveBeenCalledWith('/backups/holy-grail-backup.db'),
    );
  });

  it('If "Back up first" is canceled, Then the restore confirmation stays open without a continue message', async () => {
    // Arrange
    mockElectronAPI.dialog.showSaveDialog.mockResolvedValue({ canceled: true });
    render(<DatabaseCard />);
    const backupFirstButton = await openRestoreConfirmation();

    // Act
    fireEvent.click(backupFirstButton);

    // Assert
    await waitFor(() => expect(mockElectronAPI.dialog.showSaveDialog).toHaveBeenCalled());
    expect(mockElectronAPI.grail.backup).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Back up first' })).toBeEnabled();
    expect(
      screen.queryByText('Backup created. You can now continue with the restore.'),
    ).not.toBeInTheDocument();
  });

  it('If a backup is in flight from the restore confirmation, Then Restore, Cancel and Back up first are disabled', async () => {
    // Arrange
    let finishBackup: (value: { success: boolean }) => void = () => undefined;
    mockElectronAPI.dialog.showSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/backups/pre-restore.db',
    });
    mockElectronAPI.grail.backup.mockReturnValue(
      new Promise<{ success: boolean }>((resolve) => {
        finishBackup = resolve;
      }),
    );
    render(<DatabaseCard />);
    const backupFirstButton = await openRestoreConfirmation();

    // Act
    fireEvent.click(backupFirstButton);

    // Assert
    await waitFor(() => expect(mockElectronAPI.grail.backup).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Restore Database' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    const inFlightButtons = screen.getAllByRole('button', { name: 'Creating Backup...' });
    expect(inFlightButtons.length).toBeGreaterThan(0);
    for (const button of inFlightButtons) {
      expect(button).toBeDisabled();
    }

    // Act
    finishBackup({ success: true });

    // Assert
    expect(await screen.findByRole('button', { name: 'Restore Database' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Back up first' })).toBeEnabled();
  });

  it('When a backup file is chosen for restore, Then the confirmation names the file and states what is replaced', async () => {
    // Arrange
    render(<DatabaseCard />);

    // Act
    await openRestoreConfirmation();

    // Assert
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText('holy-grail-backup.db')).toBeInTheDocument();
    expect(dialog).toHaveTextContent('vaulted items');
    expect(dialog).not.toHaveTextContent('⚠️');
  });

  it('If a restore fails, Then a translated error is shown', async () => {
    // Arrange
    mockElectronAPI.grail.restore.mockResolvedValue({ success: false });
    render(<DatabaseCard />);
    await openRestoreConfirmation();

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Restore Database' }));

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to restore database');
  });
});
