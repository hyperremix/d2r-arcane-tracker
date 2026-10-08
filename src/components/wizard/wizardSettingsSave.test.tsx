import { act, fireEvent, render, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGrailStore } from '@/stores/grailStore';
import { GrailSettingsStep } from './steps/GrailSettingsStep';
import { NotificationsStep } from './steps/NotificationsStep';

describe('When a wizard step saves settings', () => {
  const originalElectronAPI = window.electronAPI;
  const originalSettings = useGrailStore.getState().settings;
  const updateSettings = vi.fn();

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    updateSettings.mockReset();
    Object.defineProperty(window, 'electronAPI', {
      value: { grail: { updateSettings, getItems: vi.fn(), getProgress: vi.fn() } },
      configurable: true,
      writable: true,
    });
    useGrailStore.setState((state) => ({
      settings: { ...state.settings, grailEthereal: false, inAppNotifications: true },
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useGrailStore.setState({ settings: originalSettings });
    Object.defineProperty(window, 'electronAPI', {
      value: originalElectronAPI,
      configurable: true,
      writable: true,
    });
  });

  it('If the save fails, Then the change is reverted, an inline alert is shown and no toast is raised', async () => {
    // Arrange
    const toastError = vi.spyOn(toast, 'error');
    updateSettings.mockRejectedValue(new Error('database locked'));
    render(<GrailSettingsStep />);

    // Act
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Include Ethereal Items'));
    });

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your setup could not be saved. Please try again.',
    );
    expect(useGrailStore.getState().settings.grailEthereal).toBe(false);
    expect(toastError).not.toHaveBeenCalled();
  });

  it('If a later save succeeds after a failed one, Then the inline alert is cleared', async () => {
    // Arrange
    updateSettings
      .mockRejectedValueOnce(new Error('database locked'))
      .mockResolvedValue({ success: true });
    render(<NotificationsStep />);
    const toggle = screen.getByRole('switch', { name: 'In-App Notifications' });

    // Act
    await act(async () => {
      fireEvent.click(toggle);
    });
    await act(async () => {
      fireEvent.click(toggle);
    });

    // Assert
    expect(updateSettings).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(useGrailStore.getState().settings.inAppNotifications).toBe(false);
  });
});
