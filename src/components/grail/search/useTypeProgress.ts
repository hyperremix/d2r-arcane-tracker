import type { ItemType } from 'electron/types/grail';
import { useMemo } from 'react';
import { computeTypeProgress, type ProgressCount } from '@/lib/grailStatistics';
import { useGrailStore } from '@/stores/grailStore';

/**
 * Returns the grail progress of each item type (unique, set, rune, runeword). It counts the same
 * items and tracked versions as the overall grail progress, independent of the current filters.
 */
export function useTypeProgress(): Partial<Record<ItemType, ProgressCount>> {
  // Individual selectors so the toolbar only recomputes when these slices change
  const items = useGrailStore((state) => state.items);
  const progress = useGrailStore((state) => state.progress);
  const grailNormal = useGrailStore((state) => state.settings.grailNormal);
  const grailEthereal = useGrailStore((state) => state.settings.grailEthereal);

  return useMemo(
    () => computeTypeProgress({ items, progress, settings: { grailNormal, grailEthereal } }),
    [items, progress, grailNormal, grailEthereal],
  );
}
