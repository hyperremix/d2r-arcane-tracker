import type { Settings } from 'electron/types/grail';
import { createDefaultSettings } from 'electron/utils/settingsCodec';
import type { StateCreator } from 'zustand';
import type { GrailState } from './grailStore';
import {
  dismissSettingsSaveErrorIfNothingToRetry,
  forgetSettingsRetry,
  notifySettingsSaveFailed,
  resetSettingsSaveFeedback,
} from './settingsSaveFeedback';

/**
 * Settings slice of the grail store: the settings shared with the main process, saved with
 * optimistic updates, per-key write tracking and rollback of failed saves. The slice is part of
 * `useGrailStore` because a settings change also prunes the grail filter and reloads the
 * filtered grail data in the same update. Failure feedback (error toast and Retry) lives in
 * `settingsSaveFeedback.ts`.
 */

/**
 * Outcome of a settings save. `setSettings` never rejects; callers that need to react to a
 * failed save (e.g. keep a dialog open) inspect `success` instead.
 */
export type SettingsSaveResult = { success: true } | { success: false; error: unknown };

/**
 * Options controlling how `setSettings` reports a failed save.
 */
export interface SetSettingsOptions {
  /**
   * Show an error toast with a Retry action when the save fails. Defaults to `true`.
   * Disable when the caller presents its own inline error (e.g. inside a modal dialog).
   */
  notifyOnError?: boolean;
  /**
   * Follow-up to run once the update was saved (e.g. an IPC call that applies the setting to a
   * window). The error toast's Retry runs it again for the keys it re-applies, so the follow-up
   * is not lost when the first attempt failed. A throwing follow-up is logged and never makes
   * `setSettings` reject.
   */
  onSaved?: () => void | Promise<void>;
}

export type SettingsSavedCallback = NonNullable<SetSettingsOptions['onSaved']>;

/**
 * State and actions of the settings slice.
 */
export interface SettingsSlice {
  settings: Settings;
  /** True once settings (or an explicit theme choice) are known; until then `settings` holds defaults. */
  settingsHydrated: boolean;
  setSettings: (
    settings: Partial<Settings>,
    options?: SetSettingsOptions,
  ) => Promise<SettingsSaveResult>;
  hydrateSettings: (settings: Partial<Settings>) => void;
}

/**
 * Applies a settings update and drops type filters (rune/runeword) whose tracking was
 * disabled, since their checkboxes are no longer shown and could not be untoggled.
 * @param {Pick<GrailState, 'settings' | 'filter'>} state - The current store state
 * @param {Partial<Settings>} settingsUpdate - The settings to merge
 * @returns {Pick<GrailState, 'settings' | 'filter'>} The next settings and (pruned) filter
 */
export const withSettingsUpdate = (
  state: Pick<GrailState, 'settings' | 'filter'>,
  settingsUpdate: Partial<Settings>,
): Pick<GrailState, 'settings' | 'filter'> => {
  const settings = { ...state.settings, ...settingsUpdate };
  const { filter } = state;
  const types = filter.types?.filter(
    (type) =>
      (type !== 'rune' || settings.grailRunes) && (type !== 'runeword' || settings.grailRunewords),
  );
  return {
    settings,
    filter: types && types.length !== filter.types?.length ? { ...filter, types } : filter,
  };
};

/** Settings whose change requires reloading the (filtered) items and progress. */
const GRAIL_FILTER_SETTING_KEYS: ReadonlyArray<keyof Settings> = [
  'grailNormal',
  'grailEthereal',
  'grailRunes',
  'grailRunewords',
];

/**
 * Whether an update changes a setting that requires reloading the filtered grail data.
 * @param {Partial<Settings>} settingsUpdate - The saved update
 * @returns {boolean} True if items and progress must be reloaded
 */
export const affectsGrailFilter = (settingsUpdate: Partial<Settings>): boolean =>
  Object.keys(settingsUpdate).some((key) =>
    GRAIL_FILTER_SETTING_KEYS.includes(key as keyof Settings),
  );

