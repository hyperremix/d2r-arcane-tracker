import type { JSX } from 'react';
import { Badge } from '@/components/ui/badge';
import { useRunewordStore } from '@/stores/runewordStore';
import { RunewordCard } from './RunewordCard';

/**
 * List of runewords with filtering and sorting applied.
 */
export function RunewordList(): JSX.Element {
  const { craftableRunewords } = useRunewordStore();

  if (craftableRunewords.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">No runewords found</p>
          <p className="text-muted-foreground text-sm">Try adjusting your filters or adding runes to your inventory</p>
        </div>
      </div>
    );
  }

  // Count craftable runewords
  const craftableCount = craftableRunewords.filter((cr) => cr.canCraft).length;

  return (
    <div className="flex h-full flex-col">
      {/* Stats Header */}
      <div className="mb-4 flex items-center gap-2">
        <Badge variant="secondary">
          {craftableRunewords.length} runeword{craftableRunewords.length !== 1 ? 's' : ''}
        </Badge>
        {craftableCount > 0 && (
          <Badge variant="default">
            {craftableCount} craftable
          </Badge>
        )}
      </div>

      {/* Runeword Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 gap-4 pb-4 lg:grid-cols-2 xl:grid-cols-3">
          {craftableRunewords.map((craftable) => (
            <RunewordCard key={craftable.runeword.id} craftable={craftable} />
          ))}
        </div>
      </div>
    </div>
  );
}
