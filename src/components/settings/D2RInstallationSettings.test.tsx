import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { D2RInstallationSettings } from './D2RInstallationSettings';

const originalElectronAPI = window.electronAPI;

const MAC_DEFAULT_PATH = '/Applications/Diablo II Resurrected.app';

interface ArrangeOptions {
  savedPath?: string | null;
  suggestedPath?: string;
  setD2RPath?: ReturnType<typeof vi.fn>;
}

function arrangeElectronAPI({
  savedPath = '/games/d2r',
  suggestedPath,
  setD2RPath = vi.fn().mockResolvedValue(undefined),
}: ArrangeOptions = {}) {
  const api = {
    platform: 'darwin',
    icon: {
      getD2RPath: vi.fn().mockResolvedValue(savedPath),
      getSuggestedD2RPath: vi.fn().mockResolvedValue(suggestedPath),
      setD2RPath,
    },
    dialog: { showOpenDialog: vi.fn().mockResolvedValue({ canceled: true, filePaths: [] }) },
  };
  window.electronAPI = api as unknown as typeof window.electronAPI;
  return api;
}

describe('When D2RInstallationSettings is rendered', () => {
  beforeEach(() => {
    arrangeElectronAPI();
  });

  afterEach(() => {
    window.electronAPI = originalElectronAPI;
  });

  it('Then the icon-only browse button has a translated aria-label', async () => {
    // Arrange & Act
    render(<D2RInstallationSettings />);

    // Assert
    expect(await screen.findByDisplayValue('/games/d2r')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Browse for directory' })).toHaveAttribute(
      'aria-label',
      'Browse for directory',
    );
  });

  it('If a path is saved, Then no "not saved" notice is shown', async () => {
    // Arrange & Act
    render(<D2RInstallationSettings />);

    // Assert
    expect(await screen.findByDisplayValue('/games/d2r')).toBeInTheDocument();
    await waitFor(() =>
      expect(window.electronAPI.icon.getSuggestedD2RPath).toHaveBeenCalledTimes(1),
    );
    expect(screen.queryByText('No installation path saved')).not.toBeInTheDocument();
  });

  it('If no path is saved, Then the field stays empty and the default is only a placeholder', async () => {
    // Arrange
    const api = arrangeElectronAPI({ savedPath: null });

    // Act
    render(<D2RInstallationSettings />);

    // Assert
    expect(await screen.findByText('No installation path saved')).toBeInTheDocument();
    const input = screen.getByLabelText('Installation Path');
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('placeholder', MAC_DEFAULT_PATH);
    expect(api.icon.setD2RPath).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Use this path' })).not.toBeInTheDocument();
  });

  it('If no path is saved but the default location exists, When "Use this path" is clicked, Then it is saved and shown', async () => {
    // Arrange
    const api = arrangeElectronAPI({ savedPath: null, suggestedPath: MAC_DEFAULT_PATH });
    render(<D2RInstallationSettings />);
    const useButton = await screen.findByRole('button', { name: 'Use this path' });
    expect(screen.getByText(MAC_DEFAULT_PATH)).toBeInTheDocument();

    // Act
    fireEvent.click(useButton);

    // Assert
    await waitFor(() => expect(api.icon.setD2RPath).toHaveBeenCalledWith(MAC_DEFAULT_PATH));
    expect(screen.getByLabelText('Installation Path')).toHaveValue(MAC_DEFAULT_PATH);
    expect(screen.queryByText('No installation path saved')).not.toBeInTheDocument();
  });

  it('If saving the path fails, Then an error is announced', async () => {
    // Arrange
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    arrangeElectronAPI({ setD2RPath: vi.fn().mockRejectedValue(new Error('disk full')) });
    render(<D2RInstallationSettings />);
    const input = await screen.findByDisplayValue('/games/d2r');

    // Act
    fireEvent.change(input, { target: { value: '/games/other' } });

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not save the installation path. Please try again.',
    );
    expect(input).toHaveAttribute('aria-invalid', 'true');
    consoleError.mockRestore();
  });
});
