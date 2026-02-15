import type { GameItemTooltipModel } from '@/lib/gameItemTooltip';
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
    </div>
  );
}
