import { ArrowDown, ArrowUp } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';

/**
 * Sort direction used by sortable run tracker tables.
 */
export type SortOrder = 'asc' | 'desc';

interface SortableTableHeadProps<TField extends string> {
  field: TField;
  label: string;
  activeField: TField;
  sortOrder: SortOrder;
  onSort: (field: TField) => void;
  className?: string;
  align?: 'start' | 'center';
}

/**
 * Table header cell with a keyboard-operable sort button.
 * Exposes the current sort direction to assistive technology via `aria-sort`.
 */
export function SortableTableHead<TField extends string>({
  field,
  label,
  activeField,
  sortOrder,
  onSort,
  className,
  align = 'start',
}: SortableTableHeadProps<TField>) {
  const isActive = activeField === field;
  const ariaSort = isActive ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none';

  return (
    <TableHead className={cn('p-0', className)} aria-sort={ariaSort}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          'flex h-10 w-full select-none items-center px-2 font-medium outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring',
          align === 'center' && 'justify-center',
        )}
      >
        {label}
        {isActive &&
          (sortOrder === 'asc' ? (
            <ArrowUp className="ml-1 h-3 w-3" aria-hidden="true" />
          ) : (
            <ArrowDown className="ml-1 h-3 w-3" aria-hidden="true" />
          ))}
      </button>
    </TableHead>
  );
}
