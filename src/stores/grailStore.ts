import type {
  AdvancedGrailFilter,
  Character,
  GrailFilter,
  GrailProgress,
  Item,
  Settings,
} from 'electron/types/grail';
import { useMemo } from 'react';
import { create } from 'zustand';
import { useCurrentDay } from '@/hooks/useCurrentDay';
import { filterItemsByTrackedVersions } from '@/lib/ethereal';
import { filterAndSortItems } from '@/lib/grailFilters';
import { computeGrailStatistics, type GrailStatisticsSummary } from '@/lib/grailStatistics';
import { combineUnsubscribers, onMainEvent } from '@/lib/ipcEvents';
import {
  affectsGrailFilter,
  createSettingsSlice,
  type SettingsSlice,
  withSettingsUpdate,
} from './settingsStore';

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
 * Interface defining the complete state structure and actions for the Grail store.
 * Manages Holy Grail data, UI state, and provides actions for data manipulation. The settings
 * and their saving come from the settings slice (see `settingsStore.ts`).
 */
export interface GrailState extends SettingsSlice {
  // Data
  characters: Character[];
  items: Item[];
  progress: GrailProgress[];

  // UI State
  filter: GrailFilter;
  /** Incremented on every resetFilters() call so UI holding local filter state can discard it. */
  filterResetCount: number;
  advancedFilter: AdvancedGrailFilter;
  viewMode: 'grid' | 'list';
  groupMode: 'none' | 'category' | 'type' | 'ethereal';
  loading: boolean;

  // Actions
  setItems: (items: Item[]) => void;
  setFilter: (filter: Partial<GrailFilter>) => void;
  setAdvancedFilter: (filter: Partial<AdvancedGrailFilter>) => void;
  resetFilters: () => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  setGroupMode: (mode: 'none' | 'category' | 'type' | 'ethereal') => void;
  setLoading: (loading: boolean) => void;

  // Complex actions
  addManualProgress: (input: ManualProgressInput) => Promise<void>;
  removeProgress: (progressId: string) => Promise<void>;
  reloadData: () => Promise<void>;
}

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

/**
 * Zustand store for managing Holy Grail state including items, progress, characters, and settings.
 * Provides actions for data manipulation and persistence to the Electron backend.
 */
export const useGrailStore = create<GrailState>((set, get, store) => ({
  ...createSettingsSlice(set, get, store),

  // Initial state
  characters: [],
  items: [],
  progress: [],
  filter: defaultFilter,
  filterResetCount: 0,
  advancedFilter: defaultAdvancedFilter,
  viewMode: 'grid',
  groupMode: 'none',
  loading: false,

  // Simple setters
  setItems: (items) => set({ items }),
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

  // Reload all data from database. Failures are logged per data set; whatever loaded is applied.
  reloadData: async () => {
    const finishLoad = startLoad();
    try {
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
    } catch (error) {
      console.error('Failed to reload grail data:', error);
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
 * Applies settings saved by another window, reloading the grail data if the update changes
 * which items are tracked.
 * @param {Partial<Settings>} settingsUpdate - The saved settings broadcast by the main process
 */
const applySettingsSavedElsewhere = (settingsUpdate: Partial<Settings>): void => {
  const { hydrateSettings, reloadData } = useGrailStore.getState();
  hydrateSettings(settingsUpdate);
  if (affectsGrailFilter(settingsUpdate)) {
    void reloadData();
  }
};

/**
 * Options for {@link initGrailData}.
 */
export interface InitGrailDataOptions {
  /**
   * Apply settings that other windows saved (the main process broadcasts every saved update to
   * all windows). The main window saves the settings itself and must leave this off: applying
   * the broadcast of an older in-flight save would briefly undo a newer optimistic value.
   */
  followSettingsUpdates?: boolean;
}

/**
 * Loads the grail data (settings, characters, items and progress) into the store and keeps the
 * progress (and, if requested, the settings) in sync with the main process for as long as the
 * returned cleanup was not called. Started once per window from its root component, so every
 * page sees current data regardless of which page is mounted.
 * @param {InitGrailDataOptions} [options] - Which main-process updates to follow
 * @returns {() => void} Cleanup that removes the main-process subscriptions
 */
export const initGrailData = ({
  followSettingsUpdates = false,
}: InitGrailDataOptions = {}): (() => void) => {
  void useGrailStore.getState().reloadData();
  const unsubscribers = [
    onMainEvent('grail-progress-updated', () => {
      void refreshProgressAndCharacters();
    }),
  ];
  if (followSettingsUpdates) {
    unsubscribers.push(onMainEvent('settings-updated', applySettingsSavedElsewhere));
  }
  return combineUnsubscribers(unsubscribers);
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
 * items, progress, characters or tracked versions change, or the day rolls over.
 * @returns {GrailStatisticsSummary} The statistics
 */
export const useGrailStatistics = (): GrailStatisticsSummary => {
  // Individual selectors so consumers only re-render when these slices change
  const items = useGrailStore((state) => state.items);
  const progress = useGrailStore((state) => state.progress);
  const characters = useGrailStore((state) => state.characters);
  const grailNormal = useGrailStore((state) => state.settings.grailNormal);
  const grailEthereal = useGrailStore((state) => state.settings.grailEthereal);

  // Recent finds and streaks depend on the current date, so recalculate when the day rolls over
  // even if the data did not change (e.g. a widget left open overnight)
  const currentDay = useCurrentDay();

  // biome-ignore lint/correctness/useExhaustiveDependencies: currentDay only triggers a recalculation with a fresh current time
  return useMemo(
    () =>
      computeGrailStatistics({
        items,
        progress,
        characters,
        settings: { grailNormal, grailEthereal },
      }),
    [items, progress, characters, grailNormal, grailEthereal, currentDay],
  );
};
