import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/stores/grailStore');
// Only SaveDirectoryStep is rendered for real. The other steps are stubbed so they aren't cached
// bound to this file's grailStore mock in the shared (non-isolated) module registry.
vi.mock('./steps/WelcomeStep', () => ({ WelcomeStep: () => null }));
vi.mock('./steps/D2RInstallationStep', () => ({ D2RInstallationStep: () => null }));
vi.mock('./steps/GameModeStep', () => ({ GameModeStep: () => null }));
vi.mock('./steps/GameVersionStep', () => ({ GameVersionStep: () => null }));
vi.mock('./steps/GrailSettingsStep', () => ({ GrailSettingsStep: () => null }));
vi.mock('./steps/PreferencesStep', () => ({ PreferencesStep: () => null }));
vi.mock('./steps/CompletionStep', () => ({ CompletionStep: () => null }));

const CURRENT_DIR = '/current/save/dir';
const NEW_DIR = '/new/save/dir';
const SAVE_DIRECTORY_STEP_INDEX = 1;

// Assign instead of redefining: other test files in this shared (non-isolated) window define
// `electronAPI` as a non-configurable property, which makes `Object.defineProperty` throw.
function installElectronAPI(api: unknown): void {
  (window as unknown as { electronAPI: unknown }).electronAPI = api;
}

describe('When the real SaveDirectoryStep is rendered inside SetupWizard', () => {
  const originalElectronAPI = window.electronAPI;
  // Modules are imported per test after a registry reset: with `isolate: false` the module cache is
  // shared across test files, so a SetupWizard cached by another file would be bound to a different
  // grailStore mock instance than the one configured here.
  let SetupWizard: typeof import('./SetupWizard').SetupWizard;
  let useWizardStore: typeof import('@/stores/wizardStore').useWizardStore;
  let setSettings: ReturnType<typeof vi.fn>;
  let updateSaveDirectory: ReturnType<typeof vi.fn>;
  let restoreDefaultDirectory: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const { useGrailStore } = await import('@/stores/grailStore');
    ({ useWizardStore } = await import('@/stores/wizardStore'));
    ({ SetupWizard } = await import('./SetupWizard'));
    const mockUseGrailStore = vi.mocked(useGrailStore);
    setSettings = vi.fn().mockResolvedValue(undefined);
    updateSaveDirectory = vi.fn().mockResolvedValue({ success: true });
    restoreDefaultDirectory = vi.fn().mockResolvedValue({ success: true });
    mockUseGrailStore.mockReturnValue({
      setSettings,
      settings: { saveDir: CURRENT_DIR },
      reloadData: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof useGrailStore>);
    installElectronAPI({
      platform: 'darwin',
      dialog: {
        showOpenDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: [NEW_DIR] }),
      },
      grail: {
        getCharacters: vi.fn().mockResolvedValue([{ id: 'char-1' }]),
        getProgress: vi.fn().mockResolvedValue([{ id: 'progress-1' }]),
      },
      saveFile: {
        getMonitoringStatus: vi
          .fn()
          .mockResolvedValue({ isMonitoring: true, directory: CURRENT_DIR }),
        getSaveFiles: vi.fn().mockResolvedValue([]),
        getDefaultDirectory: vi.fn().mockResolvedValue('/default/save/dir'),
        updateSaveDirectory,
        restoreDefaultDirectory,
      },
    });
    useWizardStore.setState({ isOpen: true, currentStep: SAVE_DIRECTORY_STEP_INDEX });
  });

  afterEach(() => {
    installElectronAPI(originalElectronAPI);
    useWizardStore.setState({ isOpen: false, currentStep: 0 });
  });

  describe('If the user presses Escape on the destructive confirmation dialog', () => {
    it('Then only that dialog closes, the skip dialog stays closed and no IPC change is made', async () => {
      // Arrange
      render(<SetupWizard />);
      const wizard = await screen.findByRole('dialog');
      await waitFor(() =>
        expect(within(wizard).getByRole('button', { name: 'Browse' })).toBeEnabled(),
      );
      fireEvent.click(within(wizard).getByRole('button', { name: 'Browse' }));
      const destructiveDialog = await screen.findByRole('alertdialog');
      expect(
        within(destructiveDialog).getByText(
          'This action will permanently delete all characters and progress data.',
        ),
      ).toBeInTheDocument();

      // Act
      fireEvent.keyDown(destructiveDialog, { key: 'Escape' });

      // Assert
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
      expect(screen.queryByText('Skip setup?')).not.toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(updateSaveDirectory).not.toHaveBeenCalled();
      expect(restoreDefaultDirectory).not.toHaveBeenCalled();
      expect(setSettings).not.toHaveBeenCalled();
      expect(useWizardStore.getState().isOpen).toBe(true);
    });
  });
});
