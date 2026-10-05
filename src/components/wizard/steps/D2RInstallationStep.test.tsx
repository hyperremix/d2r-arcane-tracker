import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGrailStore } from '@/stores/grailStore';
import { D2RInstallationStep } from './D2RInstallationStep';

const SUGGESTED_PATH = 'C:\\Games\\Diablo II Resurrected';

/**
 * Builds a minimal electronAPI mock for the D2R installation step.
 */
function createElectronApiMock(detectedPath: string | null, valid = true) {
  return {
    platform: 'win32',
    icon: {
      getD2RPath: vi.fn().mockResolvedValue(detectedPath),
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

  beforeEach(() => {
    useGrailStore.setState((state) => ({
      settings: { ...state.settings, d2rInstallPath: undefined },
    }));
  });

  afterEach(() => {
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
    expect(api.grail.updateSettings).toHaveBeenCalledWith({ d2rInstallPath: SUGGESTED_PATH });
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
});
