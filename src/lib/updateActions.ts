import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import { translations } from '@/i18n/translations';

/**
 * Starts downloading the available app update and reports the outcome with a toast.
 * Shared by the automatic update notifications and the update settings.
 * @param {TFunction} t - Translation function for the toast texts
 * @returns {Promise<void>} Resolves once the download was started or the failure was reported
 */
export async function downloadUpdate(t: TFunction): Promise<void> {
  try {
    await window.electronAPI.update.downloadUpdate();
    toast.info(t(translations.settings.update.downloadingUpdate), {
      description: t(translations.settings.update.downloadStarted),
    });
  } catch (error) {
    console.error('Failed to download update:', error);
    toast.error(t(translations.settings.update.downloadFailed), {
      description: t(translations.settings.update.downloadFailedDescription),
    });
  }
}

/**
 * Quits the app and installs the downloaded update, reporting a failure with a toast.
 * Shared by the automatic update notifications and the update settings.
 * @param {TFunction} t - Translation function for the toast texts
 * @returns {Promise<void>} Resolves once the install was triggered or the failure was reported
 */
export async function installUpdate(t: TFunction): Promise<void> {
  try {
    await window.electronAPI.update.quitAndInstall();
  } catch (error) {
    console.error('Failed to install update:', error);
    toast.error(t(translations.settings.update.installFailed), {
      description: t(translations.settings.update.installFailedDescription),
    });
  }
}
