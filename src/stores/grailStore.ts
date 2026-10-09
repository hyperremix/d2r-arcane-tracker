import {
  type AdvancedGrailFilter,
  type Character,
  GameMode,
  GameVersion,
  type GrailFilter,
  type GrailProgress,
  type Item,
  type Settings,
} from 'electron/types/grail';
import i18n from 'i18next';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { create } from 'zustand';
import { translations } from '@/i18n/translations';
import { filterItemsByTrackedVersions } from '@/lib/ethereal';
import { computeGrailStatistics, type GrailStatisticsSummary } from '@/lib/grailStatistics';
import { onMainEvent } from '@/lib/ipcEvents';
import { itemMatchesSearch, tokenizeSearchQuery } from '@/lib/itemSearch';

/**
 * Information needed to manually record an item as found.
 */
export interface ManualProgressInput {
  itemId: string;
  characterId: string;
  isEthereal: boolean;
  foundDate: Date;
}

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

type SettingsSavedCallback = NonNullable<SetSettingsOptions['onSaved']>;

/**
 * Interface defining the complete state structure and actions for the Grail store.
 * Manages Holy Grail data, UI state, and provides actions for data manipulation.
 */
interface GrailState {
  // Data
  characters: Character[];
  items: Item[];
  progress: GrailProgress[];
  settings: Settings;
  /** True once settings (or an explicit theme choice) are known; until then `settings` holds defaults. */
  settingsHydrated: boolean;

  // UI State
  filter: GrailFilter;
  /** Incremented on every resetFilters() call so UI holding local filter state can discard it. */
  filterResetCount: number;
  advancedFilter: AdvancedGrailFilter;
  viewMode: 'grid' | 'list';
  groupMode: 'none' | 'category' | 'type' | 'ethereal';
  loading: boolean;
  error: string | null;

  // Actions
  setCharacters: (characters: Character[]) => void;
  setItems: (items: Item[]) => void;
  setProgress: (progress: GrailProgress[]) => void;
  setSettings: (
    settings: Partial<Settings>,
    options?: SetSettingsOptions,
  ) => Promise<SettingsSaveResult>;
  hydrateSettings: (settings: Partial<Settings>) => void;
  setFilter: (filter: Partial<GrailFilter>) => void;
  setAdvancedFilter: (filter: Partial<AdvancedGrailFilter>) => void;
  resetFilters: () => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  setGroupMode: (mode: 'none' | 'category' | 'type' | 'ethereal') => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Complex actions
  addManualProgress: (input: ManualProgressInput) => Promise<void>;
  removeProgress: (progressId: string) => Promise<void>;
  reloadData: () => Promise<void>;
}

/**
 * Default application settings.
 */
const defaultSettings: Settings = {
  saveDir: '',
  lang: 'en',
  gameMode: GameMode.Both,
  grailNormal: true,
  grailEthereal: false,
  grailRunes: false,
  grailRunewords: false,
  gameVersion: GameVersion.Resurrected,
  enableSounds: true,
  notificationVolume: 0.5,
  inAppNotifications: true,
  nativeNotifications: true,
  needsSeeding: true,
  theme: 'system',
  showItemIcons: false,
  widgetEnabled: false,
  widgetDisplay: 'overall',
  widgetOpacity: 0.9,
  widgetLocked: false,
  wizardCompleted: false,
  wizardSkipped: false,
  runTrackerAutoStart: true,
  runTrackerEndThreshold: 10,
  runTrackerShortcuts: {
    startRun: 'Ctrl+R',
    pauseRun: 'Ctrl+Space',
    endRun: 'Ctrl+E',
    endSession: 'Ctrl+Shift+E',
  },
  runTrackerGlobalHotkeys: false,
};

/**
 * Default filter configuration.
 */
const defaultFilter: GrailFilter = {
  foundStatus: 'all',
};

/**
 * Default advanced filter configuration with sorting and search options.
 */
