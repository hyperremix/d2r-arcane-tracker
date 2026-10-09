import type {
  GrailProgress,
  Item,
  Run,
  RunItem,
  Session,
  SessionStats,
} from 'electron/types/grail';

/**
 * Finds the progress records that added an item version to the grail: for every tracked item
 * (and, with ethereal tracking, every version of it) the earliest found record. A run item linked
 * to one of these records was a new grail item.
 * @param progress - All progress records
 * @param items - Tracked items; finds of other items are not grail items
 * @param trackEthereal - Whether normal and ethereal versions count as separate grail entries
 * @returns The first-discovery records by progress ID
 */
export function findFirstDiscoveries(
  progress: GrailProgress[],
  items: Item[],
  trackEthereal: boolean,
): ReadonlyMap<string, GrailProgress> {
  const trackedItemIds = new Set(items.map((item) => item.id));
  const earliestByEntry = new Map<string, GrailProgress>();

  for (const record of progress) {
    if (!record.foundDate || !trackedItemIds.has(record.itemId)) {
      continue;
    }
    const entry = trackEthereal ? `${record.itemId}:${Boolean(record.isEthereal)}` : record.itemId;
    const earliest = earliestByEntry.get(entry);
    if (!earliest?.foundDate || record.foundDate.getTime() < earliest.foundDate.getTime()) {
      earliestByEntry.set(entry, record);
    }
  }

  return new Map([...earliestByEntry.values()].map((record) => [record.id, record]));
}

/**
 * Counts the distinct new grail items found in the given runs. A run item counts if it is linked
 * to the record that first added its item to the grail, and that record was created during the
 * run. Repeat finds are linked to the existing record and items from the initial save file scan
 * were not found in a run, so neither counts.
 */
function countNewGrailItems(
  runs: Run[],
  runItems: ReadonlyMap<string, RunItem[]>,
  firstDiscoveries: ReadonlyMap<string, GrailProgress>,
): number {
  const newGrailProgressIds = new Set<string>();
  for (const run of runs) {
    for (const runItem of runItems.get(run.id) ?? []) {
      const discovery = runItem.grailProgressId
        ? firstDiscoveries.get(runItem.grailProgressId)
        : undefined;
      if (
        discovery?.foundDate &&
        !discovery.fromInitialScan &&
        discovery.foundDate.getTime() >= run.startTime.getTime()
      ) {
        newGrailProgressIds.add(discovery.id);
      }
    }
  }
  return newGrailProgressIds.size;
}

/**
 * Computes the statistics of a session from its loaded runs and run items. Pure, so callers can
 * memoize it on its inputs.
 * @param session - The session
 * @param runs - Runs of the session
 * @param runItems - Loaded run items by run ID
 * @param firstDiscoveries - Result of {@link findFirstDiscoveries}
 * @returns The session statistics
 */
export function computeSessionStats(
  session: Session,
  runs: Run[],
  runItems: ReadonlyMap<string, RunItem[]>,
  firstDiscoveries: ReadonlyMap<string, GrailProgress>,
): SessionStats {
  const durations = runs
    .map((run) => run.duration)
    .filter((duration): duration is number => duration !== undefined);
  const itemsFound = runs.reduce((total, run) => total + (runItems.get(run.id)?.length ?? 0), 0);

  return {
    sessionId: session.id,
    totalRuns: runs.length,
    totalTime: session.totalSessionTime,
    totalRunTime: session.totalRunTime,
    averageRunDuration:
      durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0,
    fastestRun: durations.length > 0 ? Math.min(...durations) : 0,
    slowestRun: durations.length > 0 ? Math.max(...durations) : 0,
    itemsFound,
    newGrailItems: countNewGrailItems(runs, runItems, firstDiscoveries),
  };
}