/**
 * Bookkeeping for the saves of a single settings key that are currently in flight.
 */
interface SettingKeyWrites {
  /** Token of the most recently started save for this key; it owns the optimistic value. */
  latestToken: number;
  /** Number of saves for this key that have not settled yet. */
  inFlight: number;
  /** Last value known to be persisted, which a failed latest save rolls back to. */
  persisted: Settings[keyof Settings];
}

const settingKeyWrites = new Map<keyof Settings, SettingKeyWrites>();
let lastWriteToken = 0;

/**
 * Clears all write tracking and the save failure feedback state. Only intended for tests, which
 * share this module state.
 */
export const resetSettingsWriteTracking = (): void => {
  settingKeyWrites.clear();
  lastWriteToken = 0;
  resetSettingsSaveFeedback();
};

/**
 * Runs a save follow-up. Failures are logged only: the setting itself was saved.
 * @param {SettingsSavedCallback | undefined} onSaved - The follow-up, if any
 */
const runOnSaved = async (onSaved: SettingsSavedCallback | undefined): Promise<void> => {
  try {
    await onSaved?.();
  } catch (error) {
    console.error('Failed to apply a saved setting:', error);
  }
};

/**
 * Combines the follow-ups of several failed saves into one that runs them in order.
 * @param {SettingsSavedCallback[]} followUps - The follow-ups to run
 * @returns {SettingsSavedCallback | undefined} The combined follow-up, or undefined if there is none
 */
const combineFollowUps = (followUps: SettingsSavedCallback[]): SettingsSavedCallback | undefined =>
  followUps.length > 0
    ? async () => {
        for (const followUp of followUps) {
          await runOnSaved(followUp);
        }
      }
    : undefined;

/**
 * Registers a settings save as in flight. Must run before the optimistic update is applied so
 * the value being replaced can be remembered as the last persisted one.
 * @param {Settings} currentSettings - The settings before the optimistic update
 * @param {Partial<Settings>} settingsUpdate - The update about to be saved
 * @returns {number} Token identifying this save
 */
const beginSettingsWrite = (
  currentSettings: Settings,
  settingsUpdate: Partial<Settings>,
): number => {
  lastWriteToken += 1;
  const keys = Object.keys(settingsUpdate) as Array<keyof Settings>;
  forgetSettingsRetry(keys);
  for (const key of keys) {
    const entry = settingKeyWrites.get(key) ?? {
      latestToken: lastWriteToken,
      inFlight: 0,
      persisted: currentSettings[key],
    };
    entry.latestToken = lastWriteToken;
    entry.inFlight += 1;
    settingKeyWrites.set(key, entry);
  }
  return lastWriteToken;
};

/**
 * Settles an in-flight settings save and, on failure, builds the rollback. Writes are tracked
 * per key so a failure only reverts keys this save still owns: if a newer save for the same key
 * started in the meantime, that save owns the value (and reverts to the last persisted value
 * itself if it fails too), regardless of whether the values happen to be equal. Keys whose
 * value was changed by something else since are left alone.
 * @param {number} token - Token returned by `beginSettingsWrite`
 * @param {Settings} currentSettings - The settings as they are now
 * @param {Partial<Settings>} settingsUpdate - The update that was saved
 * @param {boolean} succeeded - Whether the save was persisted
 * @returns {Partial<Settings>} The persisted values of the keys that should be reverted
 */
const settleSettingsWrite = (
  token: number,
  currentSettings: Settings,
  settingsUpdate: Partial<Settings>,
  succeeded: boolean,
): Partial<Settings> => {
  const rollback: Partial<Settings> = {};
  for (const key of Object.keys(settingsUpdate) as Array<keyof Settings>) {
    const entry = settingKeyWrites.get(key);
    if (!entry) {
      continue;
    }
    if (succeeded) {
      // Saves are handled in order by the main process, so the latest settled save wins
      entry.persisted = settingsUpdate[key];
    } else if (
      entry.latestToken === token &&
      Object.is(currentSettings[key], settingsUpdate[key])
    ) {
      Object.assign(rollback, { [key]: entry.persisted });
    }
    entry.inFlight -= 1;
    if (entry.inFlight <= 0) {
      settingKeyWrites.delete(key);
    }
  }
  return rollback;
};

