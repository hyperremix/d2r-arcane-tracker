import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGrailStore } from '@/stores/grailStore';
import { useWizardStore } from '@/stores/wizardStore';
import { mockStoreState } from '@/test/storeMock';
import { SAVE_DIRECTORY_INSPECTION_DEBOUNCE_MS, SaveDirectoryStep } from './SaveDirectoryStep';

vi.mock('@/stores/grailStore');
// Shared toast spies: the step's backup hook must not bind to the real `sonner` for later suites
vi.mock('sonner', () => import('@/test/sonnerMock'));

const mockUseGrailStore = vi.mocked(useGrailStore);

const CURRENT_DIR = '/current/save/dir';
const NEW_DIR = '/new/save/dir';
const DEFAULT_DIR = '/default/save/dir';
const TYPED_DIR = '/typed/save/dir';
const SUGGESTED_DIR = '/Users/me/Saved Games/Diablo II Resurrected';
// Debounced inspection must have run well within this timeout
const INSPECTION_TIMEOUT_MS = SAVE_DIRECTORY_INSPECTION_DEBOUNCE_MS + 1500;
const SAVE_FILE = { name: 'Sorceress', path: `${CURRENT_DIR}/Sorceress.d2s` };

interface MockElectronAPI {
  platform: string;
  dialog: { showOpenDialog: ReturnType<typeof vi.fn>; showSaveDialog: ReturnType<typeof vi.fn> };
  grail: {
    getCharacters: ReturnType<typeof vi.fn>;
    getProgress: ReturnType<typeof vi.fn>;
    backup: ReturnType<typeof vi.fn>;
  };
  saveFile: {
    getMonitoringStatus: ReturnType<typeof vi.fn>;
    getSaveFiles: ReturnType<typeof vi.fn>;
    getDefaultDirectory: ReturnType<typeof vi.fn>;
    updateSaveDirectory: ReturnType<typeof vi.fn>;
    restoreDefaultDirectory: ReturnType<typeof vi.fn>;
    inspectDirectory: ReturnType<typeof vi.fn>;
  };
}

function createElectronAPI(options: {
  hasUserData: boolean;
  saveFiles?: unknown[];
}): MockElectronAPI {
  return {
    platform: 'darwin',
    dialog: {
      showOpenDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: [NEW_DIR] }),
      showSaveDialog: vi.fn().mockResolvedValue({ canceled: true }),
    },
    grail: {
      getCharacters: vi.fn().mockResolvedValue(options.hasUserData ? [{ id: 'char-1' }] : []),
      getProgress: vi.fn().mockResolvedValue(options.hasUserData ? [{ id: 'progress-1' }] : []),
      backup: vi.fn().mockResolvedValue({ success: true }),
    },
    saveFile: {
      getMonitoringStatus: vi
        .fn()
        .mockResolvedValue({ isMonitoring: true, directory: CURRENT_DIR }),
      getSaveFiles: vi.fn().mockResolvedValue(options.saveFiles ?? []),
      getDefaultDirectory: vi.fn().mockResolvedValue(DEFAULT_DIR),
      updateSaveDirectory: vi.fn().mockResolvedValue({ success: true }),
      restoreDefaultDirectory: vi
        .fn()
        .mockResolvedValue({ success: true, defaultDirectory: DEFAULT_DIR }),
      inspectDirectory: vi.fn().mockResolvedValue({ status: 'noSaveFiles', saveFileCount: 0 }),
    },
  };
}

// Assign instead of redefining: other test files in this shared (non-isolated) window define
// `electronAPI` as a non-configurable property, which makes `Object.defineProperty` throw.
function installElectronAPI(api: unknown): void {
  (window as unknown as { electronAPI: unknown }).electronAPI = api;
}

