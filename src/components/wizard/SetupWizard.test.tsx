import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWizardStore } from '@/stores/wizardStore';
import { SetupWizard, wizardSteps } from './SetupWizard';

vi.mock('./steps/WelcomeStep', () => ({ WelcomeStep: () => <div>WelcomeContent</div> }));
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

/**
 * Opens the wizard at the given step with a clean validation state.
 */
function openWizardAt(step: number, stepValidity: Record<string, boolean> = {}) {
  useWizardStore.setState({ isOpen: true, currentStep: step, stepValidity });
}

describe('SetupWizard', () => {
  beforeEach(() => {
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

  it('When Skip Setup is clicked on an invalid step, Then the wizard closes', async () => {
    // Arrange
    openWizardAt(1);
    render(<SetupWizard />);

    // Act
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Skip Setup' }));
    });

    // Assert
    expect(useWizardStore.getState().isOpen).toBe(false);
  });
});
