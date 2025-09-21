import {
  type AdvancedGrailFilter,
  type Character,
  GameMode,
  GameVersion,
  type GrailFilter,
  type GrailProgress,
  type GrailStatistics,
  type HolyGrailItem,
  type Settings,
} from 'electron/types/grail';
import { create } from 'zustand';
import { isRecentFind } from '@/lib/utils';

interface GrailState {
  // Data
  characters: Character[];
  items: HolyGrailItem[];
  progress: GrailProgress[];
  statistics: GrailStatistics | null;
  settings: Settings;

  // UI State
  selectedCharacterId: string | null;
  filter: GrailFilter;
  advancedFilter: AdvancedGrailFilter;
  loading: boolean;
  error: string | null;

  // Actions
  setCharacters: (characters: Character[]) => void;
  setItems: (items: HolyGrailItem[]) => void;
  setProgress: (progress: GrailProgress[]) => void;
  setStatistics: (statistics: GrailStatistics) => void;
  setSettings: (settings: Partial<Settings>) => Promise<void>;
  setSelectedCharacterId: (characterId: string | null) => void;
  setFilter: (filter: Partial<GrailFilter>) => void;
  setAdvancedFilter: (filter: Partial<AdvancedGrailFilter>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Complex actions
  toggleItemFound: (itemId: string, foundBy?: string, manuallyAdded?: boolean) => void;
  reloadData: () => Promise<void>;
}

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
};

const defaultFilter: GrailFilter = {
  foundStatus: 'all',
};

const defaultAdvancedFilter: AdvancedGrailFilter = {
  rarities: [],
  difficulties: [],
  levelRange: { min: 1, max: 99 },
  requiredLevelRange: { min: 1, max: 99 },
  sortBy: 'name',
  sortOrder: 'asc',
  fuzzySearch: false,
};

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
          await window.electronAPI?.itemDetection.setGrailItems(items);
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
  setSelectedCharacterId: (selectedCharacterId) => set({ selectedCharacterId }),
  setFilter: (filterUpdate) =>
    set((state) => ({
      filter: { ...state.filter, ...filterUpdate },
    })),
  setAdvancedFilter: (filterUpdate) =>
    set((state) => ({
      advancedFilter: { ...state.advancedFilter, ...filterUpdate },
    })),
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
      newProgress = progress.map((p) =>
        p.itemId === itemId && p.characterId === selectedCharacterId
          ? {
              ...p,
              found: !p.found,
              foundDate: !p.found ? new Date() : undefined,
              foundBy: !p.found ? foundBy : undefined,
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
        found: true,
        foundDate: new Date(),
        foundBy,
        manuallyAdded,
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

        // Enable item detection and set grail items for monitoring
        await window.electronAPI?.itemDetection.setGrailItems(items);
        await window.electronAPI?.itemDetection.enable();
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

// Selectors for computed values
// Helper functions for filtering
const matchesCategories = (item: HolyGrailItem, categories?: string[]): boolean => {
  return !categories || categories.length === 0 || categories.includes(item.category);
};

const matchesSubCategories = (item: HolyGrailItem, subCategories?: string[]): boolean => {
  return !subCategories || subCategories.length === 0 || subCategories.includes(item.subCategory);
};

const matchesTypes = (item: HolyGrailItem, types?: string[]): boolean => {
  return !types || types.length === 0 || types.includes(item.type);
};

const matchesFoundStatus = (
  item: HolyGrailItem,
  foundStatus?: string,
  progress?: GrailProgress[],
): boolean => {
  // Always show all items by default, regardless of found status
  if (!foundStatus || foundStatus === 'all') return true;

  const itemProgress = progress?.find((p) => p.itemId === item.id && p.found);
  const isFound = Boolean(itemProgress);

  if (foundStatus === 'found') return isFound;
  if (foundStatus === 'missing') return !isFound;
  return true;
};

const matchesSearchTerm = (
  item: HolyGrailItem,
  searchTerm?: string,
  fuzzySearch?: boolean,
): boolean => {
  if (!searchTerm) return true;

  const term = searchTerm.toLowerCase();
  const name = item.name.toLowerCase();

  if (fuzzySearch) {
    // Fuzzy search with Levenshtein distance
    return calculateSimilarity(name, term) > 0.6 || name.includes(term.slice(0, 3)); // Partial match
  }

  return name.includes(term);
};

const calculateSimilarity = (str1: string, str2: string): number => {
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  return 1 - distance / maxLength;
};

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

const sortItems = (
  items: HolyGrailItem[],
  sortBy: string,
  sortOrder: string,
  progress?: GrailProgress[],
): HolyGrailItem[] => {
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
        if (!progress) {
          comparison = 0;
          break;
        }
        const aProgress = progress.find((p) => p.itemId === a.id);
        const bProgress = progress.find((p) => p.itemId === b.id);
        const aDate = aProgress?.foundDate?.getTime() || 0;
        const bDate = bProgress?.foundDate?.getTime() || 0;
        comparison = aDate - bDate;
        break;
      }
      default:
        comparison = 0;
    }

    return sortOrder === 'desc' ? -comparison : comparison;
  });
};

