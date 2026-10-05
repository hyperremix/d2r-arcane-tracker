import type { GrailStatistics } from 'electron/types/grail';
import { useTranslation } from 'react-i18next';
import { Progress } from '@/components/ui/progress';
import { translations } from '@/i18n/translations';
import { cn } from '@/lib/utils';

/**
 * Indicator colors for the progress bars, matching the colors used by the progress gauges.
 */
const indicatorColors = {
  purple: '[&_[data-slot=progress-indicator]]:bg-chart-4',
  orange: '[&_[data-slot=progress-indicator]]:bg-chart-5',
  blue: '[&_[data-slot=progress-indicator]]:bg-ethereal',
} as const;

/**
 * Props interface for a single progress summary entry.
 */
interface ProgressSummaryItemProps {
  label: string;
  current: number;
  total: number;
  color: keyof typeof indicatorColors;
  className?: string;
}

/**
 * ProgressSummaryItem renders a compact labeled progress bar with percentage and found/total counts.
 */
function ProgressSummaryItem({
  label,
  current,
  total,
  color,
  className,
}: ProgressSummaryItemProps) {
  const { t } = useTranslation();
  const percentage = total > 0 ? (current / total) * 100 : 0;
  const valueText = t(translations.grail.progressBar.progress, {
    current,
    total,
    percentage: percentage.toFixed(1),
  });

  return (
    <div className={cn('flex min-w-40 max-w-md flex-1 flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium text-muted-foreground text-xs">{label}</span>
        <span className="flex items-baseline gap-1.5 tabular-nums">
          <span className="font-semibold text-foreground text-sm">{percentage.toFixed(1)}%</span>
          <span className="text-muted-foreground text-xs">
            {current}/{total}
          </span>
        </span>
      </div>
      <Progress
        value={percentage}
        aria-label={label}
        getAriaValueText={() => valueText}
        className={indicatorColors[color]}
      />
    </div>
  );
}

/**
 * Props interface for the ProgressSummary component.
 */
interface ProgressSummaryProps {
  statistics: GrailStatistics;
  showEtherealBreakdown: boolean;
}

/**
 * ProgressSummary renders a compact horizontal strip with the total grail progress and,
 * when ethereal tracking is enabled, the normal and ethereal breakdown.
 */
export function ProgressSummary({ statistics, showEtherealBreakdown }: ProgressSummaryProps) {
  const { t } = useTranslation();

  return (
    <section
      aria-label={t(translations.grail.tracker.progressSummary)}
      className="flex flex-wrap gap-x-8 gap-y-3 rounded-lg border border-border bg-card px-4 py-3"
    >
      <ProgressSummaryItem
        label={t(translations.grail.tracker.totalProgress)}
        current={statistics.foundItems}
        total={statistics.totalItems}
        color="purple"
      />
      {showEtherealBreakdown && (
        <>
          <ProgressSummaryItem
            label={t(translations.grail.tracker.normalItems)}
            current={statistics.normalItems.found}
            total={statistics.normalItems.total}
            color="orange"
          />
          <ProgressSummaryItem
            label={t(translations.grail.tracker.etherealItems)}
            current={statistics.etherealItems.found}
            total={statistics.etherealItems.total}
            color="blue"
          />
        </>
      )}
    </section>
  );
}
