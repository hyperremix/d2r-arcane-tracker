import type { Settings } from 'electron/types/grail';
import i18n from 'i18next';
import { toast } from 'sonner';
import { translations } from '@/i18n/translations';
import type { SettingsSavedCallback } from './settingsStore';

/**
 * User feedback for failed settings saves: the shared error toast and the Retry it offers. Kept
 * apart from the settings slice so the store logic itself has no UI side effects.
 */

/** Prefix of the id of the settings error toast; see `activeErrorToastId`. */
const SETTINGS_SAVE_ERROR_TOAST_ID_PREFIX = 'settings-save-error';

/** A reverted key: the value its failed save attempted and the follow-up to run once saved. */
interface RevertedSetting {
  value: Settings[keyof Settings];
  onSaved?: SettingsSavedCallback;
}

/**
 * Saves the update collected by a Retry click.
 * @param update - The values the failed saves attempted
 * @param followUps - The distinct follow-ups of those saves, in the order they failed
 */
export type RetrySettingsSave = (
  update: Partial<Settings>,
  followUps: SettingsSavedCallback[],
) => void;

/**
 * Keys whose failed save was reverted and offered for Retry on the shared error toast, with
 * the value the failed save attempted. A key is dropped as soon as it is written or hydrated
 * again, so a stale Retry can never overwrite a newer value, and the whole map is dropped when
 * the toast closes, so an abandoned change is never re-applied by a later failure's Retry.
 */
const revertedSettings = new Map<keyof Settings, RevertedSetting>();

/**
 * Id of the error toast currently on screen, if any. Failures while it is showing update it in
 * place (so e.g. dragging a slider does not stack toasts); once it is gone, the next failure
 * gets a fresh id. sonner removes toasts by id on its own timers after a dismissal, so reusing
 * the id of a toast that was just dismissed would let those stale timers remove the new toast.
 */
let activeErrorToastId: string | undefined;
let errorToastCount = 0;

/**
 * Clears the Retry bookkeeping. Only intended for tests, which share this module state.
 */
export const resetSettingsSaveFeedback = (): void => {
  revertedSettings.clear();
  activeErrorToastId = undefined;
  errorToastCount = 0;
};

/**
 * Stops offering Retry for keys that were written or hydrated since their save failed.
 * @param {Array<keyof Settings>} keys - The keys that were just written
 */
export const forgetSettingsRetry = (keys: Array<keyof Settings>): void => {
  for (const key of keys) {
    revertedSettings.delete(key);
  }
};

/**
 * Dismisses the error toast once nothing is left to retry. Called when a save succeeded or
 * settings were hydrated, never at the start of a save: that save may still fail and must then
 * keep updating the same toast.
 */
export const dismissSettingsSaveErrorIfNothingToRetry = (): void => {
  if (revertedSettings.size > 0 || activeErrorToastId === undefined) {
    return;
  }
  const toastId = activeErrorToastId;
  activeErrorToastId = undefined;
  try {
    toast.dismiss(toastId);
  } catch (error) {
    console.error('Failed to dismiss the settings save error notification:', error);
  }
};

/**
 * Shows the error toast for a failed settings save with a Retry action. The toast is shared,
 * so Retry re-applies every key still waiting for a retry (not just the keys of this failure)
 * and skips keys that were written since.
 * @param {Partial<Settings>} reverted - The persisted values the failed keys were reverted to
 * @param {Partial<Settings>} attempted - The update whose save failed
 * @param {SettingsSavedCallback | undefined} onSaved - Follow-up of the failed save, re-run by Retry
 * @param {RetrySettingsSave} retry - Saves the collected update when Retry is clicked
 */
export const notifySettingsSaveFailed = (
  reverted: Partial<Settings>,
  attempted: Partial<Settings>,
  onSaved: SettingsSavedCallback | undefined,
  retry: RetrySettingsSave,
): void => {
  for (const key of Object.keys(reverted) as Array<keyof Settings>) {
    revertedSettings.set(key, { value: attempted[key], onSaved });
  }
  const toastId =
    activeErrorToastId ?? `${SETTINGS_SAVE_ERROR_TOAST_ID_PREFIX}-${++errorToastCount}`;
  activeErrorToastId = toastId;
  // Once the toast closes (timeout or dismiss) its Retry is gone, so the abandoned changes must
  // not be re-applied by the Retry of a later, unrelated failure. A stale callback of an older
  // toast must not wipe the state of a newer one.
  const forgetAbandonedRetry = (): void => {
    if (activeErrorToastId === toastId) {
      activeErrorToastId = undefined;
      revertedSettings.clear();
    }
  };
  // Reporting is best effort: a failing toast or translation must not make setSettings reject
  try {
    toast.error(i18n.t(translations.settings.saveError.title), {
      id: toastId,
      description: i18n.t(translations.settings.saveError.description),
      action: {
        label: i18n.t(translations.common.retry),
        onClick: (event) => {
          // Keep the toast until the retry settles: sonner would otherwise remove it by id a
          // moment later, taking a toast shown for a failed retry with it. A successful retry
          // dismisses it, a failed one updates it in place.
          event.preventDefault();
          if (revertedSettings.size === 0) {
            return;
          }
          const update: Partial<Settings> = {};
          const followUps = new Set<SettingsSavedCallback>();
          for (const [key, entry] of revertedSettings) {
            Object.assign(update, { [key]: entry.value });
            if (entry.onSaved) {
              followUps.add(entry.onSaved);
            }
          }
          retry(update, [...followUps]);
        },
      },
      onDismiss: forgetAbandonedRetry,
      onAutoClose: forgetAbandonedRetry,
    });
  } catch (error) {
    console.error('Failed to show the settings save error notification:', error);
    forgetAbandonedRetry();
  }
};
