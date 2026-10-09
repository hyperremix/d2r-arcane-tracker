import type {
  Character,
  GrailProgress,
  GrailStatistics,
  Item,
  ItemCategory,
  Settings,
} from 'electron/types/grail';
import { DAY_MS } from '@/lib/date';
import { canItemBeEthereal, canItemBeNormal } from '@/lib/ethereal';

/** Number of days a find counts as recent. */
export const RECENT_FIND_DAYS = 7;

/** Grail settings that decide which item versions are tracked. */
export type GrailStatisticsSettings = Pick<Settings, 'grailNormal' | 'grailEthereal'>;

/** Found and total count of tracked item versions, with the completion percentage. */
export interface ProgressCount {
  total: number;
  found: number;
  percentage: number;
}

/** Progress of a single item category. */
export interface CategoryStatistics extends ProgressCount {
  category: ItemCategory;
  /** Recent finds (excluding the initial scan) of items in this category. */
  recent: number;
}

/** Finds of a single character. */
export interface CharacterStatistics {
  character: Character;
  totalFound: number;
  /** Recent finds (excluding the initial scan) of this character. */
  recentFinds: number;
}

/** Holy Grail statistics shown by the grail page, the statistics page and the widget. */
export interface GrailStatisticsSummary extends GrailStatistics {
  normalItems: ProgressCount;
  etherealItems: ProgressCount;
  averageItemsPerDay: number;
  /** Most recently found progress record, if anything was found. */
  lastFind: GrailProgress | undefined;
  /** Categories sorted by completion, highest first. */
  categoryStats: CategoryStatistics[];
  /** Characters sorted by number of finds, highest first. */
  characterStats: CharacterStatistics[];
}

/** Data the statistics are computed from. */
export interface GrailStatisticsInput {
  /** Tracked items; the main process already filters them by the grail settings. */
  items: Item[];
  /** All progress records, including those of items that are not tracked. */
  progress: GrailProgress[];
  characters: Character[];
  settings: GrailStatisticsSettings;
  /** Reference time for recent finds and streaks; defaults to the current time. */
  now?: Date;
}

interface FoundVersions {
  normal: boolean;
  ethereal: boolean;
}

const toPercentage = (found: number, total: number): number =>
  total > 0 ? (found / total) * 100 : 0;

/**
 * Index of the local calendar day of a date, so consecutive days differ by exactly one.
 */
const toDayIndex = (date: Date): number =>
  Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;

/**
 * Calculates the current and longest streak of consecutive days with at least one find.
 * The current streak counts back from today, or from yesterday if nothing was found today yet.
 * @param findDates - Dates of the finds that count towards streaks
 * @param now - Reference time
 * @returns The current and the longest streak in days
 */
export function calculateFindStreaks(
  findDates: Date[],
  now: Date,
): { currentStreak: number; maxStreak: number } {
  const days = [...new Set(findDates.map(toDayIndex))].sort((a, b) => a - b);
  if (days.length === 0) {
    return { currentStreak: 0, maxStreak: 0 };
  }

  let maxStreak = 1;
  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    streak = days[i] === days[i - 1] + 1 ? streak + 1 : 1;
    maxStreak = Math.max(maxStreak, streak);
  }

  const today = toDayIndex(now);
  const foundDays = new Set(days);
  let day = foundDays.has(today) ? today : today - 1;
  let currentStreak = 0;
  while (foundDays.has(day)) {
    currentStreak++;
    day--;
  }

  return { currentStreak, maxStreak };
}

/**
 * Counts the tracked versions (normal and/or ethereal) of the given items and how many of them
 * were found.
 */
function countTrackedVersions(
  items: Item[],
  foundVersions: Map<string, FoundVersions>,
  settings: GrailStatisticsSettings,
): { normal: ProgressCount; ethereal: ProgressCount; overall: ProgressCount } {
  let normalTotal = 0;
  let normalFound = 0;
  let etherealTotal = 0;
  let etherealFound = 0;

  for (const item of items) {
    const found = foundVersions.get(item.id);
    if (settings.grailNormal && canItemBeNormal(item)) {
      normalTotal++;
      if (found?.normal) normalFound++;
    }
    if (settings.grailEthereal && canItemBeEthereal(item)) {
      etherealTotal++;
      if (found?.ethereal) etherealFound++;
    }
  }

  const total = normalTotal + etherealTotal;
  const found = normalFound + etherealFound;
  return {
    normal: {
      total: normalTotal,
      found: normalFound,
      percentage: toPercentage(normalFound, normalTotal),
    },
    ethereal: {
      total: etherealTotal,
      found: etherealFound,
      percentage: toPercentage(etherealFound, etherealTotal),
    },
    overall: { total, found, percentage: toPercentage(found, total) },
  };
}

