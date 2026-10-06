import type { GrailStatistics } from 'electron/types/grail';
import { useTranslation } from 'react-i18next';
import { Progress } from '@/components/ui/progress';
import { translations } from '@/i18n/translations';
import { cn } from '@/lib/utils';

/**
 * Indicator color for each progress lane.
 */
const laneStyles = {
  normal: '[&_[data-slot=progress-indicator]]:bg-primary',
  ethereal: '[&_[data-slot=progress-indicator]]:bg-ethereal',
} as const;

const barStyles = '[&_[data-slot=progress-track]]:h-2';

/**
 * A single segment of the progress bar.
 * Lanes share one row and are sized proportionally to their item totals.
 */
interface ProgressLane {
  key: keyof typeof laneStyles;
  label: string;
  found: number;
  total: number;
}

function toPercentage(found: number, total: number): number {
  return total > 0 ? (found / total) * 100 : 0;
}

/**
 * Props interface for the ProgressSummary component.
 */
interface ProgressSummaryProps {
  statistics: GrailStatistics;
  showEtherealBreakdown: boolean;
}

/**
 * ProgressSummary renders a slim grail progress line: the completion percentage, a bar and the
 * found count. When ethereal tracking is enabled, the bar is split into a normal and an ethereal
 * lane, each as wide as its share of the grail and filled to its own completion.
 */
export function ProgressSummary({ statistics, showEtherealBreakdown }: ProgressSummaryProps) {
  const { t } = useTranslation();
  const percentage = toPercentage(statistics.foundItems, statistics.totalItems);

  const lanes: ProgressLane[] =
    showEtherealBreakdown && statistics.normalItems.total > 0 && statistics.etherealItems.total > 0
      ? [
          {
            key: 'normal',
            label: t(translations.grail.tracker.normalItems),
            found: statistics.normalItems.found,
            total: statistics.normalItems.total,
          },
          {
            key: 'ethereal',
            label: t(translations.grail.tracker.etherealItems),
            found: statistics.etherealItems.found,
            total: statistics.etherealItems.total,
          },
        ]
      : [];

  const getValueText = (found: number, total: number) =>
    t(translations.grail.progressBar.progress, {
      current: found,
      total,
      percentage: toPercentage(found, total).toFixed(1),
    });

  return (
    <section
      aria-label={t(translations.grail.tracker.progressSummary)}
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1"
    >
      <span className="min-w-[6ch] text-right font-semibold text-foreground text-sm tabular-nums">
        {percentage.toFixed(1)}%
      </span>

      {lanes.length > 0 ? (
        <div className="flex gap-1">
          {lanes.map((lane) => (
            <Progress
              key={lane.key}
              value={toPercentage(lane.found, lane.total)}
              aria-label={lane.label}
              getAriaValueText={() => getValueText(lane.found, lane.total)}
              className={cn('min-w-0 basis-0', barStyles, laneStyles[lane.key])}
              style={{ flexGrow: lane.total }}
            />
          ))}
        </div>
      ) : (
        <Progress
          value={percentage}
          aria-label={t(translations.grail.tracker.totalProgress)}
          getAriaValueText={() => getValueText(statistics.foundItems, statistics.totalItems)}
          className={cn(barStyles, laneStyles.normal)}
        />
      )}

      <span className="whitespace-nowrap text-muted-foreground text-xs tabular-nums">
        {t(translations.grail.tracker.foundOfTotal, {
          found: statistics.foundItems,
          total: statistics.totalItems,
        })}
      </span>

      {/* Lane captions sit directly under their lane, so no separate color legend is needed */}
      {lanes.length > 0 && (
        <div className="col-start-2 flex gap-1 text-muted-foreground text-xs">
          {lanes.map((lane) => (
            <span
              key={lane.key}
              className="min-w-0 basis-0 truncate"
              style={{ flexGrow: lane.total }}
            >
              {lane.label}{' '}
              <span className="text-foreground tabular-nums">
                {lane.found}/{lane.total}
              </span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
