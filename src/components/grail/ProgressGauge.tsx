import { useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * Props interface for the ProgressGauge component.
 */
interface ProgressGaugeProps {
  label: string;
  current: number;
  total: number;
  className?: string;
  showLabel?: boolean;
  color?: 'blue' | 'green' | 'purple' | 'orange';
  /** Use 'overlay' on an always-dark surface (e.g. the widget) so text stays legible in any theme */
  tone?: GaugeTone;
  /** Rendered size of the gauge and its text; the gauge takes up real layout space at every size */
  size?: GaugeSize;
}

/**
 * Size of the gauge. 'sm' is the compact default; larger sizes scale the ring and text together.
 */
type GaugeSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Ring and text classes per gauge size.
 */
interface SizeClasses {
  ring: string;
  percentage: string;
  ratio: string;
  label: string;
}

const sizeConfig: Record<GaugeSize, SizeClasses> = {
  sm: { ring: 'size-22', percentage: 'text-lg', ratio: 'text-xs', label: 'text-xs' },
  md: { ring: 'size-26', percentage: 'text-xl', ratio: 'text-xs', label: 'text-xs' },
  lg: { ring: 'size-31', percentage: 'text-2xl', ratio: 'text-sm', label: 'text-sm' },
  xl: { ring: 'size-40', percentage: 'text-3xl', ratio: 'text-base', label: 'text-sm' },
};

/**
 * Text tone of the gauge. 'overlay' is for always-dark surfaces and ignores the app theme.
 */
type GaugeTone = 'default' | 'overlay';

/**
 * Text and track classes per tone. Only the default tone follows the app theme.
 */
interface ToneClasses {
  secondaryText: string;
  track: string;
  percentage?: string;
}

const toneConfig: Record<GaugeTone, ToneClasses> = {
  default: {
    secondaryText: 'text-muted-foreground',
    track: 'text-muted-foreground/30',
  },
  overlay: {
    secondaryText: 'text-white/85',
    track: 'text-white/25',
    percentage: 'text-white',
  },
};

/**
 * Color configuration for the progress gauge
 */
const colorConfig = {
  blue: {
    stroke: 'text-ethereal group-hover:text-ethereal/80',
    text: 'text-ethereal',
  },
  green: {
    stroke: 'text-chart-3 group-hover:text-chart-3/80',
    text: 'text-item-set',
  },
  purple: {
    stroke: 'text-chart-4 group-hover:text-chart-4/80',
    text: 'text-item-runeword',
  },
  orange: {
    stroke: 'text-chart-5 group-hover:text-chart-5/80',
    text: 'text-item-rune',
  },
};

/**
 * Fill animation for the progress stroke, applied only when the user allows motion.
 */
const fillAnimationClasses =
  'motion-safe:transition-[stroke-dasharray] motion-safe:duration-1500 motion-safe:ease-in-out motion-safe:starting:[stroke-dasharray:0_100]';

/**
 * ProgressGauge component that displays a circular progress indicator with centered statistics.
 * Inspired by the skill-gauge component pattern with animated SVG circle.
 * @param {ProgressGaugeProps} props - Component props
 * @param {string} props.label - The label text for the gauge (shown in tooltip and optionally below)
 * @param {number} props.current - The current progress value
 * @param {number} props.total - The total/maximum progress value
 * @param {string} [props.className] - Optional additional CSS classes
 * @param {boolean} [props.showLabel=false] - Whether to show the label below the gauge
 * @param {'blue' | 'green' | 'purple' | 'orange'} [props.color='blue'] - Color variant of the gauge
 * @param {'default' | 'overlay'} [props.tone='default'] - Text tone; 'overlay' is for always-dark surfaces
 * @param {'sm' | 'md' | 'lg' | 'xl'} [props.size='sm'] - Size of the ring and its text
 * @returns {JSX.Element} A circular progress gauge with animated stroke and centered statistics
 */
export function ProgressGauge({
  label,
  current,
  total,
  className,
  showLabel = false,
  color = 'blue',
  tone = 'default',
  size = 'sm',
}: ProgressGaugeProps) {
  const percentage = useMemo(() => (total > 0 ? (current / total) * 100 : 0), [current, total]);
  const degree = useMemo(() => Math.floor((percentage / 100) * 75), [percentage]);
  const colors = colorConfig[color];
  const toneClasses = toneConfig[tone];

  const {
    ring: sizeClasses,
    percentage: percentageTextSize,
    ratio: ratioTextSize,
    label: labelTextSize,
  } = sizeConfig[size];

  const tooltipContent = `${label}: ${current}/${total} (${percentage.toFixed(1)}%)`;

  const gaugeElement = (
    <Tooltip delay={0}>
      <TooltipTrigger
        className={cn('group relative shrink-0', sizeClasses, showLabel ? '' : className)}
        aria-label={tooltipContent}
      >
        <svg
          className="size-full rotate-[135deg]"
          viewBox="0 0 36 36"
          xmlns="http://www.w3.org/2000/svg"
        >
          <title>{label}</title>
          {/* Background circle */}
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            className={cn('stroke-current', toneClasses.track)}
            strokeWidth="2"
            strokeDasharray="75 100"
            strokeLinecap="round"
          />
          {/*
            Animated progress circle. The stroke grows from empty on first render (@starting-style)
            and eases between values; both are skipped when the user prefers reduced motion. The
            dasharray stays a presentation attribute so the starting style can override it.
          */}
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            className={cn('stroke-current', colors.stroke, fillAnimationClasses)}
            strokeWidth="2"
            strokeDasharray={`${degree} 100`}
            strokeLinecap="round"
          />
        </svg>

        {/* Centered content */}
        <div className="absolute start-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 transform flex-col items-center gap-0.5 text-center">
          <div
            className={cn('font-bold', toneClasses.percentage ?? colors.text, percentageTextSize)}
          >
            {percentage.toFixed(1)}%
          </div>
          <div className={cn(toneClasses.secondaryText, ratioTextSize)}>
            {current}/{total}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{tooltipContent}</p>
      </TooltipContent>
    </Tooltip>
  );

  if (showLabel) {
    return (
      <div className={cn('flex flex-col items-center', className)}>
        {gaugeElement}
        <div className={cn('-mt-2 text-center', toneClasses.secondaryText, labelTextSize)}>
          {label}
        </div>
      </div>
    );
  }

  return gaugeElement;
}
