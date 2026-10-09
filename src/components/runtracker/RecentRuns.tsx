import type { Run } from 'electron/types/grail';
import { ChevronRight } from 'lucide-react';
import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@/components/ui/button';
import { translations } from '@/i18n/translations';
import { formatDuration } from '@/lib/date';
import { createRunItemLookup, resolveRunItemName } from '@/lib/runItems';
import { useGrailStore } from '@/stores/grailStore';
import { useRunTrackerStore } from '@/stores/runTrackerStore';
import { getRecentRuns, RECENT_RUNS_LIMIT } from './liveSession';

interface RecentRunsProps {
  runs: Run[];
  onViewAllRuns?: () => void;
  limit?: number;
}

/**
 * Compact list of the active session's most recent finished runs (newest first),
 * showing each run's duration and the items found, with an action to view all runs.
 */
export function RecentRuns({ runs, onViewAllRuns, limit = RECENT_RUNS_LIMIT }: RecentRunsProps) {
  const { t } = useTranslation();
  const headingId = useId();
  const runItems = useRunTrackerStore((state) => state.runItems);
  const { items, progress } = useGrailStore(
    useShallow((state) => ({ items: state.items, progress: state.progress })),
  );

  const recentRuns = useMemo(() => getRecentRuns(runs, limit), [runs, limit]);
  const lookup = useMemo(() => createRunItemLookup(items, progress), [items, progress]);

  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 id={headingId} className="font-medium text-muted-foreground text-sm">
          {t(translations.runTracker.sessionCard.recentRuns)}
        </h3>
        {onViewAllRuns && (
          <Button variant="ghost" size="sm" onClick={onViewAllRuns} className="gap-1">
            {t(translations.runTracker.sessionCard.viewAllRuns)}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>

      {recentRuns.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {t(translations.runTracker.sessionCard.noFinishedRuns)}
        </p>
      ) : (
        <ol className="divide-y rounded-md border">
          {recentRuns.map((run) => {
            const foundItems = runItems.get(run.id) ?? [];
            const itemNames = foundItems
              .map(
                (runItem) =>
                  resolveRunItemName(runItem, lookup) ??
                  t(translations.runTracker.runList.unknownItem),
              )
              .join(', ');
            return (
              <li key={run.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2">
                <span className="font-medium text-sm">
                  {t(translations.runTracker.sessionCard.runNumber, { number: run.runNumber })}
                </span>
                <span className="font-mono text-sm tabular-nums">
                  {formatDuration(run.duration)}
                </span>
                <span className="text-muted-foreground text-sm">
                  {foundItems.length > 0
                    ? t(translations.runTracker.sessionCard.runItems, {
                        count: foundItems.length,
                      })
                    : t(translations.runTracker.sessionCard.noItems)}
                </span>
                {itemNames && (
                  <span
                    className="min-w-0 basis-full truncate text-sm sm:flex-1 sm:basis-auto"
                    title={itemNames}
                  >
                    {itemNames}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
