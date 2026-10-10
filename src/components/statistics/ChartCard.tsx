import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { translations } from '@/i18n/translations';
import { cn } from '@/lib/utils';

/**
 * Props for the ChartCard component.
 */
interface ChartCardProps {
  /** Section heading, rendered as an `h2` */
  title: string;
  /** What the chart shows and how to read it */
  description: string;
  children: ReactNode;
  className?: string;
}

/**
 * Card that frames a chart with a section heading and a description.
 * @returns {JSX.Element} The chart card
 */
export function ChartCard({ title, description, children, className }: ChartCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>
          <h2>{title}</h2>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/**
 * Props for the ChartEmptyState component.
 */
interface ChartEmptyStateProps {
  children: ReactNode;
}

/**
 * Message shown in place of a chart that has no data yet.
 * @returns {JSX.Element} The empty state
 */
export function ChartEmptyState({ children }: ChartEmptyStateProps) {
  return (
    <p className="flex min-h-40 items-center justify-center px-4 text-center text-muted-foreground text-sm">
      {children}
    </p>
  );
}

/** One line of a chart tooltip: the value leads, the label follows. */
interface ChartTooltipRow {
  label: string;
  value: string;
}

/** Content of a chart tooltip. */
interface ChartTooltipContent {
  heading: string;
  rows: ChartTooltipRow[];
}

/** Position of a data point in chart coordinates. */
interface ChartPoint {
  x: number;
  y: number;
}

/**
 * Props for the InteractiveChart component.
 */
interface InteractiveChartProps {
  /** Callback ref of the chart container, from {@link useChartWidth} */
  containerRef: RefCallback<HTMLDivElement>;
  /** Width of the chart coordinate system, from {@link useChartWidth} */
  width: number;
  /** Height of the chart coordinate system */
  height: number;
  /** Accessible summary of the chart */
  label: string;
  /** Anchor of every data position; the tooltip of the closest one (along x) is shown */
  points: ChartPoint[];
  /** Tooltip content of a data position */
  getTooltip: (index: number) => ChartTooltipContent;
  /** Marks of the chart; receives the highlighted data position, if any */
  children: (activeIndex: number | undefined) => ReactNode;
  /** Visually hidden table with every value of the chart */
  table: ReactNode;
}

/**
 * Index of the point closest to an x coordinate.
 */
function findClosestIndex(points: ChartPoint[], x: number): number {
  let closest = 0;
  for (let index = 1; index < points.length; index++) {
    if (Math.abs(points[index].x - x) < Math.abs(points[closest].x - x)) {
      closest = index;
    }
  }
  return closest;
}

/**
 * Responsive SVG chart with a hover and keyboard tooltip. Pointing at the chart highlights the
 * closest data position; when the chart has focus, the arrow keys (and Home/End) move between data
 * positions. Every value is also available in a visually hidden table, so the tooltip never is the
 * only way to read a value. The chart has no animations.
 * @returns {JSX.Element} The chart
 */
export function InteractiveChart({
  containerRef,
  width,
  height,
  label,
  points,
  getTooltip,
  children,
  table,
}: InteractiveChartProps) {
  const { t } = useTranslation();
  const hintId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  // Position chosen with the keyboard (it survives the pointer leaving) and the one under the pointer
  const [keyboardIndex, setKeyboardIndex] = useState<number | undefined>(undefined);
  const [pointerIndex, setPointerIndex] = useState<number | undefined>(undefined);
  // Text of the latest keyboard change; pointer hover never writes to the live region
  const [announcement, setAnnouncement] = useState('');
  const lastIndex = points.length - 1;
  const requestedIndex = pointerIndex ?? keyboardIndex;
  // The data may shrink while a position is active (e.g. a setting is toggled), so keep it in range
  const activeIndex =
    requestedIndex === undefined || lastIndex < 0 ? undefined : Math.min(requestedIndex, lastIndex);

  // Write the clamped positions back, so growing data later does not jump back to a stale position
  useEffect(() => {
    const clamp = (index: number | undefined) =>
      index === undefined || index <= lastIndex ? index : lastIndex < 0 ? undefined : lastIndex;
    setKeyboardIndex(clamp);
    setPointerIndex(clamp);
  }, [lastIndex]);

  const formatAnnouncement = (tooltip: ChartTooltipContent) =>
    `${tooltip.heading}: ${tooltip.rows.map((row) => `${row.value} ${row.label}`).join(', ')}`;

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || points.length === 0) return;
    const x = ((event.clientX - rect.left) / rect.width) * width;
    setAnnouncement('');
    setPointerIndex(findClosestIndex(points, x));
  };

  const handleKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (points.length === 0) return;
    const current = activeIndex ?? lastIndex;
    const next: Record<string, number | undefined> = {
      ArrowLeft: Math.max(0, current - 1),
      ArrowRight: Math.min(lastIndex, current + 1),
      Home: 0,
      End: lastIndex,
    };
    if (event.key === 'Escape') {
      setKeyboardIndex(undefined);
      setPointerIndex(undefined);
      setAnnouncement('');
      return;
    }
    if (event.key in next) {
      const target = next[event.key] as number;
      event.preventDefault();
      setPointerIndex(undefined);
      setKeyboardIndex(target);
      setAnnouncement(formatAnnouncement(getTooltip(target)));
    }
  };

  const active = activeIndex === undefined ? undefined : points[activeIndex];
  const tooltip = activeIndex === undefined ? undefined : getTooltip(activeIndex);
  const leftPercent = active ? (active.x / width) * 100 : 0;

  return (
    <div ref={containerRef} className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label}
        aria-describedby={hintId}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the chart is focusable so keyboard users can move its tooltip with the arrow keys
        tabIndex={0}
        className="block h-auto w-full overflow-visible rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setPointerIndex(undefined)}
        onFocus={() =>
          setKeyboardIndex((index) => index ?? (lastIndex < 0 ? undefined : lastIndex))
        }
        onBlur={() => {
          setKeyboardIndex(undefined);
          setAnnouncement('');
        }}
        onKeyDown={handleKeyDown}
      >
        {children(activeIndex)}
      </svg>
      <p id={hintId} className="sr-only">
        {t(translations.statistics.charts.keyboardHint)}
      </p>
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="chart-announcement"
      >
        {announcement}
      </div>
      <div aria-hidden="true">
        {active && tooltip && (
          <div
            data-testid="chart-tooltip"
            className={cn(
              'pointer-events-none absolute z-10 w-max max-w-xs -translate-y-full rounded-md bg-popover px-3 py-2 text-popover-foreground text-xs shadow-md ring-1 ring-foreground/10',
              leftPercent < 25 && 'translate-x-0',
              leftPercent >= 25 && leftPercent <= 75 && '-translate-x-1/2',
              leftPercent > 75 && '-translate-x-full',
            )}
            style={{
              left: `${leftPercent}%`,
              top: `calc(${(active.y / height) * 100}% - 0.5rem)`,
            }}
          >
            <p className="mb-1 text-muted-foreground">{tooltip.heading}</p>
            <dl className="space-y-0.5">
              {tooltip.rows.map((row) => (
                <div
                  key={row.label}
                  className="flex flex-row-reverse items-baseline justify-end gap-2"
                >
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="font-semibold tabular-nums">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
      {table}
    </div>
  );
}

/**
 * A row of the ChartDataTable component.
 */
interface ChartDataTableRow {
  key: string;
  cells: string[];
}

/**
 * Props for the ChartDataTable component.
 */
interface ChartDataTableProps {
  caption: string;
  columns: string[];
  rows: ChartDataTableRow[];
}

/**
 * Visually hidden table with the values of a chart, for assistive technology.
 * @returns {JSX.Element} The table
 */
export function ChartDataTable({ caption, columns, rows }: ChartDataTableProps) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            {row.cells.map((cell, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: cells have a fixed column order
              <td key={index}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Height of the charts, in pixels. */
export const CHART_HEIGHT = 220;

/** Width of a chart until its container was measured (and in environments without layout). */
const DEFAULT_CHART_WIDTH = 560;

/** Narrowest coordinate system; narrower containers scale the chart down instead. */
const MIN_CHART_WIDTH = 320;

/**
 * Measures the width of a chart container, so the chart is drawn at its real size and its text
 * keeps its size as the card is resized, as long as the chart is at least
 * {@link MIN_CHART_WIDTH} pixels wide (below that, the chart is scaled down).
 * @returns The callback ref for the container and its width in pixels
 */
export function useChartWidth(): [RefCallback<HTMLDivElement>, number] {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(DEFAULT_CHART_WIDTH);

  useEffect(() => {
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const measured = Math.round(entry.contentRect.width);
      if (measured > 0) setWidth(Math.max(MIN_CHART_WIDTH, measured));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return [setElement, width];
}

/** Margins around the plot area of a chart, in chart coordinates. */
interface ChartMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Plot area of a chart, in chart coordinates. */
interface PlotArea {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Margins of charts with their value labels on the left only. */
export const CHART_MARGIN: ChartMargin = { top: 16, right: 16, bottom: 28, left: 44 };

/**
 * Returns the plot area inside the chart margins.
 * @param margin - Margins around the plot area
 * @param width - Width of the chart
 * @returns The plot area
 */
export function getPlotArea(margin: ChartMargin, width: number): PlotArea {
  return {
    left: margin.left,
    right: width - margin.right,
    top: margin.top,
    bottom: CHART_HEIGHT - margin.bottom,
  };
}

/** Class of axis and label text inside a chart. */
export const CHART_TEXT_CLASS = 'fill-muted-foreground text-[11px] tabular-nums';

/**
 * Props for the ChartGrid component.
 */
interface ChartGridProps {
  ticks: number[];
  toY: (value: number) => number;
  plot: PlotArea;
  format: (value: number) => string;
}

/**
 * Horizontal hairline gridlines with their value labels on the left of the plot area.
 * @returns {JSX.Element} The grid
 */
export function ChartGrid({ ticks, toY, plot, format }: ChartGridProps) {
  return (
    <g>
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={plot.left}
            x2={plot.right}
            y1={toY(tick)}
            y2={toY(tick)}
            className="stroke-border"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={plot.left - 8}
            y={toY(tick)}
            dy="0.32em"
            textAnchor="end"
            className={CHART_TEXT_CLASS}
          >
            {format(tick)}
          </text>
        </g>
      ))}
    </g>
  );
}

/**
 * Returns a linear scale that maps a domain onto a range.
 * @param domain - Input interval
 * @param range - Output interval
 * @returns The scale function
 */
export function linearScale(
  [domainStart, domainEnd]: [number, number],
  [rangeStart, rangeEnd]: [number, number],
): (value: number) => number {
  const span = domainEnd - domainStart;
  return (value) =>
    span === 0
      ? (rangeStart + rangeEnd) / 2
      : rangeStart + ((value - domainStart) / span) * (rangeEnd - rangeStart);
}
