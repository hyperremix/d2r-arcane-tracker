import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { GameMode } from 'electron/types/grail';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { useGrailStore } from '@/stores/grailStore';
import { SaveFileMonitor } from './SaveFileMonitor';

vi.mock('sonner', () => import('@/test/sonnerMock'));

vi.mock('@/stores/grailStore');

const mockUseGrailStore = vi.mocked(useGrailStore);
const mockReloadData = vi.fn();

function mockGameMode(gameMode: GameMode) {
  mockUseGrailStore.mockReturnValue({
    reloadData: mockReloadData,
    settings: { gameMode },
  } as unknown as ReturnType<typeof useGrailStore>);
}

const CURRENT_DIRECTORY = '/saves/current';
const NEW_DIRECTORY = '/saves/new';
const DEFAULT_DIRECTORY = '/saves/default';

interface MockElectronAPI {
  dialog: {
    showOpenDialog: ReturnType<typeof vi.fn>;
    showSaveDialog: ReturnType<typeof vi.fn>;
  };
  grail: {
    getCharacters: ReturnType<typeof vi.fn>;
    getProgress: ReturnType<typeof vi.fn>;
    backup: ReturnType<typeof vi.fn>;
  };
  saveFile: {
    getMonitoringStatus: ReturnType<typeof vi.fn>;
    getSaveFiles: ReturnType<typeof vi.fn>;
    stopMonitoring: ReturnType<typeof vi.fn>;
    getDefaultDirectory: ReturnType<typeof vi.fn>;
    updateSaveDirectory: ReturnType<typeof vi.fn>;
    restoreDefaultDirectory: ReturnType<typeof vi.fn>;
  };
}

// Other suites define a non-configurable `window.electronAPI` (vitest runs with isolate: false),
// so it is replaced by assignment rather than vi.stubGlobal, and restored after each test.
const windowGlobals = window as unknown as Record<string, unknown>;
const stubbedKeys = ['electronAPI', 'ipcRenderer'] as const;
const originalDescriptors = new Map<string, PropertyDescriptor | undefined>();

function getElectronAPI(): MockElectronAPI {
  return windowGlobals.electronAPI as MockElectronAPI;
}

/**
 * Sets up a monitored directory and whether the database holds user data.
 */
function arrangeMonitoredDirectory(hasUserData: boolean) {
  const api = getElectronAPI();
  api.saveFile.getMonitoringStatus.mockResolvedValue({
    isMonitoring: true,
    directory: CURRENT_DIRECTORY,
  });
  api.grail.getCharacters.mockResolvedValue(hasUserData ? [{ id: 'char-1' }] : []);
  api.grail.getProgress.mockResolvedValue([]);
}

async function renderWithLoadedDirectory() {
  render(<SaveFileMonitor />);
  await screen.findByText(CURRENT_DIRECTORY);
}

function pickFolder(directory: string) {
  getElectronAPI().dialog.showOpenDialog.mockResolvedValue({
    canceled: false,
    filePaths: [directory],
  });
  fireEvent.click(screen.getByRole('button', { name: 'Change Directory' }));
}

