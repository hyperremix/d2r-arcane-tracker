import {
  type AdvancedGrailFilter,
  type Character,
  GameMode,
  GameVersion,
  type GrailFilter,
  type GrailProgress,
  type GrailStatistics,
  type Item,
  type Settings,
} from 'electron/types/grail';
import { useMemo } from 'react';
import { create } from 'zustand';
import { canItemBeEthereal, canItemBeNormal } from '@/lib/ethereal';
import { isRecentFind } from '@/lib/utils';

/**
 * Interface defining the complete state structure and actions for the Grail store.
 * Manages Holy Grail data, UI state, and provides actions for data manipulation.
 */
interface GrailState {
  // Data
  characters: Character[];
  items: Item[];
  progress: GrailProgress[];
  statistics: GrailStatistics | null;
  settings: Settings;

  // UI State
  selectedCharacterId: string | null;
  filter: GrailFilter;
  advancedFilter: AdvancedGrailFilter;
  viewMode: 'grid' | 'list';
  groupMode: 'none' | 'category' | 'type' | 'ethereal';
  loading: boolean;
  error: string | null;

  // Actions
  setCharacters: (characters: Character[]) => void;
  setItems: (items: Item[]) => void;
  setProgress: (progress: GrailProgress[]) => void;
  setStatistics: (statistics: GrailStatistics) => void;
  setSettings: (settings: Partial<Settings>) => Promise<void>;
  hydrateSettings: (settings: Partial<Settings>) => void;
  setSelectedCharacterId: (characterId: string | null) => void;
  setFilter: (filter: Partial<GrailFilter>) => void;
  setAdvancedFilter: (filter: Partial<AdvancedGrailFilter>) => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  setGroupMode: (mode: 'none' | 'category' | 'type' | 'ethereal') => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Complex actions
  toggleItemFound: (itemId: string, foundBy?: string, manuallyAdded?: boolean) => void;
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
 * Zustand store for managing Holy Grail state including items, progress, characters, and settings.
 * Provides actions for data manipulation and persistence to the Electron backend.
 */
export const useGrailStore = create<GrailState>((set, get) => ({
  // Initial state
  characters: [],
  items: [],
  progress: [],
  statistics: null,
  settings: defaultSettings,
  selectedCharacterId: null,
  filter: defaultFilter,
  advancedFilter: defaultAdvancedFilter,
  viewMode: 'grid',
  groupMode: 'none',
  loading: false,
  error: null,

  // Simple setters
  setCharacters: (characters) => set({ characters }),
  setItems: (items) => set({ items }),
  setProgress: (progress) => set({ progress }),
  setStatistics: (statistics) => set({ statistics }),
  setSettings: async (settingsUpdate) => {
    // Update local state
    set((state) => ({
      settings: { ...state.settings, ...settingsUpdate },
    }));

    // Persist to database
    try {
      await window.electronAPI?.grail.updateSettings(settingsUpdate);

      // Reload data if grail-related settings changed
      const grailSettingsChanged = Object.keys(settingsUpdate).some((key) =>
        ['grailNormal', 'grailEthereal', 'grailRunes', 'grailRunewords'].includes(key),
      );

      if (grailSettingsChanged) {
        // Reload items and progress to apply filtering
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
      }
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  },
  hydrateSettings: (settingsUpdate) => {
    // Update local state only, without persisting to database
    // This is used when loading settings from the database to avoid triggering
    // settings-updated events that would cause unwanted side effects (e.g., widget resize)
    set((state) => ({
      settings: { ...state.settings, ...settingsUpdate },
    }));
  },
  setSelectedCharacterId: (selectedCharacterId) => set({ selectedCharacterId }),
  setFilter: (filterUpdate) =>
    set((state) => ({
      filter: { ...state.filter, ...filterUpdate },
    })),
  setAdvancedFilter: (filterUpdate) =>
    set((state) => ({
      advancedFilter: { ...state.advancedFilter, ...filterUpdate },
    })),
  setViewMode: (viewMode) => set({ viewMode }),
  setGroupMode: (groupMode) => set({ groupMode }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  // Complex actions
  toggleItemFound: (itemId, foundBy, manuallyAdded = true) => {
    const { progress, selectedCharacterId } = get();

    // Need a selected character to track progress
    if (!selectedCharacterId) {
      console.warn('No character selected for tracking progress');
      return;
    }

    const existingProgress = progress.find(
      (p) => p.itemId === itemId && p.characterId === selectedCharacterId,
    );

    let newProgress: GrailProgress[];

    if (existingProgress) {
      // Toggle existing progress
      const isCurrentlyFound = existingProgress.foundDate !== undefined;
      newProgress = progress.map((p) =>
        p.itemId === itemId && p.characterId === selectedCharacterId
          ? {
              ...p,
              foundDate: !isCurrentlyFound ? new Date() : undefined,
              foundBy: !isCurrentlyFound ? foundBy : undefined,
              manuallyAdded,
            }
          : p,
      );
    } else {
      // Create new progress entry
      const newEntry: GrailProgress = {
        id: `${selectedCharacterId}-${itemId}-${Date.now()}`,
        characterId: selectedCharacterId,
        itemId,
        foundDate: new Date(),
        foundBy,
        manuallyAdded,
        isEthereal: false, // Default to normal version
      };
      newProgress = [...progress, newEntry];
    }

    set({ progress: newProgress });

    // Persist to database via IPC
    const updatedEntry = newProgress.find(
      (p) => p.itemId === itemId && p.characterId === selectedCharacterId,
    );
    if (updatedEntry) {
      window.electronAPI?.grail.updateProgress(updatedEntry);
    }
  },

  // Reload all data from database
  reloadData: async () => {
    try {
      set({ loading: true, error: null });

      // Load settings first
      const settingsData = await window.electronAPI?.grail.getSettings();
      if (settingsData) {
        set((state) => ({ settings: { ...state.settings, ...settingsData } }));
        console.log('Reloaded settings from database');
      }

      // Load characters
      const charactersData = await window.electronAPI?.grail.getCharacters();
      if (charactersData) {
        set({ characters: charactersData });
      }

      // Load items from database
      const items = await window.electronAPI?.grail.getItems();
      if (items) {
        set({ items });
        console.log(`Reloaded ${items.length} Holy Grail items from database`);
      }

      // Load progress data
      const progressData = await window.electronAPI?.grail.getProgress();
      if (progressData) {
        set({ progress: progressData });
        console.log(`Reloaded ${progressData.length} progress entries from database`);
      }
    } catch (error) {
      console.error('Failed to reload grail data:', error);
      set({ error: 'Failed to reload data' });
    } finally {
      set({ loading: false });
    }
  },
}));

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
 * Checks if an item matches the specified subcategories filter.
 * @param {Item} item - The item to check
 * @param {string[]} [subCategories] - Optional array of subcategories to match
 * @returns {boolean} True if item matches (or no filter applied), false otherwise
 */
const matchesSubCategories = (item: Item, subCategories?: string[]): boolean => {
  return !subCategories || subCategories.length === 0 || subCategories.includes(item.subCategory);
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
 * Checks if an item matches the specified search term.
 * @param {Item} item - The item to check
 * @param {string} [searchTerm] - Optional search term to match against item name
 * @param {boolean} [fuzzySearch] - Whether to use fuzzy matching with Levenshtein distance
 * @returns {boolean} True if item matches the search term, false otherwise
 */
const matchesSearchTerm = (item: Item, searchTerm?: string, fuzzySearch?: boolean): boolean => {
  if (!searchTerm) return true;

  const term = searchTerm.toLowerCase();
  const name = item.name.toLowerCase();

  if (fuzzySearch) {
    // Fuzzy search with Levenshtein distance
    return calculateSimilarity(name, term) > 0.6 || name.includes(term.slice(0, 3)); // Partial match
  }

  return name.includes(term);
};

/**
 * Calculates the similarity between two strings using Levenshtein distance.
 * @param {string} str1 - First string to compare
 * @param {string} str2 - Second string to compare
 * @returns {number} Similarity score between 0 and 1 (1 being identical)
 */
const calculateSimilarity = (str1: string, str2: string): number => {
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  return 1 - distance / maxLength;
};

/**
 * Calculates the Levenshtein distance between two strings.
 * @param {string} str1 - First string to compare
 * @param {string} str2 - Second string to compare
 * @returns {number} The minimum number of single-character edits required to change str1 into str2
 */
const levenshteinDistance = (str1: string, str2: string): number => {
  const matrix = Array(str2.length + 1)
    .fill(null)
    .map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator, // substitution
      );
    }
  }

  return matrix[str2.length][str1.length];
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
 * Sorts items based on the specified criteria and order.
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
  return [...items].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'category':
        comparison = a.category.localeCompare(b.category);
        break;
      case 'type':
        comparison = a.type.localeCompare(b.type);
        break;
      case 'found_date': {
        const aDate = foundDateMap?.get(a.id) ?? 0;
        const bDate = foundDateMap?.get(b.id) ?? 0;
        comparison = aDate - bDate;
        break;
      }
      default:
        comparison = 0;
    }

