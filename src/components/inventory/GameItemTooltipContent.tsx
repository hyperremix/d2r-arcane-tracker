import { useSpriteIcon } from '@/hooks/useSpriteIcon';
import type { GameItemTooltipModel, GameItemTooltipSocketEntry } from '@/lib/gameItemTooltip';
import { cn } from '@/lib/utils';

interface GameItemTooltipContentProps {
  model: GameItemTooltipModel;
}

function getNameColorClass(model: GameItemTooltipModel): string {
  if (model.isRuneword) {
    return 'text-amber-500 dark:text-amber-300';
  }

  switch (model.quality.toLowerCase()) {
    case 'unique':
      return 'text-yellow-500 dark:text-yellow-300';
    case 'set':
      return 'text-emerald-600 dark:text-green-300';
    case 'magic':
      return 'text-blue-600 dark:text-blue-300';
    case 'rare':
      return 'text-amber-600 dark:text-yellow-200';
    case 'crafted':
      return 'text-orange-600 dark:text-orange-300';
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
      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[2px] border border-amber-600/80 bg-black/30 dark:border-amber-300/70">
          <div className="h-2 w-2 rounded-full border border-amber-500/90 dark:border-amber-200/90" />
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
        <div key={line} className="text-sky-600 dark:text-sky-300">
          {line}
        </div>
      ))}

      {model.socketEntries.map((entry) => (
        <GameItemTooltipSocketRow key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