describe('SaveFileMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of stubbedKeys) {
      originalDescriptors.set(key, Object.getOwnPropertyDescriptor(window, key));
    }
    mockReloadData.mockResolvedValue(undefined);
    windowGlobals.electronAPI = {
      dialog: {
        showOpenDialog: vi.fn().mockResolvedValue({ canceled: true, filePaths: [] }),
        showSaveDialog: vi.fn().mockResolvedValue({ canceled: true }),
      },
      grail: {
        getCharacters: vi.fn().mockResolvedValue([]),
        getProgress: vi.fn().mockResolvedValue([]),
        backup: vi.fn().mockResolvedValue({ success: true }),
      },
      saveFile: {
        getMonitoringStatus: vi.fn().mockResolvedValue({ isMonitoring: false, directory: null }),
        getSaveFiles: vi.fn().mockResolvedValue([]),
        stopMonitoring: vi.fn().mockResolvedValue(undefined),
        getDefaultDirectory: vi.fn().mockResolvedValue(DEFAULT_DIRECTORY),
        updateSaveDirectory: vi.fn().mockResolvedValue({ success: true }),
        restoreDefaultDirectory: vi
          .fn()
          .mockResolvedValue({ success: true, defaultDirectory: DEFAULT_DIRECTORY }),
      },
    };
    windowGlobals.ipcRenderer = { on: vi.fn(), off: vi.fn() };
  });

  afterEach(() => {
    for (const key of stubbedKeys) {
      const original = originalDescriptors.get(key);
      if (original && 'value' in original) {
        windowGlobals[key] = original.value;
      } else {
        delete windowGlobals[key];
      }
    }
  });

  describe('manual mode notice', () => {
    it('When game mode is manual, then the notice is a polite status and not an assertive alert', async () => {
      // Arrange
      mockGameMode(GameMode.Manual);

      // Act
      render(<SaveFileMonitor />);

      // Assert
      await waitFor(() => expect(window.electronAPI?.saveFile.getSaveFiles).toHaveBeenCalled());
      const notice = screen.getByText(/Manual Mode Active:/).closest('[data-slot="alert"]');
      expect(notice).toHaveAttribute('role', 'status');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('If game mode is not manual, then the notice is not rendered', async () => {
      // Arrange
      mockGameMode(GameMode.Both);

      // Act
      render(<SaveFileMonitor />);

      // Assert
      await waitFor(() => expect(window.electronAPI?.saveFile.getSaveFiles).toHaveBeenCalled());
      expect(screen.queryByText(/Manual Mode Active:/)).not.toBeInTheDocument();
    });
  });

  describe('changing the save directory', () => {
    let consoleErrorSpy: MockInstance;

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      mockGameMode(GameMode.Both);
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('When the picked folder is already monitored, then no confirmation is shown and an info toast explains nothing changed', async () => {
      // Arrange
      arrangeMonitoredDirectory(true);
      await renderWithLoadedDirectory();

      // Act
      pickFolder(`${CURRENT_DIRECTORY}/`);

      // Assert
      await waitFor(() =>
        expect(toast.info).toHaveBeenCalledWith('Save folder unchanged', {
          description: `${CURRENT_DIRECTORY}/ is already the monitored folder.`,
        }),
      );
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(getElectronAPI().saveFile.updateSaveDirectory).not.toHaveBeenCalled();
    });

    it('When restoring the default while already on the default, then nothing is deleted and no confirmation is shown', async () => {
      // Arrange
      arrangeMonitoredDirectory(true);
      getElectronAPI().saveFile.getDefaultDirectory.mockResolvedValue(CURRENT_DIRECTORY);
      await renderWithLoadedDirectory();

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Restore Default' }));

      // Assert
      await waitFor(() => expect(toast.info).toHaveBeenCalled());
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(getElectronAPI().saveFile.restoreDefaultDirectory).not.toHaveBeenCalled();
    });

    it('When a different folder is picked and data exists, then the confirmation shows the current and new folder before anything changes', async () => {
      // Arrange
      arrangeMonitoredDirectory(true);
      await renderWithLoadedDirectory();

      // Act
      pickFolder(NEW_DIRECTORY);

      // Assert
      const dialog = await screen.findByRole('alertdialog');
      expect(within(dialog).getByText('Current folder')).toBeInTheDocument();
      expect(within(dialog).getByText(CURRENT_DIRECTORY)).toBeInTheDocument();
      expect(within(dialog).getByText('New folder')).toBeInTheDocument();
      expect(within(dialog).getByText(NEW_DIRECTORY)).toBeInTheDocument();
      expect(getElectronAPI().saveFile.updateSaveDirectory).not.toHaveBeenCalled();
    });

    it('When restoring a different default and data exists, then the confirmation shows the default folder', async () => {
      // Arrange
      arrangeMonitoredDirectory(true);
      await renderWithLoadedDirectory();

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Restore Default' }));

      // Assert
      const dialog = await screen.findByRole('alertdialog');
      expect(within(dialog).getByText('Restore Default Directory')).toBeInTheDocument();
      expect(within(dialog).getByText(DEFAULT_DIRECTORY)).toBeInTheDocument();
      expect(getElectronAPI().saveFile.restoreDefaultDirectory).not.toHaveBeenCalled();
    });

    it('If the change is confirmed, then the directory is updated, data is reloaded and a success toast is shown', async () => {
      // Arrange
      arrangeMonitoredDirectory(true);
      await renderWithLoadedDirectory();
      pickFolder(NEW_DIRECTORY);
      const dialog = await screen.findByRole('alertdialog');

      // Act
      fireEvent.click(within(dialog).getByRole('button', { name: 'Change Directory' }));

      // Assert
      await waitFor(() =>
        expect(toast.success).toHaveBeenCalledWith('Save folder updated', {
          description: `Now monitoring ${NEW_DIRECTORY}`,
        }),
      );
      expect(getElectronAPI().saveFile.updateSaveDirectory).toHaveBeenCalledWith(NEW_DIRECTORY);
      expect(mockReloadData).toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    });

    it('If restoring the default is confirmed, then the restore IPC is used and a success toast is shown', async () => {
      // Arrange
      arrangeMonitoredDirectory(true);
      await renderWithLoadedDirectory();
      fireEvent.click(screen.getByRole('button', { name: 'Restore Default' }));
      const dialog = await screen.findByRole('alertdialog');

      // Act
      fireEvent.click(within(dialog).getByRole('button', { name: 'Restore Default' }));

      // Assert
      await waitFor(() =>
        expect(toast.success).toHaveBeenCalledWith('Save folder updated', {
          description: `Now monitoring ${DEFAULT_DIRECTORY}`,
        }),
      );
      expect(getElectronAPI().saveFile.restoreDefaultDirectory).toHaveBeenCalledTimes(1);
      expect(getElectronAPI().saveFile.updateSaveDirectory).not.toHaveBeenCalled();
    });

    it('If "Back up first" is clicked, then the backup runs before the directory is changed', async () => {
      // Arrange
      arrangeMonitoredDirectory(true);
      const api = getElectronAPI();
      api.dialog.showSaveDialog.mockResolvedValue({
        canceled: false,
        filePath: '/backups/holy-grail-backup.db',
      });
      await renderWithLoadedDirectory();
      pickFolder(NEW_DIRECTORY);
      const dialog = await screen.findByRole('alertdialog');

      // Act
      fireEvent.click(within(dialog).getByRole('button', { name: 'Back up first' }));
      await within(dialog).findByText(
        'Backup created. You can now continue with the directory change.',
      );
      fireEvent.click(within(dialog).getByRole('button', { name: 'Change Directory' }));

      // Assert
      await waitFor(() => expect(api.saveFile.updateSaveDirectory).toHaveBeenCalled());
      expect(api.grail.backup).toHaveBeenCalledWith('/backups/holy-grail-backup.db');
      expect(api.grail.backup.mock.invocationCallOrder[0]).toBeLessThan(
        api.saveFile.updateSaveDirectory.mock.invocationCallOrder[0],
      );
    });

    it('If the confirmation is canceled, then the directory is not changed', async () => {
      // Arrange
      arrangeMonitoredDirectory(true);
      await renderWithLoadedDirectory();
      pickFolder(NEW_DIRECTORY);
      const dialog = await screen.findByRole('alertdialog');

      // Act
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      // Assert
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
      expect(getElectronAPI().saveFile.updateSaveDirectory).not.toHaveBeenCalled();
    });

    it('If a different folder is picked and no data exists, then it is applied without confirmation', async () => {
      // Arrange
      arrangeMonitoredDirectory(false);
      await renderWithLoadedDirectory();

      // Act
      pickFolder(NEW_DIRECTORY);

      // Assert
      await waitFor(() =>
        expect(getElectronAPI().saveFile.updateSaveDirectory).toHaveBeenCalledWith(NEW_DIRECTORY),
      );
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      await waitFor(() => expect(toast.success).toHaveBeenCalled());
    });

    it('If applying the change fails, then a translated error toast is shown', async () => {
      // Arrange
      arrangeMonitoredDirectory(false);
      getElectronAPI().saveFile.updateSaveDirectory.mockRejectedValue(new Error('boom'));
      await renderWithLoadedDirectory();

      // Act
      pickFolder(NEW_DIRECTORY);

      // Assert
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to change directory'));
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('If the folder picker is canceled, then nothing changes', async () => {
      // Arrange
      arrangeMonitoredDirectory(true);
      await renderWithLoadedDirectory();

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Change Directory' }));

      // Assert
      await waitFor(() => expect(getElectronAPI().dialog.showOpenDialog).toHaveBeenCalled());
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Change Directory' })).toBeEnabled(),
      );
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(getElectronAPI().saveFile.updateSaveDirectory).not.toHaveBeenCalled();
      expect(toast.info).not.toHaveBeenCalled();
    });
  });
});