/**
 * Computes the Holy Grail statistics. Pure, so callers can memoize it on its inputs.
 *
 * Only the tracked versions of the tracked items count towards completion. Finds from the
 * initial save file scan count as found, but not towards recent finds, streaks or the daily
 * average, since they were not found while the tracker was running.
 * @param input - Items, progress, characters, settings and the reference time
 * @returns The statistics
 */
export function computeGrailStatistics({
  items,
  progress,
  characters,
  settings,
  now = new Date(),
}: GrailStatisticsInput): GrailStatisticsSummary {
  const recentThreshold = now.getTime() - RECENT_FIND_DAYS * DAY_MS;
  const foundProgress = progress.filter(
    (p): p is GrailProgress & { foundDate: Date } => p.foundDate !== undefined,
  );

  const foundVersions = new Map<string, FoundVersions>();
  for (const p of foundProgress) {
    const versions = foundVersions.get(p.itemId) ?? { normal: false, ethereal: false };
    if (p.isEthereal) {
      versions.ethereal = true;
    } else {
      versions.normal = true;
    }
    foundVersions.set(p.itemId, versions);
  }

  const counts = countTrackedVersions(items, foundVersions, settings);

  // Finds made while the tracker was running
  const trackedFinds = foundProgress.filter((p) => !p.fromInitialScan);
  const recentFinds = trackedFinds.filter((p) => new Date(p.foundDate).getTime() > recentThreshold);
  const { currentStreak, maxStreak } = calculateFindStreaks(
    trackedFinds.map((p) => new Date(p.foundDate)),
    now,
  );

  let lastFind: (typeof foundProgress)[number] | undefined;
  for (const p of foundProgress) {
    if (!lastFind || new Date(p.foundDate).getTime() > new Date(lastFind.foundDate).getTime()) {
      lastFind = p;
    }
  }

  // Category breakdown, in the order the categories first appear in the items
  const itemsByCategory = new Map<ItemCategory, Item[]>();
  const categoryByItemId = new Map<string, ItemCategory>();
  for (const item of items) {
    const categoryItems = itemsByCategory.get(item.category) ?? [];
    categoryItems.push(item);
    itemsByCategory.set(item.category, categoryItems);
    categoryByItemId.set(item.id, item.category);
  }
  const recentByCategory = new Map<ItemCategory, number>();
  for (const p of recentFinds) {
    const category = categoryByItemId.get(p.itemId);
    if (category) {
      recentByCategory.set(category, (recentByCategory.get(category) ?? 0) + 1);
    }
  }
  const categoryStats: CategoryStatistics[] = [...itemsByCategory].map(
    ([category, categoryItems]) => ({
      category,
      ...countTrackedVersions(categoryItems, foundVersions, settings).overall,
      recent: recentByCategory.get(category) ?? 0,
    }),
  );
  categoryStats.sort((a, b) => b.percentage - a.percentage);

  // Character comparison
  const characterStats: CharacterStatistics[] = characters.map((character) => {
    const characterFinds = foundProgress.filter((p) => p.characterId === character.id);
    return {
      character,
      totalFound: characterFinds.length,
      recentFinds: characterFinds.filter(
        (p) => !p.fromInitialScan && new Date(p.foundDate).getTime() > recentThreshold,
      ).length,
    };
  });
  characterStats.sort((a, b) => b.totalFound - a.totalFound);

  return {
    totalItems: counts.overall.total,
    foundItems: counts.overall.found,
    completionPercentage: counts.overall.percentage,
    normalItems: counts.normal,
    etherealItems: counts.ethereal,
    recentFinds: recentFinds.length,
    currentStreak,
    maxStreak,
    averageItemsPerDay: recentFinds.length / RECENT_FIND_DAYS,
    lastFind,
    categoryStats,
    characterStats,
  };
}
