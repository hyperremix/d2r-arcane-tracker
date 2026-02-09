import type { Run } from 'electron/types/grail';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TableCell, TableRow } from '@/components/ui/table';
import { formatDuration } from '@/lib/utils';

// Skeleton loader for table rows
export function TableRowSkeleton() {
  return (
    <TableRow>
      <TableCell>
        <Skeleton className="h-4 w-8" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-20" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-20" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-16" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-8" />
      </TableCell>
    </TableRow>
  );
}

export interface RunRowProps {
  run: Run;
  itemsCount: number;
  onViewDetails: (run: Run) => void;
  formatTimestamp: (date: Date) => string;
}

export function RunRow({ run, itemsCount, onViewDetails, formatTimestamp }: RunRowProps) {
  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/70 focus-visible:bg-muted/70"
      tabIndex={0}
      onClick={() => onViewDetails(run)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onViewDetails(run);
        }
      }}
      aria-label={`View run #${run.runNumber} details`}
    >
      <TableCell className="font-medium">#{run.runNumber}</TableCell>
      <TableCell className="font-mono text-sm">{formatTimestamp(run.startTime)}</TableCell>
      <TableCell className="font-mono text-sm">
        {run.endTime ? formatTimestamp(run.endTime) : '-'}
      </TableCell>
      <TableCell className="font-mono text-sm">
        {run.duration ? formatDuration(run.duration) : '-'}
      </TableCell>
      <TableCell className="text-center">
        {itemsCount > 0 ? (
          <Badge variant="secondary" className="text-xs">
            {itemsCount}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        )}
      </TableCell>
    </TableRow>
  );
}
