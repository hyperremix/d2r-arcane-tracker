import { useTranslation } from 'react-i18next';
import { translations } from '@/i18n/translations';
import { formatLocalizedDate } from '@/lib/date';
import {
  CHART_HEIGHT,
  CHART_TEXT_CLASS,
  ChartCard,
  ChartDataTable,
  ChartEmptyState,
  ChartGrid,
  getPlotArea,
  InteractiveChart,
  linearScale,
  useChartWidth,
} from './ChartCard';
import { type CumulativeFindsPoint, dayIndexToUtcDate, niceTicks } from './chartData';

/** Days shown before the first find when every find was made on the same day. */
const MIN_DAY_SPAN = 7;

const MARGIN = { top: 16, right: 44, bottom: 28, left: 44 };

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
}

/**
 * Step area chart of the number of grail entries found over time, ending today. Each step is a day
 * with new grail entries.
 * @returns {JSX.Element} The chart card
 */
export function GrailProgressChart({ points, today, totalItems }: GrailProgressChartProps) {
  const { t, i18n } = useTranslation();
  const [chartRef, width] = useChartWidth();
  const chartT = translations.statistics.charts;
  const title = t(chartT.grailProgressTitle);
  const description = t(chartT.grailProgressDescription);

  if (points.length === 0) {
    return (
      <ChartCard title={title} description={description}>
        <ChartEmptyState>{t(translations.statistics.dashboard.noItemsFoundYet)}</ChartEmptyState>
      </ChartCard>
    );
  }

  const formatDay = (day: number) =>
    formatLocalizedDate(dayIndexToUtcDate(day), i18n.language, {
      dateStyle: 'medium',
      timeZone: 'UTC',
    });

  const plot = getPlotArea(MARGIN, width);
  const firstDay = points[0].day;
  const lastDay = Math.max(today, points[points.length - 1].day);
  const startDay = Math.min(firstDay, lastDay - MIN_DAY_SPAN);
  const latest = points[points.length - 1];
  const ticks = niceTicks(latest.total);
  const toX = linearScale([startDay, lastDay], [plot.left, plot.right]);
  const toY = linearScale([0, ticks[ticks.length - 1]], [plot.bottom, plot.top]);

  // Step line: flat until the day of the next find, then up to the new total
  const linePath = [
    `M${toX(firstDay)},${toY(0)}`,
    ...points.map((point, index) =>
      index === 0 ? `V${toY(point.total)}` : `H${toX(point.day)}V${toY(point.total)}`,
    ),
    `H${toX(lastDay)}`,
  ].join('');
  const areaPath = `${linePath}V${toY(0)}Z`;

  const anchors = points.map((point) => ({ x: toX(point.day), y: toY(point.total) }));

  const getTooltip = (index: number) => {
    const point = points[index];
    const previousTotal = index > 0 ? points[index - 1].total : 0;
    return {
      heading: formatDay(point.day),
      rows: [
        { label: t(translations.common.found), value: point.total.toLocaleString(i18n.language) },
        {
          label: t(chartT.newOnDay),
          value: (point.total - previousTotal).toLocaleString(i18n.language),
        },
      ],
    };
  };

  const label = t(chartT.grailProgressSummary, {
    count: latest.total,
    total: totalItems,
    date: formatDay(firstDay),
  });

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
                String(point.total),
                String(point.total - (index > 0 ? points[index - 1].total : 0)),
              ],
            }))}
          />
        }
      >
        {(activeIndex) => (
          <>
            <ChartGrid
              ticks={ticks}
              toY={toY}
              plot={plot}
              format={(value) => value.toLocaleString(i18n.language)}
            />
            <path d={areaPath} className="fill-chart-1/10" />
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
              {latest.total.toLocaleString(i18n.language)}
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
    </ChartCard>
  );
}