const defaultAdvancedFilter: AdvancedGrailFilter = {
  rarities: [],
  difficulties: [],
  levelRange: { min: 1, max: 99 },
  requiredLevelRange: { min: 1, max: 99 },
  sortBy: 'found_date',
  sortOrder: 'desc',
  fuzzySearch: false,
};

/**
 * Applies a settings update and drops type filters (rune/runeword) whose tracking was
 * disabled, since their checkboxes are no longer shown and could not be untoggled.
 * @param {Pick<GrailState, 'settings' | 'filter'>} state - The current store state
 * @param {Partial<Settings>} settingsUpdate - The settings to merge
 * @returns {Pick<GrailState, 'settings' | 'filter'>} The next settings and (pruned) filter
 */
const withSettingsUpdate = (
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

/** Prefix of the id of the settings error toast; see `activeErrorToastId`. */
const SETTINGS_SAVE_ERROR_TOAST_ID_PREFIX = 'settings-save-error';

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

/** A reverted key: the value its failed save attempted and the follow-up to run once saved. */
interface RevertedSetting {
  value: Settings[keyof Settings];
  onSaved?: SettingsSavedCallback;
}

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
 * Clears all write tracking. Only intended for tests, which share this module state.
 */
export const resetSettingsWriteTracking = (): void => {
  settingKeyWrites.clear();
  revertedSettings.clear();
  activeErrorToastId = undefined;
  errorToastCount = 0;
  lastWriteToken = 0;
};

/**
 * Stops offering Retry for keys that were written or hydrated since their save failed.
 * @param {Array<keyof Settings>} keys - The keys that were just written
 */
const forgetRevertedSettings = (keys: Array<keyof Settings>): void => {
  for (const key of keys) {
    revertedSettings.delete(key);
  }
};

/**
 * Dismisses the error toast once nothing is left to retry. Called when a save succeeded or
 * settings were hydrated, never at the start of a save: that save may still fail and must then
 * keep updating the same toast.
 */
const dismissErrorToastIfNothingToRetry = (): void => {
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
  forgetRevertedSettings(keys);
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
 * Shows the error toast for a failed settings save with a Retry action. The toast is shared,
 * so Retry re-applies every key still waiting in `revertedSettings` (not just the keys of this
 * failure) and skips keys that were written since.
 * @param {Partial<Settings>} reverted - The persisted values the failed keys were reverted to
 * @param {Partial<Settings>} attempted - The update whose save failed
 * @param {SettingsSavedCallback | undefined} onSaved - Follow-up of the failed save, re-run by Retry
 * @param {(update: Partial<Settings>, options?: SetSettingsOptions) => Promise<SettingsSaveResult>} save - Saves an update
 */
const notifySettingsSaveFailed = (
  reverted: Partial<Settings>,
  attempted: Partial<Settings>,
  onSaved: SettingsSavedCallback | undefined,
  save: (update: Partial<Settings>, options?: SetSettingsOptions) => Promise<SettingsSaveResult>,
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
          const retryOnSaved: SettingsSavedCallback | undefined =
            followUps.size > 0
              ? async () => {
                  for (const followUp of followUps) {
                    await runOnSaved(followUp);
                  }
                }
              : undefined;
          void save(update, { onSaved: retryOnSaved });
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
 * Returns the value of a settled promise, logging the failure if it was rejected.
 * @param {PromiseSettledResult<T>} result - The settled result
 * @param {string} label - What was loaded, used in the log message
 * @returns {T | undefined} The value, or undefined if the promise was rejected
 */
function getSettledValue<T>(result: PromiseSettledResult<T>, label: string): T | undefined {
  if (result.status === 'fulfilled') return result.value;
  console.error(`Failed to load ${label}:`, result.reason);
  return undefined;
}

const isRejected = (result: PromiseSettledResult<unknown>): boolean => result.status === 'rejected';

/**
 * Zustand store for managing Holy Grail state including items, progress, characters, and settings.
 * Provides actions for data manipulation and persistence to the Electron backend.
 */
export const useGrailStore = create<GrailState>((set, get) => ({
  // Initial state
  characters: [],
  items: [],
  progress: [],
  settings: defaultSettings,
  settingsHydrated: false,
  filter: defaultFilter,
  filterResetCount: 0,
  advancedFilter: defaultAdvancedFilter,
  viewMode: 'grid',
  groupMode: 'none',
  loading: false,
  error: null,

  // Simple setters
  setCharacters: (characters) => set({ characters }),
  setItems: (items) => set({ items }),
  setProgress: (progress) => set({ progress }),
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
            (update, retryOptions) => get().setSettings(update, retryOptions),
          );
        }
      }

      return { success: false, error };
    }
    settleSettingsWrite(writeToken, get().settings, settingsUpdate, true);
    dismissErrorToastIfNothingToRetry();
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
    forgetRevertedSettings(keys);
    dismissErrorToastIfNothingToRetry();
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
  setFilter: (filterUpdate) =>
    set((state) => ({
      filter: { ...state.filter, ...filterUpdate },
    })),
  setAdvancedFilter: (filterUpdate) =>
    set((state) => ({
      advancedFilter: { ...state.advancedFilter, ...filterUpdate },
    })),
  resetFilters: () =>
    set((state) => ({
      filter: defaultFilter,
      advancedFilter: defaultAdvancedFilter,
      filterResetCount: state.filterResetCount + 1,
    })),
  setViewMode: (viewMode) => set({ viewMode }),
  setGroupMode: (groupMode) => set({ groupMode }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  // Complex actions
  addManualProgress: async ({ itemId, characterId, isEthereal, foundDate }) => {
    const character = get().characters.find((c) => c.id === characterId);
    const entry: GrailProgress = {
      id: `manual_${characterId}_${itemId}_${isEthereal ? 'ethereal' : 'normal'}_${Date.now()}`,
      characterId,
      itemId,
      foundDate,
      foundBy: character?.name,
      manuallyAdded: true,
      isEthereal,
    };

    // Persist first so local state never diverges from the database
    const result = await window.electronAPI?.grail.updateProgress(entry);
    if (!result?.success) {
      throw new Error('Failed to save manual progress');
    }

    // The main process also broadcasts a progress reload, which may already include the entry
    set((state) =>
      state.progress.some((p) => p.id === entry.id)
        ? state
        : { progress: [...state.progress, entry] },
    );
  },

  removeProgress: async (progressId) => {
    const result = await window.electronAPI?.grail.deleteProgress(progressId);
    if (!result) {
      throw new Error('Failed to remove progress');
    }

    // The main process only deletes manual records, so a failed delete of a manual (or already
    // dropped) record means it is already gone and removal is idempotent. A failed delete of an
    // auto-detected record is a real failure.
    if (!result.success) {
      const local = get().progress.find((p) => p.id === progressId);
      if (local && !local.manuallyAdded) {
        throw new Error('Failed to remove progress');
      }
    }

    set((state) => ({ progress: state.progress.filter((p) => p.id !== progressId) }));
  },

  // Reload all data from database
  reloadData: async () => {
    const finishLoad = startLoad();
    try {
      set({ error: null });

      // Items are filtered by the grail settings in the main process, so nothing here depends on
      // the settings being applied first. allSettled lets every successful call apply its data
      // even if another one fails.
      const api = window.electronAPI?.grail;
      const [settingsResult, charactersResult, itemsResult, progressResult] =
        await Promise.allSettled([
          api?.getSettings(),
          api?.getCharacters(),
          api?.getItems(),
          api?.getProgress(),
        ]);

      const settingsData = getSettledValue(settingsResult, 'settings');
      if (settingsData) {
        set((state) => ({ ...withSettingsUpdate(state, settingsData), settingsHydrated: true }));
      }

      const characters = getSettledValue(charactersResult, 'characters');
      if (characters) {
        set({ characters });
      }

      const items = getSettledValue(itemsResult, 'items');
      if (items) {
        set({ items });
        console.log(`Loaded ${items.length} Holy Grail items from database`);
      }

      const progress = getSettledValue(progressResult, 'progress');
      if (progress) {
        set({ progress });
        console.log(`Loaded ${progress.length} progress entries from database`);
      }

      if ([settingsResult, charactersResult, itemsResult, progressResult].some(isRejected)) {
        set({ error: 'Failed to reload data' });
      }
    } catch (error) {
      console.error('Failed to reload grail data:', error);
      set({ error: 'Failed to reload data' });
    } finally {
      finishLoad();
    }
  },
}));

