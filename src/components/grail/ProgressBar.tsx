import { useTranslation } from 'react-i18next';
import { Progress } from '@/components/ui/progress';
import { translations } from '@/i18n/translations';
import { cn } from '@/lib/utils';

/**
 * Props interface for the ProgressBar component.
 */
interface ProgressBarProps {
  label: string;
  current: number;
  total: number;
  className?: string;
}

/**
 * ProgressBar component that displays a visual progress indicator with label and percentage.
 * @param {ProgressBarProps} props - Component props
 * @param {string} props.label - The label text to display above the progress bar
 * @param {number} props.current - The current progress value
 * @param {number} props.total - The total/maximum progress value
 * @param {string} [props.className] - Optional additional CSS classes
 * @returns {JSX.Element} A progress bar with label and percentage display
 */
export function ProgressBar({ label, current, total, className }: ProgressBarProps) {
  const { t } = useTranslation();
  const percentage = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <span className="font-medium text-gray-700 text-sm dark:text-gray-300">{label}</span>
        <span className="text-gray-500 text-sm dark:text-gray-400">
          {t(translations.grail.progressBar.progress, {
            current,
            total,
            percentage: percentage.toFixed(1),
          })}
        </span>
      </div>
      <Progress value={percentage} className="h-2" />
    </div>
  );
}
