import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockStoreState } from '@/test/storeMock';
import App from './App';
import { initGrailData, useGrailStore } from './stores/grailStore';
import { useWizardStore } from './stores/wizardStore';

vi.mock('react-router', () => ({
  RouterProvider: () => <div data-testid="router" />,
}));

vi.mock('./router', () => ({
  router: { navigate: vi.fn() },
}));

vi.mock('@/components/wizard/SetupWizard', () => ({
  SetupWizard: () => <div data-testid="setup-wizard" />,
}));

vi.mock('@/components/ui/sonner', () => ({
  Toaster: () => <div data-testid="toaster" />,
}));

vi.mock('./hooks/useItemIcon', () => ({ useIconPreloader: vi.fn() }));
vi.mock('./hooks/useServiceErrorNotifications', () => ({
  useServiceErrorNotifications: vi.fn(),
}));
vi.mock('./hooks/useSettingsLanguage', () => ({ useSettingsLanguage: vi.fn() }));
vi.mock('./hooks/useTheme', () => ({ useTheme: vi.fn() }));
vi.mock('./hooks/useUpdateNotifications', () => ({ useUpdateNotifications: vi.fn() }));

vi.mock('./stores/grailStore', () => ({
  initGrailData: vi.fn(),
  useGrailStore: Object.assign(vi.fn(), { getState: vi.fn() }),
}));

vi.mock('./stores/wizardStore', () => ({
  useWizardStore: vi.fn(),
}));

const WIZARD_DELAY_MS = 500;

interface GrailStateOverrides {
  settingsHydrated?: boolean;
  wizardCompleted?: boolean;
  wizardSkipped?: boolean;
}

describe('When App is rendered', () => {
  const cleanupGrailData = vi.fn();
  const openWizard = vi.fn();

  const setGrailState = ({
    settingsHydrated = true,
    wizardCompleted = false,
    wizardSkipped = false,
  }: GrailStateOverrides = {}) => {
    const state = { settingsHydrated, settings: { wizardCompleted, wizardSkipped } };
    mockStoreState(vi.mocked(useGrailStore), state);
    vi.mocked(useGrailStore.getState).mockReturnValue(state as never);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.mocked(initGrailData).mockReturnValue(cleanupGrailData);
    mockStoreState(vi.mocked(useWizardStore), { openWizard });
    setGrailState();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('If the window mounts and unmounts', () => {
    it('Then the grail data is initialised once and cleaned up on unmount', () => {
      // Arrange & Act
      const { unmount } = render(<App />);

      // Assert
      expect(initGrailData).toHaveBeenCalledTimes(1);
      expect(cleanupGrailData).not.toHaveBeenCalled();

      // Act
      unmount();

      // Assert
      expect(cleanupGrailData).toHaveBeenCalledTimes(1);
    });
  });

  describe('If the window re-renders', () => {
    it('Then the grail data is not initialised again', () => {
      // Arrange
      const { rerender } = render(<App />);

      // Act
      rerender(<App />);

      // Assert
      expect(initGrailData).toHaveBeenCalledTimes(1);
    });
  });

  describe('If the settings are hydrated and the wizard was never completed or skipped', () => {
    it('Then the wizard opens once after a short delay', () => {
      // Arrange
      const { rerender } = render(<App />);
      expect(openWizard).not.toHaveBeenCalled();

      // Act
      rerender(<App />);
      act(() => {
        vi.advanceTimersByTime(WIZARD_DELAY_MS);
      });

      // Assert
      expect(openWizard).toHaveBeenCalledTimes(1);
    });
  });

  describe('If the settings are not hydrated yet', () => {
    it('Then the wizard does not open, even for default settings', () => {
      // Arrange
      setGrailState({ settingsHydrated: false });

      // Act
      render(<App />);
      act(() => {
        vi.advanceTimersByTime(WIZARD_DELAY_MS);
      });

      // Assert
      expect(openWizard).not.toHaveBeenCalled();
    });

    it('Then the wizard opens after the settings are hydrated', () => {
      // Arrange
      setGrailState({ settingsHydrated: false });
      const { rerender } = render(<App />);
      setGrailState({ settingsHydrated: true });

      // Act
      rerender(<App />);
      act(() => {
        vi.advanceTimersByTime(WIZARD_DELAY_MS);
      });

      // Assert
      expect(openWizard).toHaveBeenCalledTimes(1);
    });
  });

  describe.each([
    ['completed', { wizardCompleted: true }],
    ['skipped', { wizardSkipped: true }],
  ])('If the wizard was already %s', (_label, overrides) => {
    it('Then the wizard does not open', () => {
      // Arrange
      setGrailState(overrides);

      // Act
      render(<App />);
      act(() => {
        vi.advanceTimersByTime(WIZARD_DELAY_MS);
      });

      // Assert
      expect(openWizard).not.toHaveBeenCalled();
    });
  });
});
