import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGrailStore } from '@/stores/grailStore';
import { useWizardStore } from '@/stores/wizardStore';
import { SaveDirectoryStep } from './SaveDirectoryStep';

vi.mock('@/stores/grailStore');

const mockUseGrailStore = vi.mocked(useGrailStore);

const CURRENT_DIR = '/current/save/dir';
const NEW_DIR = '/new/save/dir';
const DEFAULT_DIR = '/default/save/dir';

interface MockElectronAPI {
  platform: string;
  dialog: { showOpenDialog: ReturnType<typeof vi.fn> };
  grail: { getCharacters: ReturnType<typeof vi.fn>; getProgress: ReturnType<typeof vi.fn> };
  saveFile: {
    getMonitoringStatus: ReturnType<typeof vi.fn>;
    getSaveFiles: ReturnType<typeof vi.fn>;
    getDefaultDirectory: ReturnType<typeof vi.fn>;
    updateSaveDirectory: ReturnType<typeof vi.fn>;
    restoreDefaultDirectory: ReturnType<typeof vi.fn>;
  };
}

function createElectronAPI(options: { hasUserData: boolean }): MockElectronAPI {
  return {
    platform: 'darwin',
    dialog: {
      showOpenDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: [NEW_DIR] }),
    },
    grail: {
      getCharacters: vi.fn().mockResolvedValue(options.hasUserData ? [{ id: 'char-1' }] : []),
      getProgress: vi.fn().mockResolvedValue(options.hasUserData ? [{ id: 'progress-1' }] : []),
    },
    saveFile: {
      getMonitoringStatus: vi
        .fn()
        .mockResolvedValue({ isMonitoring: true, directory: CURRENT_DIR }),
      getSaveFiles: vi.fn().mockResolvedValue([]),
      getDefaultDirectory: vi.fn().mockResolvedValue(DEFAULT_DIR),
      updateSaveDirectory: vi.fn().mockResolvedValue({ success: true }),
      restoreDefaultDirectory: vi
        .fn()
        .mockResolvedValue({ success: true, defaultDirectory: DEFAULT_DIR }),
    },
  };
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
    mockUseGrailStore.mockReturnValue({
      settings: { saveDir: CURRENT_DIR },
      reloadData,
    } as unknown as ReturnType<typeof useGrailStore>);
    electronAPI = createElectronAPI({ hasUserData: true });
    Object.defineProperty(window, 'electronAPI', {
      value: electronAPI,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'electronAPI', {
      value: originalElectronAPI,
      writable: true,
      configurable: true,
    });
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
          'This action will permanently delete all characters and progress data.',
        ),
      ).toBeInTheDocument();
      expect(electronAPI.saveFile.updateSaveDirectory).not.toHaveBeenCalled();
      expect(reloadData).not.toHaveBeenCalled();
    });

    it('Then confirming applies the directory and reloads grail data', async () => {
      // Arrange
      await renderStep();
      fireEvent.click(screen.getByRole('button', { name: /browse/i }));
      const dialog = await screen.findByRole('alertdialog');

      // Act
      fireEvent.click(within(dialog).getByRole('button', { name: 'Change Directory' }));

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
      Object.defineProperty(window, 'electronAPI', {
        value: electronAPI,
        writable: true,
        configurable: true,
      });
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
      fireEvent.click(within(dialog).getByRole('button', { name: 'Restore Default' }));

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
      Object.defineProperty(window, 'electronAPI', {
        value: electronAPI,
        writable: true,
        configurable: true,
      });
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
    mockUseGrailStore.mockReturnValue({
      settings: { saveDir: '' },
      reloadData,
    } as unknown as ReturnType<typeof useGrailStore>);
    electronAPI = createElectronAPI({ hasUserData: false });
    electronAPI.saveFile.getMonitoringStatus.mockResolvedValue({
      isMonitoring: false,
      directory: null,
    });
    Object.defineProperty(window, 'electronAPI', {
      value: electronAPI,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useWizardStore.setState({ stepValidity: {} });
    Object.defineProperty(window, 'electronAPI', {
      value: originalElectronAPI,
      writable: true,
      configurable: true,
    });
  });

  it('Then it shows a not-detected state with a Browse prompt and blocks the step', async () => {
    // Arrange & Act
    render(<SaveDirectoryStep />);

    // Assert
    expect(await screen.findByText('No save directory detected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Browse for Folder' })).toBeInTheDocument();
    expect(useWizardStore.getState().stepValidity.saveDirectory).toBe(false);
  });

  it('When the user browses to a folder, Then the directory is applied and the step becomes valid', async () => {
    // Arrange
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
    mockUseGrailStore.mockReturnValue({
      settings: { saveDir: '' },
      reloadData: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof useGrailStore>);
    Object.defineProperty(window, 'electronAPI', {
      value: createElectronAPI({ hasUserData: false }),
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    useWizardStore.setState({ stepValidity: {} });
    Object.defineProperty(window, 'electronAPI', {
      value: originalElectronAPI,
      writable: true,
      configurable: true,
    });
  });

  it('Then the step is valid and no not-detected state is shown', async () => {
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
