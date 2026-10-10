import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { GameMode } from 'electron/types/grail';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGrailStore } from '@/stores/grailStore';
import { useWizardStore } from '@/stores/wizardStore';
import { mockStoreState } from '@/test/storeMock';
import { SetupWizard, wizardSteps } from './SetupWizard';

vi.mock('@/stores/grailStore');
// The real module imports grailStore, so it would be cached bound to this file's mock
vi.mock('@/components/wizard/wizardSettingsSave', () => import('@/test/wizardSettingsSaveStub'));
vi.mock('./steps/WelcomeStep', () => ({ WelcomeStep: () => <div>WelcomeContent</div> }));
// Stubbed so this file's grailStore mock isn't baked into the shared module cache
// (vitest runs with isolate: false) that SaveDirectoryStep.test.tsx also relies on.
vi.mock('./steps/SaveDirectoryStep', () => ({
  SAVE_DIRECTORY_STEP_ID: 'saveDirectory',
  SaveDirectoryStep: () => <div>SaveDirectoryContent</div>,
}));
vi.mock('./steps/D2RInstallationStep', () => ({
  D2RInstallationStep: () => <div>D2RInstallationContent</div>,
}));
vi.mock('./steps/TrackingStep', () => ({ TrackingStep: () => <div>TrackingContent</div> }));
vi.mock('./steps/PreferencesStep', () => ({
  PreferencesStep: () => <div>PreferencesContent</div>,
}));
vi.mock('./steps/CompletionStep', () => ({ CompletionStep: () => <div>CompletionContent</div> }));

const mockUseGrailStore = vi.mocked(useGrailStore);

/**
 * Opens the wizard at the given step with a clean validation state.
 */
function openWizardAt(step: number, stepValidity: Record<string, boolean> = {}) {
  useWizardStore.setState({ isOpen: true, currentStep: step, stepValidity });
}