/** Number of data loads (initial load, reloadData) that are currently in flight. */
let pendingLoadCount = 0;

/**
 * Marks a data load as started and sets the store loading flag.
 * The flag is only cleared once every load started this way has finished, so an earlier
 * load completing cannot hide a later one that is still pending.
 * @returns {() => void} A function that must be called exactly once when the load finishes
 */
export const startLoad = (): (() => void) => {
  pendingLoadCount++;
  useGrailStore.setState({ loading: true });
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    pendingLoadCount--;
    if (pendingLoadCount === 0) {
      useGrailStore.setState({ loading: false });
    }
  };
};

/**
 * Reloads progress and characters after the main process reported a grail progress change
 * (e.g. an automatically detected item, which may also have created a character).
 */
const refreshProgressAndCharacters = async (): Promise<void> => {
  try {
    const api = window.electronAPI?.grail;
    const [progressResult, charactersResult] = await Promise.allSettled([
      api?.getProgress(),
      api?.getCharacters(),
    ]);

    const progress = getSettledValue(progressResult, 'progress');
    if (progress) {
      useGrailStore.setState({ progress });
      console.log(`Reloaded ${progress.length} progress entries after a grail progress update`);
    }

    const characters = getSettledValue(charactersResult, 'characters');
    if (characters) {
      useGrailStore.setState({ characters });
    }
  } catch (error) {
    console.error('Failed to reload data after grail progress update:', error);
  }
};

