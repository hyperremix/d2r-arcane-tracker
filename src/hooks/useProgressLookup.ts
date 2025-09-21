import type { GrailProgress, HolyGrailItem } from 'electron/types/grail';
import { useMemo } from 'react';
import { shouldShowEtherealStatus, shouldShowNormalStatus } from '@/lib/ethereal';

// Helper function to calculate normal version progress
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

// Helper function to calculate ethereal version progress
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

export interface ProgressLookupData {
  normalFound: boolean;
  etherealFound: boolean;
  normalProgress: GrailProgress[];
  etherealProgress: GrailProgress[];
  overallFound: boolean;
}

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
