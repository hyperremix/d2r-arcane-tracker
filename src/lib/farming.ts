import type { Character, Difficulty, GrailProgress, Item, Settings } from 'electron/types/grail';
import { MAX_FARMING_CHARACTER_LEVEL } from 'electron/types/grail';
import { getProgressVersion, type ItemVersion, isVersionTracked } from '@/lib/ethereal';

/** Time without a change to a farming input before the drop data is requested for it. */
export const FARMING_INPUT_DEBOUNCE_MS = 250;

/** The difficulties in the order the farming advisor lists them: the best drops first. */
export const FARMING_DIFFICULTY_ORDER: readonly Difficulty[] = ['hell', 'nightmare', 'normal'];

/** Item types that can drop from monsters; runewords are made, not found. */
const DROPPABLE_TYPES = new Set<Item['type']>(['unique', 'set', 'rune']);

/** Whether an item can drop from monsters, so the farming advisor has something to say about it. */
export const isFarmableItem = (item: Item): boolean => DROPPABLE_TYPES.has(item.type);

const VERSIONS: ItemVersion[] = ['normal', 'ethereal'];

/**
 * The grail items worth farming: uniques, set items and runes with at least one tracked version
 * (normal or ethereal) that no character found yet.
 * @param items - The tracked grail items
 * @param progress - All progress records
 * @param settings - The grail tracking settings
 * @returns The missing items, in catalog order
 */
export function getMissingFarmingItems(
  items: Item[],
  progress: GrailProgress[],
  settings: Pick<Settings, 'grailNormal' | 'grailEthereal'>,
): Item[] {
  const found = new Set<string>();
  for (const record of progress) {
    if (record.foundDate !== undefined) {
      found.add(`${record.itemId}|${getProgressVersion(record)}`);
    }
  }
  return items.filter(
    (item) =>
      isFarmableItem(item) &&
      VERSIONS.some(
        (version) =>
          isVersionTracked(item, version, settings) && !found.has(`${item.id}|${version}`),
      ),
  );
}

/**
 * The character level the terror zone levels start from by default: the highest level of the
 * known characters, or the level cap when there are none.
 */
export function getDefaultFarmingCharacterLevel(characters: Character[]): number {
  const levels = characters.filter((c) => !c.deleted).map((c) => c.level);
  return levels.length > 0 ? Math.max(...levels) : MAX_FARMING_CHARACTER_LEVEL;
}

/** How a drop rate is shown: as "1 in N kills", or as drops per kill when it is at least one. */
export type DropRateDisplay = { kind: 'oneIn'; kills: number } | { kind: 'perKill'; drops: number };

/**
 * Turns an expected number of drops per kill into the way it is shown.
 * @param dropsPerKill - Expected drops per kill (greater than 0)
 */
export function toDropRateDisplay(dropsPerKill: number): DropRateDisplay {
  return dropsPerKill >= 1
    ? { kind: 'perKill', drops: Math.round(dropsPerKill * 100) / 100 }
    : { kind: 'oneIn', kills: Math.round(1 / dropsPerKill) };
}

/**
 * Clamps a number input to an integer range; empty or invalid input becomes the minimum.
 */
export function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
