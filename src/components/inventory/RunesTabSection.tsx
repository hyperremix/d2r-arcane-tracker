import { runes } from 'electron/items/runes';
import type { ParsedInventoryItem } from 'electron/types/grail';
import type { ReactNode } from 'react';
import { BoardSurface } from '@/components/inventory/boardPrimitives';
import type { GridSize } from '@/components/inventory/spatialLayout';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSpriteIcon } from '@/hooks/useSpriteIcon';

const RUNE_GRID_SIZE: GridSize = { columns: 10, rows: 4 };

interface RunePlaceholderTileProps {
  imageFilename: string;
  runeName: string;
}

function RunePlaceholderTile({ imageFilename, runeName }: RunePlaceholderTileProps) {
  const { iconUrl } = useSpriteIcon(imageFilename, { forceEnabled: true });

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div className="relative h-full w-full rounded-[2px] border border-border/70 bg-card/75 opacity-40" />
        }
      >
        <img
          src={iconUrl}
          alt=""
          draggable={false}
          className="pointer-events-none h-full w-full object-contain"
        />
        <Badge
          variant="secondary"
          className="absolute right-0.5 bottom-0.5 h-4 min-w-4 justify-center px-1 text-[10px] leading-none"
        >
          0
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-md p-3 text-sm">
        <div className="font-semibold tracking-wide">{runeName} Rune</div>
      </TooltipContent>
    </Tooltip>
  );
}

export interface RunesTabSectionProps {
  title?: string;
  testId?: string;
  items: ParsedInventoryItem[];
  renderOwnedTile: (item: ParsedInventoryItem) => ReactNode;
}

export function RunesTabSection({ title, testId, items, renderOwnedTile }: RunesTabSectionProps) {
  const ownedMap = new Map<string, ParsedInventoryItem>();
  for (const item of items) {
    if (item.itemCode) {
      ownedMap.set(item.itemCode.toLowerCase(), item);
    }
  }

  return (
    <div className="space-y-2">
      {title && <div className="font-medium text-sm">{title}</div>}
      <BoardSurface gridSize={RUNE_GRID_SIZE} testId={testId} showBaseGrid={false}>
        {runes.map((rune, i) => {
          const gridX = i % 10;
          const gridY = Math.floor(i / 10);
          const style = { gridColumn: gridX + 1, gridRow: gridY + 1 };
          const ownedItem = rune.code ? ownedMap.get(rune.code.toLowerCase()) : undefined;

          if (ownedItem) {
            return (
              <div key={rune.id} className="relative z-10" style={style}>
                {renderOwnedTile(ownedItem)}
              </div>
            );
          }

          return (
            <div key={rune.id} className="relative z-10" style={style}>
              <RunePlaceholderTile imageFilename={rune.imageFilename ?? ''} runeName={rune.name} />
            </div>
          );
        })}
      </BoardSurface>
    </div>
  );
}