/**
 * Reloads items and progress after a grail filter setting changed. Failures are logged only:
 * the setting itself was saved, so it must not be rolled back.
 * @param {(partial: Pick<GrailState, 'items'> | Pick<GrailState, 'progress'>) => void} set - Store setter
 */
const reloadFilteredGrailData = async (
  set: (partial: Pick<GrailState, 'items'> | Pick<GrailState, 'progress'>) => void,
): Promise<void> => {
  try {
    const items = await window.electronAPI?.grail.getItems();
    if (items) {
      set({ items });
      console.log(`Reloaded ${items.length} filtered Holy Grail items from database`);
    }

    const progressData = await window.electronAPI?.grail.getProgress();
    if (progressData) {
      set({ progress: progressData });
      console.log(`Reloaded ${progressData.length} filtered progress entries from database`);
    }
  } catch (error) {
    console.error('Failed to reload grail data after updating settings:', error);
  }
};

/**
 * Creates the settings slice of the grail store.
 */
export const createSettingsSlice: StateCreator<GrailState, [], [], SettingsSlice> = (set, get) => ({
  settings: createDefaultSettings(),
  settingsHydrated: false,

  setSettings: async (settingsUpdate, options) => {
    const writeToken = beginSettingsWrite(get().settings, settingsUpdate);

    // Update local state optimistically. An explicit theme choice is a real value even if the
    // initial settings load failed, so mark settings as hydrated to let the theme be applied and cached.
    set((state) => ({
      ...withSettingsUpdate(state, settingsUpdate),
      ...(settingsUpdate.theme !== undefined ? { settingsHydrated: true } : {}),
    }));

    // Persist to database
    try {
      const result = await window.electronAPI?.grail.updateSettings(settingsUpdate);
      if (result && !result.success) {
        throw new Error('Settings update was not persisted');
      }
    } catch (error) {
      console.error('Failed to update settings:', error);

      const rollback = settleSettingsWrite(writeToken, get().settings, settingsUpdate, false);
      const revertedKeys = Object.keys(rollback) as Array<keyof Settings>;
      // Nothing to revert or report if every key was already superseded by a newer update
      if (revertedKeys.length > 0) {
        set((state) => withSettingsUpdate(state, rollback));
        if (options?.notifyOnError !== false) {
          notifySettingsSaveFailed(
            rollback,
            settingsUpdate,
            options?.onSaved,
            (update, followUps) => {
              void get().setSettings(update, { onSaved: combineFollowUps(followUps) });
            },
          );
        }
      }

      return { success: false, error };
    }
    settleSettingsWrite(writeToken, get().settings, settingsUpdate, true);
    dismissSettingsSaveErrorIfNothingToRetry();
    await runOnSaved(options?.onSaved);

    // The setting is saved at this point; a failed reload only leaves stale item data and
    // must not roll the setting back.
    if (affectsGrailFilter(settingsUpdate)) {
      await reloadFilteredGrailData(set);
    }

    return { success: true };
  },

  hydrateSettings: (settingsUpdate) => {
    // Update local state only, without persisting to database
    // This is used when loading settings from the database to avoid triggering
    // settings-updated events that would cause unwanted side effects (e.g., widget resize)
    const keys = Object.keys(settingsUpdate) as Array<keyof Settings>;
    forgetSettingsRetry(keys);
    dismissSettingsSaveErrorIfNothingToRetry();
    // The hydrated value is what the database holds, so it is also what a failed in-flight
    // save of that key must roll back to
    for (const key of keys) {
      const entry = settingKeyWrites.get(key);
      if (entry) {
        entry.persisted = settingsUpdate[key];
      }
    }
    set((state) => ({ ...withSettingsUpdate(state, settingsUpdate), settingsHydrated: true }));
  },
});