    return sortOrder === 'desc' ? -comparison : comparison;
  });
};

/**
 * Custom hook that returns filtered and sorted items based on current filter and sort settings.
 * Memoized to avoid recalculating on every render when dependencies haven't changed.
 * Uses pre-built lookup maps for O(1) access instead of O(N) array searches.
 * @returns {Item[]} Array of filtered and sorted Holy Grail items
 */
export const useFilteredItems = () => {
  const { items, progress, filter, advancedFilter } = useGrailStore();

  return useMemo(() => {
    // Build lookup maps once for O(1) access during filtering and sorting
    const progressMap = buildProgressMap(progress);
    const foundDateMap =
      advancedFilter.sortBy === 'found_date' ? buildFoundDateMap(progress) : undefined;

    const filtered = items.filter((item) => {
      return (
        matchesCategories(item, filter.categories) &&
        matchesSubCategories(item, filter.subCategories) &&
        matchesTypes(item, filter.types) &&
        matchesFoundStatus(item, filter.foundStatus, progressMap) &&
        matchesSearchTerm(item, filter.searchTerm, advancedFilter.fuzzySearch)
      );
    });

    return sortItems(filtered, advancedFilter.sortBy, advancedFilter.sortOrder, foundDateMap);
  }, [items, progress, filter, advancedFilter]);
};