describe('When SaveDirectoryStep is rendered', () => {
  const originalElectronAPI = window.electronAPI;
  let electronAPI: MockElectronAPI;
  let reloadData: ReturnType<typeof vi.fn>;

  const renderStep = async () => {
    render(<SaveDirectoryStep />);
    // Wait for the initial directory load to finish
    await waitFor(() => expect(screen.getByDisplayValue(CURRENT_DIR)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: /browse/i })).toBeEnabled());
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    reloadData = vi.fn().mockResolvedValue(undefined);
    mockStoreState(mockUseGrailStore, {
      settings: { saveDir: CURRENT_DIR },
      reloadData,
    } as unknown as ReturnType<typeof useGrailStore>);
    electronAPI = createElectronAPI({ hasUserData: true });
    installElectronAPI(electronAPI);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    installElectronAPI(originalElectronAPI);
  });

  describe('If the user browses to a different directory while progress exists', () => {
    it('Then a destructive confirmation is shown and no IPC change is made yet', async () => {
      // Arrange
      await renderStep();

      // Act
      fireEvent.click(screen.getByRole('button', { name: /browse/i }));

      // Assert
      const dialog = await screen.findByRole('alertdialog');
      expect(
        within(dialog).getByText(
          'This permanently deletes 1 character and 1 recorded grail find from the app.',
        ),
      ).toBeInTheDocument();
      expect(within(dialog).getByText(CURRENT_DIR)).toBeInTheDocument();
      expect(within(dialog).getByText(NEW_DIR)).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Back up first' })).toBeInTheDocument();
      expect(electronAPI.saveFile.updateSaveDirectory).not.toHaveBeenCalled();
      expect(reloadData).not.toHaveBeenCalled();
    });

    it('Then "Back up first" creates a backup before the directory is changed', async () => {
      // Arrange
      electronAPI.dialog.showSaveDialog.mockResolvedValue({
        canceled: false,
        filePath: '/backups/holy-grail-backup.db',
      });
      await renderStep();
      fireEvent.click(screen.getByRole('button', { name: /browse/i }));
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
      await waitFor(() =>
        expect(electronAPI.saveFile.updateSaveDirectory).toHaveBeenCalledWith(NEW_DIR),
      );
      expect(electronAPI.grail.backup).toHaveBeenCalledWith('/backups/holy-grail-backup.db');
      expect(electronAPI.grail.backup.mock.invocationCallOrder[0]).toBeLessThan(
        electronAPI.saveFile.updateSaveDirectory.mock.invocationCallOrder[0],
      );
    });

    it('Then confirming applies the directory and reloads grail data', async () => {
      // Arrange
      await renderStep();
      fireEvent.click(screen.getByRole('button', { name: /browse/i }));
      const dialog = await screen.findByRole('alertdialog');

      // Act
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Delete progress and switch folder' }),
      );

      // Assert
      await waitFor(() =>
        expect(electronAPI.saveFile.updateSaveDirectory).toHaveBeenCalledWith(NEW_DIR),
      );
      await waitFor(() => expect(reloadData).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.getByDisplayValue(NEW_DIR)).toBeInTheDocument());
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    });

    it('Then cancelling keeps the current directory and data untouched', async () => {
      // Arrange
      await renderStep();
      fireEvent.click(screen.getByRole('button', { name: /browse/i }));
      const dialog = await screen.findByRole('alertdialog');

      // Act
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      // Assert
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
      expect(electronAPI.saveFile.updateSaveDirectory).not.toHaveBeenCalled();
      expect(reloadData).not.toHaveBeenCalled();
      expect(screen.getByDisplayValue(CURRENT_DIR)).toBeInTheDocument();
    });
  });

  describe('If the user browses to a different directory and no progress exists', () => {
    it('Then the directory is applied without confirmation and grail data is reloaded', async () => {
      // Arrange
      electronAPI = createElectronAPI({ hasUserData: false });
      installElectronAPI(electronAPI);
      await renderStep();

      // Act
      fireEvent.click(screen.getByRole('button', { name: /browse/i }));

      // Assert
      await waitFor(() =>
        expect(electronAPI.saveFile.updateSaveDirectory).toHaveBeenCalledWith(NEW_DIR),
      );
      await waitFor(() => expect(reloadData).toHaveBeenCalledTimes(1));
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });

  describe('If the user restores the default directory', () => {
    it('Then a restore confirmation is shown when the default differs and progress exists', async () => {
      // Arrange
      await renderStep();

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Use Default Directory' }));

      // Assert
      const dialog = await screen.findByRole('alertdialog');
      expect(within(dialog).getByText('Restore Default Directory')).toBeInTheDocument();
      expect(electronAPI.saveFile.restoreDefaultDirectory).not.toHaveBeenCalled();
    });

    it('Then confirming the restore applies the default and reloads grail data', async () => {
      // Arrange
      await renderStep();
      fireEvent.click(screen.getByRole('button', { name: 'Use Default Directory' }));
      const dialog = await screen.findByRole('alertdialog');

      // Act
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Delete progress and use default folder' }),
      );

      // Assert
      await waitFor(() => expect(electronAPI.saveFile.restoreDefaultDirectory).toHaveBeenCalled());
      await waitFor(() => expect(reloadData).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.getByDisplayValue(DEFAULT_DIR)).toBeInTheDocument());
    });

    it('Then no confirmation is shown when the default is already the current directory', async () => {
      // Arrange
      electronAPI.saveFile.getDefaultDirectory.mockResolvedValue(`${CURRENT_DIR}/`);
      electronAPI.saveFile.restoreDefaultDirectory.mockResolvedValue({
        success: true,
        defaultDirectory: CURRENT_DIR,
      });
      await renderStep();

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Use Default Directory' }));

      // Assert
      await waitFor(() => expect(electronAPI.saveFile.restoreDefaultDirectory).toHaveBeenCalled());
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(electronAPI.grail.getCharacters).not.toHaveBeenCalled();
    });
  });

  describe('If applying the directory fails', () => {
    it('Then an error message is shown', async () => {
      // Arrange
      electronAPI = createElectronAPI({ hasUserData: false });
      electronAPI.saveFile.updateSaveDirectory.mockRejectedValue(new Error('boom'));
      installElectronAPI(electronAPI);
      await renderStep();

      // Act
      fireEvent.click(screen.getByRole('button', { name: /browse/i }));

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Failed to change the save directory. Please try again.',
      );
      expect(reloadData).not.toHaveBeenCalled();
    });
  });

  describe('If the change succeeds but refreshing afterwards fails', () => {
    it('Then reloadData failing does not show a change-failed alert and still loads save files', async () => {
      // Arrange
      electronAPI = createElectronAPI({ hasUserData: false });
      installElectronAPI(electronAPI);
      reloadData.mockRejectedValue(new Error('reload failed'));
      await renderStep();
      electronAPI.saveFile.getSaveFiles.mockClear();

      // Act
      fireEvent.click(screen.getByRole('button', { name: /browse/i }));

      // Assert
      await waitFor(() => expect(reloadData).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.getByDisplayValue(NEW_DIR)).toBeInTheDocument());
      await waitFor(() => expect(electronAPI.saveFile.getSaveFiles).toHaveBeenCalledTimes(1));
      expect(electronAPI.saveFile.updateSaveDirectory).toHaveBeenCalledWith(NEW_DIR);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /browse/i })).toBeEnabled();
    });

    it('Then getSaveFiles failing does not show a change-failed alert', async () => {
      // Arrange
      electronAPI = createElectronAPI({ hasUserData: false });
      installElectronAPI(electronAPI);
      await renderStep();
      electronAPI.saveFile.getSaveFiles.mockRejectedValue(new Error('read failed'));

      // Act
      fireEvent.click(screen.getByRole('button', { name: /browse/i }));

      // Assert
      await waitFor(() => expect(reloadData).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.getByDisplayValue(NEW_DIR)).toBeInTheDocument());
      await waitFor(() => expect(screen.getByRole('button', { name: /browse/i })).toBeEnabled());
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('If the default directory cannot be determined', () => {
    it('Then an error message is shown and no change is made', async () => {
      // Arrange
      await renderStep();
      electronAPI.saveFile.getDefaultDirectory.mockRejectedValue(new Error('no default'));

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Use Default Directory' }));

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Failed to change the save directory. Please try again.',
      );
      expect(electronAPI.saveFile.restoreDefaultDirectory).not.toHaveBeenCalled();
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });
  });

  describe('If the current directory is decided', () => {
    it('Then the monitoring status directory is used rather than the stored setting', async () => {
      // Arrange: the stored setting is stale, the monitor is actually using CURRENT_DIR
      mockStoreState(mockUseGrailStore, {
        settings: { saveDir: NEW_DIR },
        reloadData,
      } as unknown as ReturnType<typeof useGrailStore>);
      await renderStep();

      // Act: picking the stale setting value is a real change, so it must be confirmed
      fireEvent.click(screen.getByRole('button', { name: /browse/i }));

      // Assert
      expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
      expect(electronAPI.saveFile.updateSaveDirectory).not.toHaveBeenCalled();
    });

    it('Then confirmation is requested when neither the monitoring status nor the setting identify it', async () => {
      // Arrange
      mockStoreState(mockUseGrailStore, {
        settings: { saveDir: '' },
        reloadData,
      } as unknown as ReturnType<typeof useGrailStore>);
      electronAPI.saveFile.getMonitoringStatus.mockResolvedValue({
        isMonitoring: false,
        directory: null,
      });
      render(<SaveDirectoryStep />);
      await waitFor(() => expect(screen.getByRole('button', { name: 'Browse' })).toBeEnabled());

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Browse' }));

      // Assert
      expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
      expect(electronAPI.saveFile.updateSaveDirectory).not.toHaveBeenCalled();
    });
  });

  describe('If the user opens the directory picker', () => {
    it('Then the localized dialog title is passed to the picker', async () => {
      // Arrange
      await renderStep();

      // Act
      fireEvent.click(screen.getByRole('button', { name: /browse/i }));

      // Assert
      await waitFor(() =>
        expect(electronAPI.dialog.showOpenDialog).toHaveBeenCalledWith({
          title: 'Select Save File Directory',
          properties: ['openDirectory'],
        }),
      );
    });
  });
});

