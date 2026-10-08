import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import type { MockInstance } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGrailStore } from '@/stores/grailStore';
import { D2RInstallationStep } from './D2RInstallationStep';

const SUGGESTED_PATH = 'C:\\Program Files (x86)\\Diablo II Resurrected';

/**
 * Builds a minimal electronAPI mock for the D2R installation step.
 * The main process reports the default install path as existing unless overridden.
 */
function createElectronApiMock(detectedPath: string | null, valid = true) {
  return {
    platform: 'win32',
    icon: {
      getD2RPath: vi.fn().mockResolvedValue(detectedPath),
      getSuggestedD2RPath: vi.fn().mockResolvedValue(SUGGESTED_PATH),
      setD2RPath: vi.fn().mockResolvedValue(undefined),
      validatePath: vi.fn().mockResolvedValue({ valid }),
    },
    dialog: {
      showOpenDialog: vi.fn(),
    },
    grail: {
      updateSettings: vi.fn().mockResolvedValue(undefined),
    },
  };
}

/**
 * Installs the electronAPI mock on the window.
 */
function installElectronApi(api: ReturnType<typeof createElectronApiMock>) {
  Object.defineProperty(window, 'electronAPI', { value: api, configurable: true, writable: true });
}

describe('D2RInstallationStep', () => {
  const originalElectronAPI = window.electronAPI;
  const originalSettings = useGrailStore.getState().settings;
  let consoleError: MockInstance | undefined;
  let toastError: MockInstance | undefined;

  beforeEach(() => {
    useGrailStore.setState((state) => ({
      settings: { ...state.settings, d2rInstallPath: undefined },
    }));
  });

  afterEach(() => {
    consoleError?.mockRestore();
    consoleError = undefined;
    toastError?.mockRestore();
    toastError = undefined;
    useGrailStore.setState({ settings: originalSettings });
    Object.defineProperty(window, 'electronAPI', {
      value: originalElectronAPI,
      configurable: true,
      writable: true,
    });
  });

  it('If no path is detected, Then the guess is only a suggestion and nothing is saved', async () => {
    // Arrange
    const api = createElectronApiMock(null);
    installElectronApi(api);

    // Act
    render(<D2RInstallationStep />);

    // Assert
    expect(await screen.findByRole('button', { name: 'Use this' })).toBeInTheDocument();
    const input = screen.getByLabelText('Installation Path');
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('placeholder', SUGGESTED_PATH);
    expect(api.icon.setD2RPath).not.toHaveBeenCalled();
  });

  it('If the default location does not exist, Then no suggestion is offered but browsing is', async () => {
    // Arrange
    const api = createElectronApiMock(null);
    api.icon.getSuggestedD2RPath.mockResolvedValue(undefined);
    installElectronApi(api);

    // Act
    render(<D2RInstallationStep />);

    // Assert
    expect(await screen.findByText('Installation not detected')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Browse to your Diablo II: Resurrected folder, or skip this optional step and set it later in Settings.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use this' })).not.toBeInTheDocument();
    expect(screen.queryByText(SUGGESTED_PATH, { selector: 'p' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Installation Path')).toHaveAttribute(
      'placeholder',
      SUGGESTED_PATH,
    );
    expect(api.icon.setD2RPath).not.toHaveBeenCalled();
  });

  it('If checking the default location fails, Then no suggestion is offered', async () => {
    // Arrange
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const api = createElectronApiMock(null);
    api.icon.getSuggestedD2RPath.mockRejectedValue(new Error('ipc failed'));
    installElectronApi(api);

    // Act
    render(<D2RInstallationStep />);

    // Assert
    expect(await screen.findByText('Installation not detected')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use this' })).not.toBeInTheDocument();
  });

  it('When the user accepts the suggestion, Then the suggested path is saved and validated', async () => {
    // Arrange
    const api = createElectronApiMock(null);
    installElectronApi(api);
    render(<D2RInstallationStep />);
    const useButton = await screen.findByRole('button', { name: 'Use this' });

    // Act
    await act(async () => {
      fireEvent.click(useButton);
    });

    // Assert
    expect(api.icon.setD2RPath).toHaveBeenCalledWith(SUGGESTED_PATH);
    expect(useGrailStore.getState().settings.d2rInstallPath).toBe(SUGGESTED_PATH);
    expect(api.grail.updateSettings).not.toHaveBeenCalled();
    expect(api.icon.validatePath).toHaveBeenCalled();
    expect(screen.getByLabelText('Installation Path')).toHaveValue(SUGGESTED_PATH);
    expect(await screen.findByText('Game files found at this location')).toBeInTheDocument();
  });

  it('When the user types a path, Then it is saved on blur and not on each keystroke', async () => {
    // Arrange
    const api = createElectronApiMock(null);
    installElectronApi(api);
    render(<D2RInstallationStep />);
    await screen.findByRole('button', { name: 'Use this' });
    const input = screen.getByLabelText('Installation Path');

    // Act
    fireEvent.change(input, { target: { value: 'D:\\D2' } });
    fireEvent.change(input, { target: { value: 'D:\\D2R' } });

    // Assert
    expect(api.icon.setD2RPath).not.toHaveBeenCalled();

    // Act
    await act(async () => {
      fireEvent.blur(input);
    });

    // Assert
    expect(api.icon.setD2RPath).toHaveBeenCalledTimes(1);
    expect(api.icon.setD2RPath).toHaveBeenCalledWith('D:\\D2R');
    expect(api.icon.validatePath).toHaveBeenCalledTimes(1);
  });

  it('If the saved path fails validation, Then a warning is shown', async () => {
    // Arrange
    const api = createElectronApiMock(null, false);
    installElectronApi(api);
    render(<D2RInstallationStep />);
    await screen.findByRole('button', { name: 'Use this' });
    const input = screen.getByLabelText('Installation Path');

    // Act
    fireEvent.change(input, { target: { value: 'D:\\Nowhere' } });
    await act(async () => {
      fireEvent.blur(input);
    });

    // Assert
    expect(
      await screen.findByText('Extracted game files were not found at this location'),
    ).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('If a path is already configured, Then it is shown and validated without being re-saved', async () => {
    // Arrange
    const api = createElectronApiMock('E:\\Diablo II Resurrected');
    installElectronApi(api);

    // Act
    render(<D2RInstallationStep />);

    // Assert
    expect(await screen.findByDisplayValue('E:\\Diablo II Resurrected')).toBeInTheDocument();
    await waitFor(() => {
      expect(api.icon.validatePath).toHaveBeenCalledTimes(1);
    });
    expect(api.icon.setD2RPath).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Use this' })).not.toBeInTheDocument();
  });

  it('If the path changes while a validation is in flight, Then the stale result is ignored', async () => {
    // Arrange
    const api = createElectronApiMock('E:\\Diablo II Resurrected');
    const resolvers: Array<(value: { valid: boolean }) => void> = [];
    api.icon.validatePath.mockImplementation(
      () =>
        new Promise<{ valid: boolean }>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    installElectronApi(api);
    render(<D2RInstallationStep />);
    const input = await screen.findByDisplayValue('E:\\Diablo II Resurrected');
    await waitFor(() => {
      expect(api.icon.validatePath).toHaveBeenCalledTimes(1);
    });

    // Act
    fireEvent.change(input, { target: { value: 'E:\\Diablo II Resurrected\\Other' } });
    await act(async () => {
      resolvers[0]({ valid: true });
    });

    // Assert
    expect(screen.queryByText('Game files found at this location')).not.toBeInTheDocument();
    expect(screen.queryByText('Checking installation path...')).not.toBeInTheDocument();
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('If a newer validation starts before an older one resolves, Then only the newest result is shown', async () => {
    // Arrange
    const api = createElectronApiMock('E:\\Diablo II Resurrected');
    const resolvers: Array<(value: { valid: boolean }) => void> = [];
    api.icon.validatePath.mockImplementation(
      () =>
        new Promise<{ valid: boolean }>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    installElectronApi(api);
    render(<D2RInstallationStep />);
    const input = await screen.findByDisplayValue('E:\\Diablo II Resurrected');
    await waitFor(() => {
      expect(resolvers).toHaveLength(1);
    });
    fireEvent.change(input, { target: { value: 'D:\\D2R' } });
    await act(async () => {
      fireEvent.blur(input);
    });
    await waitFor(() => {
      expect(resolvers).toHaveLength(2);
    });

    // Act
    await act(async () => {
      resolvers[1]({ valid: false });
    });
    await act(async () => {
      resolvers[0]({ valid: true });
    });

    // Assert
    expect(
      screen.getByText('Extracted game files were not found at this location'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Game files found at this location')).not.toBeInTheDocument();
  });

  it('When the user presses Enter, Then the path is saved and validated', async () => {
    // Arrange
    const api = createElectronApiMock(null);
    installElectronApi(api);
    render(<D2RInstallationStep />);
    await screen.findByRole('button', { name: 'Use this' });
    const input = screen.getByLabelText('Installation Path');
    fireEvent.change(input, { target: { value: 'D:\\D2R' } });

    // Act
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });

    // Assert
    expect(api.icon.setD2RPath).toHaveBeenCalledTimes(1);
    expect(api.icon.setD2RPath).toHaveBeenCalledWith('D:\\D2R');
    expect(await screen.findByText('Game files found at this location')).toBeInTheDocument();
  });

  it('If Enter is immediately followed by blur, Then the path is only saved once', async () => {
    // Arrange
    const api = createElectronApiMock(null);
    let resolveSave: () => void = () => undefined;
    api.icon.setD2RPath.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    installElectronApi(api);
    render(<D2RInstallationStep />);
    await screen.findByRole('button', { name: 'Use this' });
    const input = screen.getByLabelText('Installation Path');
    fireEvent.change(input, { target: { value: 'D:\\D2R' } });

    // Act
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
      fireEvent.blur(input);
    });
    await act(async () => {
      resolveSave();
    });

    // Assert
    expect(api.icon.setD2RPath).toHaveBeenCalledTimes(1);
  });

  it('When the user browses to a folder, Then the chosen path is saved and validated', async () => {
    // Arrange
    const api = createElectronApiMock(null);
    api.dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['F:\\Games\\D2R'] });
    installElectronApi(api);
    render(<D2RInstallationStep />);
    await screen.findByRole('button', { name: 'Use this' });

    // Act
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Browse for directory' })[0]);
    });

    // Assert
    expect(api.icon.setD2RPath).toHaveBeenCalledWith('F:\\Games\\D2R');
    expect(screen.getByLabelText('Installation Path')).toHaveValue('F:\\Games\\D2R');
    expect(await screen.findByText('Game files found at this location')).toBeInTheDocument();
  });

  it('If the user cancels the browse dialog, Then nothing is saved', async () => {
    // Arrange
    const api = createElectronApiMock(null);
    api.dialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
    installElectronApi(api);
    render(<D2RInstallationStep />);
    await screen.findByRole('button', { name: 'Use this' });

    // Act
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Browse for directory' })[0]);
    });

    // Assert
    expect(api.icon.setD2RPath).not.toHaveBeenCalled();
  });

  it('When the icon IPC persists the path, Then the store is hydrated without a second save that could fail', async () => {
    // Arrange
    const api = createElectronApiMock(null);
    api.grail.updateSettings.mockRejectedValue(new Error('database locked'));
    toastError = vi.spyOn(toast, 'error');
    installElectronApi(api);
    render(<D2RInstallationStep />);
    await screen.findByRole('button', { name: 'Use this' });
    const input = screen.getByLabelText('Installation Path');
    fireEvent.change(input, { target: { value: 'D:\\D2R' } });

    // Act
    await act(async () => {
      fireEvent.blur(input);
    });

    // Assert
    expect(api.icon.setD2RPath).toHaveBeenCalledWith('D:\\D2R');
    expect(api.grail.updateSettings).not.toHaveBeenCalled();
    expect(useGrailStore.getState().settings.d2rInstallPath).toBe('D:\\D2R');
    expect(api.icon.validatePath).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText('Could not save the installation path. Please try again.'),
    ).not.toBeInTheDocument();
    expect(toastError).not.toHaveBeenCalled();
  });

  it('If saving the path fails, Then a save error is shown and the path is not validated', async () => {
    // Arrange
    const api = createElectronApiMock(null);
    api.icon.setD2RPath.mockRejectedValue(new Error('disk full'));
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    installElectronApi(api);
    render(<D2RInstallationStep />);
    await screen.findByRole('button', { name: 'Use this' });
    const input = screen.getByLabelText('Installation Path');
    fireEvent.change(input, { target: { value: 'D:\\D2R' } });

    // Act
    await act(async () => {
      fireEvent.blur(input);
    });

    // Assert
    const message = await screen.findByText(
      'Could not save the installation path. Please try again.',
    );
    expect(message.closest('[aria-live="polite"]')).not.toBeNull();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(api.icon.validatePath).not.toHaveBeenCalled();
    expect(useGrailStore.getState().settings.d2rInstallPath).toBeUndefined();
    expect(screen.queryByText('Checking installation path...')).not.toBeInTheDocument();
    expect(screen.queryByText('Game files found at this location')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Extracted game files were not found at this location'),
    ).not.toBeInTheDocument();
  });

  it('If the user types and then restores the saved path, Then the saved path is validated again', async () => {
    // Arrange
    const api = createElectronApiMock('E:\\Diablo II Resurrected');
    installElectronApi(api);
    render(<D2RInstallationStep />);
    const input = await screen.findByDisplayValue('E:\\Diablo II Resurrected');
    expect(await screen.findByText('Game files found at this location')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'E:\\Other' } });
    fireEvent.change(input, { target: { value: 'E:\\Diablo II Resurrected' } });
    expect(screen.queryByText('Game files found at this location')).not.toBeInTheDocument();

    // Act
    await act(async () => {
      fireEvent.blur(input);
    });

    // Assert
    expect(api.icon.setD2RPath).not.toHaveBeenCalled();
    expect(api.icon.validatePath).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('Game files found at this location')).toBeInTheDocument();
  });
});