/**
 * Calculates current and maximum find streaks from an array of find dates.
 * @param {string[]} findDates - Array of date strings representing find dates
 * @returns {Object} Object containing current and maximum streak counts
 * @returns {number} returns.currentStreak - Current consecutive days with finds
 * @returns {number} returns.maxStreak - Maximum consecutive days with finds
 */
function calculateStreaks(findDates: string[]) {
  let currentStreak = 0;
  let maxStreak = 0;
  const today = new Date().toDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (findDates.includes(today) || findDates.includes(yesterday.toDateString())) {
    // Calculate current streak
    const uniqueDates = [...new Set(findDates)].reverse();
    const currentDate = new Date();

    for (const dateStr of uniqueDates) {
      const date = new Date(dateStr);
      const diffDays = Math.floor((currentDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays <= currentStreak + 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  // Calculate max streak
  let tempStreak = 1;
  for (let i = 1; i < findDates.length; i++) {
    const prev = new Date(findDates[i - 1]);
    const curr = new Date(findDates[i]);
    const diffDays = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 1) {
      tempStreak++;
    } else {
      maxStreak = Math.max(maxStreak, tempStreak);
      tempStreak = 1;
    }
  }
  maxStreak = Math.max(maxStreak, tempStreak);

  return { currentStreak, maxStreak };
}

/**
 * Helper function to calculate statistics for a single category
 */
function calculateCategoryStatsForCategory(
  categoryItems: Item[],
  foundInCategory: GrailProgress[],
  recentInCategory: GrailProgress[],
  settings: Settings,
) {
  let categoryTotal = 0;
  let categoryFound = 0;

  for (const item of categoryItems) {
    const itemProgress = foundInCategory.filter((p) => p.itemId === item.id);
    const hasNormal = itemProgress.some((p) => !p.isEthereal);
    const hasEthereal = itemProgress.some((p) => p.isEthereal);

    if (settings.grailNormal && canItemBeNormal(item)) {
      categoryTotal++;
      if (hasNormal) categoryFound++;
    }
    if (settings.grailEthereal && canItemBeEthereal(item)) {
      categoryTotal++;
      if (hasEthereal) categoryFound++;
    }
  }

  return {
    total: categoryTotal,
    found: categoryFound,
    percentage: categoryTotal > 0 ? (categoryFound / categoryTotal) * 100 : 0,
    recent: recentInCategory.length,
  };
}

/**
 * Calculates statistics for each item category.
 * @param {Item[]} items - All Holy Grail items
 * @param {GrailProgress[]} foundProgress - Progress records for found items
 * @param {GrailProgress[]} recentFinds - Recent find progress records
 * @param {Settings} settings - Grail settings to determine what counts as found
 * @returns {Array} Array of category statistics with totals, found counts, and percentages
 */
function calculateCategoryStats(
  items: Item[],
  foundProgress: GrailProgress[],
  recentFinds: GrailProgress[],
  settings: Settings,
) {
  const categories = [...new Set(items.map((item) => item.category))];
  return categories.map((category) => {
    const categoryItems = items.filter((item) => item.category === category);
    const foundInCategory = foundProgress.filter((p) =>
      categoryItems.some((item) => item.id === p.itemId),
    );
    const recentInCategory = recentFinds.filter((p) =>
      categoryItems.some((item) => item.id === p.itemId),
    );

    const stats = calculateCategoryStatsForCategory(
      categoryItems,
      foundInCategory,
      recentInCategory,
      settings,
    );

    return {
      category,
      ...stats,
    };
  });
}

/**
 * Calculates statistics for each character.
 * @param {Character[]} characters - All characters
 * @param {GrailProgress[]} progress - All progress records
 * @param {Item[]} items - All Holy Grail items
 * @returns {Array} Array of character statistics with finds, favorite category, and activity
 */
function calculateCharacterStats(
  characters: Character[],
  progress: GrailProgress[],
  items: Item[],
) {
  return characters.map((character) => {
    const charProgress = progress.filter(
      (p) => p.foundDate !== undefined && p.characterId === character.id,
    );
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    // Exclude items from initial scan when calculating recent finds
    const recentProgress = charProgress.filter((p) => {
      return p.foundDate && new Date(p.foundDate) > sevenDaysAgo && !p.fromInitialScan;
    });

    // Find favorite category
    const categoryCount: Record<string, number> = {};
    for (const p of charProgress) {
      const item = items.find((i) => i.id === p.itemId);
      if (item) {
        categoryCount[item.category] = (categoryCount[item.category] || 0) + 1;
      }
    }

    const favoriteCategory =
      Object.entries(categoryCount).sort(([, a], [, b]) => b - a)[0]?.[0] || 'None';

    const lastActivity =
      charProgress.length > 0
        ? charProgress
            .filter((p) => p.foundDate)
            .sort((a, b) => {
              if (!a.foundDate || !b.foundDate) return 0;
              return new Date(b.foundDate).getTime() - new Date(a.foundDate).getTime();
            })[0]?.foundDate || null
        : null;

    return {
      character,
      totalFound: charProgress.length,
      recentFinds: recentProgress.length,
      favoriteCategory,
      lastActivity,
    };
  });
}

/**
 * Calculates timeline statistics for the last 30 days.
 * @param {GrailProgress[]} progress - All progress records
 * @returns {Array} Array of daily statistics with dates, item counts, and character attributions
 */
function calculateTimelineStats(progress: GrailProgress[]) {
  const timelineStats = [];
  // Exclude items from initial scan from timeline statistics
  const progressForTimeline = progress.filter((p) => !p.fromInitialScan);

  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toDateString();

    const dayProgress = progressForTimeline.filter(
      (p) => p.foundDate !== undefined && new Date(p.foundDate).toDateString() === dateStr,
    );

    timelineStats.push({
      date: date.toLocaleDateString(),
      itemsFound: dayProgress.length,
      characters: [...new Set(dayProgress.map((p) => p.foundBy || 'Unknown'))],
    });
  }
  return timelineStats;
}

/**
 * Helper function to calculate item counts based on grail settings
 */
function calculateItemCounts(items: Item[], foundProgress: GrailProgress[], settings: Settings) {
  let totalItems = 0;
  let foundItems = 0;
  let foundNormalItems = 0;
  let foundEtherealItems = 0;

  for (const item of items) {
    const itemProgress = foundProgress.filter((p) => p.itemId === item.id);
    const hasNormal = itemProgress.some((p) => !p.isEthereal);
    const hasEthereal = itemProgress.some((p) => p.isEthereal);

    if (settings.grailNormal && canItemBeNormal(item)) {
      totalItems++;
      if (hasNormal) {
        foundItems++;
        foundNormalItems++;
      }
    }
    if (settings.grailEthereal && canItemBeEthereal(item)) {
      totalItems++;
      if (hasEthereal) {
        foundItems++;
        foundEtherealItems++;
      }
    }
  }

  return { totalItems, foundItems, foundNormalItems, foundEtherealItems };
}

/**
 * Helper function to calculate statistics for a single item type
 */
function calculateTypeStatsForType(
  typeItems: Item[],
  foundProgress: GrailProgress[],
  settings: Settings,
) {
  let typeTotal = 0;
  let typeFound = 0;

  for (const item of typeItems) {
    const itemProgress = foundProgress.filter((p) => p.itemId === item.id);
    const hasNormal = itemProgress.some((p) => !p.isEthereal);
    const hasEthereal = itemProgress.some((p) => p.isEthereal);

    if (settings.grailNormal && canItemBeNormal(item)) {
      typeTotal++;
      if (hasNormal) typeFound++;
    }
    if (settings.grailEthereal && canItemBeEthereal(item)) {
      typeTotal++;
      if (hasEthereal) typeFound++;
    }
  }

  return {
    total: typeTotal,
    found: typeFound,
    percentage: typeTotal > 0 ? (typeFound / typeTotal) * 100 : 0,
  };
}

/**
 * Helper function to calculate type statistics
 */
function calculateTypeStats(items: Item[], foundProgress: GrailProgress[], settings: Settings) {
  return ['unique', 'set', 'rune', 'runeword'].map((type) => {
    const typeItems = items.filter((item) => item.type === type);
    const stats = calculateTypeStatsForType(typeItems, foundProgress, settings);

    return {
      type,
      ...stats,
    };
  });
}

/**
 * Custom hook that calculates comprehensive Holy Grail statistics.
 * Provides overall progress, type breakdowns, recent finds, streaks, and category/character stats.
 * @returns {Object} Comprehensive statistics object with multiple data points
 */
export const useGrailStatistics = () => {
  const { items, progress, characters, settings } = useGrailStore();

  // Note: items are filtered based on grail settings (grailNormal, grailEthereal, grailRunes, grailRunewords)
  // at the database level. Progress contains ALL progress data, but statistics calculations only consider
  // progress for items that are in the filtered items array. This allows features like the runeword
  // calculator to access runeword collection counts even when grailRunewords tracking is disabled.
  const foundProgress = progress.filter((p) => p.foundDate !== undefined);

  // Calculate item counts based on grail settings
  const { totalItems, foundItems, foundNormalItems, foundEtherealItems } = calculateItemCounts(
    items,
    foundProgress,
    settings,
  );

  // Calculate ethereal vs normal breakdown
  // Note: These calculations are based on the already-filtered items array
  // If grailEthereal is false, etherealItems will be empty
  // If grailNormal is false, normalItems will be empty
  const normalItems = items.filter((item) => canItemBeNormal(item));
  const etherealItems = items.filter((item) => canItemBeEthereal(item));

  // Type breakdown - based on filtered items
  // If grailRunes is false, rune items will not be in the items array
  // If grailRunewords is false, runeword items will not be in the items array
  const typeStats = calculateTypeStats(items, foundProgress, settings);

  // Filter out items from initial scan for statistics calculations
  // Items from initial scan should not count towards Recent Finds, Streaks, or Avg per Day
  const progressForStats = foundProgress.filter((p) => !p.fromInitialScan);

  // Recent finds (last 7 days) - excluding items from initial scan
  const recentFinds = progressForStats.filter((p) => isRecentFind(p.foundDate));

  // Find streak calculation - excluding items from initial scan
  const findDates = progressForStats
    .filter((p) => p.foundDate)
    .map((p) => (p.foundDate ? new Date(p.foundDate).toDateString() : ''))
    .filter(Boolean)
    .sort();

  const { currentStreak, maxStreak } = calculateStreaks(findDates);

  // Most active day - excluding items from initial scan
  const dayCount: Record<string, number> = {};
  for (const p of progressForStats) {
    if (p.foundDate) {
      const day = new Date(p.foundDate).toLocaleDateString('en-US', { weekday: 'long' });
      dayCount[day] = (dayCount[day] || 0) + 1;
    }
  }
  const mostActiveDay = Object.entries(dayCount).sort(([, a], [, b]) => b - a)[0]?.[0] || 'No data';

  // Last find
  const lastFind =
    foundProgress.length > 0
      ? foundProgress
          .filter((p) => p.foundDate)
          .sort((a, b) => {
            if (!a.foundDate || !b.foundDate) return 0;
            return new Date(b.foundDate).getTime() - new Date(a.foundDate).getTime();
          })[0]
      : null;

  // Calculate complex statistics using helper functions
  const categoryStats = calculateCategoryStats(items, foundProgress, recentFinds, settings);
  const characterStats = calculateCharacterStats(characters, progress, items);
  const timelineStats = calculateTimelineStats(progress);

  return {
    totalItems,
    foundItems,
    completionPercentage: totalItems > 0 ? (foundItems / totalItems) * 100 : 0,
    normalItems: {
      total: normalItems.length,
      found: foundNormalItems,
      percentage: normalItems.length > 0 ? (foundNormalItems / normalItems.length) * 100 : 0,
    },
    etherealItems: {
      total: etherealItems.length,
      found: foundEtherealItems,
      percentage: etherealItems.length > 0 ? (foundEtherealItems / etherealItems.length) * 100 : 0,
    },
    typeStats,
    recentFinds: recentFinds.length,
    currentStreak,
    maxStreak,
    averageItemsPerDay: recentFinds.length / 7,
    mostActiveDay,
    lastFind,
    categoryStats: categoryStats.sort((a, b) => b.percentage - a.percentage),
    characterStats: characterStats.sort((a, b) => b.totalFound - a.totalFound),
    timelineStats,
    totalCharacters: characters.length,
    totalProgress: foundProgress.length,
  };
};