describe('SetupWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState(mockUseGrailStore, {
      setSettings: vi.fn().mockResolvedValue({ success: true }),
      settings: { gameMode: GameMode.Both },
    } as unknown as ReturnType<typeof useGrailStore>);
    useWizardStore.setState({ isOpen: false, currentStep: 0, stepValidity: {} });
  });

  afterEach(() => {
    useWizardStore.setState({ isOpen: false, currentStep: 0, stepValidity: {} });
  });

  it('When the wizard opens, Then the step count matches the configured steps', () => {
    // Arrange
    openWizardAt(0);

    // Act
    render(<SetupWizard />);

    // Assert
    expect(wizardSteps).toHaveLength(6);
    expect(useWizardStore.getState().totalSteps).toBe(wizardSteps.length);
    expect(screen.getByText('Step 1 of 6')).toBeInTheDocument();
    expect(screen.queryByText('17%')).not.toBeInTheDocument();
    expect(screen.getByText('WelcomeContent')).toBeInTheDocument();
  });

  it('If no save directory has been selected, Then Next is disabled with guidance while Skip stays available', () => {
    // Arrange
    openWizardAt(1);

    // Act
    render(<SetupWizard />);

    // Assert
    const nextButton = screen.getByRole('button', { name: 'Next' });
    expect(nextButton).toBeDisabled();
    expect(
      screen.getByText(
        'Choose the folder that contains your .d2s character files to continue, or skip setup to configure it later.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip Setup' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Skip Optional Steps' })).not.toBeInTheDocument();
  });

  it('If the save directory step reports a directory, Then Next is enabled and advances', () => {
    // Arrange
    openWizardAt(1);
    render(<SetupWizard />);

    // Act
    act(() => {
      useWizardStore.getState().setStepValidity('saveDirectory', true);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    // Assert
    expect(screen.getByText('TrackingContent')).toBeInTheDocument();
    expect(screen.getByText('Step 3 of 6')).toBeInTheDocument();
  });

  it('When the flow is configured, Then only the save folder is required and everything after What to Track is optional', () => {
    // Arrange & Act
    const flow = wizardSteps.map((wizardStep) => ({
      id: wizardStep.id,
      optional: Boolean(wizardStep.optional),
      requiresValidation: Boolean(wizardStep.requiresValidation),
    }));

    // Assert
    expect(flow).toEqual([
      { id: 'welcome', optional: false, requiresValidation: false },
      { id: 'saveDirectory', optional: false, requiresValidation: true },
      { id: 'tracking', optional: false, requiresValidation: false },
      { id: 'd2rInstallation', optional: true, requiresValidation: false },
      { id: 'preferences', optional: true, requiresValidation: false },
      { id: 'complete', optional: false, requiresValidation: false },
    ]);
  });

  it('When advancing past What to Track, Then the optional D2R installation and Preferences steps precede completion', () => {
    // Arrange
    openWizardAt(2);
    render(<SetupWizard />);

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    // Assert
    expect(screen.getByText('D2RInstallationContent')).toBeInTheDocument();
    expect(screen.getByText('Optional')).toBeInTheDocument();
    expect(screen.getByText('Step 4 of 6')).toBeInTheDocument();

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    // Assert
    expect(screen.getByText('PreferencesContent')).toBeInTheDocument();
    expect(screen.getByText('Optional')).toBeInTheDocument();
    expect(screen.getByText('Step 5 of 6')).toBeInTheDocument();
    // Only the summary is left, so there is nothing optional to skip
    expect(screen.queryByRole('button', { name: 'Skip Optional Steps' })).not.toBeInTheDocument();

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    // Assert
    expect(screen.getByText('CompletionContent')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip Setup' })).not.toBeInTheDocument();
  });

  it('When the user skips optional steps from What to Track, Then the wizard jumps straight to the summary', () => {
    // Arrange
    openWizardAt(2);
    render(<SetupWizard />);

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Skip Optional Steps' }));

    // Assert
    expect(screen.getByText('CompletionContent')).toBeInTheDocument();
    expect(screen.getByText('Step 6 of 6')).toBeInTheDocument();
    expect(screen.queryByText('D2RInstallationContent')).not.toBeInTheDocument();
    expect(screen.queryByText('PreferencesContent')).not.toBeInTheDocument();
  });

  it('If the save directory step is valid, Then optional steps cannot be skipped yet because What to Track follows', () => {
    // Arrange
    openWizardAt(1, { saveDirectory: true });

    // Act
    render(<SetupWizard />);

    // Assert
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Skip Optional Steps' })).not.toBeInTheDocument();
  });

  it('When Skip Setup is confirmed on an invalid step, Then the wizard closes', async () => {
    // Arrange
    openWizardAt(1);
    render(<SetupWizard />);
    fireEvent.click(screen.getByRole('button', { name: 'Skip Setup' }));
    const confirm = await screen.findByRole('alertdialog');

    // Act
    await act(async () => {
      fireEvent.click(within(confirm).getByRole('button', { name: 'Skip Setup' }));
    });

    // Assert
    await waitFor(() => expect(useWizardStore.getState().isOpen).toBe(false));
  });
});

describe('When SetupWizard is open', () => {
  let setSettings: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    setSettings = vi.fn().mockResolvedValue({ success: true });
    mockStoreState(mockUseGrailStore, {
      setSettings,
      settings: { gameMode: GameMode.Both },
    } as unknown as ReturnType<typeof useGrailStore>);
    openWizardAt(0);
  });

  afterEach(() => {
    useWizardStore.setState({ isOpen: false, currentStep: 0, stepValidity: {} });
  });

  describe('If the user presses Escape', () => {
    it('Then the skip confirmation is shown and the wizard is not marked as skipped', async () => {
      // Arrange
      render(<SetupWizard />);
      const wizard = await screen.findByRole('dialog');

      // Act
      fireEvent.keyDown(wizard, { key: 'Escape' });

      // Assert
      const confirm = await screen.findByRole('alertdialog');
      expect(within(confirm).getByText('You can run setup later from Settings.')).toBeVisible();
      expect(setSettings).not.toHaveBeenCalled();
      expect(useWizardStore.getState().isOpen).toBe(true);
    });

    it('Then pressing Escape again dismisses only the confirmation', async () => {
      // Arrange
      render(<SetupWizard />);
      const wizard = await screen.findByRole('dialog');
      fireEvent.keyDown(wizard, { key: 'Escape' });
      const confirm = await screen.findByRole('alertdialog');

      // Act
      fireEvent.keyDown(confirm, { key: 'Escape' });

      // Assert
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(setSettings).not.toHaveBeenCalled();
      expect(useWizardStore.getState().isOpen).toBe(true);
    });
  });

  describe('If the user clicks outside the wizard', () => {
    it('Then the wizard stays open and is not marked as skipped', async () => {
      // Arrange
      render(<SetupWizard />);
      await screen.findByRole('dialog');

      // Act
      fireEvent.pointerDown(document.body);
      fireEvent.mouseDown(document.body);
      fireEvent.click(document.body);

      // Assert
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(setSettings).not.toHaveBeenCalled();
      expect(useWizardStore.getState().isOpen).toBe(true);
    });
  });

  describe('If the user clicks Skip Setup', () => {
    it('Then a confirmation is shown before anything is persisted', async () => {
      // Arrange
      render(<SetupWizard />);
      const wizard = await screen.findByRole('dialog');

      // Act
      fireEvent.click(within(wizard).getByRole('button', { name: 'Skip Setup' }));

      // Assert
      const confirm = await screen.findByRole('alertdialog');
      expect(within(confirm).getByText('Skip setup?')).toBeInTheDocument();
      expect(setSettings).not.toHaveBeenCalled();
    });

    it('Then confirming marks the wizard as skipped and closes it', async () => {
      // Arrange
      render(<SetupWizard />);
      const wizard = await screen.findByRole('dialog');
      fireEvent.click(within(wizard).getByRole('button', { name: 'Skip Setup' }));
      const confirm = await screen.findByRole('alertdialog');

      // Act
      fireEvent.click(within(confirm).getByRole('button', { name: 'Skip Setup' }));

      // Assert
      await waitFor(() =>
        expect(setSettings).toHaveBeenCalledWith(
          { wizardSkipped: true, wizardCompleted: false },
          { notifyOnError: false },
        ),
      );
      await waitFor(() => expect(useWizardStore.getState().isOpen).toBe(false));
    });

    it('Then choosing to continue keeps the wizard open without persisting anything', async () => {
      // Arrange
      render(<SetupWizard />);
      const wizard = await screen.findByRole('dialog');
      fireEvent.click(within(wizard).getByRole('button', { name: 'Skip Setup' }));
      const confirm = await screen.findByRole('alertdialog');

      // Act
      fireEvent.click(within(confirm).getByRole('button', { name: 'Continue Setup' }));

      // Assert
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
      expect(setSettings).not.toHaveBeenCalled();
      expect(useWizardStore.getState().isOpen).toBe(true);
    });
  });

  describe('If the user clicks Finish on the last step', () => {
    beforeEach(() => {
      openWizardAt(wizardSteps.length - 1);
    });

    it('Then the wizard is marked as completed and closes', async () => {
      // Arrange
      render(<SetupWizard />);
      const wizard = await screen.findByRole('dialog');

      // Act
      await act(async () => {
        fireEvent.click(within(wizard).getByRole('button', { name: 'Finish' }));
      });

      // Assert
      expect(setSettings).toHaveBeenCalledWith(
        { wizardCompleted: true, wizardSkipped: false },
        { notifyOnError: false },
      );
      await waitFor(() => expect(useWizardStore.getState().isOpen).toBe(false));
    });

    it('Then a failed save keeps the wizard open with an error', async () => {
      // Arrange
      setSettings.mockResolvedValueOnce({ success: false, error: new Error('disk full') });
      render(<SetupWizard />);
      const wizard = await screen.findByRole('dialog');

      // Act
      await act(async () => {
        fireEvent.click(within(wizard).getByRole('button', { name: 'Finish' }));
      });

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Your setup could not be saved. Please try again.',
      );
      expect(useWizardStore.getState().isOpen).toBe(true);
    });

    it('If Finish is clicked again after a failed save, Then the wizard closes and the error is gone', async () => {
      // Arrange
      setSettings
        .mockResolvedValueOnce({ success: false, error: new Error('disk full') })
        .mockResolvedValue({ success: true });
      render(<SetupWizard />);
      const wizard = await screen.findByRole('dialog');
      const finish = within(wizard).getByRole('button', { name: 'Finish' });

      // Act
      await act(async () => {
        fireEvent.click(finish);
      });
      await act(async () => {
        fireEvent.click(finish);
      });

      // Assert
      await waitFor(() => expect(useWizardStore.getState().isOpen).toBe(false));
      expect(setSettings).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('When the user skips setup', () => {
    const noSaveFolderWarning =
      "No save folder is set up yet, so automatic tracking won't work until you choose one in Settings.";

    /**
     * Installs the monitoring status the main process would report.
     */
    function installMonitoringStatus(getMonitoringStatus: ReturnType<typeof vi.fn>): void {
      (window as unknown as { electronAPI: unknown }).electronAPI = {
        saveFile: { getMonitoringStatus },
      };
    }

    /**
     * Opens the skip confirmation and waits until the monitoring status request has settled.
     */
    async function openSkipConfirmation(
      getMonitoringStatus: ReturnType<typeof vi.fn>,
    ): Promise<HTMLElement> {
      const wizard = await screen.findByRole('dialog');
      fireEvent.click(within(wizard).getByRole('button', { name: 'Skip Setup' }));
      const confirm = await screen.findByRole('alertdialog');
      await waitFor(() => expect(getMonitoringStatus).toHaveBeenCalledTimes(1));
      await act(async () => {
        await Promise.resolve();
      });
      return confirm;
    }

    let originalElectronAPI: unknown;

    beforeEach(() => {
      originalElectronAPI = window.electronAPI;
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
      vi.restoreAllMocks();
      (window as unknown as { electronAPI: unknown }).electronAPI = originalElectronAPI;
    });

    it('If no save folder is being monitored, Then the confirmation warns that automatic tracking will not work', async () => {
      // Arrange
      const getMonitoringStatus = vi
        .fn()
        .mockResolvedValue({ isMonitoring: false, directory: '/missing/dir' });
      installMonitoringStatus(getMonitoringStatus);
      render(<SetupWizard />);

      // Act
      const confirm = await openSkipConfirmation(getMonitoringStatus);

      // Assert
      expect(within(confirm).getByText(noSaveFolderWarning)).toBeVisible();
    });

    it('If the wizard is reopened with a monitored folder that has no characters yet, Then the warning is not shown', async () => {
      // Arrange
      const getMonitoringStatus = vi
        .fn()
        .mockResolvedValue({ isMonitoring: true, directory: '/saves' });
      installMonitoringStatus(getMonitoringStatus);
      openWizardAt(0, {});
      render(<SetupWizard />);

      // Act
      const confirm = await openSkipConfirmation(getMonitoringStatus);

      // Assert
      expect(within(confirm).queryByText(noSaveFolderWarning)).not.toBeInTheDocument();
      expect(within(confirm).getByText('You can run setup later from Settings.')).toBeVisible();
    });

    it('If characters are still tracked but the folder is no longer monitored, Then the warning is shown', async () => {
      // Arrange
      const getMonitoringStatus = vi
        .fn()
        .mockResolvedValue({ isMonitoring: false, directory: '/gone' });
      installMonitoringStatus(getMonitoringStatus);
      mockStoreState(mockUseGrailStore, {
        setSettings,
        characters: [{ id: 'char-1' }],
        settings: { gameMode: GameMode.Both },
      } as unknown as ReturnType<typeof useGrailStore>);
      render(<SetupWizard />);

      // Act
      const confirm = await openSkipConfirmation(getMonitoringStatus);

      // Assert
      expect(within(confirm).getByText(noSaveFolderWarning)).toBeVisible();
    });

    it('If the save folder step reports itself not valid yet but the folder is monitored, Then the warning is not shown', async () => {
      // Arrange
      const getMonitoringStatus = vi
        .fn()
        .mockResolvedValue({ isMonitoring: true, directory: '/saves' });
      installMonitoringStatus(getMonitoringStatus);
      openWizardAt(1, { saveDirectory: false });
      render(<SetupWizard />);

      // Act
      const confirm = await openSkipConfirmation(getMonitoringStatus);

      // Assert
      expect(within(confirm).queryByText(noSaveFolderWarning)).not.toBeInTheDocument();
    });

    it('If the save folder step reports a valid folder that is not monitored, Then the warning is shown', async () => {
      // Arrange
      const getMonitoringStatus = vi
        .fn()
        .mockResolvedValue({ isMonitoring: false, directory: '/saves' });
      installMonitoringStatus(getMonitoringStatus);
      openWizardAt(2, { saveDirectory: true });
      render(<SetupWizard />);

      // Act
      const confirm = await openSkipConfirmation(getMonitoringStatus);

      // Assert
      expect(within(confirm).getByText(noSaveFolderWarning)).toBeVisible();
    });

    it('If the monitoring status is still loading, Then no warning is shown until it resolves', async () => {
      // Arrange
      let resolveStatus: (status: { isMonitoring: boolean; directory: string }) => void = () =>
        undefined;
      const getMonitoringStatus = vi.fn().mockReturnValue(
        new Promise((resolve) => {
          resolveStatus = resolve;
        }),
      );
      installMonitoringStatus(getMonitoringStatus);
      render(<SetupWizard />);
      const wizard = await screen.findByRole('dialog');

      // Act
      fireEvent.click(within(wizard).getByRole('button', { name: 'Skip Setup' }));
      const confirm = await screen.findByRole('alertdialog');

      // Assert
      expect(within(confirm).queryByText(noSaveFolderWarning)).not.toBeInTheDocument();

      // Act
      await act(async () => {
        resolveStatus({ isMonitoring: false, directory: '/missing/dir' });
      });

      // Assert
      expect(await within(confirm).findByText(noSaveFolderWarning)).toBeVisible();
    });

    it('If the monitoring status cannot be read, Then no warning is shown', async () => {
      // Arrange
      const getMonitoringStatus = vi.fn().mockRejectedValue(new Error('ipc failed'));
      installMonitoringStatus(getMonitoringStatus);
      render(<SetupWizard />);

      // Act
      const confirm = await openSkipConfirmation(getMonitoringStatus);

      // Assert
      expect(within(confirm).queryByText(noSaveFolderWarning)).not.toBeInTheDocument();
    });

    it('If the monitoring status fails after the confirmation is closed, Then the error is not logged', async () => {
      // Arrange
      let rejectStatus: (error: Error) => void = () => undefined;
      const getMonitoringStatus = vi.fn().mockReturnValue(
        new Promise((_resolve, reject) => {
          rejectStatus = reject;
        }),
      );
      installMonitoringStatus(getMonitoringStatus);
      const { unmount } = render(<SetupWizard />);
      const wizard = await screen.findByRole('dialog');
      fireEvent.click(within(wizard).getByRole('button', { name: 'Skip Setup' }));
      await screen.findByRole('alertdialog');
      await waitFor(() => expect(getMonitoringStatus).toHaveBeenCalledTimes(1));

      // Act
      unmount();
      await act(async () => {
        rejectStatus(new Error('ipc failed'));
      });

      // Assert
      expect(console.error).not.toHaveBeenCalledWith(
        expect.stringContaining('Failed to load monitoring status'),
        expect.anything(),
      );
    });

    it('If the game mode is Manual, Then no warning is shown because nothing is monitored on purpose', async () => {
      // Arrange
      const getMonitoringStatus = vi
        .fn()
        .mockResolvedValue({ isMonitoring: false, directory: '/saves' });
      installMonitoringStatus(getMonitoringStatus);
      mockStoreState(mockUseGrailStore, {
        setSettings,
        settings: { gameMode: GameMode.Manual },
      } as unknown as ReturnType<typeof useGrailStore>);
      render(<SetupWizard />);

      // Act
      const confirm = await openSkipConfirmation(getMonitoringStatus);

      // Assert
      expect(within(confirm).queryByText(noSaveFolderWarning)).not.toBeInTheDocument();
    });
  });

  describe('If confirming Skip Setup fails to save', () => {
    it('Then the wizard stays open with an error', async () => {
      // Arrange
      setSettings.mockResolvedValueOnce({ success: false, error: new Error('disk full') });
      render(<SetupWizard />);
      const wizard = await screen.findByRole('dialog');
      fireEvent.click(within(wizard).getByRole('button', { name: 'Skip Setup' }));
      const confirm = await screen.findByRole('alertdialog');

      // Act
      await act(async () => {
        fireEvent.click(within(confirm).getByRole('button', { name: 'Skip Setup' }));
      });

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Your setup could not be saved. Please try again.',
      );
      expect(useWizardStore.getState().isOpen).toBe(true);
    });
  });
});
