import { constants as constants105 } from '@dschu012/d2s/lib/data/versions/105_constant_data';
import type { D2RLoaderItem } from '../../types/d2rLoader';
import type { GrailProgress, Item, Settings } from '../../types/grail';
import { resolveChronicleGrailItemId } from '../chronicle';

/** Status of one version (normal or ethereal) of a grail item, as the plugin protocol encodes it. */
export const VersionStatus = {
  /** The version doesn't exist for the item or the grail settings don't track it. */
  NotTracked: 0,
  Missing: 1,
  Found: 2,
} as const;

export type VersionStatus = (typeof VersionStatus)[keyof typeof VersionStatus];

/** Grail status of an item. */
export interface GrailItemStatus {
  item: Item;
  normal: VersionStatus;
  ethereal: VersionStatus;
}

/** Grail status of every tracked item, by plugin key, with the overall progress. */
export interface GrailStatusTable {
  byKey: ReadonlyMap<string, GrailItemStatus>;
  /** Tracked item versions that are found. */
  found: number;
  /** Tracked item versions. */
  total: number;
}

/** A game data row as the d2s parser data holds it: display name and item code. */
interface ParserItemRow {
  n?: string;
  c?: string;
}

/**
 * Builds the plugin key of a unique or set row: kind, zero-based row and item code. The code lets
 * the plugin skip a row that doesn't belong to the item (a mod that shifted the rows).
 */
function toRowKey(prefix: 'u' | 's', row: number, code: string): string {
  return `${prefix}:${row}:${code.trim()}`;
}

let keysByItemId: Map<string, string[]> | undefined;

/**
 * Returns the plugin keys of every grail unique, set item and rune, by grail item id. Unique and
 * set rows are matched to grail items the same way Chronicle entries are; several rows can belong
 * to one item.
 */
function getKeysByItemId(): ReadonlyMap<string, string[]> {
  if (keysByItemId) {
    return keysByItemId;
  }

  const keys = new Map<string, string[]>();
  const addKey = (itemId: string | null, key: string) => {
    if (!itemId) return;
    keys.set(itemId, [...(keys.get(itemId) ?? []), key]);
  };

  const uniqueRows = constants105.unq_items as (ParserItemRow | undefined)[];
  uniqueRows.forEach((row, index) => {
    if (row?.c) {
      addKey(
        resolveChronicleGrailItemId({ category: 'unique', index }),
        toRowKey('u', index, row.c),
      );
    }
  });
  const setRows = constants105.set_items as (ParserItemRow | undefined)[];
  setRows.forEach((row, index) => {
    if (row?.c) {
      addKey(resolveChronicleGrailItemId({ category: 'set', index }), toRowKey('s', index, row.c));
    }
  });

  keysByItemId = keys;
  return keys;
}

/**
 * Returns the plugin keys of a grail item: its unique or set rows, or `r:<code>` for a rune.
 * @param item - The grail item
 */
function getItemKeys(item: Item): string[] {
  if (item.type === 'rune') {
    return item.code ? [`r:${item.code}`] : [];
  }
  return getKeysByItemId().get(item.id) ?? [];
}

/**
 * Returns the plugin key of an item the plugin reported.
 * @param item - The reported item
 */
export function getReportedItemKey(item: D2RLoaderItem): string {
  return item.kind === 'rune'
    ? `r:${item.code}`
    : toRowKey(item.kind === 'unique' ? 'u' : 's', item.recordId, item.code);
}

function getVersionStatus(tracked: boolean, found: boolean): VersionStatus {
  if (!tracked) return VersionStatus.NotTracked;
  return found ? VersionStatus.Found : VersionStatus.Missing;
}

/** Which versions of an item any character found. */
interface FoundVersions {
  normal: boolean;
  ethereal: boolean;
}

/** Collects the found versions of every item from the progress records that have a found date. */
function collectFoundVersions(progress: GrailProgress[]): Map<string, FoundVersions> {
  const foundVersions = new Map<string, FoundVersions>();
  for (const record of progress) {
    if (!record.foundDate) continue;
    const versions = foundVersions.get(record.itemId) ?? { normal: false, ethereal: false };
    versions[record.isEthereal ? 'ethereal' : 'normal'] = true;
    foundVersions.set(record.itemId, versions);
  }
  return foundVersions;
}

/**
 * Builds the grail status the plugin shows on ground items and in the overlay. A version counts as
 * found when any character found it, the same as on the grail page; a version the grail settings
 * don't track is "not tracked", even when it was found.
 * @param items - Tracked grail items (already filtered by the rune and runeword settings)
 * @param progress - All progress records
 * @param settings - Which item versions are tracked
 * @returns The status of every item the plugin can recognize, and the overall progress
 */
export function buildGrailStatusTable(
  items: Item[],
  progress: GrailProgress[],
  settings: Pick<Settings, 'grailNormal' | 'grailEthereal'>,
): GrailStatusTable {
  const foundVersions = collectFoundVersions(progress);
  const byKey = new Map<string, GrailItemStatus>();
  const versionStatuses: VersionStatus[] = [];
  for (const item of items) {
    const versions = foundVersions.get(item.id);
    const status: GrailItemStatus = {
      item,
      normal: getVersionStatus(
        settings.grailNormal && item.etherealType !== 'only',
        versions?.normal === true,
      ),
      ethereal: getVersionStatus(
        settings.grailEthereal && item.etherealType !== 'none',
        versions?.ethereal === true,
      ),
    };
    versionStatuses.push(status.normal, status.ethereal);
    for (const key of getItemKeys(item)) {
      byKey.set(key, status);
    }
  }

  return {
    byKey,
    found: versionStatuses.filter((status) => status === VersionStatus.Found).length,
    total: versionStatuses.filter((status) => status !== VersionStatus.NotTracked).length,
  };
}

/**
 * Returns the status of the version of a grail item the player has: the ethereal version for an
 * ethereal item, otherwise the normal version.
 * @param status - Grail status of the item
 * @param ethereal - Whether the player's copy is ethereal
 */
export function getStatusOfCopy(status: GrailItemStatus, ethereal: boolean): VersionStatus {
  return ethereal ? status.ethereal : status.normal;
}
