import { ArrowLeft, ArrowRight, Check, FastForward } from 'lucide-react';
import type { ComponentType } from 'react';
import { useCallback, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { WizardSaveError } from '@/components/wizard/wizardSettingsSave';
import { translations } from '@/i18n/translations';
import { useGrailStore } from '@/stores/grailStore';
import { useWizardStore } from '@/stores/wizardStore';
import { CompletionStep } from './steps/CompletionStep';
import { D2RInstallationStep } from './steps/D2RInstallationStep';
import { PreferencesStep } from './steps/PreferencesStep';
import { SAVE_DIRECTORY_STEP_ID, SaveDirectoryStep } from './steps/SaveDirectoryStep';
import { TrackingStep } from './steps/TrackingStep';
import { WelcomeStep } from './steps/WelcomeStep';

/**
 * Configuration of a single wizard step.
 */
interface WizardStep {
  id: string;
  component: ComponentType;
  titleKey: string;
  /** Step must report itself valid (via the wizard store) before Next is enabled. */
  requiresValidation?: boolean;
  /** Translation key explaining what is missing while the step is invalid. */
  validationMessageKey?: string;
  /** Step only contains settings with sensible defaults; it can be skipped. */
  optional?: boolean;
}

/**
 * Ordered wizard steps. The length must match `totalSteps` in the wizard store.
 * Only the save folder is essential; everything after "What to track" is optional
 * and can be skipped in one click (or changed later in Settings).
 */
export const wizardSteps: WizardStep[] = [
  { id: 'welcome', component: WelcomeStep, titleKey: translations.wizard.steps.welcome },
  {
    id: SAVE_DIRECTORY_STEP_ID,
    component: SaveDirectoryStep,
    titleKey: translations.wizard.steps.saveDirectory,
    requiresValidation: true,
    validationMessageKey: translations.wizard.saveDirectoryRequired,
  },
  { id: 'tracking', component: TrackingStep, titleKey: translations.wizard.steps.tracking },
  {
    id: 'd2rInstallation',
    component: D2RInstallationStep,
    titleKey: translations.wizard.steps.d2rInstallation,
    optional: true,
  },
  {
    id: 'preferences',
    component: PreferencesStep,
    titleKey: translations.wizard.preferences.title,
    optional: true,
  },
  { id: 'complete', component: CompletionStep, titleKey: translations.wizard.steps.complete },
];

/**
 * SetupWizard component - Main wizard dialog that guides users through app configuration.
 * Displays a multi-step modal with navigation controls and progress indicator.
 * @returns {JSX.Element} Setup wizard dialog
 */
export function SetupWizard() {
  const { t } = useTranslation();
  const validationMessageId = useId();
  const {
    isOpen,
    currentStep,
    totalSteps,
    stepValidity,
    nextStep,
    previousStep,
    jumpToStep,
    skip,
    closeWizard,
  } = useWizardStore(
    useShallow((state) => ({
      isOpen: state.isOpen,
      currentStep: state.currentStep,
      totalSteps: state.totalSteps,
      stepValidity: state.stepValidity,
      nextStep: state.nextStep,
      previousStep: state.previousStep,
      jumpToStep: state.jumpToStep,
      skip: state.skip,
      closeWizard: state.closeWizard,
    })),
  );
  const setSettings = useGrailStore((state) => state.setSettings);
  const hasCharacters = useGrailStore((state) => state.characters.length > 0);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  // Set when persisting the wizard outcome fails; the wizard then stays open so it can be retried
  const [saveFailed, setSaveFailed] = useState(false);

  const step = wizardSteps[currentStep];
  const CurrentStepComponent = step?.component;
  const currentStepTitle = step ? t(step.titleKey) : '';
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  // Steps that require validation stay blocked until they report themselves valid.
  // Skipping the whole setup remains available through the Skip Setup button.
  const canProceed = useMemo(() => {
    if (!step?.requiresValidation) {
      return true;
    }
    return stepValidity[step.id] === true;
  }, [step, stepValidity]);

  const showValidationMessage = !canProceed && Boolean(step?.validationMessageKey);

  // The save folder step reports its validity once visited. Before that, tracked characters show
  // that a working save folder was set up earlier (e.g. when re-running the wizard).
  const saveFolderValidity = stepValidity[SAVE_DIRECTORY_STEP_ID];
  const hasUsableSaveFolder = saveFolderValidity ?? hasCharacters;

  // Offer to jump straight to the summary when every step before it is optional
  const remainingSteps = wizardSteps.slice(currentStep + 1, totalSteps - 1);
  const canSkipOptionalSteps =
    !isLastStep &&
    canProceed &&
    remainingSteps.length > 0 &&
    remainingSteps.every((remainingStep) => remainingStep.optional);

  const handleNext = useCallback(() => {
    if (!isLastStep && canProceed) {
      setSaveFailed(false);
      nextStep();
    }
  }, [isLastStep, canProceed, nextStep]);

  const handleSkipOptionalSteps = useCallback(() => {
    if (canSkipOptionalSteps) {
      jumpToStep(totalSteps - 1);
    }
  }, [canSkipOptionalSteps, jumpToStep, totalSteps]);

  const handleBack = useCallback(() => {
    if (!isFirstStep) {
      setSaveFailed(false);
      previousStep();
    }
  }, [isFirstStep, previousStep]);

  const handleRequestSkip = useCallback(() => {
    setShowSkipConfirm(true);
  }, []);

  const handleConfirmSkip = useCallback(async () => {
    setShowSkipConfirm(false);
    // Mark wizard as skipped (preserving any settings already made). The error is shown
    // inline because a toast outside the modal wizard could not be interacted with.
    const result = await setSettings(
      { wizardSkipped: true, wizardCompleted: false },
      { notifyOnError: false },
    );
    if (!result.success) {
      setSaveFailed(true);
      return;
    }
    setSaveFailed(false);
    skip();
  }, [setSettings, skip]);

  // Escape must never silently skip the wizard; route it through the skip confirmation.
  // Outside clicks are ignored entirely via disablePointerDismissal.
  const handleWizardOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setShowSkipConfirm(true);
    }
  }, []);

  const handleFinish = useCallback(async () => {
    // Mark wizard as completed; keep it open on failure so it does not silently reappear
    // on the next launch
    const result = await setSettings(
      { wizardCompleted: true, wizardSkipped: false },
      { notifyOnError: false },
    );
    if (!result.success) {
      setSaveFailed(true);
      return;
    }
    setSaveFailed(false);
    closeWizard();
  }, [setSettings, closeWizard]);

  return (
    <Dialog open={isOpen} onOpenChange={handleWizardOpenChange} modal disablePointerDismissal>
      <DialogContent className="max-h-[90vh] min-w-3xl" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              {currentStepTitle}
              {step?.optional && (
                <Badge variant="secondary">{t(translations.wizard.optional)}</Badge>
              )}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm">
            {t(translations.wizard.progress, { current: currentStep + 1, total: totalSteps })}
          </p>
          <Progress
            value={progress}
            className="h-2"
            aria-label={t(translations.wizard.progress, {
              current: currentStep + 1,
              total: totalSteps,
            })}
          />
        </div>

        {/* Step Content */}
        <div className="h-[600px] max-h-[calc(90vh-200px)] overflow-y-auto py-4">
          {CurrentStepComponent && <CurrentStepComponent />}
        </div>

        {/* Step validation hint */}
        {showValidationMessage && step?.validationMessageKey && (
          <p id={validationMessageId} className="text-muted-foreground text-sm" aria-live="polite">
            {t(step.validationMessageKey)}
          </p>
        )}

        {/* Skip Setup / Finish failure; steps show their own inline alert for their settings */}
        <WizardSaveError visible={saveFailed} />

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between border-t pt-4">
          <div>
            {!isFirstStep && (
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t(translations.wizard.back)}
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            {!isLastStep && (
              <Button variant="ghost" onClick={handleRequestSkip}>
                {t(translations.wizard.skipSetup)}
              </Button>
            )}

            {canSkipOptionalSteps && (
              <Button variant="outline" onClick={handleSkipOptionalSteps}>
                <FastForward className="mr-2 h-4 w-4" />
                {t(translations.wizard.skipOptionalSteps)}
              </Button>
            )}

            {isLastStep ? (
              <Button onClick={handleFinish}>
                <Check className="mr-2 h-4 w-4" />
                {t(translations.wizard.finish)}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={!canProceed}
                aria-describedby={showValidationMessage ? validationMessageId : undefined}
              >
                {t(translations.common.next)}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Skip Confirmation Dialog */}
        <AlertDialog open={showSkipConfirm} onOpenChange={setShowSkipConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t(translations.wizard.skipConfirm.title)}</AlertDialogTitle>
              <AlertDialogDescription render={<div />}>
                {!hasUsableSaveFolder && (
                  <p className="mb-2 font-medium text-warning">
                    {t(translations.wizard.skipConfirm.noSaveFolderWarning)}
                  </p>
                )}
                <p>{t(translations.wizard.skipConfirm.description)}</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t(translations.wizard.skipConfirm.continue)}</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmSkip}>
                {t(translations.wizard.skipConfirm.confirm)}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
