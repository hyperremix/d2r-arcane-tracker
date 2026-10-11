import type { GrailProgress, Item, ItemSet } from 'electron/types/grail';
import { canItemBeEthereal, canItemBeNormal, filterItemsByTrackedVersions } from '@/lib/ethereal';
import type { GrailStatisticsSettings } from '@/lib/grailStatistics';

/** Progress of one item set. */
export interface SetProgress {
  setName: ItemSet;
  found: number;
  total: number;
}

/** Progress of the item sets, for the closest set statistic. */
export interface SetsSummary {
  /** The incomplete set with the largest share of its items found; undefined if all are complete. */
  closest: SetProgress | undefined;
  /** Number of tracked sets. */
  setCount: number;
}

/** Progress of the runes, for the missing runes statistic. */
export interface RunesSummary {
  total: number;
  missing: number;
  /** The highest (rarest) rune that was not found yet. */
  highestMissing: Item | undefined;
}

/** The latest find made while the tracker was running. */
export interface LastTrackedFind {
  item: Item;
  foundDate: Date;
}

/**
 * Returns whether a record is a find of a tracked version of its item: the version must be tracked
 * and the item must be able to have it (sets and runes, for example, cannot be ethereal).
 */
const isTrackedFind = (
  record: GrailProgress,
  item: Item,
  settings: GrailStatisticsSettings,
): record is GrailProgress & { foundDate: Date } =>
  record.foundDate !== undefined &&
  (record.isEthereal
    ? settings.grailEthereal && canItemBeEthereal(item)
    : settings.grailNormal && canItemBeNormal(item));

/**
 * Returns the IDs of the given items with at least one found record of a tracked version.
 */
function findFoundItemIds(
  items: Item[],
  progress: GrailProgress[],
  settings: GrailStatisticsSettings,
): Set<string> {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const found = new Set<string>();
  for (const record of progress) {
    const item = itemsById.get(record.itemId);
    if (item && isTrackedFind(record, item, settings)) found.add(item.id);
  }
  return found;
}

/**
 * Summarizes the progress of the tracked item sets: an item counts as found once any tracked
 * version of it was found. Items without a tracked version (for example sets, which cannot be
 * ethereal, when only ethereal items are tracked) are not part of the grail and are left out.
 * @param items - Tracked items
 * @param progress - All progress records
 * @param settings - Which item versions are tracked
 * @returns The closest incomplete set and the number of sets, or undefined if no set is tracked
 */
export function summarizeSets(
  items: Item[],
  progress: GrailProgress[],
  settings: GrailStatisticsSettings,
): SetsSummary | undefined {
  const grailItems = filterItemsByTrackedVersions(items, settings);
  const foundItemIds = findFoundItemIds(grailItems, progress, settings);
  const sets = new Map<ItemSet, SetProgress>();
  for (const item of grailItems) {
    if (!item.setName) continue;
    const set = sets.get(item.setName) ?? { setName: item.setName, found: 0, total: 0 };
    set.total++;
    if (foundItemIds.has(item.id)) set.found++;
    sets.set(item.setName, set);
  }
  if (sets.size === 0) return undefined;

  // Largest share found first, then the fewest items missing, then by name
  const [closest] = [...sets.values()]
    .filter((set) => set.found < set.total)
    .sort(
      (a, b) =>
        b.found / b.total - a.found / a.total ||
        a.total - a.found - (b.total - b.found) ||
        a.setName.localeCompare(b.setName),
    );
  return { closest, setCount: sets.size };
}

/**
 * Order of a rune from its item code (r01 for El up to r33 for Zod).
 */
function runeOrder(item: Item): number {
  const match = item.code?.match(/^r(\d+)$/);
  return match ? Number(match[1]) : 0;
}

/**
 * Summarizes the tracked runes that were not found yet. Runes cannot be ethereal, so none are
 * tracked when only ethereal items are.
 * @param items - Tracked items
 * @param progress - All progress records
 * @param settings - Which item versions are tracked
 * @returns The rune counts, or undefined if no rune is tracked
 */
export function summarizeRunes(
  items: Item[],
  progress: GrailProgress[],
  settings: GrailStatisticsSettings,
): RunesSummary | undefined {
  const runes = filterItemsByTrackedVersions(items, settings).filter(
    (item) => item.type === 'rune',
  );
  if (runes.length === 0) return undefined;

  const foundItemIds = findFoundItemIds(runes, progress, settings);
  const missing = runes.filter((rune) => !foundItemIds.has(rune.id));
  const highestMissing = missing.reduce<Item | undefined>(
    (highest, rune) => (!highest || runeOrder(rune) > runeOrder(highest) ? rune : highest),
    undefined,
  );
  return { total: runes.length, missing: missing.length, highestMissing };
}

/**
 * Finds the latest find of a tracked item version made while the tracker was running. Finds from
 * the initial save file scan are left out, since their date is the date of the scan.
 * @param items - Tracked items
 * @param progress - All progress records
 * @param settings - Which item versions are tracked
 * @returns The latest find, or undefined if nothing was found while the tracker was running
 */
export function findLastTrackedFind(
  items: Item[],
  progress: GrailProgress[],
  settings: GrailStatisticsSettings,
): LastTrackedFind | undefined {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  let latest: LastTrackedFind | undefined;
  for (const record of progress) {
    const item = itemsById.get(record.itemId);
    if (!item || !isTrackedFind(record, item, settings) || record.fromInitialScan) continue;
    const foundDate = new Date(record.foundDate);
    if (!latest || foundDate.getTime() > latest.foundDate.getTime()) {
      latest = { item, foundDate };
    }
  }
  return latest;
}
