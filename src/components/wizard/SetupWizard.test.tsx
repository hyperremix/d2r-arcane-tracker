import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGrailStore } from '@/stores/grailStore';
import { useWizardStore } from '@/stores/wizardStore';
import { SetupWizard, wizardSteps } from './SetupWizard';

vi.mock('@/stores/grailStore');
// Stubbed for the same reason: the real module imports grailStore and would be cached bound to
// this file's mock for wizardSettingsSave.test.tsx (the real component is covered there).
vi.mock('@/components/wizard/wizardSettingsSave', () => ({
  WizardSaveError: ({ visible }: { visible: boolean }) =>
    visible ? <p role="alert">Your setup could not be saved. Please try again.</p> : null,
}));
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
vi.mock('./steps/GameModeStep', () => ({ GameModeStep: () => <div>GameModeContent</div> }));
vi.mock('./steps/GameVersionStep', () => ({
  GameVersionStep: () => <div>GameVersionContent</div>,
}));
vi.mock('./steps/GrailSettingsStep', () => ({
  GrailSettingsStep: () => <div>GrailSettingsContent</div>,
}));
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
    mockUseGrailStore.mockReturnValue({
      setSettings: vi.fn().mockResolvedValue({ success: true }),
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
    expect(wizardSteps).toHaveLength(8);
    expect(useWizardStore.getState().totalSteps).toBe(wizardSteps.length);
    expect(screen.getByText('Step 1 of 8')).toBeInTheDocument();
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
        'Select your save directory to continue, or skip setup to configure it later.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Skip Setup' })).toBeEnabled();
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
    expect(screen.getByText('D2RInstallationContent')).toBeInTheDocument();
    expect(screen.getByText('Step 3 of 8')).toBeInTheDocument();
  });

  it('When advancing past grail settings, Then a single optional Preferences step precedes completion', () => {
    // Arrange
    openWizardAt(5);
    render(<SetupWizard />);

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    // Assert
    expect(screen.getByText('PreferencesContent')).toBeInTheDocument();
    expect(screen.getByText('Optional')).toBeInTheDocument();
    expect(screen.getByText('Step 7 of 8')).toBeInTheDocument();
    expect(screen.queryByText('ThemeContent')).not.toBeInTheDocument();

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    // Assert
    expect(screen.getByText('CompletionContent')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip Setup' })).not.toBeInTheDocument();
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
    mockUseGrailStore.mockReturnValue({ setSettings } as unknown as ReturnType<
      typeof useGrailStore
    >);
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
