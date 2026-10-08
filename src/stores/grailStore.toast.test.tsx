import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toaster } from '@/components/ui/sonner';
import { resetSettingsWriteTracking, useGrailStore } from './grailStore';

const TOAST_TITLE = "Couldn't save your settings";

/**
 * Exercises the settings error toast through the real sonner lifecycle (real Toaster and real
 * timers): sonner removes toasts by id on its own schedule after an action click or dismiss,
 * which a mocked `toast` cannot reproduce.
 */
describe('When a settings save fails and the real Toaster is mounted', () => {
  const originalElectronAPI = window.electronAPI;
  const originalSettings = useGrailStore.getState().settings;
  const updateSettings = vi.fn();

  const wait = (ms: number) =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, ms));
    });

  let consoleError: { mockRestore: () => void } | undefined;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // sonner's Toaster reads the color scheme preference, which jsdom does not implement
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
    updateSettings.mockReset();
    resetSettingsWriteTracking();
    Object.defineProperty(window, 'electronAPI', {
      value: { grail: { updateSettings } },
      configurable: true,
      writable: true,
    });
    useGrailStore.setState({ settings: { ...originalSettings, theme: 'system' } });
  });

  afterEach(() => {
    toast.dismiss();
    resetSettingsWriteTracking();
    useGrailStore.setState({ settings: originalSettings });
    Object.defineProperty(window, 'electronAPI', {
      value: originalElectronAPI,
      configurable: true,
      writable: true,
    });
    vi.unstubAllGlobals();
    consoleError?.mockRestore();
  });

  const failSave = (key: 'theme' | 'showItemIcons', value: string | boolean) =>
    act(async () => {
      await useGrailStore.getState().setSettings({ [key]: value });
    });

  const clickRetry = async () => {
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
  };

  it('If Retry fails again right away, Then the error toast is still shown after sonner removal delay', async () => {
    // Arrange
    updateSettings.mockRejectedValue(new Error('database locked'));
    render(<Toaster />);
    await failSave('theme', 'dark');
    await screen.findByText(TOAST_TITLE);

    // Act
    await clickRetry();
    await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(2));
    await wait(500);

    // Assert
    expect(screen.getByText(TOAST_TITLE)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(useGrailStore.getState().settings.theme).toBe('system');
  });

  it('If a failed Retry is clicked again and succeeds, Then the change is applied and the toast is removed', async () => {
    // Arrange
    updateSettings
      .mockRejectedValueOnce(new Error('database locked'))
      .mockRejectedValueOnce(new Error('database locked'))
      .mockResolvedValue({ success: true });
    render(<Toaster />);

    // Act
    await failSave('theme', 'dark');
    await clickRetry();
    await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(2));
    await wait(500);
    await clickRetry();
    await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(3));

    // Assert
    expect(updateSettings).toHaveBeenLastCalledWith({ theme: 'dark' });
    expect(useGrailStore.getState().settings.theme).toBe('dark');
    await waitFor(() => expect(screen.queryByText(TOAST_TITLE)).not.toBeInTheDocument());
  });

  it('If a successful Retry is followed by a new failure within 250 ms, Then the new error toast stays visible', async () => {
    // Arrange
    updateSettings
      .mockRejectedValueOnce(new Error('database locked'))
      .mockResolvedValueOnce({ success: true })
      .mockRejectedValueOnce(new Error('database locked'));
    render(<Toaster />);

    // Act
    await failSave('theme', 'dark');
    await clickRetry();
    await waitFor(() => expect(useGrailStore.getState().settings.theme).toBe('dark'));
    await failSave('showItemIcons', true);
    await wait(500);

    // Assert: sonner keeps a removed toast in the DOM (data-removed) until it unmounts it
    const shownToasts = document.querySelectorAll('[data-sonner-toast][data-removed="false"]');
    expect(shownToasts).toHaveLength(1);
    expect(within(shownToasts[0] as HTMLElement).getByText(TOAST_TITLE)).toBeInTheDocument();
    expect(
      within(shownToasts[0] as HTMLElement).getByRole('button', { name: 'Retry' }),
    ).toBeInTheDocument();
  });

  it('If the failed key is saved again by hand and fails again, Then the error toast stays visible with a working Retry', async () => {
    // Arrange
    updateSettings
      .mockRejectedValueOnce(new Error('database locked'))
      .mockRejectedValueOnce(new Error('database locked'))
      .mockResolvedValue({ success: true });
    render(<Toaster />);

    // Act
    await failSave('theme', 'dark');
    await screen.findByText(TOAST_TITLE);
    await failSave('theme', 'dark');
    await wait(500);
    await clickRetry();
    await waitFor(() => expect(useGrailStore.getState().settings.theme).toBe('dark'));

    // Assert
    await waitFor(() => expect(screen.queryByText(TOAST_TITLE)).not.toBeInTheDocument());
  });

  it('If the error toast is dismissed, Then a later failure shows a new toast whose Retry only re-applies the new change', async () => {
    // Arrange
    updateSettings
      .mockRejectedValueOnce(new Error('database locked'))
      .mockRejectedValueOnce(new Error('database locked'))
      .mockResolvedValue({ success: true });
    render(<Toaster />);

    // Act
    await failSave('theme', 'dark');
    await screen.findByText(TOAST_TITLE);
    act(() => {
      toast.dismiss();
    });
    await waitFor(() => expect(screen.queryByText(TOAST_TITLE)).not.toBeInTheDocument());
    await failSave('showItemIcons', true);
    await clickRetry();
    await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(3));

    // Assert
    expect(updateSettings).toHaveBeenLastCalledWith({ showItemIcons: true });
    expect(useGrailStore.getState().settings.theme).toBe('system');
  });
});
