import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';

/**
 * Props for the StatTile component.
 */
interface StatTileProps {
  /** Name of the statistic */
  label: string;
  /** The value, already formatted */
  value: ReactNode;
  /** Optional supporting text below the value (e.g. the period or a related value) */
  hint?: ReactNode;
  /** Decorative icon shown next to the label */
  icon: LucideIcon;
}

/**
 * A single headline statistic: a label with a small muted icon, a neutral value and an optional
 * hint. Shared by the grail and run statistics so every tile looks the same.
 * @returns {JSX.Element} The stat tile
 */
export function StatTile({ label, value, hint, icon: Icon }: StatTileProps) {
  return (
    <Card className="gap-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-muted-foreground text-sm">{label}</p>
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="font-semibold text-2xl text-foreground tabular-nums">{value}</p>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </Card>
  );
}
