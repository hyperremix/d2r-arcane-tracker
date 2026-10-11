import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { GameMode } from 'electron/types/grail';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { useGrailStore } from '@/stores/grailStore';
import { createMainEventsMock } from '@/test/mainEventsMock';
import { mockStoreState } from '@/test/storeMock';
import { SaveFileMonitor } from './SaveFileMonitor';

vi.mock('sonner', () => import('@/test/sonnerMock'));

vi.mock('@/stores/grailStore');

const mockUseGrailStore = vi.mocked(useGrailStore);
const mockReloadData = vi.fn();

function mockGameMode(gameMode: GameMode) {
  mockStoreState(mockUseGrailStore, {
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
    getSettings: ReturnType<typeof vi.fn>;
    backup: ReturnType<typeof vi.fn>;
  };
  saveFile: {
    getMonitoringStatus: ReturnType<typeof vi.fn>;
    getSaveFiles: ReturnType<typeof vi.fn>;
    startMonitoring: ReturnType<typeof vi.fn>;
    stopMonitoring: ReturnType<typeof vi.fn>;
    getDefaultDirectory: ReturnType<typeof vi.fn>;
    updateSaveDirectory: ReturnType<typeof vi.fn>;
    restoreDefaultDirectory: ReturnType<typeof vi.fn>;
  };
}

// Other suites define a non-configurable `window.electronAPI` (vitest runs with isolate: false),
// so it is replaced by assignment rather than vi.stubGlobal, and restored after each test.
const windowGlobals = window as unknown as Record<string, unknown>;
const stubbedKeys = ['electronAPI'] as const;
const originalDescriptors = new Map<string, PropertyDescriptor | undefined>();
const mainEvents = createMainEventsMock();

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

function createSaveFiles(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    name: `Character ${index + 1}`,
    path: `${CURRENT_DIRECTORY}/Character${index + 1}.d2s`,
    lastModified: new Date('2026-01-01T00:00:00Z'),
    characterClass: 'sorceress',
    level: 90,
    hardcore: false,
    expansion: true,
  }));
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
    mainEvents.reset();
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
        getSettings: vi.fn().mockResolvedValue({ saveDir: '' }),
        backup: vi.fn().mockResolvedValue({ success: true }),
      },
      saveFile: {
        getMonitoringStatus: vi.fn().mockResolvedValue({ isMonitoring: false, directory: null }),
        getSaveFiles: vi.fn().mockResolvedValue([]),
        startMonitoring: vi.fn().mockResolvedValue({ success: true }),
        stopMonitoring: vi.fn().mockResolvedValue({ success: true }),
        getDefaultDirectory: vi.fn().mockResolvedValue(DEFAULT_DIRECTORY),
        updateSaveDirectory: vi.fn().mockResolvedValue({ success: true }),
        restoreDefaultDirectory: vi
          .fn()
          .mockResolvedValue({ success: true, defaultDirectory: DEFAULT_DIRECTORY }),
      },
      on: mainEvents.on,
    };
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

  describe('manual mode monitoring', () => {
    it('When game mode is manual while monitoring, Then monitoring is stopped', async () => {
      // Arrange
      mockGameMode(GameMode.Manual);
      getElectronAPI().saveFile.getMonitoringStatus.mockResolvedValue({
        isMonitoring: true,
        directory: CURRENT_DIRECTORY,
      });

      // Act
      render(<SaveFileMonitor />);

      // Assert
      await waitFor(() =>
        expect(getElectronAPI().saveFile.stopMonitoring).toHaveBeenCalledTimes(1),
      );
      expect(getElectronAPI().saveFile.startMonitoring).not.toHaveBeenCalled();
    });

    it('When switching from manual to an automatic mode, Then monitoring is resumed', async () => {
      // Arrange
      mockGameMode(GameMode.Manual);
      const { rerender } = render(<SaveFileMonitor />);
      await waitFor(() => expect(getElectronAPI().saveFile.getMonitoringStatus).toHaveBeenCalled());

      // Act
      mockGameMode(GameMode.Both);
      rerender(<SaveFileMonitor />);

      // Assert
      await waitFor(() =>
        expect(getElectronAPI().saveFile.startMonitoring).toHaveBeenCalledTimes(1),
      );
    });

    it('If game mode stays automatic, Then monitoring is neither stopped nor started', async () => {
      // Arrange
      mockGameMode(GameMode.Both);

      // Act
      render(<SaveFileMonitor />);

      // Assert
      await waitFor(() => expect(getElectronAPI().saveFile.getSaveFiles).toHaveBeenCalled());
      expect(getElectronAPI().saveFile.startMonitoring).not.toHaveBeenCalled();
      expect(getElectronAPI().saveFile.stopMonitoring).not.toHaveBeenCalled();
    });
  });

  describe('status badge', () => {
    it('When Settings opens while monitoring is already active, Then the badge counts the listed save files', async () => {
      // Arrange
      mockGameMode(GameMode.Both);
      arrangeMonitoredDirectory(false);
      getElectronAPI().saveFile.getSaveFiles.mockResolvedValue(createSaveFiles(3));

      // Act
      render(<SaveFileMonitor />);

      // Assert
      expect(await screen.findByText('Detected Characters (3):')).toBeInTheDocument();
      expect(screen.getByText('Active (3 files)')).toBeInTheDocument();
    });

    it('If exactly one save file is listed, Then the badge uses the singular', async () => {
      // Arrange
      mockGameMode(GameMode.Both);
      arrangeMonitoredDirectory(false);
      getElectronAPI().saveFile.getSaveFiles.mockResolvedValue(createSaveFiles(1));

      // Act
      render(<SaveFileMonitor />);

      // Assert
      expect(await screen.findByText('Active (1 file)')).toBeInTheDocument();
    });

    type SaveFiles = ReturnType<typeof createSaveFiles>;

    function createPendingSaveFiles() {
      let resolve: (files: SaveFiles) => void = () => undefined;
      let reject: (reason: Error) => void = () => undefined;
      const promise = new Promise<SaveFiles>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    }

    function emitMonitoringStarted() {
      act(() => {
        mainEvents.emit('monitoring-status-changed', {
          status: 'started',
          directory: NEW_DIRECTORY,
          saveFileCount: 1,
        });
      });
    }

    it('If the save files are still loading, Then the badge shows no count instead of 0 files', async () => {
      // Arrange
      mockGameMode(GameMode.Both);
      arrangeMonitoredDirectory(false);
      getElectronAPI().saveFile.getSaveFiles.mockReturnValue(createPendingSaveFiles().promise);

      // Act
      render(<SaveFileMonitor />);
      await screen.findByText(CURRENT_DIRECTORY);

      // Assert
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.queryByText(/Active \(/)).not.toBeInTheDocument();
    });

    it('When the pending save files finish loading, Then the badge shows their count', async () => {
      // Arrange
      mockGameMode(GameMode.Both);
      arrangeMonitoredDirectory(false);
      const pending = createPendingSaveFiles();
      getElectronAPI().saveFile.getSaveFiles.mockReturnValue(pending.promise);
      render(<SaveFileMonitor />);
      await screen.findByText(CURRENT_DIRECTORY);

      // Act
      await act(async () => {
        pending.resolve(createSaveFiles(2));
      });

      // Assert
      expect(screen.getByText('Active (2 files)')).toBeInTheDocument();
    });

    it('If monitoring restarts, Then the badge drops the old count until the list is reloaded', async () => {
      // Arrange
      mockGameMode(GameMode.Both);
      arrangeMonitoredDirectory(false);
      getElectronAPI().saveFile.getSaveFiles.mockResolvedValue(createSaveFiles(3));
      render(<SaveFileMonitor />);
      await screen.findByText('Active (3 files)');
      getElectronAPI().saveFile.getSaveFiles.mockReturnValue(createPendingSaveFiles().promise);

      // Act
      emitMonitoringStarted();

      // Assert
      expect(await screen.findByText('Active')).toBeInTheDocument();
      expect(screen.queryByText('Active (3 files)')).not.toBeInTheDocument();
    });

    it('If an earlier load resolves after monitoring restarted, Then its stale list is ignored', async () => {
      // Arrange
      mockGameMode(GameMode.Both);
      arrangeMonitoredDirectory(false);
      const mountLoad = createPendingSaveFiles();
      const restartLoad = createPendingSaveFiles();
      getElectronAPI().saveFile.getSaveFiles.mockReturnValueOnce(mountLoad.promise);
      render(<SaveFileMonitor />);
      await screen.findByText(CURRENT_DIRECTORY);
      getElectronAPI().saveFile.getSaveFiles.mockReturnValueOnce(restartLoad.promise);
      emitMonitoringStarted();
      await act(async () => {
        restartLoad.resolve(createSaveFiles(1));
      });

      // Act
      await act(async () => {
        mountLoad.resolve(createSaveFiles(3));
      });

      // Assert
      expect(screen.getByText('Active (1 file)')).toBeInTheDocument();
      expect(screen.getByText('Detected Characters (1):')).toBeInTheDocument();
    });

    it('If loading the save files fails, Then the error is logged and the badge shows the empty list', async () => {
      // Arrange
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        mockGameMode(GameMode.Both);
        arrangeMonitoredDirectory(false);
        getElectronAPI().saveFile.getSaveFiles.mockRejectedValue(new Error('ipc down'));

        // Act
        render(<SaveFileMonitor />);

        // Assert
        expect(await screen.findByText('Active (0 files)')).toBeInTheDocument();
        expect(consoleError).toHaveBeenCalledWith('Failed to load save files:', expect.any(Error));
      } finally {
        consoleError.mockRestore();
      }
    });

    it('When monitoring starts, Then the save files are reloaded and the badge follows the list', async () => {
      // Arrange
      mockGameMode(GameMode.Both);
      render(<SaveFileMonitor />);
      await waitFor(() => expect(getElectronAPI().saveFile.getSaveFiles).toHaveBeenCalledTimes(1));
      getElectronAPI().saveFile.getSaveFiles.mockResolvedValue(createSaveFiles(2));

      // Act
      act(() => {
        mainEvents.emit('monitoring-status-changed', {
          status: 'started',
          directory: CURRENT_DIRECTORY,
          saveFileCount: 5,
        });
      });

      // Assert
      expect(await screen.findByText('Active (2 files)')).toBeInTheDocument();
      expect(screen.getByText('Detected Characters (2):')).toBeInTheDocument();
      expect(getElectronAPI().saveFile.getSaveFiles).toHaveBeenCalledTimes(2);
    });
  });

  describe('detected characters', () => {
    it('If at most five characters are detected, Then all are listed and no toggle is shown', async () => {
      // Arrange
      mockGameMode(GameMode.Both);
      arrangeMonitoredDirectory(false);
      getElectronAPI().saveFile.getSaveFiles.mockResolvedValue(createSaveFiles(5));

      // Act
      render(<SaveFileMonitor />);

      // Assert
      expect(await screen.findByText('Character 5')).toBeInTheDocument();
      expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(5);
      expect(screen.queryByRole('button', { name: /^Show / })).not.toBeInTheDocument();
    });

    it('If more than five characters are detected, Then the first five are listed in the page without an inner scroll area', async () => {
      // Arrange
      mockGameMode(GameMode.Both);
      arrangeMonitoredDirectory(false);
      getElectronAPI().saveFile.getSaveFiles.mockResolvedValue(createSaveFiles(15));

      // Act
      render(<SaveFileMonitor />);

      // Assert
      const toggle = await screen.findByRole('button', { name: 'Show all 15 characters' });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      const list = screen.getByRole('list');
      expect(toggle).toHaveAttribute('aria-controls', list.id);
      expect(list).not.toHaveClass('overflow-y-auto');
      expect(within(list).getAllByRole('listitem')).toHaveLength(5);
      expect(screen.queryByText('Character 6')).not.toBeInTheDocument();
    });

    it('When "Show all" is clicked, Then every character is listed and the toggle offers to show fewer', async () => {
      // Arrange
      mockGameMode(GameMode.Both);
      arrangeMonitoredDirectory(false);
      getElectronAPI().saveFile.getSaveFiles.mockResolvedValue(createSaveFiles(15));
      render(<SaveFileMonitor />);
      const toggle = await screen.findByRole('button', { name: 'Show all 15 characters' });

      // Act
      fireEvent.click(toggle);

      // Assert
      const list = screen.getByRole('list');
      expect(within(list).getAllByRole('listitem')).toHaveLength(15);
      expect(within(list).getByText('Character 15')).toBeInTheDocument();
      const fewerToggle = screen.getByRole('button', { name: 'Show fewer characters' });
      expect(fewerToggle).toHaveAttribute('aria-expanded', 'true');
      expect(fewerToggle).toHaveAttribute('aria-controls', list.id);
    });

    it('When "Show fewer" is clicked, Then only the first five characters are listed again', async () => {
      // Arrange
      mockGameMode(GameMode.Both);
      arrangeMonitoredDirectory(false);
      getElectronAPI().saveFile.getSaveFiles.mockResolvedValue(createSaveFiles(15));
      render(<SaveFileMonitor />);
      fireEvent.click(await screen.findByRole('button', { name: 'Show all 15 characters' }));

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Show fewer characters' }));

      // Assert
      expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(5);
      expect(screen.getByRole('button', { name: 'Show all 15 characters' })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    });
  });

  describe('latest activity', () => {
    function emitSaveFileEvent(type: string) {
      act(() => {
        mainEvents.emit('save-file-event', {
          type,
          file: { name: 'Sorc', level: 90, characterClass: 'sorceress', hardcore: false },
        });
      });
    }

    it.each([
      ['created', 'Created'],
      ['modified', 'Modified'],
      ['deleted', 'Deleted'],
    ])('When a "%s" save file event arrives, then the event type is shown as "%s"', async (type, label) => {
      // Arrange
      mockGameMode(GameMode.Both);
      render(<SaveFileMonitor />);
      await waitFor(() => expect(window.electronAPI?.saveFile.getSaveFiles).toHaveBeenCalled());

      // Act
      emitSaveFileEvent(type);

      // Assert
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.queryByText(type)).not.toBeInTheDocument();
    });

    it('If the event type is unrecognized, then a translated fallback is shown', async () => {
      // Arrange
      mockGameMode(GameMode.Both);
      render(<SaveFileMonitor />);
      await waitFor(() => expect(window.electronAPI?.saveFile.getSaveFiles).toHaveBeenCalled());

      // Act
      emitSaveFileEvent('renamed');

      // Assert
      expect(screen.getByText('Unknown')).toBeInTheDocument();
      expect(screen.queryByText('renamed')).not.toBeInTheDocument();
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

    it('When the card renders, Then the folder actions warn that switching folders deletes progress', async () => {
      // Arrange
      arrangeMonitoredDirectory(true);

      // Act
      await renderWithLoadedDirectory();

      // Assert
      expect(
        screen.getByText(
          'Switching to a different folder deletes all characters and grail progress in the app.',
        ),
      ).toBeInTheDocument();
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
      expect(
        within(dialog).getByText(
          'This permanently deletes 1 character and 0 recorded grail finds from the app.',
        ),
      ).toBeInTheDocument();
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
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Delete progress and switch folder' }),
      );

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
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Delete progress and use default folder' }),
      );

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
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Delete progress and switch folder' }),
      );

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

    it('If restoring the default fails, then a translated restore error toast is shown', async () => {
      // Arrange
      arrangeMonitoredDirectory(false);
      getElectronAPI().saveFile.restoreDefaultDirectory.mockRejectedValue(new Error('boom'));
      await renderWithLoadedDirectory();

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Restore Default' }));

      // Assert
      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith('Failed to restore default directory'),
      );
      expect(toast.success).not.toHaveBeenCalled();
    });

    it.each([
      ['nothing', () => getElectronAPI().saveFile.getDefaultDirectory.mockResolvedValue('')],
      [
        'rejects',
        () => getElectronAPI().saveFile.getDefaultDirectory.mockRejectedValue(new Error('boom')),
      ],
    ])('If the default directory lookup returns %s, then a restore error toast is shown and nothing changes', async (_name, arrange) => {
      // Arrange
      arrangeMonitoredDirectory(true);
      arrange();
      await renderWithLoadedDirectory();

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Restore Default' }));

      // Assert
      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith('Failed to restore default directory'),
      );
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(getElectronAPI().saveFile.restoreDefaultDirectory).not.toHaveBeenCalled();
    });

    it('If checking for existing data fails, then the confirmation is shown to be safe', async () => {
      // Arrange
      arrangeMonitoredDirectory(false);
      getElectronAPI().grail.getCharacters.mockRejectedValue(new Error('db locked'));
      await renderWithLoadedDirectory();

      // Act
      pickFolder(NEW_DIRECTORY);

      // Assert
      const dialog = await screen.findByRole('alertdialog');
      expect(
        within(dialog).getByText(
          'This action will permanently delete all characters and progress data.',
        ),
      ).toBeInTheDocument();
      expect(getElectronAPI().saveFile.updateSaveDirectory).not.toHaveBeenCalled();
    });

    it('If applying fails after the user confirms, then an error toast is shown and the dialog closes', async () => {
      // Arrange
      arrangeMonitoredDirectory(true);
      getElectronAPI().saveFile.updateSaveDirectory.mockRejectedValue(new Error('boom'));
      await renderWithLoadedDirectory();
      pickFolder(NEW_DIRECTORY);
      const dialog = await screen.findByRole('alertdialog');

      // Act
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Delete progress and switch folder' }),
      );

      // Assert
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to change directory'));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('If reloading data fails after the change was applied, then the change is still reported as successful', async () => {
      // Arrange
      arrangeMonitoredDirectory(false);
      mockReloadData.mockRejectedValue(new Error('reload failed'));
      await renderWithLoadedDirectory();

      // Act
      pickFolder(NEW_DIRECTORY);

      // Assert
      await waitFor(() =>
        expect(toast.success).toHaveBeenCalledWith('Save folder updated', {
          description: `Now monitoring ${NEW_DIRECTORY}`,
        }),
      );
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('If the backup from the dialog is canceled, then no backup note is shown and the change is not applied', async () => {
      // Arrange
      arrangeMonitoredDirectory(true);
      await renderWithLoadedDirectory();
      pickFolder(NEW_DIRECTORY);
      const dialog = await screen.findByRole('alertdialog');

      // Act
      fireEvent.click(within(dialog).getByRole('button', { name: 'Back up first' }));

      // Assert
      await waitFor(() => expect(getElectronAPI().dialog.showSaveDialog).toHaveBeenCalled());
      await waitFor(() =>
        expect(within(dialog).getByRole('button', { name: 'Back up first' })).toBeEnabled(),
      );
      expect(
        within(dialog).queryByText(
          'Backup created. You can now continue with the directory change.',
        ),
      ).not.toBeInTheDocument();
      expect(getElectronAPI().grail.backup).not.toHaveBeenCalled();
      expect(getElectronAPI().saveFile.updateSaveDirectory).not.toHaveBeenCalled();
    });

    it('If the backup from the dialog fails, then an error toast is shown and no backup note appears', async () => {
      // Arrange
      arrangeMonitoredDirectory(true);
      const api = getElectronAPI();
      api.dialog.showSaveDialog.mockResolvedValue({ canceled: false, filePath: '/backups/b.db' });
      api.grail.backup.mockResolvedValue({ success: false });
      await renderWithLoadedDirectory();
      pickFolder(NEW_DIRECTORY);
      const dialog = await screen.findByRole('alertdialog');

      // Act
      fireEvent.click(within(dialog).getByRole('button', { name: 'Back up first' }));

      // Assert
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to back up database'));
      expect(
        within(dialog).queryByText(
          'Backup created. You can now continue with the directory change.',
        ),
      ).not.toBeInTheDocument();
      expect(api.saveFile.updateSaveDirectory).not.toHaveBeenCalled();
    });

    it('If the monitored directory is not loaded, then the saved saveDir setting is used so an unchanged folder needs no confirmation', async () => {
      // Arrange
      const api = getElectronAPI();
      api.grail.getSettings.mockResolvedValue({ saveDir: NEW_DIRECTORY });
      api.grail.getCharacters.mockResolvedValue([{ id: 'char-1' }]);
      render(<SaveFileMonitor />);
      await waitFor(() => expect(api.saveFile.getMonitoringStatus).toHaveBeenCalled());

      // Act
      pickFolder(NEW_DIRECTORY);

      // Assert
      await waitFor(() => expect(toast.info).toHaveBeenCalled());
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(api.saveFile.updateSaveDirectory).not.toHaveBeenCalled();
    });

    it('If the monitored directory is not loaded and a different folder is picked, then the confirmation shows the resolved current folder', async () => {
      // Arrange
      const api = getElectronAPI();
      api.grail.getSettings.mockResolvedValue({ saveDir: CURRENT_DIRECTORY });
      api.grail.getCharacters.mockResolvedValue([{ id: 'char-1' }]);
      render(<SaveFileMonitor />);
      await waitFor(() => expect(api.saveFile.getMonitoringStatus).toHaveBeenCalled());

      // Act
      pickFolder(NEW_DIRECTORY);

      // Assert
      const dialog = await screen.findByRole('alertdialog');
      expect(within(dialog).getByText(CURRENT_DIRECTORY)).toBeInTheDocument();
      expect(within(dialog).getByText(NEW_DIRECTORY)).toBeInTheDocument();
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
