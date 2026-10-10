import type { VaultItem } from 'electron/types/grail';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { serializeVaultTextPayload, VAULT_DRAG_MIME } from '@/components/inventory/dragPayloads';
import { GameItemTooltipContent } from '@/components/inventory/GameItemTooltipContent';
import { ItemSocketOverlay } from '@/components/inventory/ItemSocketOverlay';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSpriteIcon } from '@/hooks/useSpriteIcon';
import { translations } from '@/i18n/translations';
import { buildGameItemTooltipModel } from '@/lib/gameItemTooltip';
import {
  createSpatialIconCandidates,
  type SpriteIconLookupIndex,
} from '@/lib/spriteIconCandidates';
import { cn } from '@/lib/utils';

export interface VaultedItemTileProps {
  item: VaultItem;
  iconLookup: SpriteIconLookupIndex;
  selected: boolean;
  onSelect: (item: VaultItem) => void;
  onDragStart?: (item: VaultItem) => void;
  onDragEnd?: () => void;
}

export function VaultedItemTile({
  item,
  iconLookup,
  selected,
  onSelect,
  onDragStart,
  onDragEnd,
}: VaultedItemTileProps) {
  const { t } = useTranslation();
  const [isOverlayVisible, setIsOverlayVisible] = useState(false);
  const iconCandidates = useMemo(
    () => createSpatialIconCandidates(item, iconLookup),
    [iconLookup, item],
  );
  const { iconUrl } = useSpriteIcon(iconCandidates, { forceEnabled: true });
  const gameTooltipModel = useMemo(
    () =>
      buildGameItemTooltipModel({
        rawItemJson: item.rawItemJson,
        itemName: item.itemName,
        quality: item.quality,
        type: item.type,
        socketCount: item.socketCount,
        t,
      }),
    [item.itemName, item.quality, item.rawItemJson, item.socketCount, item.type, t],
  );

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            draggable={!!onDragStart}
            aria-label={t(translations.inventoryBrowser.vaultedTileAriaLabel, {
              itemName: item.itemName,
            })}
            className={cn(
              'relative h-16 w-16 overflow-hidden rounded-[2px] border bg-card/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70',
              selected ? 'border-primary ring-1 ring-primary/70' : 'border-success/60',
            )}
            onClick={() => onSelect(item)}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData(VAULT_DRAG_MIME, item.id);
              const textPayload = serializeVaultTextPayload({
                id: item.id,
                gridWidth: item.gridWidth ?? 1,
                gridHeight: item.gridHeight ?? 1,
              });
              event.dataTransfer.setData('text/plain', textPayload);
              event.dataTransfer.setData('text', textPayload);
              onDragStart?.(item);
            }}
            onDragEnd={onDragEnd}
            onMouseEnter={() => setIsOverlayVisible(true)}
            onMouseLeave={() => setIsOverlayVisible(false)}
            onFocus={() => setIsOverlayVisible(true)}
            onBlur={() => setIsOverlayVisible(false)}
          />
        }
      >
        <div className="relative h-full w-full">
          <img
            src={iconUrl}
            alt={item.itemName}
            draggable={false}
            className="pointer-events-none h-full w-full object-contain"
            loading="lazy"
          />
          {(item.stackCount ?? 1) > 1 && (
            <Badge
              variant="secondary"
              aria-label={t(translations.inventoryBrowser.vaultedTileStackCountLabel, {
                count: item.stackCount,
              })}
              className="absolute right-0.5 bottom-0.5 h-4 min-w-4 justify-center px-1 text-[10px] leading-none"
            >
              {item.stackCount}
            </Badge>
          )}
          {isOverlayVisible && (
            <ItemSocketOverlay entries={gameTooltipModel?.socketEntries ?? []} />
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-md p-3 text-sm">
        {gameTooltipModel ? (
          <GameItemTooltipContent model={gameTooltipModel} />
        ) : (
          <div className="space-y-1.5">
            <div className="font-medium">{item.itemName}</div>
            <div>
              <span className="text-muted-foreground">
                {t(translations.inventoryBrowser.tooltip.qualityTypeLabel)}
              </span>{' '}
              {item.quality}
              {item.type ? ` / ${item.type}` : ''}
            </div>
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
