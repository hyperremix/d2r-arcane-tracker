import { useSpriteIcon } from '@/hooks/useSpriteIcon';
import type { GameItemTooltipSocketEntry } from '@/lib/gameItemTooltip';
import { cn } from '@/lib/utils';

export interface ItemSocketOverlayProps {
  entries: GameItemTooltipSocketEntry[];
}

interface ItemSocketOverlaySlotProps {
  entry: GameItemTooltipSocketEntry;
  compact: boolean;
}

function ItemSocketOverlaySlot({ entry, compact }: ItemSocketOverlaySlotProps) {
  const { iconUrl } = useSpriteIcon(entry.iconCandidates, { forceEnabled: true });
  const sizeClass = compact ? 'h-3 w-3' : 'h-4 w-4';

  if (entry.isOpenSocket) {
    return (
      <div
        data-testid="item-socket-overlay-open-slot"
        className={cn(
          'flex items-center justify-center rounded-[2px] border border-warning/90 bg-black/30',
          sizeClass,
        )}
      >
        <div
          className={cn(
            'rounded-full border border-warning/70',
            compact ? 'h-1.5 w-1.5' : 'h-2 w-2',
          )}
        />
      </div>
    );
  }

  return (
    <div
      data-testid="item-socket-overlay-filled-slot"
      className={cn(
        'overflow-hidden rounded-[2px] border border-white/45 bg-black/20 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]',
        sizeClass,
      )}
    >
      <img
        src={iconUrl}
        alt=""
        draggable={false}
        className="h-full w-full object-contain"
        loading="lazy"
      />
    </div>
  );
}

export function ItemSocketOverlay({ entries }: ItemSocketOverlayProps) {
  if (entries.length === 0) {
    return null;
  }

  const compact = entries.length >= 5;

  return (
    <div
      data-testid="item-socket-overlay"
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
      aria-hidden="true"
    >
      <div
        className={cn(
          'gap-0.5',
          entries.length > 3 ? 'grid grid-cols-2' : 'flex flex-col items-center',
        )}
      >
        {entries.map((entry) => (
          <ItemSocketOverlaySlot key={entry.id} entry={entry} compact={compact} />
        ))}
      </div>
    </div>
  );
}
