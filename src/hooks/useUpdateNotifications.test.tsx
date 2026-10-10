import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { UpdateStatus } from 'electron/types/grail';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Toaster } from '@/components/ui/sonner';
import { useUpdateNotifications } from './useUpdateNotifications';

/**
 * Exercises the automatic update toasts through the real sonner Toaster, so the assertions see
 * the translated texts the user sees.
 */
describe('When useUpdateNotifications receives an update status', () => {
  const originalElectronAPI = window.electronAPI;
  const downloadUpdateMock = vi.fn();
  let emitStatus: (status: UpdateStatus) => void = () => undefined;

  const idleStatus: UpdateStatus = {
    checking: false,
    available: false,
    downloading: false,
    downloaded: false,
  };

  beforeEach(() => {
    downloadUpdateMock.mockReset().mockResolvedValue({ success: true });
    // sonner's Toaster reads the color scheme preference, which jsdom does not implement
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
    Object.defineProperty(window, 'electronAPI', {
      value: {
        update: {
          downloadUpdate: downloadUpdateMock,
          quitAndInstall: vi.fn(),
          onUpdateStatus: (listener: (status: UpdateStatus) => void) => {
            emitStatus = listener;
            return () => {
              emitStatus = () => undefined;
            };
          },
        },
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    act(() => {
      toast.dismiss();
    });
    Object.defineProperty(window, 'electronAPI', {
      value: originalElectronAPI,
      configurable: true,
      writable: true,
    });
    vi.unstubAllGlobals();
  });

  it('If an update is available, Then a translated toast offers to download it', async () => {
    // Arrange
    render(<Toaster />);
    renderHook(() => useUpdateNotifications());

    // Act
    act(() => {
      emitStatus({
        ...idleStatus,
        available: true,
        info: { version: '1.2.3', releaseDate: '2026-10-01' },
      });
    });

    // Assert
    expect(await screen.findByText('Update Available')).toBeInTheDocument();
    expect(screen.getByText('Version 1.2.3 is ready to download')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('If Download is clicked, Then the shared download action starts the download', async () => {
    // Arrange
    render(<Toaster />);
    renderHook(() => useUpdateNotifications());
    act(() => {
      emitStatus({
        ...idleStatus,
        available: true,
        info: { version: '1.2.3', releaseDate: '2026-10-01' },
      });
    });

    // Act
    fireEvent.click(await screen.findByRole('button', { name: 'Download' }));

    // Assert
    await waitFor(() => expect(downloadUpdateMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Downloading Update')).toBeInTheDocument();
  });

  it('If an update was downloaded, Then a translated toast offers to restart', async () => {
    // Arrange
    render(<Toaster />);
    renderHook(() => useUpdateNotifications());

    // Act
    act(() => {
      emitStatus({ ...idleStatus, available: true, downloaded: true });
    });

    // Assert
    expect(await screen.findByText('Update Ready')).toBeInTheDocument();
    expect(screen.getByText('Restart to install the update')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restart Now' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Later' })).toBeInTheDocument();
  });
});