/**
 * Loads the grail data (settings, characters, items and progress) into the store and keeps the
 * progress in sync with the main process for as long as the returned cleanup was not called.
 * Started once per window from its root component, so every page sees current data regardless
 * of which page is mounted.
 * @returns {() => void} Cleanup that removes the main-process subscription
 */
export const initGrailData = (): (() => void) => {
  void useGrailStore.getState().reloadData();
  return onMainEvent('grail-progress-updated', () => {
    void refreshProgressAndCharacters();
  });
};

/**
 * Counts the number of user-facing filters that are currently narrowing the item list.
 * Sorting and fuzzy-search mode are not counted since they never hide items on their own.
 * @param {GrailFilter} filter - The current grail filter
 * @returns {number} The number of active filters
 */
export const countActiveFilters = (filter: GrailFilter): number => {
  let count = 0;
  if (filter.searchTerm) count++;
  if (filter.categories && filter.categories.length > 0) count++;
  if (filter.subCategories && filter.subCategories.length > 0) count++;
  if (filter.types && filter.types.length > 0) count++;
  if (filter.foundStatus && filter.foundStatus !== 'all') count++;
  return count;
};

/**
 * Checks if an item matches the specified categories filter.
 * @param {Item} item - The item to check
 * @param {string[]} [categories] - Optional array of categories to match
 * @returns {boolean} True if item matches (or no filter applied), false otherwise
 */
const matchesCategories = (item: Item, categories?: string[]): boolean => {
  return !categories || categories.length === 0 || categories.includes(item.category);
};

/**
 * Builds the category-qualified sub-category filter value, e.g. `weapons:sorceress`.
 * Some sub-categories (such as `sorceress`) exist under more than one category, so the filters
 * popover stores qualified values to keep each selection specific to its category.
 * @param {string} category - The item category
 * @param {string} subCategory - The item sub-category
 * @returns {string} The qualified sub-category filter value
 */
