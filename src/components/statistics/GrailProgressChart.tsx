import { useTranslation } from 'react-i18next';
import {
  CHART_HEIGHT,
  CHART_MARGIN,
  CHART_TEXT_CLASS,
  ChartCard,
  ChartDataTable,
  ChartGrid,
  EmptyChartCard,
  getPlotArea,
  InteractiveChart,
  linearScale,
  useChartWidth,
} from '@/components/statistics/ChartCard';
import {
  type CumulativeFindsPoint,
  formatDayIndex,
  hasProgressFinds,
  niceTicks,
  type TrackingBaseline,
} from '@/components/statistics/chartData';
import { translations } from '@/i18n/translations';

/** Days shown before the first find when every find was made on the same day. */
const MIN_DAY_SPAN = 7;

/** The latest total is labelled to the right of the line, so the right margin is wider. */
const MARGIN: typeof CHART_MARGIN = { ...CHART_MARGIN, right: 44 };

/**
 * Props for the GrailProgressChart component.
 */
interface GrailProgressChartProps {
  /** Cumulative finds per day, in chronological order */
  points: CumulativeFindsPoint[];
  /** Day index of today; the line continues up to it */
  today: number;
  /** Number of tracked item versions */
  totalItems: number;
  /** Entries startup scans found on the first day of the chart; the chart starts from them */
  baseline?: TrackingBaseline;
}

/**
 * Step area chart of the number of grail entries found over time, ending today. Each step is a day
 * with new grail entries. With a baseline (the entries startup save file scans found on the first
 * day of the chart), the value axis starts near the baseline instead of zero, so the finds made
 * since stay visible, and a note says how many entries the first scan that found items found.
 * @returns {JSX.Element} The chart card
 */
export function GrailProgressChart({
  points,
  today,
  totalItems,
  baseline,
}: GrailProgressChartProps) {
  const { t, i18n } = useTranslation();
  const [chartRef, width] = useChartWidth();
  const chartT = translations.statistics.charts;
  const title = t(chartT.grailProgressTitle);
  const description = t(chartT.grailProgressDescription);

  if (!hasProgressFinds(points)) {
    return (
      <EmptyChartCard
        title={title}
        message={t(translations.statistics.dashboard.noItemsFoundYet)}
      />
    );
  }

  const formatDay = (day: number) => formatDayIndex(day, i18n.language, { dateStyle: 'medium' });
  const formatCount = (value: number) => value.toLocaleString(i18n.language);

  const plot = getPlotArea(MARGIN, width);
  const firstDay = points[0].day;
  const lastDay = Math.max(today, points[points.length - 1].day);
  const startDay = Math.min(firstDay, lastDay - MIN_DAY_SPAN);
  const latest = points[points.length - 1];
  const startTotal = baseline?.count ?? 0;
  const ticks = niceTicks(latest.total, { min: startTotal });
  const axisMin = ticks[0];
  const toX = linearScale([startDay, lastDay], [plot.left, plot.right]);
  const toY = linearScale([axisMin, ticks[ticks.length - 1]], [plot.bottom, plot.top]);

  // Step line: from the baseline (or zero), flat until the day of the next find, then up to the
  // new total
  const linePath = [
    `M${toX(firstDay)},${toY(startTotal)}`,
    ...points.map((point, index) =>
      index === 0 ? `V${toY(point.total)}` : `H${toX(point.day)}V${toY(point.total)}`,
    ),
    `H${toX(lastDay)}`,
  ].join('');
  const areaPath = `${linePath}V${toY(axisMin)}H${toX(firstDay)}Z`;

  const anchors = points.map((point) => ({ x: toX(point.day), y: toY(point.total) }));

  const getTooltip = (index: number) => {
    const point = points[index];
    const previousTotal = index > 0 ? points[index - 1].total : 0;
    return {
      heading: formatDay(point.day),
      rows: [
        { label: t(translations.common.found), value: formatCount(point.total) },
        { label: t(chartT.newOnDay), value: formatCount(point.total - previousTotal) },
      ],
    };
  };

  const summaryValues = {
    found: formatCount(latest.total),
    total: formatCount(totalItems),
    date: formatDay(firstDay),
  };
  const label = baseline
    ? t(chartT.grailProgressSummaryWithBaseline, {
        ...summaryValues,
        baseline: formatCount(baseline.count),
      })
    : t(chartT.grailProgressSummary, summaryValues);

  return (
    <ChartCard title={title} description={description}>
      <InteractiveChart
        containerRef={chartRef}
        width={width}
        height={CHART_HEIGHT}
        label={label}
        points={anchors}
        getTooltip={getTooltip}
        table={
          <ChartDataTable
            caption={title}
            columns={[t(chartT.date), t(translations.common.found), t(chartT.newOnDay)]}
            rows={points.map((point, index) => ({
              key: String(point.day),
              cells: [
                formatDay(point.day),
                formatCount(point.total),
                formatCount(point.total - (index > 0 ? points[index - 1].total : 0)),
              ],
            }))}
          />
        }
      >
        {(activeIndex) => (
          <>
            <ChartGrid ticks={ticks} toY={toY} plot={plot} format={formatCount} />
            <path d={areaPath} className="fill-chart-1/10" />
            {baseline && (
              // biome-ignore lint/a11y/noAriaHiddenOnFocusable: an SVG line is never focusable; it only decorates the chart
              <line
                aria-hidden="true"
                x1={toX(firstDay)}
                x2={toX(lastDay)}
                y1={toY(baseline.count)}
                y2={toY(baseline.count)}
                className="stroke-muted-foreground"
                strokeWidth={1}
                strokeDasharray="4 4"
                vectorEffect="non-scaling-stroke"
                data-testid="grail-progress-baseline"
              />
            )}
            <path
              d={linePath}
              fill="none"
              className="stroke-chart-1"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={toX(lastDay)}
              cy={toY(latest.total)}
              r={4}
              className="fill-chart-1 stroke-card"
              strokeWidth={2}
            />
            <text
              x={toX(lastDay) + 8}
              y={toY(latest.total)}
              dy="0.32em"
              className="fill-foreground font-medium text-[11px] tabular-nums"
            >
              {formatCount(latest.total)}
            </text>
            <text x={plot.left} y={CHART_HEIGHT - 8} className={CHART_TEXT_CLASS}>
              {formatDay(startDay)}
            </text>
            <text x={plot.right} y={CHART_HEIGHT - 8} textAnchor="end" className={CHART_TEXT_CLASS}>
              {formatDay(lastDay)}
            </text>
            {activeIndex !== undefined && (
              <g>
                <line
                  x1={anchors[activeIndex].x}
                  x2={anchors[activeIndex].x}
                  y1={plot.top}
                  y2={plot.bottom}
                  className="stroke-muted-foreground"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
                <circle
                  cx={anchors[activeIndex].x}
                  cy={anchors[activeIndex].y}
                  r={4}
                  className="fill-chart-1 stroke-card"
                  strokeWidth={2}
                />
              </g>
            )}
          </>
        )}
      </InteractiveChart>
      {baseline && (
        <p className="mt-2 text-muted-foreground text-xs">
          {t(chartT.grailProgressBaseline, {
            count: baseline.count,
            found: formatCount(baseline.count),
            date: formatDay(baseline.day),
          })}
        </p>
      )}
    </ChartCard>
  );
}
