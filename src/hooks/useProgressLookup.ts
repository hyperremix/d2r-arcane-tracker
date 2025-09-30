import type { GrailProgress, HolyGrailItem } from 'electron/types/grail';
import { useMemo } from 'react';
import { shouldShowEtherealStatus, shouldShowNormalStatus } from '@/lib/ethereal';

/**
 * Calculates progress for the normal (non-ethereal) version of an item.
 * @param {HolyGrailItem} item - The Holy Grail item to calculate progress for
 * @param {GrailProgress[]} progress - All progress records
 * @param {string | null} selectedCharacterId - Optional character ID to filter by
 * @returns {Object} Object containing found status and relevant progress records
 * @returns {boolean} returns.found - Whether the normal version is found
 * @returns {GrailProgress[]} returns.relevantProgress - Array of relevant progress records
 */
function calculateNormalProgress(
  item: HolyGrailItem,
  progress: GrailProgress[],
  selectedCharacterId: string | null,
) {
  if (!shouldShowNormalStatus(item)) {
    return { found: false, relevantProgress: [] };
  }

  if (selectedCharacterId) {
    const characterProgress = progress.find(
      (p) => p.itemId === item.id && p.characterId === selectedCharacterId && p.found,
    );
    return {
      found: Boolean(characterProgress),
      relevantProgress: characterProgress ? [characterProgress] : [],
    };
  }

  const relevantProgress = progress.filter((p) => p.itemId === item.id && p.found);
  return {
    found: relevantProgress.length > 0,
    relevantProgress,
  };
}

/**
 * Calculates progress for the ethereal version of an item.
 * @param {HolyGrailItem} item - The Holy Grail item to calculate progress for
 * @param {GrailProgress[]} progress - All progress records
 * @param {string | null} selectedCharacterId - Optional character ID to filter by
 * @returns {Object} Object containing found status and relevant progress records
 * @returns {boolean} returns.found - Whether the ethereal version is found
 * @returns {GrailProgress[]} returns.relevantProgress - Array of relevant progress records
 */
function calculateEtherealProgress(
  item: HolyGrailItem,
  progress: GrailProgress[],
  selectedCharacterId: string | null,
) {
  const etherealItemId = `eth_${item.id}`;

  if (!shouldShowEtherealStatus(item)) {
    return { found: false, relevantProgress: [] };
  }

  if (selectedCharacterId) {
    const characterProgress = progress.find(
      (p) => p.itemId === etherealItemId && p.characterId === selectedCharacterId && p.found,
    );
    return {
      found: Boolean(characterProgress),
      relevantProgress: characterProgress ? [characterProgress] : [],
    };
  }

  const relevantProgress = progress.filter((p) => p.itemId === etherealItemId && p.found);
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
 * @param {HolyGrailItem[]} items - Array of Holy Grail items to create lookup for
 * @param {GrailProgress[]} progress - All progress records from the database
 * @param {string | null} [selectedCharacterId] - Optional character ID to filter progress by
 * @returns {Map<string, ProgressLookupData>} A Map with item IDs as keys and progress data as values
 */
export function useProgressLookup(
  items: HolyGrailItem[],
  progress: GrailProgress[],
  selectedCharacterId?: string | null,
) {
  return useMemo(() => {
    const lookup = new Map<string, ProgressLookupData>();

    items.forEach((item) => {
      const normalProgress = calculateNormalProgress(item, progress, selectedCharacterId || null);
      const etherealProgress = calculateEtherealProgress(
        item,
        progress,
        selectedCharacterId || null,
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
    });

    return lookup;
  }, [items, progress, selectedCharacterId]);
}
