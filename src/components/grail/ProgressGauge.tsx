import { motion } from 'motion/react';
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
}

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
 * ProgressGauge component that displays a circular progress indicator with centered statistics.
 * Inspired by the skill-gauge component pattern with animated SVG circle.
 * @param {ProgressGaugeProps} props - Component props
 * @param {string} props.label - The label text for the gauge (shown in tooltip and optionally below)
 * @param {number} props.current - The current progress value
 * @param {number} props.total - The total/maximum progress value
 * @param {string} [props.className] - Optional additional CSS classes
 * @param {boolean} [props.showLabel=false] - Whether to show the label below the gauge
 * @param {'blue' | 'green' | 'purple' | 'orange'} [props.color='blue'] - Color variant of the gauge
 * @returns {JSX.Element} A circular progress gauge with animated stroke and centered statistics
 */
export function ProgressGauge({
  label,
  current,
  total,
  className,
  showLabel = false,
  color = 'blue',
}: ProgressGaugeProps) {
  const percentage = useMemo(() => (total > 0 ? (current / total) * 100 : 0), [current, total]);
  const degree = useMemo(() => Math.floor((percentage / 100) * 75), [percentage]);
  const colors = colorConfig[color];

  const sizeClasses = 'size-22';
  const percentageTextSize = 'text-lg';
  const ratioTextSize = 'text-xs';
  const labelTextSize = 'text-xs';

  const tooltipContent = `${label}: ${current}/${total} (${percentage.toFixed(1)}%)`;

  const gaugeElement = (
    <Tooltip delay={0}>
      <TooltipTrigger
        className={cn('group relative', sizeClasses, showLabel ? '' : className)}
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
            className="stroke-current text-muted-foreground/30"
            strokeWidth="2"
            strokeDasharray="75 100"
            strokeLinecap="round"
          />
          {/* Animated progress circle */}
          <motion.circle
            initial={{ strokeDasharray: '0 100' }}
            whileInView={{ strokeDasharray: `${degree} 100` }}
            transition={{ duration: 1.5, ease: 'easeInOut' }}
            viewport={{ once: true }}
            cx="18"
            cy="18"
            r="16"
            fill="none"
            className={cn('stroke-current', colors.stroke)}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>

        {/* Centered content */}
        <div className="-translate-x-1/2 -translate-y-1/2 absolute start-1/2 top-1/2 flex transform flex-col items-center gap-0.5 text-center">
          <div className={cn('font-bold', colors.text, percentageTextSize)}>
            {percentage.toFixed(1)}%
          </div>
          <div className={cn('text-muted-foreground', ratioTextSize)}>
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
        <div className={cn('-mt-2 text-center text-muted-foreground', labelTextSize)}>{label}</div>
      </div>
    );
  }

  return gaugeElement;
}
