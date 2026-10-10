import { useTranslation } from 'react-i18next';
import { translations } from '@/i18n/translations';
import { formatClockDuration } from '@/lib/date';
import { cn } from '@/lib/utils';

interface LiveRunTimerProps {
  /** Elapsed time of the in-progress run in milliseconds, or undefined when no run is active. */
  elapsedMs: number | undefined;
  /** Number of the in-progress run, if any. */
  runNumber?: number;
  /** Whether the in-progress run is paused; the elapsed time is then frozen. */
  paused?: boolean;
}

/**
 * Large, glanceable current-run timer with tabular numerals so digits do not shift while ticking.
 * A paused run's timer is shown in the paused state color. The timer is intentionally not a live
 * region; state changes are announced by the session state badge.
 */
export function LiveRunTimer({ elapsedMs, runNumber, paused = false }: LiveRunTimerProps) {
  const { t } = useTranslation();
  const hasRun = elapsedMs !== undefined;

  return (
    <div className="flex flex-col gap-1">
      <p className="font-medium text-muted-foreground text-sm">
        {t(translations.runTracker.sessionCard.currentRun)}
        {hasRun && runNumber !== undefined && (
          <span className="ml-2 font-normal">
            {t(translations.runTracker.sessionCard.runNumber, { number: runNumber })}
          </span>
        )}
      </p>
      <p
        className={cn(
          'font-mono font-semibold text-5xl tabular-nums leading-none tracking-tight',
          !hasRun && 'text-muted-foreground',
          hasRun && paused && 'text-warning',
        )}
      >
        {formatClockDuration(elapsedMs ?? 0)}
      </p>
      {!hasRun && (
        <p className="text-muted-foreground text-xs">
          {t(translations.runTracker.controls.noRunInProgress)}
        </p>
      )}
    </div>
  );
}
