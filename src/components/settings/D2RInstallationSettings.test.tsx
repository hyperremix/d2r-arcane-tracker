import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { D2RInstallationSettings } from './D2RInstallationSettings';

const originalElectronAPI = window.electronAPI;

const MAC_DEFAULT_PATH = '/Applications/Diablo II Resurrected.app';
const WINDOWS_DEFAULT_PATH = 'C:\\Program Files (x86)\\Diablo II Resurrected';
const NOT_SAVED_NOTICE = 'No installation path saved';
const SAVE_ERROR = 'Could not save the installation path. Please try again.';

interface ArrangeOptions {
  savedPath?: string;
  suggestedPath?: string;
  platform?: string;
  setD2RPath?: ReturnType<typeof vi.fn>;
  getSettings?: ReturnType<typeof vi.fn>;
  getSuggestedD2RPath?: ReturnType<typeof vi.fn>;
}

function arrangeElectronAPI({
  savedPath,
  suggestedPath,
  platform = 'darwin',
  setD2RPath = vi.fn().mockResolvedValue(undefined),
  getSettings = vi.fn().mockResolvedValue(savedPath ? { d2rInstallPath: savedPath } : {}),
  getSuggestedD2RPath = vi.fn().mockResolvedValue(suggestedPath),
}: ArrangeOptions = {}) {
  const api = {
    platform,
    grail: { getSettings },
    icon: {
      // Auto-detects and persists a path, so the card must never call it
      getD2RPath: vi.fn().mockResolvedValue(suggestedPath ?? null),
      getSuggestedD2RPath,
      setD2RPath,
    },
    dialog: { showOpenDialog: vi.fn().mockResolvedValue({ canceled: true, filePaths: [] }) },
  };
  window.electronAPI = api as unknown as typeof window.electronAPI;
  return api;
}

