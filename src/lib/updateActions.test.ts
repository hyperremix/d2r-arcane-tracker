import i18n from 'i18next';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadUpdate, installUpdate } from './updateActions';

describe('When the shared update actions are used', () => {
  const originalElectronAPI = window.electronAPI;
  const downloadUpdateMock = vi.fn();
  const quitAndInstallMock = vi.fn();
  let toastInfo: ReturnType<typeof vi.spyOn>;
  let toastError: ReturnType<typeof vi.spyOn>;
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    downloadUpdateMock.mockReset();
    quitAndInstallMock.mockReset();
    toastInfo = vi.spyOn(toast, 'info').mockImplementation(() => 'info');
    toastError = vi.spyOn(toast, 'error').mockImplementation(() => 'error');
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    Object.defineProperty(window, 'electronAPI', {
      value: { update: { downloadUpdate: downloadUpdateMock, quitAndInstall: quitAndInstallMock } },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    toastInfo.mockRestore();
    toastError.mockRestore();
    consoleError.mockRestore();
    Object.defineProperty(window, 'electronAPI', {
      value: originalElectronAPI,
      configurable: true,
      writable: true,
    });
  });

  it('If the download starts, Then a translated info toast is shown', async () => {
    // Arrange
    downloadUpdateMock.mockResolvedValue({ success: true });

    // Act
    await downloadUpdate(i18n.t);

    // Assert
    expect(downloadUpdateMock).toHaveBeenCalledTimes(1);
    expect(toastInfo).toHaveBeenCalledWith('Downloading Update', {
      description: 'Download started in the background',
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it('If the download fails, Then a translated error toast is shown', async () => {
    // Arrange
    downloadUpdateMock.mockRejectedValue(new Error('offline'));

    // Act
    await downloadUpdate(i18n.t);

    // Assert
    expect(toastError).toHaveBeenCalledWith('Download Failed', {
      description: 'Failed to download update',
    });
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it('If the install fails, Then a translated error toast is shown', async () => {
    // Arrange
    quitAndInstallMock.mockRejectedValue(new Error('locked'));

    // Act
    await installUpdate(i18n.t);

    // Assert
    expect(quitAndInstallMock).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith('Install Failed', {
      description: 'Failed to install update',
    });
  });
});