export const toSubCategoryFilterValue = (category: string, subCategory: string): string =>
  `${category}:${subCategory}`;

/**
 * Splits a sub-category filter value into its parts; the inverse of {@link toSubCategoryFilterValue}.
 * Bare sub-category values have no category.
 * @param {string} value - A bare or category-qualified sub-category filter value
 * @returns {{ category: string | undefined; subCategory: string }} The category (if qualified) and sub-category
 */
export const parseSubCategoryFilterValue = (
  value: string,
): { category: string | undefined; subCategory: string } => {
  const separatorIndex = value.indexOf(':');
  if (separatorIndex === -1) return { category: undefined, subCategory: value };
  return {
    category: value.slice(0, separatorIndex),
    subCategory: value.slice(separatorIndex + 1),
  };
};

/**
 * Checks if an item matches the specified subcategories filter. Entries may be bare
 * sub-categories (matching that sub-category in every category) or category-qualified values
 * created by {@link toSubCategoryFilterValue} (matching only the given category).
 * @param {Item} item - The item to check
 * @param {string[]} [subCategories] - Optional array of subcategories to match
 * @returns {boolean} True if item matches (or no filter applied), false otherwise
 */
const matchesSubCategories = (item: Item, subCategories?: string[]): boolean => {
  if (!subCategories || subCategories.length === 0) return true;
  return (
    subCategories.includes(item.subCategory) ||
    subCategories.includes(toSubCategoryFilterValue(item.category, item.subCategory))
  );
};

/**
 * Checks if an item matches the specified types filter.
 * @param {Item} item - The item to check
 * @param {string[]} [types] - Optional array of types to match
 * @returns {boolean} True if item matches (or no filter applied), false otherwise
 */
const matchesTypes = (item: Item, types?: string[]): boolean => {
  return !types || types.length === 0 || types.includes(item.type);
};

/**
 * Builds a lookup map from progress array for O(1) access by item ID.
 * @param {GrailProgress[]} progress - Progress records to index
 * @returns {Map<string, GrailProgress[]>} Map with item IDs as keys and progress arrays as values
 */
const buildProgressMap = (progress: GrailProgress[]): Map<string, GrailProgress[]> => {
  const map = new Map<string, GrailProgress[]>();
  for (const p of progress) {
    const existing = map.get(p.itemId);
    if (existing) {
      existing.push(p);
    } else {
      map.set(p.itemId, [p]);
    }
  }
  return map;
};

/**
 * Checks if an item matches the specified found status filter.
 * @param {Item} item - The item to check
 * @param {string} [foundStatus] - Optional found status ('all', 'found', 'missing')
 * @param {Map<string, GrailProgress[]>} [progressMap] - Pre-built progress lookup map for O(1) access
 * @returns {boolean} True if item matches the found status, false otherwise
 */
const matchesFoundStatus = (
  item: Item,
  foundStatus?: string,
  progressMap?: Map<string, GrailProgress[]>,
): boolean => {
  // Always show all items by default, regardless of found status
  if (!foundStatus || foundStatus === 'all') return true;

  const itemProgress = progressMap?.get(item.id);
  const isFound = itemProgress?.some((p) => p.foundDate !== undefined) ?? false;

  if (foundStatus === 'found') return isFound;
  if (foundStatus === 'missing') return !isFound;
  return true;
};

/**
 * Builds a map of item ID to latest found date timestamp for efficient sorting.
 * @param {GrailProgress[]} progress - Progress records to index
 * @returns {Map<string, number>} Map with item IDs as keys and latest found date timestamps as values
 */
const buildFoundDateMap = (progress: GrailProgress[]): Map<string, number> => {
  const map = new Map<string, number>();
  for (const p of progress) {
    if (p.foundDate) {
      const time = p.foundDate.getTime();
      const existing = map.get(p.itemId);
      if (existing === undefined || time > existing) {
        map.set(p.itemId, time);
      }
    }
  }
  return map;
};

