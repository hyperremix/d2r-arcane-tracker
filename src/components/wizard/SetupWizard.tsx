import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useGrailStore } from '@/stores/grailStore';
import { useWizardStore } from '@/stores/wizardStore';
import { CompletionStep } from './steps/CompletionStep';
import { GameModeStep } from './steps/GameModeStep';
import { GameVersionStep } from './steps/GameVersionStep';
import { GrailSettingsStep } from './steps/GrailSettingsStep';
import { NotificationsStep } from './steps/NotificationsStep';
import { SaveDirectoryStep } from './steps/SaveDirectoryStep';
import { ThemeStep } from './steps/ThemeStep';
import { WelcomeStep } from './steps/WelcomeStep';
import { WidgetStep } from './steps/WidgetStep';

/**
 * Step configuration with component, title, and optional validation.
 */
const steps = [
  { component: WelcomeStep, title: 'Welcome' },
  { component: SaveDirectoryStep, title: 'Save Directory' },
  { component: GameModeStep, title: 'Game Mode' },
  { component: GameVersionStep, title: 'Game Version' },
  { component: GrailSettingsStep, title: 'Grail Settings' },
  { component: ThemeStep, title: 'Theme' },
  { component: NotificationsStep, title: 'Notifications' },
  { component: WidgetStep, title: 'Widget' },
  { component: CompletionStep, title: 'Complete' },
];

/**
 * SetupWizard component - Main wizard dialog that guides users through app configuration.
 * Displays a multi-step modal with navigation controls and progress indicator.
 * @returns {JSX.Element} Setup wizard dialog
 */
export function SetupWizard() {
  const { isOpen, currentStep, totalSteps, nextStep, previousStep, skip, closeWizard } =
    useWizardStore();
  const { setSettings } = useGrailStore();

  const CurrentStepComponent = steps[currentStep]?.component;
  const currentStepTitle = steps[currentStep]?.title || '';
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  const handleNext = useCallback(() => {
    if (!isLastStep) {
      nextStep();
    }
  }, [isLastStep, nextStep]);

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

  // Validate current step (optional, can be expanded)
  const canProceed = useMemo(() => {
    // Add step-specific validation logic here if needed
    // For now, all steps can proceed
    return true;
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleSkip()}>
      <DialogContent
        className="max-h-[90vh] min-w-3xl"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{currentStepTitle}</DialogTitle>
          </div>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-sm">
            <span>
              Step {currentStep + 1} of {totalSteps}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step Content */}
        <div className="max-h-[calc(90vh-200px)] min-h-[400px] overflow-y-auto py-4">
          {CurrentStepComponent && <CurrentStepComponent />}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between border-t pt-4">
          <div>
            {!isFirstStep && (
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            {!isLastStep && (
              <Button variant="ghost" onClick={handleSkip}>
                Skip Setup
              </Button>
            )}

            {isLastStep ? (
              <Button onClick={handleFinish}>
                <Check className="mr-2 h-4 w-4" />
                Finish
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={!canProceed}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
