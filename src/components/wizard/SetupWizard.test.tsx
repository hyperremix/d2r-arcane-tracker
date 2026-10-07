import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGrailStore } from '@/stores/grailStore';
import { useWizardStore } from '@/stores/wizardStore';
import { SetupWizard, wizardSteps } from './SetupWizard';

vi.mock('@/stores/grailStore');
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
    mockUseGrailStore.mockReturnValue({
      setSettings: vi.fn().mockResolvedValue(undefined),
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
    setSettings = vi.fn().mockResolvedValue(undefined);
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
        expect(setSettings).toHaveBeenCalledWith({ wizardSkipped: true, wizardCompleted: false }),
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
});
