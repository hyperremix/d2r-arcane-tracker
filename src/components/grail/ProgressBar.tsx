import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  label: string;
  current: number;
  total: number;
  className?: string;
}

export function ProgressBar({ label, current, total, className }: ProgressBarProps) {
  const percentage = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <span className="font-medium text-gray-700 text-sm dark:text-gray-300">{label}</span>
        <span className="text-gray-500 text-sm dark:text-gray-400">
          {current}/{total} ({percentage.toFixed(1)}%)
        </span>
      </div>
      <Progress value={percentage} className="h-2" />
    </div>
  );
}