/**
 * Collator used for name comparisons. Reusing one instance is much faster than calling
 * `String.prototype.localeCompare` for every comparison.
 */
const nameCollator = new Intl.Collator();

/**
 * Compares two items by the given sort key only.
 * @returns {number} Negative, zero or positive like any sort comparator
 */
const compareBySortKey = (
  a: Item,
  b: Item,
  sortBy: string,
  foundDateMap?: Map<string, number>,
): number => {
  switch (sortBy) {
    case 'name':
      return nameCollator.compare(a.name, b.name);
    case 'category':
      return a.category.localeCompare(b.category);
    case 'type':
      return a.type.localeCompare(b.type);
    case 'found_date':
      return (foundDateMap?.get(a.id) ?? 0) - (foundDateMap?.get(b.id) ?? 0);
    default:
      return 0;
  }
};

/**
 * Sorts items based on the specified criteria and order.
 * Items with equal sort keys (e.g. all missing items when sorting by found date) are ordered
 * by name A–Z and then by ID, regardless of the sort order, so the result is always stable.
 * @param {Item[]} items - Array of items to sort
 * @param {string} sortBy - Property to sort by ('name', 'category', 'type', 'found_date')
 * @param {string} sortOrder - Sort order ('asc' or 'desc')
 * @param {Map<string, number>} [foundDateMap] - Pre-built map of item ID to found date timestamp for found_date sorting
 * @returns {Item[]} Sorted array of items
 */
