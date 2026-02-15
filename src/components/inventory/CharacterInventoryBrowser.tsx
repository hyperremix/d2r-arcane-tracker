import type {
  CharacterInventorySnapshot,
  ParsedInventoryItem,
  VaultItem,
  VaultItemFilter,
  VaultItemUpsertInput,
  VaultLocationContext,
} from 'electron/types/grail';
import { PackagePlus, Sparkles } from 'lucide-react';
import { type DragEvent, useCallback, useEffect, useMemo, useState } from 'react';
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

type PresenceFilter = 'all' | 'present' | 'missing';
type TypeFilter = 'all' | 'unique' | 'set' | 'runeword' | 'rune' | 'other';
type EquipmentUnplacedReason = UnplacedReason | 'unknownEquippedSlot';

type DragInventoryPayload = {
  type: 'inventory-item';
  item: ParsedInventoryItem;
};

interface InventoryTileProps {
  item: ParsedInventoryItem;
  iconLookup: SpriteIconLookupIndex;
  selected: boolean;
  isVaultPresent?: boolean;
  unplacedReason?: EquipmentUnplacedReason;
  onSelect: (item: ParsedInventoryItem) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>, item: ParsedInventoryItem) => void;
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
  optimisticPresent: Map<string, boolean>;
  vaultItemsByFingerprint: Map<string, VaultItem>;
  onSelect: (item: ParsedInventoryItem) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>, item: ParsedInventoryItem) => void;
}

interface EquipmentSectionProps {
  items: ParsedInventoryItem[];
  iconLookup: SpriteIconLookupIndex;
  selectedFingerprint?: string;
  optimisticPresent: Map<string, boolean>;
  vaultItemsByFingerprint: Map<string, VaultItem>;
  weaponSet: EquippedWeaponSet;
  onWeaponSetChange: (weaponSet: EquippedWeaponSet) => void;
  onSelect: (item: ParsedInventoryItem) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>, item: ParsedInventoryItem) => void;
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

