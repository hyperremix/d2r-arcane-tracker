import { useSpriteIcon } from '@/hooks/useSpriteIcon';
import type { GameItemTooltipModel, GameItemTooltipSocketEntry } from '@/lib/gameItemTooltip';
import { cn } from '@/lib/utils';

interface GameItemTooltipContentProps {
  model: GameItemTooltipModel;
}

function getNameColorClass(model: GameItemTooltipModel): string {
  if (model.isRuneword) {
    return 'text-item-unique';
  }

  switch (model.quality.toLowerCase()) {
    case 'unique':
      return 'text-item-unique';
    case 'set':
      return 'text-item-set';
    case 'magic':
      return 'text-item-magic';
    case 'rare':
      return 'text-item-rare';
    case 'crafted':
      return 'text-item-rune';
    default:
      return 'text-popover-foreground';
  }
}

interface GameItemTooltipSocketRowProps {
  entry: GameItemTooltipSocketEntry;
}

function GameItemTooltipSocketRow({ entry }: GameItemTooltipSocketRowProps) {
  const { iconUrl } = useSpriteIcon(entry.iconCandidates, { forceEnabled: true });

  if (entry.isOpenSocket) {
    return (
      <div className="flex items-center gap-2 text-warning">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[2px] border border-warning/80 bg-black/30">
          <div className="h-2 w-2 rounded-full border border-warning/90" />
        </div>
        <span>{entry.name}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-popover-foreground">
      <img
        src={iconUrl}
        alt={entry.name}
        className="h-5 w-5 shrink-0 object-contain"
        loading="lazy"
      />
      <span>{entry.name}</span>
    </div>
  );
}

export function GameItemTooltipContent({ model }: GameItemTooltipContentProps) {
  return (
    <div className="space-y-1.5 text-sm leading-6">
      <div className={cn('font-semibold tracking-wide', getNameColorClass(model))}>
        {model.name}
      </div>

      {model.baseTypeLine && <div className="text-popover-foreground">{model.baseTypeLine}</div>}

      {model.coreLines.map((line) => (
        <div key={line} className="text-popover-foreground">
          {line}
        </div>
      ))}

      {model.affixLines.map((line) => (
        <div key={line} className="text-item-magic">
          {line}
        </div>
      ))}

      {model.socketEntries.map((entry) => (
        <GameItemTooltipSocketRow key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