const sortItems = (
  items: Item[],
  sortBy: string,
  sortOrder: string,
  foundDateMap?: Map<string, number>,
): Item[] => {
  const direction = sortOrder === 'desc' ? -1 : 1;
  return [...items].sort((a, b) => {
    const comparison = compareBySortKey(a, b, sortBy, foundDateMap);
    if (comparison !== 0) return comparison * direction;
    const nameComparison = sortBy === 'name' ? 0 : nameCollator.compare(a.name, b.name);
    if (nameComparison !== 0) return nameComparison;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
};

/**
 * Filters and sorts items according to the given filter and sort settings.
 * Uses pre-built lookup maps for O(1) access instead of O(N) array searches, and tokenizes the
 * search query once per call instead of once per item.
 * @param {Item[]} items - All Holy Grail items
 * @param {GrailProgress[]} progress - All progress records
 * @param {GrailFilter} filter - The active filter
 * @param {AdvancedGrailFilter} advancedFilter - The active sort and search options
 * @returns {Item[]} The filtered and sorted items
 */
export const filterAndSortItems = (
  items: Item[],
  progress: GrailProgress[],
  filter: GrailFilter,
  advancedFilter: AdvancedGrailFilter,
): Item[] => {
  // Build lookup maps once for O(1) access during filtering and sorting
  const progressMap = buildProgressMap(progress);
  const foundDateMap =
    advancedFilter.sortBy === 'found_date' ? buildFoundDateMap(progress) : undefined;
  const searchTerm = filter.searchTerm ?? '';
  const searchTokens = tokenizeSearchQuery(searchTerm);
  // A query made only of unsearchable characters (e.g. "龙" or "???") can never match an item;
  // only a blank query means "no search".
  if (searchTerm.trim() !== '' && searchTokens.length === 0) return [];

  const filtered = items.filter((item) => {
    return (
      matchesCategories(item, filter.categories) &&
      matchesSubCategories(item, filter.subCategories) &&
      matchesTypes(item, filter.types) &&
      matchesFoundStatus(item, filter.foundStatus, progressMap) &&
      itemMatchesSearch(item, searchTokens, advancedFilter.fuzzySearch)
    );
  });

  return sortItems(filtered, advancedFilter.sortBy, advancedFilter.sortOrder, foundDateMap);
};

/**
 * Inputs and result of the most recent {@link filterAndSortItems} call made through
 * {@link useFilteredItems}. Several components (the item grid and the toolbar result count)
 * read the filtered items; sharing the last result means the list is only computed once per
 * store change instead of once per component.
 */
let lastFilteredItems:
  | {
      items: Item[];
      progress: GrailProgress[];
      filter: GrailFilter;
      advancedFilter: AdvancedGrailFilter;
      result: Item[];
    }
  | undefined;

/**
 * Returns the filtered and sorted items, reusing the previous result if the inputs are unchanged.
 */
const getFilteredItems = (
  items: Item[],
  progress: GrailProgress[],
  filter: GrailFilter,
  advancedFilter: AdvancedGrailFilter,
): Item[] => {
  const cached = lastFilteredItems;
  if (
    cached &&
    cached.items === items &&
    cached.progress === progress &&
    cached.filter === filter &&
    cached.advancedFilter === advancedFilter
  ) {
    return cached.result;
  }

  const result = filterAndSortItems(items, progress, filter, advancedFilter);
  lastFilteredItems = { items, progress, filter, advancedFilter, result };
  return result;
};

/**
 * Custom hook that returns filtered and sorted items based on current filter and sort settings.
 * The result is shared between all components using the hook and only recalculated when the
 * items, progress, filter or sort settings change.
 * @returns {Item[]} Array of filtered and sorted Holy Grail items
 */
export const useFilteredItems = () => {
  // Individual selectors so the item grid only re-renders when these slices change
  const items = useGrailStore((state) => state.items);
  const progress = useGrailStore((state) => state.progress);
  const filter = useGrailStore((state) => state.filter);
  const advancedFilter = useGrailStore((state) => state.advancedFilter);
  return getFilteredItems(items, progress, filter, advancedFilter);
};

/**
 * Number of items currently shown out of all tracked items.
 */
export interface ItemResultCount {
  shown: number;
  total: number;
}

/**
 * Custom hook that returns how many items the current filters show out of all tracked items.
 * Both numbers only include items with a tracked version (normal and/or ethereal), matching
 * what the item grid displays.
 * @returns {ItemResultCount} The shown and total item counts
 */
export const useItemResultCount = (): ItemResultCount => {
  const items = useGrailStore((state) => state.items);
  const progress = useGrailStore((state) => state.progress);
  const filter = useGrailStore((state) => state.filter);
  const advancedFilter = useGrailStore((state) => state.advancedFilter);
  const grailNormal = useGrailStore((state) => state.settings.grailNormal);
  const grailEthereal = useGrailStore((state) => state.settings.grailEthereal);
  const filteredItems = getFilteredItems(items, progress, filter, advancedFilter);

  return useMemo(() => {
    const settings = { grailNormal, grailEthereal };
    return {
      shown: filterItemsByTrackedVersions(filteredItems, settings).length,
      total: filterItemsByTrackedVersions(items, settings).length,
    };
  }, [filteredItems, items, grailNormal, grailEthereal]);
};

/**
 * Custom hook that returns the Holy Grail statistics (overall progress, recent finds, streaks and
 * the category and character breakdowns). The result is memoized and only recalculated when the
 * items, progress, characters or tracked versions change.
 * @returns {GrailStatisticsSummary} The statistics
 */
export const useGrailStatistics = (): GrailStatisticsSummary => {
  // Individual selectors so consumers only re-render when these slices change
  const items = useGrailStore((state) => state.items);
  const progress = useGrailStore((state) => state.progress);
  const characters = useGrailStore((state) => state.characters);
  const grailNormal = useGrailStore((state) => state.settings.grailNormal);
  const grailEthereal = useGrailStore((state) => state.settings.grailEthereal);

  return useMemo(
    () =>
      computeGrailStatistics({
        items,
        progress,
        characters,
        settings: { grailNormal, grailEthereal },
      }),
    [items, progress, characters, grailNormal, grailEthereal],
  );
};
