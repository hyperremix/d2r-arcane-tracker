import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it.each([0, 300])(
    'If Retry fails again after %i ms, Then the error toast stays visible with a working Retry',
    async (retryFailureDelayMs) => {
      // Arrange
      updateSettings
        .mockRejectedValueOnce(new Error('database locked'))
        .mockImplementationOnce(
          () =>
            new Promise((_, reject) => {
              setTimeout(() => reject(new Error('database locked')), retryFailureDelayMs);
            }),
        )
        .mockResolvedValue({ success: true });
      render(<Toaster />);
      await act(async () => {
        await useGrailStore.getState().setSettings({ theme: 'dark' });
      });
      fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
      await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(2));

      // Act: let sonner's own removal timers for the clicked toast run out
      await wait(retryFailureDelayMs + 500);

      // Assert: the failed retry left a visible toast whose Retry still re-applies the change
      expect(screen.getByText(TOAST_TITLE)).toBeInTheDocument();
      expect(useGrailStore.getState().settings.theme).toBe('system');
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      await waitFor(() => expect(useGrailStore.getState().settings.theme).toBe('dark'));
      expect(updateSettings).toHaveBeenCalledTimes(3);
      expect(updateSettings).toHaveBeenLastCalledWith({ theme: 'dark' });
      await waitFor(() => expect(screen.queryByText(TOAST_TITLE)).not.toBeInTheDocument());
    },
  );

  it('If the failed key is saved again by hand and fails again, Then the error toast stays visible with a working Retry', async () => {
    // Arrange
    updateSettings
      .mockRejectedValueOnce(new Error('database locked'))
      .mockRejectedValueOnce(new Error('database locked'))
      .mockResolvedValue({ success: true });
    render(<Toaster />);
    await act(async () => {
      await useGrailStore.getState().setSettings({ theme: 'dark' });
    });
    await screen.findByText(TOAST_TITLE);

    // Act
    await act(async () => {
      await useGrailStore.getState().setSettings({ theme: 'dark' });
    });
    await wait(500);

    // Assert
    expect(screen.getByText(TOAST_TITLE)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(useGrailStore.getState().settings.theme).toBe('dark'));
    await waitFor(() => expect(screen.queryByText(TOAST_TITLE)).not.toBeInTheDocument());
  });

  it('If the error toast is dismissed, Then a later failure shows a new toast whose Retry only re-applies the new change', async () => {
    // Arrange
    updateSettings
      .mockRejectedValueOnce(new Error('database locked'))
      .mockRejectedValueOnce(new Error('database locked'))
      .mockResolvedValue({ success: true });
    render(<Toaster />);
    await act(async () => {
      await useGrailStore.getState().setSettings({ theme: 'dark' });
    });
    await screen.findByText(TOAST_TITLE);
    act(() => {
      toast.dismiss();
    });
    await waitFor(() => expect(screen.queryByText(TOAST_TITLE)).not.toBeInTheDocument());

    // Act
    await act(async () => {
      await useGrailStore.getState().setSettings({ showItemIcons: true });
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));

    // Assert
    await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(3));
    expect(updateSettings).toHaveBeenLastCalledWith({ showItemIcons: true });
    expect(useGrailStore.getState().settings.theme).toBe('system');
  });
});
