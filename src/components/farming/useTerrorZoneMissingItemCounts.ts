import { useMemo } from 'react';
import { getDefaultFarmingCharacterLevel, getMissingFarmingItems } from '@/lib/farming';
import { useFarmingSessionStore } from '@/stores/farmingSessionStore';
import { useGrailStore } from '@/stores/grailStore';
import { useFarmingOverview } from './useFarmingOverview';

/**
 * How many of the grail's missing items the terrorized monsters of each terror zone can drop, in
 * any difficulty, at the character level of the farming advisor. Uses the farming advisor's data,
 * so it is undefined while that loads and when the game files or the terror zone file can't be read.
 * @returns The number of missing items per zone ID, or undefined without farming data
 */
export function useTerrorZoneMissingItemCounts(): Map<string, number> | undefined {
  const items = useGrailStore((state) => state.items);
  const progress = useGrailStore((state) => state.progress);
  const characters = useGrailStore((state) => state.characters);
  const settings = useGrailStore((state) => state.settings);
  const storedCharacterLevel = useFarmingSessionStore((state) => state.characterLevel);
  const characterLevel = storedCharacterLevel ?? getDefaultFarmingCharacterLevel(characters);
  const missingItems = useMemo(
    () => getMissingFarmingItems(items, progress, settings),
    [items, progress, settings],
  );
  const { overview } = useFarmingOverview(missingItems, characterLevel);

  return useMemo(() => {
    if (overview?.status !== 'ready' || overview.terrorZones.length === 0) return undefined;
    const itemsByZone = new Map<string, Set<number>>();
    for (const zone of overview.terrorZones) {
      const zoneItems = itemsByZone.get(zone.zoneId) ?? new Set<number>();
      for (const index of zone.itemIndexes) zoneItems.add(index);
      itemsByZone.set(zone.zoneId, zoneItems);
    }
    return new Map([...itemsByZone].map(([zoneId, zoneItems]) => [zoneId, zoneItems.size]));
  }, [overview]);
}