export const useFilteredItems = () => {
  const { items, progress, filter, advancedFilter } = useGrailStore();

  const filtered = items.filter((item) => {
    return (
      matchesCategories(item, filter.categories) &&
      matchesSubCategories(item, filter.subCategories) &&
      matchesTypes(item, filter.types) &&
      matchesFoundStatus(item, filter.foundStatus, progress) &&
      matchesSearchTerm(item, filter.searchTerm, advancedFilter.fuzzySearch)
    );
  });

  return sortItems(filtered, advancedFilter.sortBy, advancedFilter.sortOrder, progress);
};

// Helper functions to reduce complexity
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

function calculateCategoryStats(
  items: HolyGrailItem[],
  foundProgress: GrailProgress[],
  recentFinds: GrailProgress[],
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

    // Count unique items found in this category (not progress entries)
    const uniqueFoundItemIds = new Set(foundInCategory.map((p) => p.itemId));
    const uniqueFoundCount = uniqueFoundItemIds.size;

    return {
      category,
      total: categoryItems.length,
      found: uniqueFoundCount,
      percentage: categoryItems.length > 0 ? (uniqueFoundCount / categoryItems.length) * 100 : 0,
      recent: recentInCategory.length,
    };
  });
}

function calculateCharacterStats(
  characters: Character[],
  progress: GrailProgress[],
  items: HolyGrailItem[],
) {
  return characters.map((character) => {
    const charProgress = progress.filter((p) => p.found && p.characterId === character.id);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentProgress = charProgress.filter((p) => {
      return p.foundDate && new Date(p.foundDate) > sevenDaysAgo;
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

function calculateTimelineStats(progress: GrailProgress[]) {
  const timelineStats = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toDateString();

    const dayProgress = progress.filter(
      (p) => p.found && p.foundDate && new Date(p.foundDate).toDateString() === dateStr,
    );

    timelineStats.push({
      date: date.toLocaleDateString(),
      itemsFound: dayProgress.length,
      characters: [...new Set(dayProgress.map((p) => p.foundBy || 'Unknown'))],
    });
  }
  return timelineStats;
}

export const useGrailStatistics = () => {
  const { items, progress, characters } = useGrailStore();

  // Note: items and progress are already filtered based on grail settings (grailNormal, grailEthereal, grailRunes, grailRunewords)
  // at the database level, so these statistics automatically reflect the current grail configuration
  const totalItems = items.length;
  const foundProgress = progress.filter((p) => p.found);

  // Global statistics - count unique items found by ANY character
  const foundItemIds = new Set(
    foundProgress.map((p) => p.itemId).filter((id) => items.find((item) => item.id === id)),
  );
  const foundItems = foundItemIds.size;

  // Calculate ethereal vs normal breakdown
  // Note: These calculations are based on the already-filtered items array
  // If grailEthereal is false, etherealItems will be empty
  // If grailNormal is false, normalItems will be empty
  const normalItems = items.filter((item) => !item.id.startsWith('eth_'));
  const etherealItems = items.filter((item) => item.id.startsWith('eth_'));

  const globalFoundItems = new Set(foundProgress.map((p) => p.itemId));
  const foundNormalItems = Array.from(globalFoundItems).filter(
    (id) => !id.startsWith('eth_'),
  ).length;
  const foundEtherealItems = Array.from(globalFoundItems).filter((id) =>
    id.startsWith('eth_'),
  ).length;

  // Type breakdown - based on filtered items
  // If grailRunes is false, rune items will not be in the items array
  // If grailRunewords is false, runeword items will not be in the items array
  const typeStats = ['unique', 'set', 'rune', 'runeword'].map((type) => {
    const typeItems = items.filter((item) => item.type === type);
    const typeFoundItems = typeItems.filter((item) => globalFoundItems.has(item.id)).length;

    return {
      type,
      total: typeItems.length,
      found: typeFoundItems,
      percentage: typeItems.length > 0 ? (typeFoundItems / typeItems.length) * 100 : 0,
    };
  });

  // Recent finds (last 7 days)
  const recentFinds = foundProgress.filter((p) => isRecentFind(p.foundDate));

  // Find streak calculation
  const findDates = foundProgress
    .filter((p) => p.foundDate)
    .map((p) => (p.foundDate ? new Date(p.foundDate).toDateString() : ''))
    .filter(Boolean)
    .sort();

  const { currentStreak, maxStreak } = calculateStreaks(findDates);

  // Most active day
  const dayCount: Record<string, number> = {};
  for (const p of foundProgress) {
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
  const categoryStats = calculateCategoryStats(items, foundProgress, recentFinds);
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