describe('When SaveDirectoryStep is rendered without a detected directory', () => {
  const originalElectronAPI = window.electronAPI;
  let electronAPI: MockElectronAPI;
  let reloadData: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    useWizardStore.setState({ stepValidity: {} });
    reloadData = vi.fn().mockResolvedValue(undefined);
    mockStoreState(mockUseGrailStore, {
      settings: { saveDir: '' },
      reloadData,
    } as unknown as ReturnType<typeof useGrailStore>);
    electronAPI = createElectronAPI({ hasUserData: false });
    electronAPI.saveFile.getMonitoringStatus.mockResolvedValue({
      isMonitoring: false,
      directory: null,
    });
    installElectronAPI(electronAPI);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useWizardStore.setState({ stepValidity: {} });
    installElectronAPI(originalElectronAPI);
  });

  it('Then it shows a not-detected state with a Browse prompt and blocks the step', async () => {
    // Arrange & Act
    render(<SaveDirectoryStep />);

    // Assert
    expect(await screen.findByText('No save directory detected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Browse for Folder' })).toBeInTheDocument();
    expect(useWizardStore.getState().stepValidity.saveDirectory).toBe(false);
  });

  it('When the user browses to a folder with character files, Then the directory is applied and the step becomes valid', async () => {
    // Arrange
    electronAPI.saveFile.getSaveFiles.mockResolvedValueOnce([]).mockResolvedValue([SAVE_FILE]);
    render(<SaveDirectoryStep />);
    const browseButton = await screen.findByRole('button', { name: 'Browse for Folder' });

    // Act
    await act(async () => {
      fireEvent.click(browseButton);
    });

    // Assert
    await waitFor(() => {
      expect(useWizardStore.getState().stepValidity.saveDirectory).toBe(true);
    });
    expect(electronAPI.saveFile.updateSaveDirectory).toHaveBeenCalledWith(NEW_DIR);
    expect(screen.queryByText('No save directory detected')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue(NEW_DIR)).toBeInTheDocument();
  });

  it('If the browsed directory is still being saved, Then the step is not valid until the save succeeds', async () => {
    // Arrange
    electronAPI.saveFile.getSaveFiles.mockResolvedValueOnce([]).mockResolvedValue([SAVE_FILE]);
    let resolveSave: (value: { success: boolean }) => void = () => undefined;
    electronAPI.saveFile.updateSaveDirectory.mockImplementation(
      () =>
        new Promise<{ success: boolean }>((resolve) => {
          resolveSave = resolve;
        }),
    );
    render(<SaveDirectoryStep />);
    const browseButton = await screen.findByRole('button', { name: 'Browse for Folder' });

    // Act
    await act(async () => {
      fireEvent.click(browseButton);
    });

    // Assert
    expect(useWizardStore.getState().stepValidity.saveDirectory).toBe(false);

    // Act
    await act(async () => {
      resolveSave({ success: true });
    });

    // Assert
    await waitFor(() => {
      expect(useWizardStore.getState().stepValidity.saveDirectory).toBe(true);
    });
  });

  it('If saving the browsed directory fails, Then the step stays invalid', async () => {
    // Arrange
    electronAPI.saveFile.updateSaveDirectory.mockRejectedValue(new Error('monitor failed'));
    render(<SaveDirectoryStep />);
    const browseButton = await screen.findByRole('button', { name: 'Browse for Folder' });

    // Act
    await act(async () => {
      fireEvent.click(browseButton);
    });

    // Assert
    expect(useWizardStore.getState().stepValidity.saveDirectory).toBe(false);
    expect(await screen.findByText('No save directory detected')).toBeInTheDocument();
    expect(reloadData).not.toHaveBeenCalled();
  });
});

