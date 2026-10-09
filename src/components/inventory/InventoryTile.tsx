import type { ParsedInventoryItem } from 'electron/types/grail';
import { type DragEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GameItemTooltipContent } from '@/components/inventory/GameItemTooltipContent';
import { ItemSocketOverlay } from '@/components/inventory/ItemSocketOverlay';
import {
  type EquipmentUnplacedReason,
  formatLocation,
  formatSourceFileTypeLabel,
  getCoordinatesLabel,
  getDimensionsLabel,
  getSlotLabel,
  getUnplacedReasonLabel,
} from '@/components/inventory/inventoryItemLabels';
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

export interface InventoryTileProps {
  item: ParsedInventoryItem;
  iconLookup: SpriteIconLookupIndex;
  selected: boolean;
  disableInteractions?: boolean;
  isVaultPresent?: boolean;
  unplacedReason?: EquipmentUnplacedReason;
  onSelect: (item: ParsedInventoryItem) => void;
  onDragStart?: (event: DragEvent<HTMLButtonElement>, item: ParsedInventoryItem) => void;
  onDragEnd?: () => void;
}

export function InventoryTile({
  item,
  iconLookup,
  selected,
  disableInteractions = false,
  isVaultPresent,
  unplacedReason,
  onSelect,
  onDragStart,
  onDragEnd,
}: InventoryTileProps) {
  const { t } = useTranslation();
  const [isOverlayVisible, setIsOverlayVisible] = useState(false);
  const gameTooltipModel = useMemo(
    () =>
      buildGameItemTooltipModel({
        rawItemJson: item.rawItemJson,
        fallbackName: item.itemName,
        quality: item.quality,
        type: item.type,
        socketCount: item.socketCount,
        t,
      }),
    [item.itemName, item.quality, item.rawItemJson, item.socketCount, item.type, t],
  );
  const iconCandidates = useMemo(
    () => createSpatialIconCandidates(item, iconLookup),
    [iconLookup, item],
  );
  const { iconUrl } = useSpriteIcon(iconCandidates, { forceEnabled: true });

  const slotLabel = getSlotLabel(item, t);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            draggable={!disableInteractions && !!onDragStart}
            data-testid="inventory-item-tile"
            aria-label={t(translations.inventoryBrowser.tileAriaLabel, { itemName: item.itemName })}
            className={cn(
              'relative h-full w-full overflow-hidden rounded-[2px] border bg-card/75 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70',
              selected ? 'border-primary ring-1 ring-primary/70' : 'border-border/70',
              isVaultPresent === true ? 'border-success/60' : '',
              isVaultPresent === false ? 'border-warning/60' : '',
            )}
            onClick={() => onSelect(item)}
            onDragStart={(event) => {
              if (!disableInteractions && onDragStart) {
                onDragStart(event, item);
              }
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
              data-testid="inventory-item-stack-count"
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
            <div>
              <span className="text-muted-foreground">
                {t(translations.inventoryBrowser.tooltip.sourceLabel)}
              </span>{' '}
              {t(translations.inventoryBrowser.groupHeader, {
                characterName: item.characterName,
                sourceFileType: formatSourceFileTypeLabel(item.sourceFileType, t),
              })}
            </div>
            <div>
              <span className="text-muted-foreground">
                {t(translations.inventoryBrowser.tooltip.locationLabel)}
              </span>{' '}
              {formatLocation(item, t)}
            </div>
            <div>
              <span className="text-muted-foreground">
                {t(translations.inventoryBrowser.tooltip.coordinatesLabel)}
              </span>{' '}
              {getCoordinatesLabel(item, t)}
            </div>
            <div>
              <span className="text-muted-foreground">
                {t(translations.inventoryBrowser.tooltip.dimensionsLabel)}
              </span>{' '}
              {getDimensionsLabel(item, t)}
            </div>
            <div>
              <span className="text-muted-foreground">
                {t(translations.inventoryBrowser.tooltip.slotLabel)}
              </span>{' '}
              {slotLabel}
            </div>
            {unplacedReason && (
              <div>
                <span className="text-muted-foreground">
                  {t(translations.inventoryBrowser.tooltip.unplacedReasonLabel)}
                </span>{' '}
                {getUnplacedReasonLabel(unplacedReason, t)}
              </div>
            )}
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
