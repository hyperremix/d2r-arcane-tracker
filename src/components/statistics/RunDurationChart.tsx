import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CHART_HEIGHT,
  CHART_MARGIN,
  CHART_TEXT_CLASS,
  ChartCard,
  ChartDataTable,
  ChartEmptyState,
  ChartGrid,
  getPlotArea,
  InteractiveChart,
  linearScale,
  useChartWidth,
} from '@/components/statistics/ChartCard';
import {
  buildSessionDurations,
  durationTicks,
  RUN_DURATION_SESSIONS,
  type SessionDurationSummary,
  type SessionRuns,
} from '@/components/statistics/chartData';
import { Button } from '@/components/ui/button';
import { translations } from '@/i18n/translations';
import { formatClockDuration, formatLocalizedDate } from '@/lib/date';

/** Width of the bar that spans the middle half of a session's runs. */
const RANGE_BAR_WIDTH = 10;

/**
 * Loads the completed run durations of the most recent sessions that have a completed run. Like the
 * other run statistics, archived sessions are left out. A session's run count includes the run in
 * progress, so sessions are read newest first, in batches, until enough of them have a completed run.
 * @returns The duration summaries (oldest session first)
 */
async function loadSessionDurations(): Promise<SessionDurationSummary[]> {
  const sessions = await window.electronAPI.runTracker.getAllSessions(false);
  const candidates = sessions
    .filter((session) => session.runCount > 0)
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  const summaries: SessionDurationSummary[] = [];
  for (
    let start = 0;
    start < candidates.length && summaries.length < RUN_DURATION_SESSIONS;
    start += RUN_DURATION_SESSIONS
  ) {
    const batch: SessionRuns[] = await Promise.all(
      candidates.slice(start, start + RUN_DURATION_SESSIONS).map(async (session) => ({
        id: session.id,
        startTime: session.startTime,
        runs: await window.electronAPI.runTracker.getRunsBySession(session.id),
      })),
    );
    summaries.push(...buildSessionDurations(batch));
  }
  // Batches are newest first, so the sessions to drop are the oldest ones
  return summaries
    .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
    .slice(0, RUN_DURATION_SESSIONS)
    .reverse();
}

/**
 * Card with the run duration chart of the most recent sessions. Loads its own data, so a failure
 * only affects this chart.
 * @returns {JSX.Element} The chart card
 */
export function RunDurationCard() {
  const { t } = useTranslation();
  const chartT = translations.statistics.charts;
  const [summaries, setSummaries] = useState<SessionDurationSummary[] | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  // Number of the latest request; results of older requests and of an unmounted card are ignored
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    const request = ++latestRequest.current;
    setFailed(false);
    try {
      const loaded = await loadSessionDurations();
      if (request === latestRequest.current) setSummaries(loaded);
    } catch (error) {
      if (request !== latestRequest.current) return;
      console.error('[Analytics] Error loading run durations:', error);
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      latestRequest.current++;
    };
  }, [load]);

  const title = t(chartT.runDurationsTitle);
  const description = t(chartT.runDurationsDescription, { count: RUN_DURATION_SESSIONS });

  if (failed) {
    return (
      <ChartCard title={title} description={description}>
        <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center">
          <p className="text-muted-foreground text-sm">{t(chartT.runDurationsError)}</p>
          <Button onClick={() => void load()} variant="outline" size="sm">
            {t(translations.common.retry)}
          </Button>
        </div>
      </ChartCard>
    );
  }

  if (summaries === undefined) {
    return (
      <ChartCard title={title} description={description}>
        <ChartEmptyState>{t(translations.common.loading)}</ChartEmptyState>
      </ChartCard>
    );
  }

  if (summaries.length === 0) {
    return (
      <ChartCard title={title} description={description}>
        <ChartEmptyState>{t(chartT.runDurationsEmpty)}</ChartEmptyState>
      </ChartCard>
    );
  }

  return (
    <ChartCard title={title} description={description}>
      <RunDurationChart summaries={summaries} />
    </ChartCard>
  );
}

/**
 * Props for the RunDurationChart component.
 */
interface RunDurationChartProps {
  /** Duration summaries, oldest session first */
  summaries: SessionDurationSummary[];
}

/**
 * Chart of the run durations per session: a dot for the median run, connected across sessions to
 * show the trend, and a bar spanning the middle half of the runs to show how consistent they were.
 * @returns {JSX.Element} The chart with its legend
 */
