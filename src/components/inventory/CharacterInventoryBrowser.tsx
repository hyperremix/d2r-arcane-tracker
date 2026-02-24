import type {
  CharacterInventorySnapshot,
  ParsedInventoryItem,
  VaultItem,
  VaultItemFilter,
  VaultItemUpsertInput,
  VaultLocationContext,
  VaultSourceFileType,
} from 'electron/types/grail';
import { PackagePlus, Sparkles, X } from 'lucide-react';
import { type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BoardSurface, getItemGridPlacement } from '@/components/inventory/boardPrimitives';
import { GameItemTooltipContent } from '@/components/inventory/GameItemTooltipContent';
import {
  buildEquippedSlotMapForSet,
  buildOverflowBoardLayout,
  classifyBoardItems,
  DEFAULT_BELT_GRID_SIZE,
  DEFAULT_INVENTORY_GRID_SIZE,
  DEFAULT_STASH_GRID_SIZE,
  EQUIPPED_BOARD_SIZE,
  EQUIPPED_SLOT_LAYOUT,
  EQUIPPED_WEAPON_SET_ORDER,
  type EquippedWeaponSet,
  type GridSize,
  getGridHeight,
  getGridWidth,
  getSortedStashTabs,
  groupSpatialItems,
  hasGridDimensions,
  hasGridPosition,
  PAPER_DOLL_SLOT_ORDER,
  resolvePaperDollSlotKey,
  type UnplacedReason,
} from '@/components/inventory/spatialLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSpriteIcon } from '@/hooks/useSpriteIcon';
import { translations } from '@/i18n/translations';
import type { GameItemTooltipSocketEntry } from '@/lib/gameItemTooltip';
import { buildGameItemTooltipModel } from '@/lib/gameItemTooltip';
import { getRawItemLocation, isRawBeltItem } from '@/lib/rawItemLocation';
import {
  createSpatialIconCandidates,
  createSpriteIconLookupIndex,
  type SpriteIconLookupIndex,
} from '@/lib/spriteIconCandidates';
import { cn } from '@/lib/utils';
import { useGrailStore } from '@/stores/grailStore';

type InventorySearchAllResponse = {
  inventory: {
    snapshots: CharacterInventorySnapshot[];
    totalSnapshots: number;
    totalItems: number;
  };
  vault: {
    items: VaultItem[];
    total: number;
    page: number;
    pageSize: number;
  };
};

type TypeFilter = 'all' | 'unique' | 'set' | 'runeword' | 'rune' | 'other';
type EquipmentUnplacedReason = UnplacedReason | 'unknownEquippedSlot';

const INVENTORY_DRAG_MIME = 'application/x-d2r-arcane-tracker-inventory-item';
const VAULT_DRAG_MIME = 'application/x-d2r-arcane-tracker-vault-item';

