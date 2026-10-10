import type { GrailProgress, Item, RunItem } from 'electron/types/grail';

/**
 * Grail items and progress records indexed by id, for resolving many run items without
 * searching the full arrays for each one.
 */
export interface RunItemLookup {
  itemsById: ReadonlyMap<string, Item>;
  progressById: ReadonlyMap<string, GrailProgress>;
}

/**
 * The grail records a run item links to.
 */
export interface ResolvedRunItem {
  /** Display name: the manual entry's name, or the name of the linked grail item. */
  name: string | undefined;
  /** Grail progress record the run item links to, if any. */
  progress: GrailProgress | undefined;
  /** Grail item of the linked progress record, if any. */
  item: Item | undefined;
}

/**
 * Indexes records by id. With duplicate ids the first record wins, like `Array.find` did.
 */
function indexById<T extends { id: string }>(records: readonly T[]): Map<string, T> {
  const byId = new Map<string, T>();
  for (const record of records) {
    if (!byId.has(record.id)) {
      byId.set(record.id, record);
    }
  }
  return byId;
}

/**
 * Indexes grail items and progress records by id. Build it once per data change (e.g. in a
 * `useMemo`) and reuse it for every run item.
 * @param items - All grail items
 * @param progress - All grail progress records
 */
export function createRunItemLookup(items: Item[], progress: GrailProgress[]): RunItemLookup {
  return { itemsById: indexById(items), progressById: indexById(progress) };
}

/**
 * Resolves a run item to the grail records it links to. Manual entries carry their own name;
 * detected ones link to a grail progress record, which links to the grail item.
 * @param runItem - The run item to resolve
 * @param lookup - Grail items and progress records by id
 */
export function resolveRunItem(runItem: RunItem, lookup: RunItemLookup): ResolvedRunItem {
  const progress = runItem.grailProgressId
    ? lookup.progressById.get(runItem.grailProgressId)
    : undefined;
  const item = progress ? lookup.itemsById.get(progress.itemId) : undefined;
  return { name: runItem.name || item?.name, progress, item };
}

/**
 * Resolves a run item to its display name.
 * @param runItem - The run item to resolve
 * @param lookup - Grail items and progress records by id
 * @returns The name, or undefined if the run item has no name and links to no known grail item
 */
export function resolveRunItemName(runItem: RunItem, lookup: RunItemLookup): string | undefined {
  return resolveRunItem(runItem, lookup).name;
}
