import type { GrailProgress, Item, Settings } from 'electron/types/grail';
import { useMemo } from 'react';
import { shouldShowEtherealStatus, shouldShowNormalStatus } from '@/lib/ethereal';

/**
 * Calculates progress for the normal (non-ethereal) version of an item.
 * Uses pre-built progress map for O(1) lookup instead of O(N) array search.
 * @param {Item} item - The Holy Grail item to calculate progress for
 * @param {GrailProgress[]} itemProgress - Pre-filtered progress records for this item
 * @param {string | null} selectedCharacterId - Optional character ID to filter by
 * @param {Settings} settings - The application settings
 * @returns {Object} Object containing found status and relevant progress records
 * @returns {boolean} returns.found - Whether the normal version is found
 * @returns {GrailProgress[]} returns.relevantProgress - Array of relevant progress records
 */
function calculateNormalProgress(
  item: Item,
  itemProgress: GrailProgress[],
  selectedCharacterId: string | null,
  settings: Settings,
) {
  if (!shouldShowNormalStatus(item, settings)) {
    return { found: false, relevantProgress: [] };
  }

  if (selectedCharacterId) {
    const characterProgress = itemProgress.find(
      (p) => p.characterId === selectedCharacterId && p.foundDate !== undefined && !p.isEthereal,
    );
    return {
      found: Boolean(characterProgress),
      relevantProgress: characterProgress ? [characterProgress] : [],
    };
  }

  const relevantProgress = itemProgress.filter((p) => p.foundDate !== undefined && !p.isEthereal);
  return {
    found: relevantProgress.length > 0,
    relevantProgress,
  };
}

/**
 * Calculates progress for the ethereal version of an item.
 * Uses pre-built progress map for O(1) lookup instead of O(N) array search.
 * @param {Item} item - The Holy Grail item to calculate progress for
 * @param {GrailProgress[]} itemProgress - Pre-filtered progress records for this item
 * @param {string | null} selectedCharacterId - Optional character ID to filter by
 * @param {Settings} settings - The application settings
 * @returns {Object} Object containing found status and relevant progress records
 * @returns {boolean} returns.found - Whether the ethereal version is found
 * @returns {GrailProgress[]} returns.relevantProgress - Array of relevant progress records
 */
function calculateEtherealProgress(
  item: Item,
  itemProgress: GrailProgress[],
  selectedCharacterId: string | null,
  settings: Settings,
) {
  if (!shouldShowEtherealStatus(item, settings)) {
    return { found: false, relevantProgress: [] };
  }

  if (selectedCharacterId) {
    const characterProgress = itemProgress.find(
      (p) => p.characterId === selectedCharacterId && p.foundDate !== undefined && p.isEthereal,
    );
    return {
      found: Boolean(characterProgress),
      relevantProgress: characterProgress ? [characterProgress] : [],
    };
  }

  const relevantProgress = itemProgress.filter((p) => p.foundDate !== undefined && p.isEthereal);
  return {
    found: relevantProgress.length > 0,
    relevantProgress,
  };
}

/**
 * Interface defining the structure of progress lookup data for an item.
 * Contains found status and progress records for both normal and ethereal versions.
 */
export interface ProgressLookupData {
  normalFound: boolean;
  etherealFound: boolean;
  normalProgress: GrailProgress[];
  etherealProgress: GrailProgress[];
  overallFound: boolean;
}

/**
 * Custom React hook that creates an optimized lookup map for item progress data.
 * Memoizes the lookup to avoid recalculation on every render.
 * Pre-builds a progress-by-item-id map for O(1) lookups instead of O(N) searches.
 * @param {Item[]} items - Array of Holy Grail items to create lookup for
 * @param {GrailProgress[]} progress - All progress records from the database
 * @param {Settings} settings - The application settings
 * @param {string | null} [selectedCharacterId] - Optional character ID to filter progress by
 * @returns {Map<string, ProgressLookupData>} A Map with item IDs as keys and progress data as values
 */
export function useProgressLookup(
  items: Item[],
  progress: GrailProgress[],
  settings: Settings,
  selectedCharacterId?: string | null,
) {
  return useMemo(() => {
    const lookup = new Map<string, ProgressLookupData>();

    // Pre-build progress map for O(1) lookups instead of O(N) array searches
    const progressByItemId = new Map<string, GrailProgress[]>();
    for (const p of progress) {
      const existing = progressByItemId.get(p.itemId);
      if (existing) {
        existing.push(p);
      } else {
        progressByItemId.set(p.itemId, [p]);
      }
    }

    for (const item of items) {
      // Get pre-filtered progress for this item (O(1) lookup)
      const itemProgress = progressByItemId.get(item.id) ?? [];

      const normalProgress = calculateNormalProgress(
        item,
        itemProgress,
        selectedCharacterId ?? null,
        settings,
      );
      const etherealProgress = calculateEtherealProgress(
        item,
        itemProgress,
        selectedCharacterId ?? null,
        settings,
      );

      // Overall found status (either normal OR ethereal found)
      const overallFound = normalProgress.found || etherealProgress.found;

      lookup.set(item.id, {
        normalFound: normalProgress.found,
        etherealFound: etherealProgress.found,
        normalProgress: normalProgress.relevantProgress,
        etherealProgress: etherealProgress.relevantProgress,
        overallFound,
      });
    }

    return lookup;
  }, [items, progress, selectedCharacterId, settings]);
}