function getVaultItemLastUpdatedMs(item: VaultItem): number {
  const rawValue = item.lastUpdated as unknown;
  if (rawValue instanceof Date) {
    return rawValue.getTime();
  }

  if (typeof rawValue === 'string') {
    const parsed = Date.parse(rawValue);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

function compareVaultItems(a: VaultItem, b: VaultItem): number {
  const timeDiff = getVaultItemLastUpdatedMs(b) - getVaultItemLastUpdatedMs(a);
  if (timeDiff !== 0) {
    return timeDiff;
  }

  return a.fingerprint.localeCompare(b.fingerprint);
}

function mergeAndSortVaultItems(pages: VaultItem[][]): VaultItem[] {
  const deduped = new Map<string, VaultItem>();

  for (const pageItems of pages) {
    for (const item of pageItems) {
      const key = item.id || item.fingerprint;
      deduped.set(key, item);
    }
  }

  return [...deduped.values()].sort(compareVaultItems);
}

async function fetchAllVaultItemsForFilter(
  filter: VaultItemFilter,
  initialVault: InventorySearchAllResponse['vault'],
): Promise<VaultItem[]> {
  const initialItems = initialVault.items ?? [];
  const pageSize = Math.max(initialVault.pageSize, 1);
  const totalPages = Math.ceil(initialVault.total / pageSize);

  if (totalPages <= 1) {
    return mergeAndSortVaultItems([initialItems]);
  }

  const remainingPageRequests: Promise<InventorySearchAllResponse['vault']>[] = [];
  for (let page = 2; page <= totalPages; page += 1) {
    remainingPageRequests.push(
      window.electronAPI.vault.search({
        ...filter,
        page,
        pageSize,
      }),
    );
  }

  const remainingPages = await Promise.all(remainingPageRequests);
  return mergeAndSortVaultItems([initialItems, ...remainingPages.map((page) => page.items)]);
}

function resolveCharacterFilter(characterId: string): string | undefined {
  if (characterId === 'all') {
    return undefined;
  }

  if (characterId.startsWith('name:')) {
    return characterId.slice('name:'.length);
  }

  return characterId;
}

function buildInventorySearchFilter(
  searchText: string,
  characterId: string,
  locationContext: 'all' | VaultLocationContext,
): VaultItemFilter {
  return {
    text: searchText.trim() || undefined,
    characterId: resolveCharacterFilter(characterId),
    locationContext: locationContext === 'all' ? undefined : locationContext,
    includeSocketed: false,
    vaultedState: 'vaulted',
    page: 1,
    pageSize: 200,
  };
}

function withMergedVaultItems(
  response: InventorySearchAllResponse,
  allVaultItems: VaultItem[],
): InventorySearchAllResponse {
  return {
    ...response,
    vault: {
      ...response.vault,
      items: allVaultItems,
    },
  };
}

async function loadInventorySearchResponse(
  filter: VaultItemFilter,
): Promise<InventorySearchAllResponse> {
  const response = await window.electronAPI.inventory.searchAll(filter);
  const allVaultItems = await fetchAllVaultItemsForFilter(filter, response.vault);
  return withMergedVaultItems(response, allVaultItems);
}

interface VaultedItemTileProps {
  item: VaultItem;
  iconLookup: SpriteIconLookupIndex;
  selected: boolean;
  onSelect: (item: VaultItem) => void;
  onDragStart?: (item: VaultItem) => void;
  onDragEnd?: () => void;
}

interface ItemSocketOverlayProps {
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
          'flex items-center justify-center rounded-[2px] border border-amber-500/90 bg-black/30',
          sizeClass,
        )}
      >
        <div
          className={cn(
            'rounded-full border border-amber-300/90',
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

function ItemSocketOverlay({ entries }: ItemSocketOverlayProps) {
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

function VaultedItemTile({
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
        fallbackName: item.itemName,
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
              selected ? 'border-primary ring-1 ring-primary/70' : 'border-emerald-500/60',
            )}
            onClick={() => onSelect(item)}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData(VAULT_DRAG_MIME, item.id);
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

interface InventoryTileProps {
  item: ParsedInventoryItem;
  iconLookup: SpriteIconLookupIndex;
  selected: boolean;
  isVaultPresent?: boolean;
  unplacedReason?: EquipmentUnplacedReason;
  onSelect: (item: ParsedInventoryItem) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>, item: ParsedInventoryItem) => void;
  onDragEnd: () => void;
}

interface InventoryGridSectionProps {
  title: string;
  testId: string;
  items: ParsedInventoryItem[];
  gridSize: GridSize;
  showRawOverflowBoard?: boolean;
  rawOverflowTitle?: string;
  iconLookup: SpriteIconLookupIndex;
  selectedFingerprint?: string;
  pendingVaultFingerprints: Set<string>;
  vaultItemsByFingerprint: Map<string, VaultItem>;
  onSelect: (item: ParsedInventoryItem) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>, item: ParsedInventoryItem) => void;
  onDragEnd: () => void;
  snapshotSourceFilePath?: string;
  snapshotSourceFileType?: VaultSourceFileType;
  sectionLocationContext?: VaultLocationContext;
  sectionStashTab?: number;
  draggingVaultItem?: VaultItem | null;
  onDropVaultItem?: (
    vaultItemId: string,
    targetFilePath: string,
    targetFileType: VaultSourceFileType,
    targetLocationContext: VaultLocationContext,
    targetStashTab: number | undefined,
    targetGridX: number,
    targetGridY: number,
  ) => Promise<void>;
}

interface EquipmentSectionProps {
  items: ParsedInventoryItem[];
  iconLookup: SpriteIconLookupIndex;
  selectedFingerprint?: string;
  pendingVaultFingerprints: Set<string>;
  vaultItemsByFingerprint: Map<string, VaultItem>;
  weaponSet: EquippedWeaponSet;
  onWeaponSetChange: (weaponSet: EquippedWeaponSet) => void;
  onSelect: (item: ParsedInventoryItem) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>, item: ParsedInventoryItem) => void;
  onDragEnd: () => void;
}

function formatLocation(
  item: ParsedInventoryItem,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const rawLocation = getRawItemLocation(item);

  if (item.locationContext === 'unknown' && isRawBeltItem(rawLocation)) {
    return t(translations.inventoryBrowser.location.belt);
  }

  if (item.locationContext === 'stash' && item.stashTab !== undefined) {
    return t(translations.inventoryBrowser.location.stashTab, { tab: item.stashTab + 1 });
  }

  return t(translations.inventoryBrowser.location[item.locationContext]);
}

function formatSourceFileTypeLabel(
  sourceFileType: string | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (!sourceFileType?.trim()) {
    return t(translations.inventoryBrowser.unknownSourceFileType);
  }

  return sourceFileType.toUpperCase();
}

function getTypeValue(type?: string): TypeFilter {
  if (!type) {
    return 'other';
  }

  const normalizedType = type.toLowerCase();

  if (normalizedType === 'unique' || normalizedType === 'set' || normalizedType === 'runeword') {
    return normalizedType;
  }

  if (normalizedType === 'rune') {
    return 'rune';
  }

  return 'other';
}

function toVaultUpsertInput(item: ParsedInventoryItem): VaultItemUpsertInput {
  return {
    fingerprint: item.fingerprint,
    itemName: item.itemName,
    itemCode: item.itemCode,
    type: item.type,
    quality: item.quality,
    ethereal: item.ethereal,
    socketCount: item.socketCount,
    rawItemJson: item.rawItemJson,
    sourceCharacterId: item.characterId,
    sourceCharacterName: item.characterName,
    sourceFileType: item.sourceFileType,
    sourceFilePath: item.sourceFilePath,
    locationContext: item.locationContext,
    stashTab: item.stashTab,
    gridX: item.gridX,
    gridY: item.gridY,
    gridWidth: item.gridWidth,
    gridHeight: item.gridHeight,
    equippedSlotId: item.equippedSlotId,
    iconFileName: item.iconFileName,
    isSocketedItem: item.isSocketedItem,
    grailItemId: item.grailItemId,
    isPresentInLatestScan: true,
    lastSeenAt: item.seenAt,
  };
}

function isCurrentlyVaulted(vaultItem: VaultItem): boolean {
  if (!vaultItem.vaultedAt) {
    return false;
  }

  const vaultedAtMs =
    vaultItem.vaultedAt instanceof Date
      ? vaultItem.vaultedAt.getTime()
      : Date.parse(vaultItem.vaultedAt as unknown as string);

  if (!vaultItem.unvaultedAt) {
    return true;
  }

  const unvaultedAtMs =
    vaultItem.unvaultedAt instanceof Date
      ? vaultItem.unvaultedAt.getTime()
      : Date.parse(vaultItem.unvaultedAt as unknown as string);

  return vaultedAtMs > unvaultedAtMs;
}

function getEffectiveVaultPresent(
  item: ParsedInventoryItem,
  vaultItemsByFingerprint: Map<string, VaultItem>,
  pendingVaultFingerprints: Set<string>,
): boolean | undefined {
  const vaultItem = vaultItemsByFingerprint.get(item.fingerprint);
  if (vaultItem !== undefined) {
    return isCurrentlyVaulted(vaultItem);
  }

  return pendingVaultFingerprints.has(item.fingerprint) ? true : undefined;
}

function getCoordinatesLabel(
  item: ParsedInventoryItem,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (item.gridX === undefined || item.gridY === undefined) {
    return t(translations.inventoryBrowser.tooltip.noCoordinates);
  }

  return t(translations.inventoryBrowser.tooltip.coordinatesValue, {
    x: item.gridX,
    y: item.gridY,
  });
}

function getDimensionsLabel(
  item: ParsedInventoryItem,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const width = getGridWidth(item);
  const height = getGridHeight(item);
  return t(translations.inventoryBrowser.tooltip.dimensionsValue, {
    width,
    height,
  });
}

function getPresenceLabel(
  isVaultPresent: boolean | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (isVaultPresent === undefined) {
    return t(translations.inventoryBrowser.vaultUntracked);
  }

  return isVaultPresent
    ? t(translations.inventoryBrowser.vaultPresent)
    : t(translations.inventoryBrowser.vaultMissing);
}

function getSlotLabel(
  item: ParsedInventoryItem,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const slotKey = resolvePaperDollSlotKey(item.equippedSlotId);
  if (slotKey) {
    return t(translations.inventoryBrowser.equippedSlots[slotKey]);
  }

  if (item.equippedSlotId !== undefined) {
    return t(translations.inventoryBrowser.equippedSlots.unknown, {
      slotId: item.equippedSlotId,
    });
  }

  return t(translations.inventoryBrowser.details.notEquipped);
}

function getUnplacedReasonLabel(
  reason: EquipmentUnplacedReason,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (reason === 'unknownEquippedSlot') {
    return t(translations.inventoryBrowser.unplacedReasons.unknownEquippedSlot);
  }

  return t(translations.inventoryBrowser.unplacedReasons[reason]);
}

function partitionUnknownItems(items: ParsedInventoryItem[]): {
  belt: ParsedInventoryItem[];
  otherUnknown: ParsedInventoryItem[];
} {
  const belt: ParsedInventoryItem[] = [];
  const otherUnknown: ParsedInventoryItem[] = [];

  for (const item of items) {
    const rawLocation = getRawItemLocation(item);
    if (isRawBeltItem(rawLocation)) {
      belt.push(item);
      continue;
    }

    otherUnknown.push(item);
  }

  return { belt, otherUnknown };
}

function createOccupiedCellSet(
  startX: number,
  startY: number,
  width: number,
  height: number,
): Set<string> {
  const occupiedCells = new Set<string>();

  for (let x = startX; x < startX + width; x += 1) {
    for (let y = startY; y < startY + height; y += 1) {
      occupiedCells.add(`${x},${y}`);
    }
  }

  return occupiedCells;
}

function hasBoardOverlap(
  items: ParsedInventoryItem[],
  startX: number,
  startY: number,
  width: number,
  height: number,
): boolean {
  const droppingCells = createOccupiedCellSet(startX, startY, width, height);

  return items.some((item) => {
    if (!hasGridPosition(item) || !hasGridDimensions(item)) {
      return false;
    }

    const itemGridX = item.gridX as number;
    const itemGridY = item.gridY as number;

    for (let x = itemGridX; x < itemGridX + getGridWidth(item); x += 1) {
      for (let y = itemGridY; y < itemGridY + getGridHeight(item); y += 1) {
        if (droppingCells.has(`${x},${y}`)) {
          return true;
        }
      }
    }

    return false;
  });
}

function InventoryTile({
  item,
  iconLookup,
  selected,
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
            draggable
            data-testid="inventory-item-tile"
            aria-label={t(translations.inventoryBrowser.tileAriaLabel, { itemName: item.itemName })}
            className={cn(
              'relative h-full w-full overflow-hidden rounded-[2px] border bg-card/75 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70',
              selected ? 'border-primary ring-1 ring-primary/70' : 'border-border/70',
              isVaultPresent === true ? 'border-emerald-500/60' : '',
              isVaultPresent === false ? 'border-amber-500/60' : '',
            )}
            onClick={() => onSelect(item)}
            onDragStart={(event) => onDragStart(event, item)}
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

function InventoryGridSection({
  title,
  testId,
  items,
  gridSize,
  showRawOverflowBoard = false,
  rawOverflowTitle,
  iconLookup,
  selectedFingerprint,
  pendingVaultFingerprints,
  vaultItemsByFingerprint,
  onSelect,
  onDragStart,
  onDragEnd,
  snapshotSourceFilePath,
  snapshotSourceFileType,
  sectionLocationContext,
  sectionStashTab,
  draggingVaultItem,
  onDropVaultItem,
}: InventoryGridSectionProps) {
  const { t } = useTranslation();
  const [dragOverCell, setDragOverCell] = useState<{ x: number; y: number } | null>(null);
  const classified = useMemo(() => classifyBoardItems(items, gridSize), [gridSize, items]);
  const overflowLayout = useMemo(() => {
    if (!showRawOverflowBoard) {
      return {
        items: [] as ParsedInventoryItem[],
        itemKeys: new Set<string>(),
        gridSize: undefined,
        origin: undefined,
      };
    }

    return buildOverflowBoardLayout(classified.unplaced, (item) => item.fingerprint);
  }, [classified.unplaced, showRawOverflowBoard]);
  const remainingUnplaced = useMemo(
    () => classified.unplaced.filter(({ item }) => !overflowLayout.itemKeys.has(item.fingerprint)),
    [classified.unplaced, overflowLayout.itemKeys],
  );
  const previewPlacement = useMemo(() => {
    if (!dragOverCell || !draggingVaultItem) {
      return null;
    }

    const { x, y } = dragOverCell;
    const width = draggingVaultItem.gridWidth ?? 1;
    const height = draggingVaultItem.gridHeight ?? 1;

    if (x < 0 || y < 0 || x + width > gridSize.columns || y + height > gridSize.rows) {
      return { x, y, valid: false };
    }

    const hasOverlap = hasBoardOverlap(items, x, y, width, height);

    return { x, y, valid: !hasOverlap };
  }, [dragOverCell, draggingVaultItem, items, gridSize]);

  const handleDropOnBoard = useCallback(
    async (event: DragEvent<HTMLDivElement>, dropX: number, dropY: number) => {
      if (!previewPlacement?.valid) {
        setDragOverCell(null);
        return;
      }

      const vaultItemId =
        event.dataTransfer.getData(VAULT_DRAG_MIME).trim() || draggingVaultItem?.id;
      if (
        !vaultItemId ||
        !snapshotSourceFilePath ||
        !snapshotSourceFileType ||
        !sectionLocationContext
      ) {
        setDragOverCell(null);
        return;
      }

      setDragOverCell(null);
      await onDropVaultItem?.(
        vaultItemId,
        snapshotSourceFilePath,
        snapshotSourceFileType,
        sectionLocationContext,
        sectionStashTab,
        dropX,
        dropY,
      );
    },
    [
      previewPlacement,
      draggingVaultItem,
      snapshotSourceFilePath,
      snapshotSourceFileType,
      sectionLocationContext,
      sectionStashTab,
      onDropVaultItem,
    ],
  );

  return (
    <div className="space-y-2">
      <div className="font-medium text-sm">{title}</div>
      <BoardSurface
        gridSize={gridSize}
        testId={testId}
        onDragOverCell={draggingVaultItem ? (x, y) => setDragOverCell({ x, y }) : undefined}
        onDragLeaveBoard={draggingVaultItem ? () => setDragOverCell(null) : undefined}
        onDropOnBoard={draggingVaultItem ? handleDropOnBoard : undefined}
      >
        {classified.placed.map((item) => {
          const isVaultPresent = getEffectiveVaultPresent(
            item,
            vaultItemsByFingerprint,
            pendingVaultFingerprints,
          );

          return (
            <div
              key={item.fingerprint}
              className="relative z-10"
              style={getItemGridPlacement(item)}
            >
              <InventoryTile
                item={item}
                iconLookup={iconLookup}
                selected={item.fingerprint === selectedFingerprint}
                isVaultPresent={isVaultPresent}
                onSelect={onSelect}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
              />
            </div>
          );
        })}
        {previewPlacement && draggingVaultItem && (
          <div
            className={cn(
              'pointer-events-none z-20 rounded-sm border-2',
              previewPlacement.valid
                ? 'border-emerald-400 bg-emerald-400/20'
                : 'border-red-500 bg-red-500/20',
            )}
            style={{
              gridColumn: `${previewPlacement.x + 1} / span ${draggingVaultItem.gridWidth ?? 1}`,
              gridRow: `${previewPlacement.y + 1} / span ${draggingVaultItem.gridHeight ?? 1}`,
            }}
          >
            {!previewPlacement.valid && (
              <div className="flex h-full w-full items-center justify-center">
                <X className="h-1/2 w-1/2 text-red-500" />
              </div>
            )}
          </div>
        )}
      </BoardSurface>

      {overflowLayout.gridSize && (
        <div className="space-y-2 p-2">
          <div className="font-medium text-xs">
            {rawOverflowTitle ?? t(translations.inventoryBrowser.sections.rawStored)}
          </div>
          <BoardSurface
            gridSize={overflowLayout.gridSize}
            showBaseGrid={false}
            testId={`${testId}-raw-overflow`}
          >
            {overflowLayout.items.map((item) => {
              const isVaultPresent = getEffectiveVaultPresent(
                item,
                vaultItemsByFingerprint,
                pendingVaultFingerprints,
              );

              return (
                <div
                  key={item.fingerprint}
                  className="relative z-10"
                  style={getItemGridPlacement(item, overflowLayout.origin)}
                >
                  <InventoryTile
                    item={item}
                    iconLookup={iconLookup}
                    selected={item.fingerprint === selectedFingerprint}
                    isVaultPresent={isVaultPresent}
                    onSelect={onSelect}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                  />
                </div>
              );
            })}
          </BoardSurface>
        </div>
      )}

      {remainingUnplaced.length > 0 && (
        <div className="space-y-2">
          <div className="text-muted-foreground text-xs">
            {t(translations.inventoryBrowser.unplaced)}
          </div>
          <div className="flex flex-wrap gap-2" data-testid={`${testId}-unplaced`}>
            {remainingUnplaced.map(({ item, reason }) => {
              const isVaultPresent = getEffectiveVaultPresent(
                item,
                vaultItemsByFingerprint,
                pendingVaultFingerprints,
              );

              return (
                <div key={`${item.fingerprint}-${reason}`} className="h-16 w-16">
                  <InventoryTile
                    item={item}
                    iconLookup={iconLookup}
                    selected={item.fingerprint === selectedFingerprint}
                    isVaultPresent={isVaultPresent}
                    unplacedReason={reason}
                    onSelect={onSelect}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function EquipmentSection({
  items,
  iconLookup,
  selectedFingerprint,
  pendingVaultFingerprints,
  vaultItemsByFingerprint,
  weaponSet,
  onWeaponSetChange,
  onSelect,
  onDragStart,
  onDragEnd,
}: EquipmentSectionProps) {
  const { t } = useTranslation();
  const equippedMapping = useMemo(
    () => buildEquippedSlotMapForSet(items, weaponSet),
    [items, weaponSet],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium text-sm">
          {t(translations.inventoryBrowser.sections.equipped)}
        </div>
        <div className="inline-flex overflow-hidden rounded border border-border/70">
          {EQUIPPED_WEAPON_SET_ORDER.map((setKey) => (
            <button
              key={setKey}
              type="button"
              className={cn(
                'min-w-10 px-2 py-1 text-xs',
                weaponSet === setKey ? 'bg-primary text-primary-foreground' : 'bg-muted/20',
              )}
              aria-label={t(translations.inventoryBrowser.weaponSets.ariaLabel, {
                set: t(translations.inventoryBrowser.weaponSets[setKey]),
              })}
              onClick={() => onWeaponSetChange(setKey)}
            >
              {t(translations.inventoryBrowser.weaponSets[setKey])}
            </button>
          ))}
        </div>
      </div>

      <BoardSurface gridSize={EQUIPPED_BOARD_SIZE} testId="equipped-board" showBaseGrid={false}>
        {PAPER_DOLL_SLOT_ORDER.map((slotKey) => {
          const layout = EQUIPPED_SLOT_LAYOUT[slotKey];
          const slotItem = equippedMapping.slotItems.get(slotKey);

          return (
            <div
              key={slotKey}
              data-testid="equipped-slot-frame"
              className={cn(
                'relative z-[1] rounded border border-border/80 bg-black/10',
                slotItem ? 'border-border/80' : '',
              )}
              style={{
                gridColumn: `${layout.column} / span ${layout.width}`,
                gridRow: `${layout.row} / span ${layout.height}`,
              }}
            >
              {slotItem ? (
                <div className="absolute inset-[1px] z-10">
                  <InventoryTile
                    item={slotItem}
                    iconLookup={iconLookup}
                    selected={slotItem.fingerprint === selectedFingerprint}
                    isVaultPresent={getEffectiveVaultPresent(
                      slotItem,
                      vaultItemsByFingerprint,
                      pendingVaultFingerprints,
                    )}
                    onSelect={onSelect}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                  />
                </div>
              ) : (
                <div className="pointer-events-none absolute inset-[20%] rounded border border-border/40" />
              )}
            </div>
          );
        })}
      </BoardSurface>
    </div>
  );
}

export function CharacterInventoryBrowser() {
  const { t } = useTranslation();
  const grailItems = useGrailStore((state) => state.items);
  const [isLoading, setIsLoading] = useState(true);
  const [isVaulting, setIsVaulting] = useState(false);
  const [isUnvaulting, setIsUnvaulting] = useState(false);
  const [selectedVaultItemId, setSelectedVaultItemId] = useState<string | undefined>(undefined);
  const [searchText, setSearchText] = useState('');
  const [characterId, setCharacterId] = useState('all');
  const [locationContext, setLocationContext] = useState<'all' | VaultLocationContext>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [dragOverVaultDropzone, setDragOverVaultDropzone] = useState(false);
  const [draggingVaultItem, setDraggingVaultItem] = useState<VaultItem | null>(null);
  const [pendingVaultFingerprints, setPendingVaultFingerprints] = useState<Set<string>>(new Set());
  const [inventoryResponse, setInventoryResponse] = useState<InventorySearchAllResponse | null>(
    null,
  );
  const [selectedItemFingerprint, setSelectedItemFingerprint] = useState<string | undefined>(
    undefined,
  );
  const [equipmentWeaponSet, setEquipmentWeaponSet] = useState<EquippedWeaponSet>('i');
  const draggingFingerprintRef = useRef<string | undefined>(undefined);
  const draggingVaultInputRef = useRef<VaultItemUpsertInput | undefined>(undefined);
  const latestSearchRequestRef = useRef(0);
  const spriteIconLookup = useMemo(() => createSpriteIconLookupIndex(grailItems), [grailItems]);

  const loadInventorySearch = useCallback(async (): Promise<void> => {
    const requestId = latestSearchRequestRef.current + 1;
    latestSearchRequestRef.current = requestId;
    const filter = buildInventorySearchFilter(searchText, characterId, locationContext);

    setIsLoading(true);
    try {
      const response = await loadInventorySearchResponse(filter);
      if (requestId === latestSearchRequestRef.current) {
        setInventoryResponse(response);
      }
    } catch (error) {
      if (requestId === latestSearchRequestRef.current) {
        console.error('Failed to load inventory search results', error);
      }
    } finally {
      if (requestId === latestSearchRequestRef.current) {
        setIsLoading(false);
      }
    }
  }, [characterId, locationContext, searchText]);

  useEffect(() => {
    void loadInventorySearch();
  }, [loadInventorySearch]);

  const vaultItemsByFingerprint = useMemo(() => {
    const map = new Map<string, VaultItem>();

    for (const item of inventoryResponse?.vault.items ?? []) {
      map.set(item.fingerprint, item);
    }

    return map;
  }, [inventoryResponse?.vault.items]);

  const snapshots = useMemo(() => {
    const sourceSnapshots = inventoryResponse?.inventory.snapshots ?? [];

    return sourceSnapshots
      .map((snapshot) => ({
        ...snapshot,
        items: snapshot.items.filter((item) => {
          if (item.isSocketedItem) {
            return false;
          }

          if (
            getEffectiveVaultPresent(item, vaultItemsByFingerprint, pendingVaultFingerprints) ===
            true
          ) {
            return false;
          }

          const matchesType = typeFilter === 'all' || getTypeValue(item.type) === typeFilter;
          return matchesType;
        }),
      }))
      .filter((snapshot) => snapshot.items.length > 0);
  }, [
    inventoryResponse?.inventory.snapshots,
    typeFilter,
    vaultItemsByFingerprint,
    pendingVaultFingerprints,
  ]);

  const visibleItems = useMemo(() => snapshots.flatMap((snapshot) => snapshot.items), [snapshots]);

  useEffect(() => {
    setSelectedItemFingerprint((current) => {
      if (current && visibleItems.some((item) => item.fingerprint === current)) {
        return current;
      }

      return visibleItems[0]?.fingerprint;
    });
  }, [visibleItems]);

  const selectedItem = useMemo(
    () => visibleItems.find((item) => item.fingerprint === selectedItemFingerprint),
    [selectedItemFingerprint, visibleItems],
  );

  const selectedItemVaultPresent = selectedItem
    ? getEffectiveVaultPresent(selectedItem, vaultItemsByFingerprint, pendingVaultFingerprints)
    : undefined;

  const vaultItems = useMemo(
    () => inventoryResponse?.vault.items ?? [],
    [inventoryResponse?.vault.items],
  );

  const selectedVaultItem = useMemo(
    () => vaultItems.find((item) => item.id === selectedVaultItemId),
    [selectedVaultItemId, vaultItems],
  );

  const reloadInventoryAfterSaveWrite = useCallback(async (): Promise<void> => {
    try {
      await window.electronAPI.saveFile.refreshSaveFiles();
    } catch (error) {
      console.warn('Failed to refresh save files after write', error);
    }

    await loadInventorySearch();
  }, [loadInventorySearch]);

  const handleUnvault = useCallback(async (): Promise<void> => {
    if (!selectedVaultItemId || isUnvaulting) {
      return;
    }

    setIsUnvaulting(true);
    try {
      await window.electronAPI.vault.unvaultItem(selectedVaultItemId);
      setSelectedVaultItemId(undefined);
      await reloadInventoryAfterSaveWrite();
    } catch (error) {
      console.error('Failed to unvault item', error);
    } finally {
      setIsUnvaulting(false);
    }
  }, [selectedVaultItemId, isUnvaulting, reloadInventoryAfterSaveWrite]);

  const characterOptions = useMemo(() => {
    const options = new Map<string, string>();

    for (const snapshot of inventoryResponse?.inventory.snapshots ?? []) {
      const key = snapshot.characterId ?? `name:${snapshot.characterName}`;
      options.set(key, snapshot.characterName);
    }

    return [...options.entries()];
  }, [inventoryResponse?.inventory.snapshots]);

  const vaultItem = useCallback(
    async (itemInput: VaultItemUpsertInput): Promise<void> => {
      if (isVaulting) {
        return;
      }

      setIsVaulting(true);
      setPendingVaultFingerprints((previous) => {
        const next = new Set(previous);
        next.add(itemInput.fingerprint);
        return next;
      });

      try {
        await window.electronAPI.vault.addItem(itemInput);
        await loadInventorySearch();
      } catch (error) {
        console.error('Failed to vault inventory item', error);
      } finally {
        setPendingVaultFingerprints((previous) => {
          if (!previous.has(itemInput.fingerprint)) {
            return previous;
          }

          const next = new Set(previous);
          next.delete(itemInput.fingerprint);
          return next;
        });
        setIsVaulting(false);
      }
    },
    [isVaulting, loadInventorySearch],
  );

  const handleCardDragStart = (event: DragEvent<HTMLButtonElement>, item: ParsedInventoryItem) => {
    draggingFingerprintRef.current = item.fingerprint;
    draggingVaultInputRef.current = toVaultUpsertInput(item);
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(INVENTORY_DRAG_MIME, item.fingerprint);
    event.dataTransfer.setData('text/plain', item.fingerprint);
  };

  const handleCardDragEnd = () => {
    draggingFingerprintRef.current = undefined;
    draggingVaultInputRef.current = undefined;
  };

  const handleVaultItemDragStart = useCallback((item: VaultItem) => {
    setDraggingVaultItem(item);
  }, []);

  const handleVaultItemDragEnd = useCallback(() => {
    setDraggingVaultItem(null);
  }, []);

  const handleDropVaultItemOnSection = useCallback(
    async (
      vaultItemId: string,
      targetFilePath: string,
      targetFileType: VaultSourceFileType,
      targetLocationContext: VaultLocationContext,
      targetStashTab: number | undefined,
      targetGridX: number,
      targetGridY: number,
    ) => {
      try {
        await window.electronAPI.vault.unvaultItem(vaultItemId, {
          targetFilePath,
          targetFileType,
          targetLocationContext,
          targetStashTab,
          targetGridX,
          targetGridY,
        });
        setDraggingVaultItem(null);
        await reloadInventoryAfterSaveWrite();
      } catch (error) {
        console.error('Failed to unvault item to target', error);
      }
    },
    [reloadInventoryAfterSaveWrite],
  );

  const handleVaultDrop = async (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragOverVaultDropzone(false);

    const fingerprint =
      event.dataTransfer.getData(INVENTORY_DRAG_MIME) || event.dataTransfer.getData('text/plain');
    const normalizedFingerprint = fingerprint.trim() || draggingFingerprintRef.current;
    const droppedItemInput = normalizedFingerprint
      ? visibleItems.find((item) => item.fingerprint === normalizedFingerprint)
      : undefined;
    const itemInput = droppedItemInput
      ? toVaultUpsertInput(droppedItemInput)
      : draggingVaultInputRef.current;

    if (!itemInput) {
      return;
    }

    await vaultItem(itemInput);
    draggingFingerprintRef.current = undefined;
    draggingVaultInputRef.current = undefined;
  };

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="flex w-full flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t(translations.inventoryBrowser.title)}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <Input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={t(translations.inventoryBrowser.searchPlaceholder)}
              aria-label={t(translations.common.search)}
              className="md:col-span-2"
            />
            <Select value={characterId} onValueChange={(value) => setCharacterId(value ?? 'all')}>
              <SelectTrigger>
                <SelectValue placeholder={t(translations.inventoryBrowser.character)} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t(translations.inventoryBrowser.allCharacters)}
                </SelectItem>
                {characterOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={locationContext}
              onValueChange={(value) =>
                setLocationContext((value as 'all' | VaultLocationContext | null) ?? 'all')
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t(translations.inventoryBrowser.locationFilter)} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t(translations.inventoryBrowser.allLocations)}</SelectItem>
                <SelectItem value="equipped">
                  {t(translations.inventoryBrowser.location.equipped)}
                </SelectItem>
                <SelectItem value="inventory">
                  {t(translations.inventoryBrowser.location.inventory)}
                </SelectItem>
                <SelectItem value="stash">
                  {t(translations.inventoryBrowser.location.stash)}
                </SelectItem>
                <SelectItem value="mercenary">
                  {t(translations.inventoryBrowser.location.mercenary)}
                </SelectItem>
                <SelectItem value="corpse">
                  {t(translations.inventoryBrowser.location.corpse)}
                </SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={typeFilter}
              onValueChange={(value) => setTypeFilter((value as TypeFilter | null) ?? 'all')}
            >
              <SelectTrigger>
                <SelectValue placeholder={t(translations.inventoryBrowser.type)} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t(translations.inventoryBrowser.allTypes)}</SelectItem>
                <SelectItem value="unique">
                  {t(translations.inventoryBrowser.typeOptions.unique)}
                </SelectItem>
                <SelectItem value="set">
                  {t(translations.inventoryBrowser.typeOptions.set)}
                </SelectItem>
                <SelectItem value="runeword">
                  {t(translations.inventoryBrowser.typeOptions.runeword)}
                </SelectItem>
                <SelectItem value="rune">
                  {t(translations.inventoryBrowser.typeOptions.rune)}
                </SelectItem>
                <SelectItem value="other">
                  {t(translations.inventoryBrowser.typeOptions.other)}
                </SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {vaultItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t(translations.inventoryBrowser.vaultedItems)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {vaultItems.map((item) => (
                  <VaultedItemTile
                    key={item.id}
                    item={item}
                    iconLookup={spriteIconLookup}
                    selected={item.id === selectedVaultItemId}
                    onSelect={(selected) => setSelectedVaultItemId(selected.id)}
                    onDragStart={handleVaultItemDragStart}
                    onDragEnd={handleVaultItemDragEnd}
                  />
                ))}
              </div>
              {selectedVaultItem && (
                <div className="border-t pt-3">
                  <div className="mb-2 font-medium text-sm">{selectedVaultItem.itemName}</div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={isUnvaulting}
                    onClick={() => {
                      void handleUnvault();
                    }}
                  >
                    {t(translations.vault.unvaultAction)}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <button
          type="button"
          className={[
            'rounded-lg border border-dashed p-3 text-center text-sm transition-colors',
            dragOverVaultDropzone
              ? 'border-primary bg-primary/10'
              : 'border-border text-muted-foreground',
          ].join(' ')}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOverVaultDropzone(true);
          }}
          onDragLeave={() => setDragOverVaultDropzone(false)}
          onDrop={(event) => {
            void handleVaultDrop(event);
          }}
        >
          {t(translations.inventoryBrowser.dropToVault)}
        </button>

        {!isLoading && snapshots.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              {t(translations.inventoryBrowser.empty)}
            </CardContent>
          </Card>
        )}

        {snapshots.map((snapshot) => {
          const grouped = groupSpatialItems(snapshot.items);
          const stashTabs = getSortedStashTabs(grouped.stashByTab);
          const stashTabsToRender = stashTabs.length > 0 ? stashTabs : [{ stashTab: 0, items: [] }];
          const { belt: beltItems, otherUnknown } = partitionUnknownItems(grouped.unknown);

          return (
            <Card key={snapshot.snapshotId}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">
                    {t(translations.inventoryBrowser.groupHeader, {
                      characterName: snapshot.characterName,
                      sourceFileType: formatSourceFileTypeLabel(snapshot.sourceFileType, t),
                    })}
                  </CardTitle>
                  <Badge variant="outline">
                    {t(translations.inventoryBrowser.itemsCount, { count: snapshot.items.length })}
                  </Badge>
                </div>
                <div className="text-muted-foreground text-sm">
                  {t(translations.inventoryBrowser.capturedAt, {
                    date: snapshot.capturedAt.toLocaleString(),
                  })}
                </div>
              </CardHeader>
              <CardContent className="columns-1 gap-4 sm:columns-[28rem] [&>*]:mb-4 [&>*]:break-inside-avoid">
                {(locationContext === 'all' || locationContext === 'equipped') && (
                  <EquipmentSection
                    items={grouped.equipped}
                    iconLookup={spriteIconLookup}
                    selectedFingerprint={selectedItemFingerprint}
                    pendingVaultFingerprints={pendingVaultFingerprints}
                    vaultItemsByFingerprint={vaultItemsByFingerprint}
                    weaponSet={equipmentWeaponSet}
                    onWeaponSetChange={setEquipmentWeaponSet}
                    onSelect={(item) => setSelectedItemFingerprint(item.fingerprint)}
                    onDragStart={handleCardDragStart}
                    onDragEnd={handleCardDragEnd}
                  />
                )}

                {(locationContext === 'all' || locationContext === 'inventory') && (
                  <InventoryGridSection
                    title={t(translations.inventoryBrowser.sections.inventory)}
                    testId={`inventory-board-${snapshot.snapshotId}`}
                    items={grouped.inventory}
                    gridSize={DEFAULT_INVENTORY_GRID_SIZE}
                    showRawOverflowBoard
                    rawOverflowTitle={t(translations.inventoryBrowser.sections.expandedInventory)}
                    iconLookup={spriteIconLookup}
                    selectedFingerprint={selectedItemFingerprint}
                    pendingVaultFingerprints={pendingVaultFingerprints}
                    vaultItemsByFingerprint={vaultItemsByFingerprint}
                    onSelect={(item) => setSelectedItemFingerprint(item.fingerprint)}
                    onDragStart={handleCardDragStart}
                    onDragEnd={handleCardDragEnd}
                    snapshotSourceFilePath={snapshot.sourceFilePath}
                    snapshotSourceFileType={snapshot.sourceFileType}
                    sectionLocationContext="inventory"
                    draggingVaultItem={draggingVaultItem}
                    onDropVaultItem={handleDropVaultItemOnSection}
                  />
                )}

                {(locationContext === 'all' || locationContext === 'stash') &&
                  stashTabsToRender.map(({ stashTab, items }) => (
                    <InventoryGridSection
                      key={`${snapshot.snapshotId}-stash-${stashTab}`}
                      title={t(translations.inventoryBrowser.sections.stashTab, {
                        tab: stashTab + 1,
                      })}
                      testId={`stash-board-${snapshot.snapshotId}-${stashTab}`}
                      items={items}
                      gridSize={DEFAULT_STASH_GRID_SIZE}
                      showRawOverflowBoard
                      rawOverflowTitle={t(translations.inventoryBrowser.sections.expandedStash)}
                      iconLookup={spriteIconLookup}
                      selectedFingerprint={selectedItemFingerprint}
                      pendingVaultFingerprints={pendingVaultFingerprints}
                      vaultItemsByFingerprint={vaultItemsByFingerprint}
                      onSelect={(item) => setSelectedItemFingerprint(item.fingerprint)}
                      onDragStart={handleCardDragStart}
                      onDragEnd={handleCardDragEnd}
                      snapshotSourceFilePath={snapshot.sourceFilePath}
                      snapshotSourceFileType={snapshot.sourceFileType}
                      sectionLocationContext="stash"
                      sectionStashTab={stashTab}
                      draggingVaultItem={draggingVaultItem}
                      onDropVaultItem={handleDropVaultItemOnSection}
                    />
                  ))}

                {locationContext === 'all' && beltItems.length > 0 && (
                  <InventoryGridSection
                    title={t(translations.inventoryBrowser.sections.belt)}
                    testId={`belt-board-${snapshot.snapshotId}`}
                    items={beltItems}
                    gridSize={DEFAULT_BELT_GRID_SIZE}
                    iconLookup={spriteIconLookup}
                    selectedFingerprint={selectedItemFingerprint}
                    pendingVaultFingerprints={pendingVaultFingerprints}
                    vaultItemsByFingerprint={vaultItemsByFingerprint}
                    onSelect={(item) => setSelectedItemFingerprint(item.fingerprint)}
                    onDragStart={handleCardDragStart}
                    onDragEnd={handleCardDragEnd}
                  />
                )}

                {(locationContext === 'all' || locationContext === 'mercenary') && (
                  <InventoryGridSection
                    title={t(translations.inventoryBrowser.sections.mercenary)}
                    testId={`mercenary-board-${snapshot.snapshotId}`}
                    items={grouped.mercenary}
                    gridSize={DEFAULT_INVENTORY_GRID_SIZE}
                    iconLookup={spriteIconLookup}
                    selectedFingerprint={selectedItemFingerprint}
                    pendingVaultFingerprints={pendingVaultFingerprints}
                    vaultItemsByFingerprint={vaultItemsByFingerprint}
                    onSelect={(item) => setSelectedItemFingerprint(item.fingerprint)}
                    onDragStart={handleCardDragStart}
                    onDragEnd={handleCardDragEnd}
                  />
                )}

                {(locationContext === 'all' || locationContext === 'corpse') && (
                  <InventoryGridSection
                    title={t(translations.inventoryBrowser.sections.corpse)}
                    testId={`corpse-board-${snapshot.snapshotId}`}
                    items={grouped.corpse}
                    gridSize={DEFAULT_INVENTORY_GRID_SIZE}
                    iconLookup={spriteIconLookup}
                    selectedFingerprint={selectedItemFingerprint}
                    pendingVaultFingerprints={pendingVaultFingerprints}
                    vaultItemsByFingerprint={vaultItemsByFingerprint}
                    onSelect={(item) => setSelectedItemFingerprint(item.fingerprint)}
                    onDragStart={handleCardDragStart}
                    onDragEnd={handleCardDragEnd}
                  />
                )}

                {otherUnknown.length > 0 && (
                  <div className="space-y-2 rounded-md border border-border/60 bg-muted/10 p-3">
                    <div className="flex items-center gap-2 font-medium text-sm">
                      <Sparkles className="h-4 w-4" />
                      {t(translations.inventoryBrowser.sections.unknown)}
                    </div>
                    <div
                      className="flex flex-wrap gap-2"
                      data-testid={`unknown-${snapshot.snapshotId}`}
                    >
                      {otherUnknown.map((item) => (
                        <div key={item.fingerprint} className="h-16 w-16">
                          <InventoryTile
                            item={item}
                            iconLookup={spriteIconLookup}
                            selected={item.fingerprint === selectedItemFingerprint}
                            isVaultPresent={getEffectiveVaultPresent(
                              item,
                              vaultItemsByFingerprint,
                              pendingVaultFingerprints,
                            )}
                            onSelect={(selected) =>
                              setSelectedItemFingerprint(selected.fingerprint)
                            }
                            onDragStart={handleCardDragStart}
                            onDragEnd={handleCardDragEnd}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t(translations.inventoryBrowser.selectedItemTitle)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedItem ? (
              <div className="text-muted-foreground text-sm">
                {t(translations.inventoryBrowser.noSelectedItem)}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="font-medium">{selectedItem.itemName}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge variant="outline" className="capitalize">
                      {selectedItem.quality}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {formatLocation(selectedItem, t)}
                    </Badge>
                    <Badge variant="outline">
                      {formatSourceFileTypeLabel(selectedItem.sourceFileType, t)}
                    </Badge>
                    <Badge
                      variant={
                        selectedItemVaultPresent === true
                          ? 'default'
                          : selectedItemVaultPresent === false
                            ? 'secondary'
                            : 'outline'
                      }
                    >
                      {getPresenceLabel(selectedItemVaultPresent, t)}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">
                      {t(translations.inventoryBrowser.details.coordinatesLabel)}
                    </span>{' '}
                    {getCoordinatesLabel(selectedItem, t)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      {t(translations.inventoryBrowser.details.dimensionsLabel)}
                    </span>{' '}
                    {getDimensionsLabel(selectedItem, t)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      {t(translations.inventoryBrowser.details.slotLabel)}
                    </span>{' '}
                    {getSlotLabel(selectedItem, t)}
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      {t(translations.inventoryBrowser.details.characterLabel)}
                    </span>{' '}
                    {selectedItem.characterName}
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  aria-label={t(translations.inventoryBrowser.vaultAction)}
                  disabled={isVaulting || selectedItemVaultPresent === true}
                  onClick={() => {
                    void vaultItem(toVaultUpsertInput(selectedItem));
                  }}
                >
                  <PackagePlus className="mr-1 h-4 w-4" />
                  {t(translations.inventoryBrowser.vaultAction)}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