describe('When D2RInstallationSettings is rendered', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.electronAPI = originalElectronAPI;
  });

  it('Then the icon-only browse button has a translated aria-label', async () => {
    // Arrange
    arrangeElectronAPI({ savedPath: '/games/d2r' });

    // Act
    render(<D2RInstallationSettings />);

    // Assert
    expect(await screen.findByDisplayValue('/games/d2r')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Browse for directory' })).toHaveAttribute(
      'aria-label',
      'Browse for directory',
    );
  });

  it('If a path is saved, Then the field shows it, no notice is shown and nothing is auto-detected', async () => {
    // Arrange
    const api = arrangeElectronAPI({ savedPath: '/games/d2r', suggestedPath: MAC_DEFAULT_PATH });

    // Act
    render(<D2RInstallationSettings />);

    // Assert
    expect(await screen.findByDisplayValue('/games/d2r')).toBeInTheDocument();
    await waitFor(() => expect(api.icon.getSuggestedD2RPath).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(NOT_SAVED_NOTICE)).not.toBeInTheDocument();
    expect(api.icon.getD2RPath).not.toHaveBeenCalled();
    expect(api.icon.setD2RPath).not.toHaveBeenCalled();
  });

  it('If no path is saved and none is found, Then the field stays empty and the notice explains how to set one', async () => {
    // Arrange
    const api = arrangeElectronAPI();

    // Act
    render(<D2RInstallationSettings />);

    // Assert
    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent(NOT_SAVED_NOTICE);
    expect(notice).toHaveTextContent('Browse to your Diablo II: Resurrected folder.');
    const input = screen.getByLabelText('Installation Path');
    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('placeholder', MAC_DEFAULT_PATH);
    expect(input.getAttribute('aria-describedby')).toContain(notice.id);
    expect(api.icon.setD2RPath).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Use this' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Browse for directory' })).toHaveLength(1);
  });

  it('If the platform is Windows, Then the placeholder is the Battle.net default path', async () => {
    // Arrange
    arrangeElectronAPI({ platform: 'win32' });

    // Act
    render(<D2RInstallationSettings />);

    // Assert
    expect(await screen.findByText(NOT_SAVED_NOTICE)).toBeInTheDocument();
    expect(screen.getByLabelText('Installation Path')).toHaveAttribute(
      'placeholder',
      WINDOWS_DEFAULT_PATH,
    );
  });

  it('If no path is saved but D2R exists at the default location, Then it is only suggested and not auto-filled', async () => {
    // Arrange
    const api = arrangeElectronAPI({ suggestedPath: MAC_DEFAULT_PATH });

    // Act
    render(<D2RInstallationSettings />);

    // Assert
    expect(await screen.findByRole('button', { name: 'Use this' })).toBeInTheDocument();
    expect(screen.getByText(MAC_DEFAULT_PATH)).toBeInTheDocument();
    expect(screen.getByText(NOT_SAVED_NOTICE)).toBeInTheDocument();
    expect(screen.getByLabelText('Installation Path')).toHaveValue('');
    expect(api.icon.getD2RPath).not.toHaveBeenCalled();
    expect(api.icon.setD2RPath).not.toHaveBeenCalled();
  });

  it('If the suggestion is accepted, Then it is saved, shown in the field and the notice goes away', async () => {
    // Arrange
    const api = arrangeElectronAPI({ suggestedPath: MAC_DEFAULT_PATH });
    render(<D2RInstallationSettings />);
    const useButton = await screen.findByRole('button', { name: 'Use this' });

    // Act
    fireEvent.click(useButton);

    // Assert
    await waitFor(() => expect(api.icon.setD2RPath).toHaveBeenCalledWith(MAC_DEFAULT_PATH));
    await waitFor(() => expect(screen.queryByText(NOT_SAVED_NOTICE)).not.toBeInTheDocument());
    expect(screen.getByLabelText('Installation Path')).toHaveValue(MAC_DEFAULT_PATH);
  });

  it('If the user is typing, Then nothing is saved until the field loses focus', async () => {
    // Arrange
    const api = arrangeElectronAPI({ savedPath: '/games/d2r' });
    render(<D2RInstallationSettings />);
    const input = await screen.findByDisplayValue('/games/d2r');

    // Act
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.change(input, { target: { value: '/games/other' } });

    // Assert
    expect(api.icon.setD2RPath).not.toHaveBeenCalled();
    expect(screen.queryByText(NOT_SAVED_NOTICE)).not.toBeInTheDocument();

    // Act
    fireEvent.blur(input);

    // Assert
    await waitFor(() => expect(api.icon.setD2RPath).toHaveBeenCalledWith('/games/other'));
    expect(api.icon.setD2RPath).toHaveBeenCalledTimes(1);
  });

  it('If Enter is pressed and then the field loses focus, Then the trimmed path is saved once', async () => {
    // Arrange
    const api = arrangeElectronAPI({ savedPath: '/games/d2r' });
    render(<D2RInstallationSettings />);
    const input = await screen.findByDisplayValue('/games/d2r');
    fireEvent.change(input, { target: { value: '  /games/other  ' } });

    // Act
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);

    // Assert
    await waitFor(() => expect(api.icon.setD2RPath).toHaveBeenCalledWith('/games/other'));
    expect(api.icon.setD2RPath).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue('/games/other');
  });

  it('If the field is unchanged when it loses focus, Then nothing is saved', async () => {
    // Arrange
    const api = arrangeElectronAPI({ savedPath: '/games/d2r' });
    render(<D2RInstallationSettings />);
    const input = await screen.findByDisplayValue('/games/d2r');

    // Act
    fireEvent.blur(input);

    // Assert
    expect(api.icon.setD2RPath).not.toHaveBeenCalled();
  });

  it('If the saved path is cleared and the field loses focus, Then it is saved as empty and the notice appears', async () => {
    // Arrange
    const api = arrangeElectronAPI({ savedPath: '/games/d2r' });
    render(<D2RInstallationSettings />);
    const input = await screen.findByDisplayValue('/games/d2r');

    // Act
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    // Assert
    expect(await screen.findByText(NOT_SAVED_NOTICE)).toBeInTheDocument();
    expect(api.icon.setD2RPath).toHaveBeenCalledWith('');
  });

  it('If saving a changed path fails, Then the field returns to the saved path and an error is announced', async () => {
    // Arrange
    const api = arrangeElectronAPI({
      savedPath: '/games/d2r',
      setD2RPath: vi.fn().mockRejectedValue(new Error('disk full')),
    });
    render(<D2RInstallationSettings />);
    const input = await screen.findByDisplayValue('/games/d2r');

    // Act
    fireEvent.change(input, { target: { value: '/games/other' } });
    fireEvent.blur(input);

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(SAVE_ERROR);
    expect(input).toHaveValue('/games/d2r');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText(NOT_SAVED_NOTICE)).not.toBeInTheDocument();
    expect(api.icon.setD2RPath).toHaveBeenCalledTimes(1);
  });

  it('If saving the suggestion fails, Then the field stays empty and the notice remains', async () => {
    // Arrange
    arrangeElectronAPI({
      suggestedPath: MAC_DEFAULT_PATH,
      setD2RPath: vi.fn().mockRejectedValue(new Error('disk full')),
    });
    render(<D2RInstallationSettings />);

    // Act
    fireEvent.click(await screen.findByRole('button', { name: 'Use this' }));

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(SAVE_ERROR);
    expect(screen.getByLabelText('Installation Path')).toHaveValue('');
    expect(screen.getByText(NOT_SAVED_NOTICE)).toBeInTheDocument();
  });

  it('If loading the saved path fails, Then no "not saved" claim is made', async () => {
    // Arrange
    const api = arrangeElectronAPI({
      getSettings: vi.fn().mockRejectedValue(new Error('ipc down')),
    });

    // Act
    render(<D2RInstallationSettings />);

    // Assert
    await waitFor(() => expect(api.icon.getSuggestedD2RPath).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(NOT_SAVED_NOTICE)).not.toBeInTheDocument();
    expect(console.error).toHaveBeenCalledWith('Failed to load D2R path:', expect.any(Error));
  });

  it('If looking up the suggestion fails, Then the notice falls back to the browse hint', async () => {
    // Arrange
    arrangeElectronAPI({ getSuggestedD2RPath: vi.fn().mockRejectedValue(new Error('boom')) });

    // Act
    render(<D2RInstallationSettings />);

    // Assert
    expect(await screen.findByText(NOT_SAVED_NOTICE)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use this' })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith(
        'Failed to get suggested D2R path:',
        expect.any(Error),
      ),
    );
  });

  describe('and the browse button is clicked', () => {
    it('If a folder is chosen, Then it is saved and shown', async () => {
      // Arrange
      const api = arrangeElectronAPI({ savedPath: '/games/d2r' });
      api.dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/games/new'] });
      render(<D2RInstallationSettings />);
      await screen.findByDisplayValue('/games/d2r');

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Browse for directory' }));

      // Assert
      await waitFor(() => expect(api.icon.setD2RPath).toHaveBeenCalledWith('/games/new'));
      expect(screen.getByLabelText('Installation Path')).toHaveValue('/games/new');
    });

    it('If the dialog is cancelled, Then nothing is saved', async () => {
      // Arrange
      const api = arrangeElectronAPI({ savedPath: '/games/d2r' });
      render(<D2RInstallationSettings />);
      await screen.findByDisplayValue('/games/d2r');

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Browse for directory' }));

      // Assert
      await waitFor(() => expect(api.dialog.showOpenDialog).toHaveBeenCalledTimes(1));
      expect(api.icon.setD2RPath).not.toHaveBeenCalled();
    });

    it.each<[string, ArrangeOptions, string]>([
      ['a path is saved', { savedPath: '/games/d2r' }, '/games/d2r'],
      ['only a suggestion exists', { suggestedPath: MAC_DEFAULT_PATH }, MAC_DEFAULT_PATH],
      ['nothing is saved or suggested', {}, MAC_DEFAULT_PATH],
    ])('If %s, Then the dialog starts in the matching folder', async (_, options, expected) => {
      // Arrange
      const api = arrangeElectronAPI(options);
      render(<D2RInstallationSettings />);
      await screen.findByLabelText('Installation Path');
      await waitFor(() => expect(api.icon.getSuggestedD2RPath).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(screen.getByLabelText('Installation Path')).toHaveValue(options.savedPath ?? ''),
      );
      if (options.suggestedPath) {
        await screen.findByRole('button', { name: 'Use this' });
      }

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Browse for directory' }));

      // Assert
      await waitFor(() =>
        expect(api.dialog.showOpenDialog).toHaveBeenCalledWith(
          expect.objectContaining({ defaultPath: expected }),
        ),
      );
    });

    it('If the dialog fails, Then the error is logged and nothing is saved', async () => {
      // Arrange
      const api = arrangeElectronAPI({ savedPath: '/games/d2r' });
      api.dialog.showOpenDialog.mockRejectedValue(new Error('no dialog'));
      render(<D2RInstallationSettings />);
      await screen.findByDisplayValue('/games/d2r');

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Browse for directory' }));

      // Assert
      await waitFor(() =>
        expect(console.error).toHaveBeenCalledWith(
          'Failed to browse directory:',
          expect.any(Error),
        ),
      );
      expect(api.icon.setD2RPath).not.toHaveBeenCalled();
    });
  });
});
