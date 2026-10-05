import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGrailStore } from '@/stores/grailStore';
import { useWizardStore } from '@/stores/wizardStore';
import { SaveDirectoryStep } from './SaveDirectoryStep';

/**
 * Builds a minimal electronAPI mock for the save directory step.
 */
function createElectronApiMock(directory: string | null) {
  return {
    platform: 'win32',
    saveFile: {
      getMonitoringStatus: vi.fn().mockResolvedValue({ directory }),
      getSaveFiles: vi.fn().mockResolvedValue([]),
      updateSaveDirectory: vi.fn().mockResolvedValue({ success: true }),
      restoreDefaultDirectory: vi.fn(),
    },
    dialog: {
      showOpenDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: ['C:\\Saves\\D2R'] }),
    },
    grail: {
      updateSettings: vi.fn().mockResolvedValue(undefined),
    },
  };
}

describe('SaveDirectoryStep', () => {
  const originalElectronAPI = window.electronAPI;

  beforeEach(() => {
    useWizardStore.setState({ stepValidity: {} });
    useGrailStore.setState((state) => ({ settings: { ...state.settings, saveDir: '' } }));
  });

  afterEach(() => {
    Object.defineProperty(window, 'electronAPI', {
      value: originalElectronAPI,
      configurable: true,
      writable: true,
    });
  });

  it('If no save directory is detected, Then it shows a not-detected state with a Browse prompt and blocks the step', async () => {
    // Arrange
    Object.defineProperty(window, 'electronAPI', {
      value: createElectronApiMock(null),
      configurable: true,
      writable: true,
    });

    // Act
    render(<SaveDirectoryStep />);

    // Assert
    expect(await screen.findByText('No save directory detected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Browse for Folder' })).toBeInTheDocument();
    expect(useWizardStore.getState().stepValidity.saveDirectory).toBe(false);
  });

  it('When the user browses to a folder from the not-detected state, Then the directory is applied and the step becomes valid', async () => {
    // Arrange
    const electronApi = createElectronApiMock(null);
    Object.defineProperty(window, 'electronAPI', {
      value: electronApi,
      configurable: true,
      writable: true,
    });
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
    expect(electronApi.saveFile.updateSaveDirectory).toHaveBeenCalledWith('C:\\Saves\\D2R');
    expect(screen.queryByText('No save directory detected')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('C:\\Saves\\D2R')).toBeInTheDocument();
  });

  it('If a save directory is detected, Then the step is valid and no not-detected state is shown', async () => {
    // Arrange
    Object.defineProperty(window, 'electronAPI', {
      value: createElectronApiMock('C:\\Detected\\Saves'),
      configurable: true,
      writable: true,
    });

    // Act
    render(<SaveDirectoryStep />);

    // Assert
    expect(await screen.findByDisplayValue('C:\\Detected\\Saves')).toBeInTheDocument();
    await waitFor(() => {
      expect(useWizardStore.getState().stepValidity.saveDirectory).toBe(true);
    });
    expect(screen.queryByText('No save directory detected')).not.toBeInTheDocument();
  });
});
