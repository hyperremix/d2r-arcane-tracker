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
import { formatDayIndex, niceTicks, type WeeklyFinds } from '@/components/statistics/chartData';
import { translations } from '@/i18n/translations';

/** Widest a bar may be; the rest of its slot stays empty. */
const MAX_BAR_WIDTH = 24;

/** Radius of the rounded top of a bar. */
const BAR_RADIUS = 4;

/**
 * Returns the path of a bar with a rounded top and a square base.
 */
function barPath(x: number, width: number, top: number, bottom: number): string {
  const radius = Math.min(BAR_RADIUS, width / 2, bottom - top);
  return [
    `M${x},${bottom}`,
    `V${top + radius}`,
    `Q${x},${top} ${x + radius},${top}`,
    `H${x + width - radius}`,
    `Q${x + width},${top} ${x + width},${top + radius}`,
    `V${bottom}`,
    'Z',
  ].join('');
}

/**
 * Props for the WeeklyFindsChart component.
 */
interface WeeklyFindsChartProps {
  /** Finds per week, in chronological order; the last week ends today */
  weeks: WeeklyFinds[];
}

/**
 * Column chart of the number of finds in each of the most recent weeks.
 * @returns {JSX.Element} The chart card
 */
export function WeeklyFindsChart({ weeks }: WeeklyFindsChartProps) {
  const { t, i18n } = useTranslation();
  const [chartRef, width] = useChartWidth();
  const chartT = translations.statistics.charts;
  const title = t(chartT.weeklyFindsTitle);
  const description = t(chartT.weeklyFindsDescription, { count: weeks.length });
  const totalFinds = weeks.reduce((sum, week) => sum + week.count, 0);

  if (totalFinds === 0) {
    return (
      <ChartCard title={title} description={description}>
        <ChartEmptyState>{t(chartT.weeklyFindsEmpty, { count: weeks.length })}</ChartEmptyState>
      </ChartCard>
    );
  }

  const formatDay = (day: number, options: Intl.DateTimeFormatOptions) =>
    formatDayIndex(day, i18n.language, options);
  const formatWeek = (week: WeeklyFinds) =>
    t(chartT.range, {
      from: formatDay(week.startDay, { dateStyle: 'medium' }),
      to: formatDay(week.endDay, { dateStyle: 'medium' }),
    });
  const formatCount = (value: number) => value.toLocaleString(i18n.language);

  const plot = getPlotArea(CHART_MARGIN, width);
  const ticks = niceTicks(Math.max(...weeks.map((week) => week.count)));
  const toY = linearScale([0, ticks[ticks.length - 1]], [plot.bottom, plot.top]);
  const slotWidth = (plot.right - plot.left) / weeks.length;
  const barWidth = Math.min(MAX_BAR_WIDTH, slotWidth - 2);
  const slotCenter = (index: number) => plot.left + slotWidth * (index + 0.5);
  const latestIndex = weeks.length - 1;
  const latest = weeks[latestIndex];

  const anchors = weeks.map((week, index) => ({ x: slotCenter(index), y: toY(week.count) }));
  const getTooltip = (index: number) => ({
    heading: formatWeek(weeks[index]),
    rows: [{ label: t(chartT.finds), value: formatCount(weeks[index].count) }],
  });

  const label = t(chartT.weeklyFindsSummary, {
    weeks: weeks.length,
    count: totalFinds,
    latest: latest.count,
  });
  const shortDate: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };

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
            columns={[t(chartT.week), t(chartT.finds)]}
            rows={weeks.map((week) => ({
              key: String(week.startDay),
              cells: [formatWeek(week), formatCount(week.count)],
            }))}
          />
        }
      >
        {(activeIndex) => (
          <>
            <ChartGrid ticks={ticks} toY={toY} plot={plot} format={formatCount} />
            {weeks.map((week, index) =>
              week.count > 0 ? (
                <path
                  key={week.startDay}
                  d={barPath(
                    slotCenter(index) - barWidth / 2,
                    barWidth,
                    toY(week.count),
                    plot.bottom,
                  )}
                  className="fill-chart-1"
                  opacity={activeIndex === index ? 0.75 : 1}
                />
              ) : null,
            )}
            <text
              x={slotCenter(latestIndex)}
              y={toY(latest.count) - 6}
              textAnchor="middle"
              className="fill-foreground font-medium text-[11px] tabular-nums"
            >
              {formatCount(latest.count)}
            </text>
            <text
              x={slotCenter(0)}
              y={CHART_HEIGHT - 8}
              textAnchor="middle"
              className={CHART_TEXT_CLASS}
            >
              {formatDay(weeks[0].startDay, shortDate)}
            </text>
            <text
              x={slotCenter(latestIndex)}
              y={CHART_HEIGHT - 8}
              textAnchor="middle"
              className={CHART_TEXT_CLASS}
            >
              {formatDay(latest.startDay, shortDate)}
            </text>
          </>
        )}
      </InteractiveChart>
    </ChartCard>
  );
}