export function RunDurationChart({ summaries }: RunDurationChartProps) {
  const { t, i18n } = useTranslation();
  const [chartRef, width] = useChartWidth();
  const chartT = translations.statistics.charts;
  const analyticsT = translations.statistics.runAnalytics;

  const formatSessionDate = (summary: SessionDurationSummary) =>
    formatLocalizedDate(summary.startTime, i18n.language, { dateStyle: 'medium' });
  const formatCount = (value: number) => value.toLocaleString(i18n.language);
  const formatRange = (summary: SessionDurationSummary) =>
    t(chartT.range, {
      from: formatClockDuration(summary.lowerQuartile),
      to: formatClockDuration(summary.upperQuartile),
    });

  const plot = getPlotArea(CHART_MARGIN, width);
  const ticks = durationTicks(Math.max(...summaries.map((summary) => summary.upperQuartile)));
  const toY = linearScale([0, ticks[ticks.length - 1]], [plot.bottom, plot.top]);
  const slotWidth = (plot.right - plot.left) / summaries.length;
  const slotCenter = (index: number) => plot.left + slotWidth * (index + 0.5);
  const anchors = summaries.map((summary, index) => ({
    x: slotCenter(index),
    y: toY(summary.upperQuartile),
  }));
  const medianPath = summaries
    .map(
      (summary, index) => `${index === 0 ? 'M' : 'L'}${slotCenter(index)},${toY(summary.median)}`,
    )
    .join('');

  const getTooltip = (index: number) => {
    const summary = summaries[index];
    return {
      heading: formatSessionDate(summary),
      rows: [
        { label: t(chartT.medianRun), value: formatClockDuration(summary.median) },
        { label: t(chartT.middleHalf), value: formatRange(summary) },
        { label: t(analyticsT.fastestRun), value: formatClockDuration(summary.fastest) },
        { label: t(analyticsT.slowestRun), value: formatClockDuration(summary.slowest) },
        { label: t(chartT.completedRuns), value: formatCount(summary.runCount) },
      ],
    };
  };

  const first = summaries[0];
  const latest = summaries[summaries.length - 1];
  const label = t(chartT.runDurationsSummary, {
    count: summaries.length,
    first: formatClockDuration(first.median),
    last: formatClockDuration(latest.median),
  });

  return (
    <div className="space-y-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs">
        <li className="flex items-center gap-1.5">
          <svg viewBox="0 0 16 8" className="h-2 w-4" aria-hidden="true">
            <line x1={0} x2={16} y1={4} y2={4} className="stroke-chart-1" strokeWidth={2} />
            <circle cx={8} cy={4} r={3} className="fill-chart-1" />
          </svg>
          {t(chartT.medianRun)}
        </li>
        <li className="flex items-center gap-1.5">
          <span
            className="h-3 w-2.5 rounded-sm border border-chart-1 bg-chart-1/20"
            aria-hidden="true"
          />
          {t(chartT.middleHalf)}
        </li>
      </ul>
      <InteractiveChart
        containerRef={chartRef}
        width={width}
        height={CHART_HEIGHT}
        label={label}
        points={anchors}
        getTooltip={getTooltip}
        table={
          <ChartDataTable
            caption={t(chartT.runDurationsTitle)}
            columns={[
              t(chartT.session),
              t(chartT.medianRun),
              t(chartT.middleHalf),
              t(analyticsT.fastestRun),
              t(analyticsT.slowestRun),
              t(chartT.completedRuns),
            ]}
            rows={summaries.map((summary) => ({
              key: summary.sessionId,
              cells: [
                formatSessionDate(summary),
                formatClockDuration(summary.median),
                formatRange(summary),
                formatClockDuration(summary.fastest),
                formatClockDuration(summary.slowest),
                formatCount(summary.runCount),
              ],
            }))}
          />
        }
      >
        {(activeIndex) => (
          <>
            <ChartGrid ticks={ticks} toY={toY} plot={plot} format={formatClockDuration} />
            {activeIndex !== undefined && (
              <line
                x1={slotCenter(activeIndex)}
                x2={slotCenter(activeIndex)}
                y1={plot.top}
                y2={plot.bottom}
                className="stroke-muted-foreground"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            )}
            {summaries.map((summary, index) => {
              const top = toY(summary.upperQuartile);
              const height = Math.max(toY(summary.lowerQuartile) - top, 2);
              return (
                <rect
                  key={summary.sessionId}
                  x={slotCenter(index) - RANGE_BAR_WIDTH / 2}
                  y={top}
                  width={RANGE_BAR_WIDTH}
                  height={height}
                  rx={Math.min(4, height / 2)}
                  className="fill-chart-1/20 stroke-chart-1"
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
            <path
              d={medianPath}
              fill="none"
              className="stroke-chart-1"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            {summaries.map((summary, index) => (
              <circle
                key={summary.sessionId}
                cx={slotCenter(index)}
                cy={toY(summary.median)}
                r={activeIndex === index ? 5 : 4}
                className="fill-chart-1 stroke-card"
                strokeWidth={2}
              />
            ))}
            <text
              x={slotCenter(0)}
              y={CHART_HEIGHT - 8}
              textAnchor="middle"
              className={CHART_TEXT_CLASS}
            >
              {formatSessionDate(first)}
            </text>
            {summaries.length > 1 && (
              <text
                x={slotCenter(summaries.length - 1)}
                y={CHART_HEIGHT - 8}
                textAnchor="middle"
                className={CHART_TEXT_CLASS}
              >
                {formatSessionDate(latest)}
              </text>
            )}
          </>
        )}
      </InteractiveChart>
    </div>
  );
}