function matchesPresenceFilter(
  presence: PresenceFilter,
  isVaultPresent: boolean | undefined,
): boolean {
  if (presence === 'present') {
    return isVaultPresent ?? true;
  }

  if (presence === 'missing') {
    return isVaultPresent === false;
  }

  return true;
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

function getEffectiveVaultPresent(
  item: ParsedInventoryItem,
  vaultItemsByFingerprint: Map<string, VaultItem>,
  optimisticPresent: Map<string, boolean>,
): boolean | undefined {
  const optimisticValue = optimisticPresent.get(item.fingerprint);
  if (optimisticValue !== undefined) {
    return optimisticValue;
  }

  return vaultItemsByFingerprint.get(item.fingerprint)?.isPresentInLatestScan;
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

function InventoryTile({
  item,
  iconLookup,
  selected,
  isVaultPresent,
  unplacedReason,
  onSelect,
  onDragStart,
}: InventoryTileProps) {
  const { t } = useTranslation();
  const gameTooltipModel = useMemo(
    () =>
      buildGameItemTooltipModel({
        rawItemJson: item.rawItemJson,
        fallbackName: item.itemName,
        quality: item.quality,
        type: item.type,
        t,
      }),
    [item.itemName, item.quality, item.rawItemJson, item.type, t],
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
          />
        }
      >
        <img
          src={iconUrl}
          alt={item.itemName}
          className="pointer-events-none h-full w-full object-contain"
          loading="lazy"
        />
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
                sourceFileType: item.sourceFileType.toUpperCase(),
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
            <div>
              <span className="text-muted-foreground">
                {t(translations.inventoryBrowser.tooltip.presenceLabel)}
              </span>{' '}
              {getPresenceLabel(isVaultPresent, t)}
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
  optimisticPresent,
  vaultItemsByFingerprint,
  onSelect,
  onDragStart,
}: InventoryGridSectionProps) {
  const { t } = useTranslation();
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

  return (
    <div className="space-y-2">
      <div className="font-medium text-sm">{title}</div>
      <BoardSurface gridSize={gridSize} testId={testId}>
        {classified.placed.map((item) => {
          const isVaultPresent = getEffectiveVaultPresent(
            item,
            vaultItemsByFingerprint,
            optimisticPresent,
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
              />
            </div>
          );
        })}
      </BoardSurface>

      {overflowLayout.gridSize && (
        <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
          <div className="font-medium text-amber-100/90 text-xs">
            {rawOverflowTitle ?? t(translations.inventoryBrowser.sections.rawStored)}
          </div>
          <BoardSurface
            className="border-amber-500/40 bg-black/30"
            gridSize={overflowLayout.gridSize}
            showBaseGrid={false}
            testId={`${testId}-raw-overflow`}
          >
            {overflowLayout.items.map((item) => {
              const isVaultPresent = getEffectiveVaultPresent(
                item,
                vaultItemsByFingerprint,
                optimisticPresent,
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
                optimisticPresent,
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
  optimisticPresent,
  vaultItemsByFingerprint,
  weaponSet,
  onWeaponSetChange,
  onSelect,
  onDragStart,
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
                      optimisticPresent,
                    )}
                    onSelect={onSelect}
                    onDragStart={onDragStart}
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
  const [searchText, setSearchText] = useState('');
  const [characterId, setCharacterId] = useState('all');
  const [locationContext, setLocationContext] = useState<'all' | VaultLocationContext>('all');
  const [presence, setPresence] = useState<PresenceFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [dragOverVaultDropzone, setDragOverVaultDropzone] = useState(false);
  const [optimisticPresent, setOptimisticPresent] = useState<Map<string, boolean>>(new Map());
  const [inventoryResponse, setInventoryResponse] = useState<InventorySearchAllResponse | null>(
    null,
  );
  const [selectedItemFingerprint, setSelectedItemFingerprint] = useState<string | undefined>(
    undefined,
  );
  const [equipmentWeaponSet, setEquipmentWeaponSet] = useState<EquippedWeaponSet>('i');
  const spriteIconLookup = useMemo(() => createSpriteIconLookupIndex(grailItems), [grailItems]);

  const loadInventorySearch = useCallback(async (): Promise<void> => {
    const resolvedCharacterFilter =
      characterId === 'all'
        ? undefined
        : characterId.startsWith('name:')
          ? characterId.slice('name:'.length)
          : characterId;

    const filter: VaultItemFilter = {
      text: searchText.trim() || undefined,
      characterId: resolvedCharacterFilter,
      locationContext: locationContext === 'all' ? undefined : locationContext,
      includeSocketed: false,
      presentState: 'all',
      page: 1,
      pageSize: 200,
    };

    setIsLoading(true);
    const response = await window.electronAPI.inventory.searchAll(filter);
    setInventoryResponse(response);
    setIsLoading(false);
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

          const matchesType = typeFilter === 'all' || getTypeValue(item.type) === typeFilter;
          if (!matchesType) {
            return false;
          }

          const isVaultPresent = getEffectiveVaultPresent(
            item,
            vaultItemsByFingerprint,
            optimisticPresent,
          );
          return matchesPresenceFilter(presence, isVaultPresent);
        }),
      }))
      .filter((snapshot) => snapshot.items.length > 0);
  }, [
    inventoryResponse?.inventory.snapshots,
    optimisticPresent,
    presence,
    typeFilter,
    vaultItemsByFingerprint,
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
    ? getEffectiveVaultPresent(selectedItem, vaultItemsByFingerprint, optimisticPresent)
    : undefined;

  const characterOptions = useMemo(() => {
    const options = new Map<string, string>();

    for (const snapshot of inventoryResponse?.inventory.snapshots ?? []) {
      const key = snapshot.characterId ?? `name:${snapshot.characterName}`;
      options.set(key, snapshot.characterName);
    }

    return [...options.entries()];
  }, [inventoryResponse?.inventory.snapshots]);

  const vaultItem = useCallback(
    async (item: ParsedInventoryItem): Promise<void> => {
      if (isVaulting) {
        return;
      }

      setIsVaulting(true);
      const previous = new Map(optimisticPresent);
      setOptimisticPresent((prev) => new Map(prev).set(item.fingerprint, true));

      try {
        await window.electronAPI.vault.addItem(toVaultUpsertInput(item));
        await loadInventorySearch();
      } catch {
        setOptimisticPresent(previous);
      } finally {
        setIsVaulting(false);
      }
    },
    [isVaulting, loadInventorySearch, optimisticPresent],
  );

  const handleCardDragStart = (event: DragEvent<HTMLButtonElement>, item: ParsedInventoryItem) => {
    const payload: DragInventoryPayload = {
      type: 'inventory-item',
      item,
    };

    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/json', JSON.stringify(payload));
  };

  const handleVaultDrop = async (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragOverVaultDropzone(false);

    const rawPayload = event.dataTransfer.getData('application/json');
    if (!rawPayload) {
      return;
    }

    const payload = JSON.parse(rawPayload) as DragInventoryPayload;
    if (payload.type !== 'inventory-item') {
      return;
    }

    await vaultItem(payload.item);
  };

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
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
            <div className="grid grid-cols-2 gap-2">
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
              <Select
                value={presence}
                onValueChange={(value) => setPresence((value as PresenceFilter | null) ?? 'all')}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t(translations.inventoryBrowser.presence)} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t(translations.inventoryBrowser.presenceOptions.all)}
                  </SelectItem>
                  <SelectItem value="present">
                    {t(translations.inventoryBrowser.presenceOptions.present)}
                  </SelectItem>
                  <SelectItem value="missing">
                    {t(translations.inventoryBrowser.presenceOptions.missing)}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

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
                      sourceFileType: snapshot.sourceFileType.toUpperCase(),
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
              <CardContent className="space-y-4">
                {(locationContext === 'all' || locationContext === 'equipped') && (
                  <EquipmentSection
                    items={grouped.equipped}
                    iconLookup={spriteIconLookup}
                    selectedFingerprint={selectedItemFingerprint}
                    optimisticPresent={optimisticPresent}
                    vaultItemsByFingerprint={vaultItemsByFingerprint}
                    weaponSet={equipmentWeaponSet}
                    onWeaponSetChange={setEquipmentWeaponSet}
                    onSelect={(item) => setSelectedItemFingerprint(item.fingerprint)}
                    onDragStart={handleCardDragStart}
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
                    optimisticPresent={optimisticPresent}
                    vaultItemsByFingerprint={vaultItemsByFingerprint}
                    onSelect={(item) => setSelectedItemFingerprint(item.fingerprint)}
                    onDragStart={handleCardDragStart}
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
                      optimisticPresent={optimisticPresent}
                      vaultItemsByFingerprint={vaultItemsByFingerprint}
                      onSelect={(item) => setSelectedItemFingerprint(item.fingerprint)}
                      onDragStart={handleCardDragStart}
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
                    optimisticPresent={optimisticPresent}
                    vaultItemsByFingerprint={vaultItemsByFingerprint}
                    onSelect={(item) => setSelectedItemFingerprint(item.fingerprint)}
                    onDragStart={handleCardDragStart}
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
                    optimisticPresent={optimisticPresent}
                    vaultItemsByFingerprint={vaultItemsByFingerprint}
                    onSelect={(item) => setSelectedItemFingerprint(item.fingerprint)}
                    onDragStart={handleCardDragStart}
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
                    optimisticPresent={optimisticPresent}
                    vaultItemsByFingerprint={vaultItemsByFingerprint}
                    onSelect={(item) => setSelectedItemFingerprint(item.fingerprint)}
                    onDragStart={handleCardDragStart}
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
                              optimisticPresent,
                            )}
                            onSelect={(selected) =>
                              setSelectedItemFingerprint(selected.fingerprint)
                            }
                            onDragStart={handleCardDragStart}
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
                    <Badge variant="outline">{selectedItem.sourceFileType.toUpperCase()}</Badge>
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
                    void vaultItem(selectedItem);
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
