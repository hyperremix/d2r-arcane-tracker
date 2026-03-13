import { materials } from 'electron/items/materials';
import type { ParsedInventoryItem } from 'electron/types/grail';
import type { ReactNode } from 'react';
import { BoardSurface } from '@/components/inventory/boardPrimitives';
import type { GridSize } from '@/components/inventory/spatialLayout';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSpriteIcon } from '@/hooks/useSpriteIcon';

const MATERIALS_GRID_SIZE: GridSize = { columns: 6, rows: 4 };

interface MaterialPlaceholderTileProps {
  imageFilename: string;
  materialName: string;
}

function MaterialPlaceholderTile({ imageFilename, materialName }: MaterialPlaceholderTileProps) {
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
        <div className="font-semibold tracking-wide">{materialName}</div>
      </TooltipContent>
    </Tooltip>
  );
}

export interface MaterialsTabSectionProps {
  title?: string;
  testId?: string;
  items: ParsedInventoryItem[];
  renderOwnedTile: (item: ParsedInventoryItem) => ReactNode;
}

export function MaterialsTabSection({
  title,
  testId,
  items,
  renderOwnedTile,
}: MaterialsTabSectionProps) {
  const ownedMap = new Map<string, ParsedInventoryItem>();
  for (const item of items) {
    if (item.itemCode) {
      ownedMap.set(item.itemCode.toLowerCase(), item);
    }
  }

  return (
    <div className="space-y-2">
      {title && <div className="font-medium text-sm">{title}</div>}
      <BoardSurface gridSize={MATERIALS_GRID_SIZE} testId={testId} showBaseGrid={false}>
        {materials.map((material, i) => {
          const gridX = i % 6;
          const gridY = Math.floor(i / 6);
          const style = { gridColumn: gridX + 1, gridRow: gridY + 1 };
          const ownedItem = material.code ? ownedMap.get(material.code.toLowerCase()) : undefined;

          if (ownedItem) {
            return (
              <div key={material.id} className="relative z-10" style={style}>
                {renderOwnedTile(ownedItem)}
              </div>
            );
          }

          return (
            <div key={material.id} className="relative z-10" style={style}>
              <MaterialPlaceholderTile
                imageFilename={material.imageFilename ?? ''}
                materialName={material.name}
              />
            </div>
          );
        })}
      </BoardSurface>
    </div>
  );
}
