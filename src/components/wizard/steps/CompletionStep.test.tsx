import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGrailStore } from '@/stores/grailStore';
import { CompletionStep } from './CompletionStep';

const MONITORED_DIR = 'C:\\Users\\me\\Saved Games\\Diablo II Resurrected';

/**
 * Builds a minimal electronAPI mock for the completion summary.
 */
function createElectronApiMock(directory: string | null, saveFileCount: number) {
  return {
    platform: 'win32',
    saveFile: {
      getMonitoringStatus: vi.fn().mockResolvedValue({ isMonitoring: true, directory }),
      getSaveFiles: vi
        .fn()
        .mockResolvedValue(Array.from({ length: saveFileCount }, (_, i) => ({ name: `C${i}` }))),
    },
  };
}

// Assign instead of redefining: other test files in this shared (non-isolated) window define
// `electronAPI` as a non-configurable property, which makes `Object.defineProperty` throw.
function installElectronAPI(api: unknown): void {
  (window as unknown as { electronAPI: unknown }).electronAPI = api;
}

/**
 * Returns the summary value rendered for a label.
 */
function getSummaryValue(label: string): HTMLElement {
  const term = screen.getByText(label);
  const row = term.parentElement as HTMLElement;
  return within(row).getByRole('definition');
}

describe('When CompletionStep is rendered', () => {
  const originalElectronAPI = window.electronAPI;
  const originalSettings = useGrailStore.getState().settings;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    useGrailStore.setState((state) => ({
      settings: { ...state.settings, saveDir: MONITORED_DIR },
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useGrailStore.setState({ settings: originalSettings });
    installElectronAPI(originalElectronAPI);
  });

  it('If a save folder is monitored, Then the summary shows its path and character file count', async () => {
    // Arrange
    installElectronAPI(createElectronApiMock(MONITORED_DIR, 3));

    // Act
    render(<CompletionStep />);

    // Assert
    expect(await screen.findByText('Character Files:')).toBeInTheDocument();
    expect(getSummaryValue('Save Directory:')).toHaveTextContent(MONITORED_DIR);
    expect(getSummaryValue('Character Files:')).toHaveTextContent('3');
    expect(screen.queryByText('Configured')).not.toBeInTheDocument();
  });

  it('If the monitored folder differs from the stored setting, Then the monitored folder is shown', async () => {
    // Arrange
    const defaultDir = 'C:\\Users\\me\\Saved Games\\Default';
    useGrailStore.setState((state) => ({ settings: { ...state.settings, saveDir: '' } }));
    installElectronAPI(createElectronApiMock(defaultDir, 0));

    // Act
    render(<CompletionStep />);

    // Assert
    await waitFor(() => expect(getSummaryValue('Save Directory:')).toHaveTextContent(defaultDir));
    expect(getSummaryValue('Character Files:')).toHaveTextContent('0');
  });

  it('If no save folder is known, Then the summary says it is not set and omits the count', async () => {
    // Arrange
    useGrailStore.setState((state) => ({ settings: { ...state.settings, saveDir: '' } }));
    const api = createElectronApiMock(null, 0);
    installElectronAPI(api);

    // Act
    render(<CompletionStep />);

    // Assert
    await waitFor(() => expect(api.saveFile.getSaveFiles).toHaveBeenCalled());
    expect(getSummaryValue('Save Directory:')).toHaveTextContent('Not set');
    expect(screen.queryByText('Character Files:')).not.toBeInTheDocument();
  });

  it('If loading the save files fails, Then the stored path is still shown without a count', async () => {
    // Arrange
    const api = createElectronApiMock(MONITORED_DIR, 0);
    api.saveFile.getSaveFiles.mockRejectedValue(new Error('read failed'));
    installElectronAPI(api);

    // Act
    render(<CompletionStep />);

    // Assert
    await waitFor(() => expect(api.saveFile.getSaveFiles).toHaveBeenCalled());
    expect(getSummaryValue('Save Directory:')).toHaveTextContent(MONITORED_DIR);
    expect(screen.queryByText('Character Files:')).not.toBeInTheDocument();
  });
});