describe('When SaveDirectoryStep is rendered with a detected directory', () => {
  const originalElectronAPI = window.electronAPI;

  beforeEach(() => {
    vi.clearAllMocks();
    useWizardStore.setState({ stepValidity: {} });
    mockStoreState(mockUseGrailStore, {
      settings: { saveDir: '' },
      reloadData: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof useGrailStore>);
    installElectronAPI(createElectronAPI({ hasUserData: false, saveFiles: [SAVE_FILE] }));
  });

  afterEach(() => {
    useWizardStore.setState({ stepValidity: {} });
    installElectronAPI(originalElectronAPI);
  });

  it('If it contains character files, Then the step is valid and no not-detected state is shown', async () => {
    // Arrange & Act
    render(<SaveDirectoryStep />);

    // Assert
    expect(await screen.findByDisplayValue(CURRENT_DIR)).toBeInTheDocument();
    await waitFor(() => {
      expect(useWizardStore.getState().stepValidity.saveDirectory).toBe(true);
    });
    expect(screen.queryByText('No save directory detected')).not.toBeInTheDocument();
  });
});

describe('When SaveDirectoryStep validates the selected folder', () => {
  const originalElectronAPI = window.electronAPI;
  let electronAPI: MockElectronAPI;
  let reloadData: ReturnType<typeof vi.fn>;

  const getStepValidity = () => useWizardStore.getState().stepValidity.saveDirectory;

  const renderStep = async () => {
    render(<SaveDirectoryStep />);
    await waitFor(() => expect(screen.getByDisplayValue(CURRENT_DIR)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Browse' })).toBeEnabled());
  };

  const typePath = (value: string) => {
    fireEvent.change(screen.getByLabelText('Save Directory Path'), { target: { value } });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    useWizardStore.setState({ stepValidity: {} });
    reloadData = vi.fn().mockResolvedValue(undefined);
    mockStoreState(mockUseGrailStore, {
      settings: { saveDir: CURRENT_DIR },
      reloadData,
    } as unknown as ReturnType<typeof useGrailStore>);
    electronAPI = createElectronAPI({ hasUserData: false });
    installElectronAPI(electronAPI);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useWizardStore.setState({ stepValidity: {} });
    installElectronAPI(originalElectronAPI);
  });

  describe('If the applied folder has no character files', () => {
    it('Then the step stays blocked and a warning is shown', async () => {
      // Arrange & Act
      await renderStep();

      // Assert
      expect(screen.getByText('No character files found')).toBeInTheDocument();
      expect(getStepValidity()).toBe(false);
    });

    it('Then ticking Continue anyway unblocks the step and unticking blocks it again', async () => {
      // Arrange
      await renderStep();
      const continueAnyway = screen.getByRole('checkbox', {
        name: 'Continue anyway without character files',
      });

      // Act
      fireEvent.click(continueAnyway);

      // Assert
      await waitFor(() => expect(getStepValidity()).toBe(true));

      // Act
      fireEvent.click(continueAnyway);

      // Assert
      await waitFor(() => expect(getStepValidity()).toBe(false));
    });

    it('Then a folder that does not exist is reported as such', async () => {
      // Arrange
      electronAPI.saveFile.inspectDirectory.mockResolvedValue({
        status: 'notFound',
        saveFileCount: 0,
      });

      // Act
      await renderStep();

      // Assert
      expect(
        await screen.findByText("This folder doesn't exist", undefined, {
          timeout: INSPECTION_TIMEOUT_MS,
        }),
      ).toBeInTheDocument();
      expect(electronAPI.saveFile.inspectDirectory).toHaveBeenCalledWith(CURRENT_DIR);
    });
  });

  describe('If the applied folder has character files', () => {
    it('Then Continue anyway is not offered and the folder is not re-inspected', async () => {
      // Arrange
      electronAPI.saveFile.getSaveFiles.mockResolvedValue([SAVE_FILE]);

      // Act
      await renderStep();

      // Assert
      await waitFor(() => expect(getStepValidity()).toBe(true));
      expect(screen.getByText('Found 1 character file')).toBeInTheDocument();
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
      await new Promise((resolve) =>
        setTimeout(resolve, SAVE_DIRECTORY_INSPECTION_DEBOUNCE_MS + 50),
      );
      expect(electronAPI.saveFile.inspectDirectory).not.toHaveBeenCalled();
    });
  });

  describe('If the user types or pastes a path', () => {
    it('Then the path is inspected once after typing stops and the step is blocked until it is applied', async () => {
      // Arrange
      electronAPI.saveFile.getSaveFiles.mockResolvedValue([SAVE_FILE]);
      electronAPI.saveFile.inspectDirectory.mockResolvedValue({
        status: 'hasSaveFiles',
        saveFileCount: 3,
      });
      await renderStep();
      await waitFor(() => expect(getStepValidity()).toBe(true));

      // Act
      typePath('/typed');
      typePath('/typed/save');
      typePath(TYPED_DIR);

      // Assert
      expect(getStepValidity()).toBe(false);
      expect(screen.getByText('Checking folder...')).toBeInTheDocument();
      expect(
        await screen.findByText('Found 3 character files', undefined, {
          timeout: INSPECTION_TIMEOUT_MS,
        }),
      ).toBeInTheDocument();
      expect(electronAPI.saveFile.inspectDirectory).toHaveBeenCalledTimes(1);
      expect(electronAPI.saveFile.inspectDirectory).toHaveBeenCalledWith(TYPED_DIR);
      expect(electronAPI.saveFile.updateSaveDirectory).not.toHaveBeenCalled();
      expect(getStepValidity()).toBe(false);
    });

    it('Then Use This Folder applies the typed path and validates the step', async () => {
      // Arrange
      electronAPI.saveFile.getSaveFiles.mockResolvedValueOnce([]).mockResolvedValue([SAVE_FILE]);
      electronAPI.saveFile.inspectDirectory.mockResolvedValue({
        status: 'hasSaveFiles',
        saveFileCount: 1,
      });
      await renderStep();
      typePath(TYPED_DIR);
      const useButton = screen.getByRole('button', { name: 'Use This Folder' });
      await waitFor(() => expect(useButton).toBeEnabled(), { timeout: INSPECTION_TIMEOUT_MS });

      // Act
      fireEvent.click(useButton);

      // Assert
      await waitFor(() =>
        expect(electronAPI.saveFile.updateSaveDirectory).toHaveBeenCalledWith(TYPED_DIR),
      );
      await waitFor(() => expect(getStepValidity()).toBe(true));
      expect(reloadData).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('button', { name: 'Use This Folder' })).not.toBeInTheDocument();
    });

    it('Then pressing Enter applies the typed path once it has been validated', async () => {
      // Arrange
      await renderStep();
      typePath(TYPED_DIR);
      await waitFor(
        () => expect(screen.getByRole('button', { name: 'Use This Folder' })).toBeEnabled(),
        { timeout: INSPECTION_TIMEOUT_MS },
      );

      // Act
      fireEvent.keyDown(screen.getByLabelText('Save Directory Path'), { key: 'Enter' });

      // Assert
      await waitFor(() =>
        expect(electronAPI.saveFile.updateSaveDirectory).toHaveBeenCalledWith(TYPED_DIR),
      );
    });

    it('Then a path that does not exist cannot be applied', async () => {
      // Arrange
      electronAPI.saveFile.inspectDirectory.mockResolvedValue({
        status: 'notFound',
        saveFileCount: 0,
      });
      await renderStep();

      // Act
      typePath(TYPED_DIR);

      // Assert
      expect(
        await screen.findByText("This folder doesn't exist", undefined, {
          timeout: INSPECTION_TIMEOUT_MS,
        }),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Use This Folder' })).toBeDisabled();
      expect(screen.getByLabelText('Save Directory Path')).toHaveAttribute('aria-invalid', 'true');
      fireEvent.keyDown(screen.getByLabelText('Save Directory Path'), { key: 'Enter' });
      expect(electronAPI.saveFile.updateSaveDirectory).not.toHaveBeenCalled();
    });

    it('Then a relative path is reported as invalid', async () => {
      // Arrange
      electronAPI.saveFile.inspectDirectory.mockResolvedValue({
        status: 'invalidPath',
        saveFileCount: 0,
      });
      await renderStep();

      // Act
      typePath('Saved Games');

      // Assert
      expect(
        await screen.findByText('Enter a full folder path', undefined, {
          timeout: INSPECTION_TIMEOUT_MS,
        }),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Use This Folder' })).toBeDisabled();
    });

    it('Then progress is still protected by the destructive confirmation', async () => {
      // Arrange
      electronAPI = createElectronAPI({ hasUserData: true });
      electronAPI.saveFile.inspectDirectory.mockResolvedValue({
        status: 'hasSaveFiles',
        saveFileCount: 1,
      });
      installElectronAPI(electronAPI);
      await renderStep();
      typePath(TYPED_DIR);
      const useButton = screen.getByRole('button', { name: 'Use This Folder' });
      await waitFor(() => expect(useButton).toBeEnabled(), { timeout: INSPECTION_TIMEOUT_MS });

      // Act
      fireEvent.click(useButton);

      // Assert
      const dialog = await screen.findByRole('alertdialog');
      expect(
        within(dialog).getByText(
          'This permanently deletes 1 character and 1 recorded grail find from the app.',
        ),
      ).toBeInTheDocument();
      expect(electronAPI.saveFile.updateSaveDirectory).not.toHaveBeenCalled();
    });
  });

  describe('If the chosen folder looks like the parent or a subfolder of the save folder', () => {
    it('Then the save folder is suggested and one click applies it', async () => {
      // Arrange
      electronAPI.saveFile.inspectDirectory.mockResolvedValue({
        status: 'noSaveFiles',
        saveFileCount: 0,
        suggestedDirectory: SUGGESTED_DIR,
      });
      electronAPI.saveFile.getSaveFiles.mockResolvedValueOnce([]).mockResolvedValue([SAVE_FILE]);
      await renderStep();
      const useSuggestion = await screen.findByRole(
        'button',
        { name: 'Use Suggested Folder' },
        { timeout: INSPECTION_TIMEOUT_MS },
      );
      expect(screen.getByText('Did you mean this folder?')).toBeInTheDocument();
      expect(screen.getByText(SUGGESTED_DIR)).toBeInTheDocument();

      // Act
      fireEvent.click(useSuggestion);

      // Assert
      await waitFor(() =>
        expect(electronAPI.saveFile.updateSaveDirectory).toHaveBeenCalledWith(SUGGESTED_DIR),
      );
      await waitFor(() => expect(screen.getByDisplayValue(SUGGESTED_DIR)).toBeInTheDocument());
      await waitFor(() => expect(getStepValidity()).toBe(true));
      expect(
        screen.queryByRole('button', { name: 'Use Suggested Folder' }),
      ).not.toBeInTheDocument();
    });

    it('Then a suggestion for a typed path is offered too', async () => {
      // Arrange
      electronAPI.saveFile.getSaveFiles.mockResolvedValue([SAVE_FILE]);
      electronAPI.saveFile.inspectDirectory.mockResolvedValue({
        status: 'noSaveFiles',
        saveFileCount: 0,
        suggestedDirectory: SUGGESTED_DIR,
      });
      await renderStep();

      // Act
      typePath('/Users/me/Saved Games');

      // Assert
      expect(
        await screen.findByRole(
          'button',
          { name: 'Use Suggested Folder' },
          { timeout: INSPECTION_TIMEOUT_MS },
        ),
      ).toBeInTheDocument();
      expect(screen.getByText('No character files found')).toBeInTheDocument();
      expect(electronAPI.saveFile.inspectDirectory).toHaveBeenCalledWith('/Users/me/Saved Games');
    });
  });

  describe('If inspecting the folder fails', () => {
    it('Then the typed path cannot be applied and no suggestion is shown', async () => {
      // Arrange
      electronAPI.saveFile.inspectDirectory.mockRejectedValue(new Error('ipc failed'));
      await renderStep();

      // Act
      typePath(TYPED_DIR);

      // Assert
      await waitFor(
        () => expect(screen.queryByText('Checking folder...')).not.toBeInTheDocument(),
        {
          timeout: INSPECTION_TIMEOUT_MS,
        },
      );
      expect(electronAPI.saveFile.inspectDirectory).toHaveBeenCalledWith(TYPED_DIR);
      expect(screen.getByRole('button', { name: 'Use This Folder' })).toBeDisabled();
      expect(
        screen.queryByRole('button', { name: 'Use Suggested Folder' }),
      ).not.toBeInTheDocument();
      expect(getStepValidity()).toBe(false);
    });
  });
});
