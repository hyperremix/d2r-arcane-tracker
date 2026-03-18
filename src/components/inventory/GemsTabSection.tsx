import { gems } from 'electron/items/gems';
import type { ParsedInventoryItem } from 'electron/types/grail';
import type { DragEvent, ReactNode } from 'react';
import { BoardSurface } from '@/components/inventory/boardPrimitives';
import type { GridSize } from '@/components/inventory/spatialLayout';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSpriteIcon } from '@/hooks/useSpriteIcon';

const GEMS_GRID_SIZE: GridSize = { columns: 7, rows: 5 };

interface GemPlaceholderTileProps {
  imageFilename: string;
  gemName: string;
}

function GemPlaceholderTile({ imageFilename, gemName }: GemPlaceholderTileProps) {
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
        <div className="font-semibold tracking-wide">{gemName}</div>
      </TooltipContent>
    </Tooltip>
  );
}

export interface GemsTabSectionProps {
  title?: string;
  testId?: string;
  items: ParsedInventoryItem[];
  renderOwnedTile: (item: ParsedInventoryItem) => ReactNode;
  disableInteractions?: boolean;
  onItemClick?: (item: ParsedInventoryItem) => void;
  onItemContextMenu?: (item: ParsedInventoryItem) => void;
  onDropInventoryItem?: (
    event: DragEvent<HTMLDivElement>,
    targetGridX: number,
    targetGridY: number,
  ) => Promise<void> | void;
}

export function GemsTabSection({
  title,
  testId,
  items,
  renderOwnedTile,
  disableInteractions = false,
  onItemClick,
  onItemContextMenu,
  onDropInventoryItem,
}: GemsTabSectionProps) {
  const itemByCode = new Map<string, ParsedInventoryItem>();
  const ownedMap = new Map<string, ParsedInventoryItem>();
  for (const item of items) {
    if (!item.itemCode) {
      continue;
    }
    const normalizedCode = item.itemCode.toLowerCase();
    itemByCode.set(normalizedCode, item);
    const availableCount = typeof item.stackCount === 'number' ? item.stackCount : 1;
    if (availableCount > 0) {
      ownedMap.set(normalizedCode, item);
    }
  }

  return (
    <div className="space-y-2">
      {title && <div className="font-medium text-sm">{title}</div>}
      <BoardSurface
        gridSize={GEMS_GRID_SIZE}
        testId={testId}
        showBaseGrid={false}
        onDropOnBoard={
          !disableInteractions && onDropInventoryItem
            ? (event, targetGridX, targetGridY) => {
                void onDropInventoryItem(event, targetGridX, targetGridY);
              }
            : undefined
        }
      >
        {/* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: per-cell tab rendering branches between owned and placeholder states with pickup/context-menu wiring. */}
        {gems.map((gem, i) => {
          const gridX = i % 7;
          const gridY = Math.floor(i / 7);
          const style = { gridColumn: gridX + 1, gridRow: gridY + 1 };
          const normalizedCode = gem.code?.toLowerCase();
          const ownedItem = normalizedCode ? ownedMap.get(normalizedCode) : undefined;
          const codeItem = normalizedCode ? itemByCode.get(normalizedCode) : undefined;

          if (ownedItem) {
            return (
              // biome-ignore lint/a11y/noStaticElementInteractions: wrapper div captures pickup click; the child InventoryTile button handles full keyboard accessibility.
              // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard accessibility provided by the child button (InventoryTile).
              <div
                key={gem.id}
                className="relative z-10"
                style={style}
                onClick={onItemClick ? () => onItemClick(ownedItem) : undefined}
                onContextMenu={
                  onItemContextMenu
                    ? (e) => {
                        e.preventDefault();
                        onItemContextMenu(ownedItem);
                      }
                    : undefined
                }
              >
                {renderOwnedTile(ownedItem)}
              </div>
            );
          }

          return (
            // biome-ignore lint/a11y/noStaticElementInteractions: placeholder wrapper captures right-click decrement; this is a pointer-only convenience for stack pickup.
            <div
              key={gem.id}
              className="relative z-10"
              style={style}
              onContextMenu={
                codeItem && onItemContextMenu
                  ? (e) => {
                      e.preventDefault();
                      onItemContextMenu(codeItem);
                    }
                  : undefined
              }
            >
              <GemPlaceholderTile imageFilename={gem.imageFilename ?? ''} gemName={gem.name} />
            </div>
          );
        })}
      </BoardSurface>
    </div>
  );
}
