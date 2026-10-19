import type {
  Difficulty,
  FarmingLocation,
  FarmingOverviewData,
  FarmingRange,
  GrailProgress,
  Item,
  Settings,
} from 'electron/types/grail';
import { MAX_FARMING_CHARACTER_LEVEL } from 'electron/types/grail';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatLevelRange } from '@/components/farming/dropRateText';
import { translations } from '@/i18n/translations';
import { FARMING_DIFFICULTY_ORDER, getMissingFarmingItems, isFarmableItem } from '@/lib/farming';
import { getRank } from '@/lib/grailFilters';

/** Where to farm a missing item, as shown in its card tooltip. */
export interface FarmingHint {
  /** Area name, or the name of the super unique or boss */
  location: string;
  /** The area a super unique or boss is in */
  areaName?: string;
  difficulty: Difficulty;
  monsterLevel: FarmingRange;
}

/** Farming hints by item ID; undefined while no farming data is available. */
export type FarmingHints = ReadonlyMap<string, FarmingHint>;

/**
 * Picks the place to farm every missing item: of the locations that can drop the item, the one the
 * farming advisor lists first. That is the highest difficulty (Hell first), then the location that
 * drops the most missing items, then the highest monster level.
 * @param overview - Where the requested items can drop
 * @param requestedItems - The items of the overview request, in request order
 * @param missingItemIds - The IDs of the items still missing
 * @returns The farming hint of every missing item that can drop somewhere
 */
export function getFarmingHints(
  overview: FarmingOverviewData,
  requestedItems: Item[],
  missingItemIds: ReadonlySet<string>,
): Map<string, FarmingHint> {
  const isMissing = (index: number) => {
    const item = requestedItems[index];
    return item !== undefined && missingItemIds.has(item.id);
  };
  const ranked = overview.locations
    .map((location) => ({ location, missingCount: location.itemIndexes.filter(isMissing).length }))
    .filter(({ missingCount }) => missingCount > 0)
    .sort(
      (a, b) =>
        getRank(FARMING_DIFFICULTY_ORDER, a.location.difficulty) -
          getRank(FARMING_DIFFICULTY_ORDER, b.location.difficulty) ||
        b.missingCount - a.missingCount ||
        b.location.monsterLevel.max - a.location.monsterLevel.max ||
        a.location.name.localeCompare(b.location.name),
    );

  const hints = new Map<string, FarmingHint>();
  for (const { location } of ranked) {
    for (const index of location.itemIndexes) {
      const item = requestedItems[index];
      if (item && isMissing(index) && !hints.has(item.id)) {
        hints.set(item.id, toFarmingHint(location));
      }
    }
  }
  return hints;
}

function toFarmingHint(location: FarmingLocation): FarmingHint {
  return {
    location: location.name,
    areaName: location.areaName,
    difficulty: location.difficulty,
    monsterLevel: location.monsterLevel,
  };
}

/** The overview of the items it was requested for. */
interface LoadedOverview {
  items: Item[];
  data: FarmingOverviewData;
}

/**
 * Loads where the tracked uniques, set items and runes drop, with one request for all of them, and
 * picks the place to farm each missing item (see {@link getFarmingHints}). Nothing is requested
 * while no D2R installation is set, and there are no hints while the farming data can't be read.
 * The request covers all farmable items rather than only the missing ones, so finding an item
 * doesn't ask again; the hints are recalculated from the progress instead.
 * @param items - The tracked grail items
 * @param progress - All progress records
 * @param settings - The D2R installation and the grail tracking settings
 * @returns The farming hints, or undefined when no farming data is available
 */
export function useFarmingHints(
  items: Item[],
  progress: GrailProgress[],
  settings: Pick<Settings, 'd2rInstallPath' | 'grailNormal' | 'grailEthereal'>,
): FarmingHints | undefined {
  const { d2rInstallPath, grailNormal, grailEthereal } = settings;
  const [loaded, setLoaded] = useState<LoadedOverview | undefined>(undefined);

  const farmableItems = useMemo(() => items.filter(isFarmableItem), [items]);
  const enabled = Boolean(d2rInstallPath?.trim()) && farmableItems.length > 0;
  // A stable key, so a new array with the same items doesn't load again
  const requestKey = farmableItems.map((item) => item.id).join('|');

  // biome-ignore lint/correctness/useExhaustiveDependencies: requestKey stands for farmableItems
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    window.electronAPI.farming
      .getOverview({
        itemIds: farmableItems.map((item) => item.id),
        // Only terror zones depend on the character level, and the hints leave them out
        characterLevel: MAX_FARMING_CHARACTER_LEVEL,
      })
      .then((overview) => {
        if (cancelled) return;
        setLoaded(
          overview.status === 'ready' ? { items: farmableItems, data: overview } : undefined,
        );
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('Failed to load the farming hints:', error);
        setLoaded(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, requestKey, d2rInstallPath]);

  return useMemo(() => {
    if (!enabled || !loaded) return undefined;
    const missingItemIds = new Set(
      getMissingFarmingItems(loaded.items, progress, { grailNormal, grailEthereal }).map(
        (item) => item.id,
      ),
    );
    return getFarmingHints(loaded.data, loaded.items, missingItemIds);
  }, [enabled, loaded, progress, grailNormal, grailEthereal]);
}

/** The farming hints of the grail page; cards outside it have none. */
export const FarmingHintsContext = createContext<FarmingHints | undefined>(undefined);

/**
 * One line naming where to farm an item, for the card tooltip of a missing item. Renders nothing
 * when there is no farming data or the item has no drop source.
 */
export function FarmingHintText({ itemId }: { itemId: string }) {
  const { t } = useTranslation();
  const hint = useContext(FarmingHintsContext)?.get(itemId);
  if (!hint) return null;

  const values = {
    location: hint.location,
    area: hint.areaName,
    difficulty: t(translations.farming.difficulties[hint.difficulty]),
    level: formatLevelRange(t, hint.monsterLevel),
  };
  return (
    <p className="text-xs">
      {hint.areaName
        ? t(translations.grail.itemCard.farmingHintInArea, values)
        : t(translations.grail.itemCard.farmingHint, values)}
    </p>
  );
}
