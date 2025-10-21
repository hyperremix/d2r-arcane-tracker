import { create } from 'zustand';

/**
 * Interface defining the wizard state structure and actions.
 * Manages wizard navigation and completion status.
 * Settings are applied directly to the app, not stored temporarily.
 */
interface WizardState {
  // UI State
  isOpen: boolean;
  currentStep: number;
  totalSteps: number;

  // Actions
  openWizard: () => void;
  closeWizard: () => void;
  nextStep: () => void;
  previousStep: () => void;
  jumpToStep: (step: number) => void;
  skip: () => void;
}

/**
 * Wizard store that manages the state of the setup wizard.
 * Handles step navigation. Settings are applied directly via grailStore.
 */
export const useWizardStore = create<WizardState>((set) => ({
  // Initial state
  isOpen: false,
  currentStep: 0,
  totalSteps: 9, // Welcome, Save Dir, Game Mode, Game Version, Grail, Theme, Notifications, Widget, Completion

  // Actions
  openWizard: () =>
    set({
      isOpen: true,
      currentStep: 0,
    }),

  closeWizard: () =>
    set({
      isOpen: false,
      currentStep: 0,
    }),

  nextStep: () =>
    set((state) => ({
      currentStep: Math.min(state.currentStep + 1, state.totalSteps - 1),
    })),

  previousStep: () =>
    set((state) => ({
      currentStep: Math.max(state.currentStep - 1, 0),
    })),

  jumpToStep: (step: number) =>
    set((state) => ({
      currentStep: Math.max(0, Math.min(step, state.totalSteps - 1)),
    })),

  skip: () =>
    set({
      isOpen: false,
      currentStep: 0,
    }),
}));
