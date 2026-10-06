import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import type { ComponentType } from 'react';
import { useCallback, useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { translations } from '@/i18n/translations';
import { useGrailStore } from '@/stores/grailStore';
import { useWizardStore } from '@/stores/wizardStore';
import { CompletionStep } from './steps/CompletionStep';
import { D2RInstallationStep } from './steps/D2RInstallationStep';
import { GameModeStep } from './steps/GameModeStep';
import { GameVersionStep } from './steps/GameVersionStep';
import { GrailSettingsStep } from './steps/GrailSettingsStep';
import { PreferencesStep } from './steps/PreferencesStep';
import { SAVE_DIRECTORY_STEP_ID, SaveDirectoryStep } from './steps/SaveDirectoryStep';
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
  /** Step only contains optional preferences. */
  optional?: boolean;
}

/**
 * Ordered wizard steps. The length must match `totalSteps` in the wizard store.
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
  {
    id: 'd2rInstallation',
    component: D2RInstallationStep,
    titleKey: translations.wizard.steps.d2rInstallation,
  },
  { id: 'gameMode', component: GameModeStep, titleKey: translations.wizard.steps.gameMode },
  {
    id: 'gameVersion',
    component: GameVersionStep,
    titleKey: translations.wizard.steps.gameVersion,
  },
  {
    id: 'grailSettings',
    component: GrailSettingsStep,
    titleKey: translations.wizard.steps.grailSettings,
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
    skip,
    closeWizard,
  } = useWizardStore();
  const { setSettings } = useGrailStore();

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

  const handleNext = useCallback(() => {
    if (!isLastStep && canProceed) {
      nextStep();
    }
  }, [isLastStep, canProceed, nextStep]);

  const handleBack = useCallback(() => {
    if (!isFirstStep) {
      previousStep();
    }
  }, [isFirstStep, previousStep]);

  const handleSkip = useCallback(async () => {
    // Mark wizard as skipped (preserving any settings already made)
    await setSettings({ wizardSkipped: true, wizardCompleted: false });
    skip();
  }, [setSettings, skip]);

  const handleFinish = useCallback(async () => {
    try {
      // Mark wizard as completed
      await setSettings({
        wizardCompleted: true,
        wizardSkipped: false,
      });

      // Close the wizard
      closeWizard();
    } catch (error) {
      console.error('Failed to mark wizard as completed:', error);
    }
  }, [setSettings, closeWizard]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleSkip()} modal>
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
          <div className="flex items-center justify-between text-muted-foreground text-sm">
            <span>
              {t(translations.wizard.progress, { current: currentStep + 1, total: totalSteps })}
            </span>
            <span>{t(translations.wizard.progressPercent, { percent: Math.round(progress) })}</span>
          </div>
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
              <Button variant="ghost" onClick={handleSkip}>
                {t(translations.wizard.skipSetup)}
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
      </DialogContent>
    </Dialog>
  );
}
