import type {
  VaultCategory,
  VaultCategoryCreateInput,
  VaultItem,
  VaultItemFilter,
  VaultLocationContext,
} from 'electron/types/grail';
import { PackageMinus, Sparkles, Tag, TagIcon, Trash2 } from 'lucide-react';
import {
  type Dispatch,
  type DragEvent,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
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

type PresenceFilter = 'all' | 'present' | 'missing';
type EquipmentUnplacedReason = UnplacedReason | 'unknownEquippedSlot';

type DragVaultPayload = {
  type: 'vault-item';
  itemId: string;
};

interface VaultTileProps {
  item: VaultItem;
  iconLookup: SpriteIconLookupIndex;
  selected: boolean;
  unplacedReason?: EquipmentUnplacedReason;
  onSelect: (item: VaultItem) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>, item: VaultItem) => void;
}

interface VaultGridSectionProps {
  title: string;
  testId: string;
  items: VaultItem[];
  gridSize: GridSize;
  showRawOverflowBoard?: boolean;
  rawOverflowTitle?: string;
  iconLookup: SpriteIconLookupIndex;
  selectedItemId?: string;
  onSelect: (item: VaultItem) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>, item: VaultItem) => void;
}

interface VaultEquipmentSectionProps {
  items: VaultItem[];
  iconLookup: SpriteIconLookupIndex;
  selectedItemId?: string;
  weaponSet: EquippedWeaponSet;
  onWeaponSetChange: (weaponSet: EquippedWeaponSet) => void;
  onSelect: (item: VaultItem) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>, item: VaultItem) => void;
}

function formatLocation(
  item: VaultItem,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const rawLocation = getRawItemLocation(item);

  if (item.locationContext === 'unknown' && isRawBeltItem(rawLocation)) {
    return t(translations.vault.location.belt);
  }

  if (item.locationContext === 'stash' && item.stashTab !== undefined) {
    return t(translations.vault.location.stashTab, { tab: item.stashTab + 1 });
  }

  return t(translations.vault.location[item.locationContext]);
}

type SourceGroup = {
  key: string;
  sourceLabel: string;
  items: VaultItem[];
};

function getNextSelectedItemId(items: VaultItem[], selectedItemId?: string): string | undefined {
  if (items.length === 0) {
    return undefined;
  }

  if (selectedItemId && items.some((item) => item.id === selectedItemId)) {
    return selectedItemId;
  }

  return items[0]?.id;
}

function groupVaultItemsBySource(
  items: VaultItem[],
  t: (key: string, options?: Record<string, unknown>) => string,
): SourceGroup[] {
  const map = new Map<string, { sourceLabel: string; items: VaultItem[] }>();

  for (const item of items) {
    const characterName =
      item.sourceCharacterName ?? t(translations.vault.lastSeenUnknownCharacter);
    const key = `${characterName}:${item.sourceFileType}`;
    const existing = map.get(key) ?? {
      sourceLabel: t(translations.inventoryBrowser.groupHeader, {
        characterName,
        sourceFileType: item.sourceFileType.toUpperCase(),
      }),
      items: [],
    };

    existing.items.push(item);
    map.set(key, existing);
  }

  return [...map.entries()]
    .map(([key, value]) => ({ key, ...value }))
    .sort((left, right) => left.sourceLabel.localeCompare(right.sourceLabel));
}

type CreateCategoryArgs = {
  name: string;
  color: string;
  loadData: () => Promise<void>;
  setName: (value: string) => void;
  setColor: (value: string) => void;
};

async function createVaultCategoryAndReload(args: CreateCategoryArgs): Promise<void> {
  if (!args.name.trim()) {
    return;
  }

  const input: VaultCategoryCreateInput = {
    id: crypto.randomUUID(),
    name: args.name.trim(),
    color: args.color.trim() || undefined,
  };

  await window.electronAPI.vault.createCategory(input);
  args.setName('');
  args.setColor('');
  await args.loadData();
}

type UnvaultItemArgs = {
  itemId: string;
  isUnvaulting: boolean;
  items: VaultItem[];
  setIsUnvaulting: (value: boolean) => void;
  setItems: Dispatch<SetStateAction<VaultItem[]>>;
  loadData: () => Promise<void>;
};

async function unvaultItemAndReload(args: UnvaultItemArgs): Promise<void> {
  if (args.isUnvaulting) {
    return;
  }

  args.setIsUnvaulting(true);
  const previous = args.items;
  args.setItems((currentItems) => currentItems.filter((item) => item.id !== args.itemId));

  try {
    await window.electronAPI.vault.removeItem(args.itemId);
    await args.loadData();
  } catch {
    args.setItems(previous);
  } finally {
    args.setIsUnvaulting(false);
  }
}

type BuildVaultFilterArgs = {
  searchText: string;
  locationContext: 'all' | VaultLocationContext;
  presence: PresenceFilter;
  selectedCategoryId: string;
};

function buildVaultSearchFilter(args: BuildVaultFilterArgs): VaultItemFilter {
  return {
    text: args.searchText.trim() || undefined,
    locationContext: args.locationContext === 'all' ? undefined : args.locationContext,
    includeSocketed: false,
    presentState: args.presence,
    categoryIds: args.selectedCategoryId === 'all' ? undefined : [args.selectedCategoryId],
    page: 1,
    pageSize: 200,
  };
}

function getNextCategoryIds(currentCategoryIds: string[], categoryId: string): string[] {
  if (currentCategoryIds.includes(categoryId)) {
    return currentCategoryIds.filter((id) => id !== categoryId);
  }

  return [...currentCategoryIds, categoryId];
}

function getCoordinatesLabel(
  item: VaultItem,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (item.gridX === undefined || item.gridY === undefined) {
    return t(translations.vault.tooltip.noCoordinates);
  }

  return t(translations.vault.tooltip.coordinatesValue, {
    x: item.gridX,
    y: item.gridY,
  });
}

function getDimensionsLabel(
  item: VaultItem,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const width = getGridWidth(item);
  const height = getGridHeight(item);

  return t(translations.vault.tooltip.dimensionsValue, {
    width,
    height,
  });
}

function getPresenceLabel(
  item: VaultItem,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  return item.isPresentInLatestScan
    ? t(translations.vault.presentInScan)
    : t(translations.vault.missingSince);
}

function getSlotLabel(
  item: VaultItem,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const slotKey = resolvePaperDollSlotKey(item.equippedSlotId);
  if (slotKey) {
    return t(translations.vault.equippedSlots[slotKey]);
  }

  if (item.equippedSlotId !== undefined) {
    return t(translations.vault.equippedSlots.unknown, {
      slotId: item.equippedSlotId,
    });
  }

  return t(translations.vault.details.notEquipped);
}

function getUnplacedReasonLabel(
  reason: EquipmentUnplacedReason,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (reason === 'unknownEquippedSlot') {
    return t(translations.vault.unplacedReasons.unknownEquippedSlot);
  }

  return t(translations.vault.unplacedReasons[reason]);
}

function partitionUnknownItems(items: VaultItem[]): {
  belt: VaultItem[];
  otherUnknown: VaultItem[];
} {
  const belt: VaultItem[] = [];
  const otherUnknown: VaultItem[] = [];

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

function VaultTile({
  item,
  iconLookup,
  selected,
  unplacedReason,
  onSelect,
  onDragStart,
}: VaultTileProps) {
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

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            draggable
            data-testid="vault-item-tile"
            aria-label={t(translations.vault.tileAriaLabel, { itemName: item.itemName })}
            className={cn(
              'relative h-full w-full overflow-hidden rounded-[2px] border bg-card/75 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70',
              selected ? 'border-primary ring-1 ring-primary/70' : 'border-border/70',
              item.isPresentInLatestScan ? 'border-emerald-500/60' : 'border-amber-500/60',
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
                {t(translations.vault.tooltip.qualityTypeLabel)}
              </span>{' '}
              {item.quality}
              {item.type ? ` / ${item.type}` : ''}
            </div>
            <div>
              <span className="text-muted-foreground">
                {t(translations.vault.tooltip.sourceLabel)}
              </span>{' '}
              {t(translations.inventoryBrowser.groupHeader, {
                characterName:
                  item.sourceCharacterName ?? t(translations.vault.lastSeenUnknownCharacter),
                sourceFileType: item.sourceFileType.toUpperCase(),
              })}
            </div>
            <div>
              <span className="text-muted-foreground">
                {t(translations.vault.tooltip.locationLabel)}
              </span>{' '}
              {formatLocation(item, t)}
            </div>
            <div>
              <span className="text-muted-foreground">
                {t(translations.vault.tooltip.coordinatesLabel)}
              </span>{' '}
              {getCoordinatesLabel(item, t)}
            </div>
            <div>
              <span className="text-muted-foreground">
                {t(translations.vault.tooltip.dimensionsLabel)}
              </span>{' '}
              {getDimensionsLabel(item, t)}
            </div>
            <div>
              <span className="text-muted-foreground">
                {t(translations.vault.tooltip.slotLabel)}
              </span>{' '}
              {getSlotLabel(item, t)}
            </div>
            <div>
              <span className="text-muted-foreground">
                {t(translations.vault.tooltip.presenceLabel)}
              </span>{' '}
              {getPresenceLabel(item, t)}
            </div>
            {unplacedReason && (
              <div>
                <span className="text-muted-foreground">
                  {t(translations.vault.tooltip.unplacedReasonLabel)}
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

function VaultGridSection({
  title,
  testId,
  items,
  gridSize,
  showRawOverflowBoard = false,
  rawOverflowTitle,
  iconLookup,
  selectedItemId,
  onSelect,
  onDragStart,
}: VaultGridSectionProps) {
  const { t } = useTranslation();
  const classified = useMemo(() => classifyBoardItems(items, gridSize), [gridSize, items]);
  const overflowLayout = useMemo(() => {
    if (!showRawOverflowBoard) {
      return {
        items: [] as VaultItem[],
        itemKeys: new Set<string>(),
        gridSize: undefined,
        origin: undefined,
      };
    }

    return buildOverflowBoardLayout(classified.unplaced, (item) => item.id);
  }, [classified.unplaced, showRawOverflowBoard]);
  const remainingUnplaced = useMemo(
    () => classified.unplaced.filter(({ item }) => !overflowLayout.itemKeys.has(item.id)),
    [classified.unplaced, overflowLayout.itemKeys],
  );

  return (
    <div className="space-y-2">
      <div className="font-medium text-sm">{title}</div>
      <BoardSurface gridSize={gridSize} testId={testId}>
        {classified.placed.map((item) => (
          <div key={item.id} className="relative z-10" style={getItemGridPlacement(item)}>
            <VaultTile
              item={item}
              iconLookup={iconLookup}
              selected={item.id === selectedItemId}
              onSelect={onSelect}
              onDragStart={onDragStart}
            />
          </div>
        ))}
      </BoardSurface>

      {overflowLayout.gridSize && (
        <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
          <div className="font-medium text-amber-100/90 text-xs">
            {rawOverflowTitle ?? t(translations.vault.sections.rawStored)}
          </div>
          <BoardSurface
            className="border-amber-500/40 bg-black/30"
            gridSize={overflowLayout.gridSize}
            showBaseGrid={false}
            testId={`${testId}-raw-overflow`}
          >
            {overflowLayout.items.map((item) => (
              <div
                key={item.id}
                className="relative z-10"
                style={getItemGridPlacement(item, overflowLayout.origin)}
              >
                <VaultTile
                  item={item}
                  iconLookup={iconLookup}
                  selected={item.id === selectedItemId}
                  onSelect={onSelect}
                  onDragStart={onDragStart}
                />
              </div>
            ))}
          </BoardSurface>
        </div>
      )}

      {remainingUnplaced.length > 0 && (
        <div className="space-y-2">
          <div className="text-muted-foreground text-xs">{t(translations.vault.unplaced)}</div>
          <div className="flex flex-wrap gap-2" data-testid={`${testId}-unplaced`}>
            {remainingUnplaced.map(({ item, reason }) => (
              <div key={`${item.id}-${reason}`} className="h-16 w-16">
                <VaultTile
                  item={item}
                  iconLookup={iconLookup}
                  selected={item.id === selectedItemId}
                  unplacedReason={reason}
                  onSelect={onSelect}
                  onDragStart={onDragStart}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VaultEquipmentSection({
  items,
  iconLookup,
  selectedItemId,
  weaponSet,
  onWeaponSetChange,
  onSelect,
  onDragStart,
}: VaultEquipmentSectionProps) {
  const { t } = useTranslation();
  const equippedMapping = useMemo(
    () => buildEquippedSlotMapForSet(items, weaponSet),
    [items, weaponSet],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium text-sm">{t(translations.vault.sections.equipped)}</div>
        <div className="inline-flex overflow-hidden rounded border border-border/70">
          {EQUIPPED_WEAPON_SET_ORDER.map((setKey) => (
            <button
              key={setKey}
              type="button"
              className={cn(
                'min-w-10 px-2 py-1 text-xs',
                weaponSet === setKey ? 'bg-primary text-primary-foreground' : 'bg-muted/20',
              )}
              aria-label={t(translations.vault.weaponSets.ariaLabel, {
                set: t(translations.vault.weaponSets[setKey]),
              })}
              onClick={() => onWeaponSetChange(setKey)}
            >
              {t(translations.vault.weaponSets[setKey])}
            </button>
          ))}
        </div>
      </div>

      <BoardSurface
        gridSize={EQUIPPED_BOARD_SIZE}
        testId="vault-equipped-board"
        showBaseGrid={false}
      >
        {PAPER_DOLL_SLOT_ORDER.map((slotKey) => {
          const layout = EQUIPPED_SLOT_LAYOUT[slotKey];
          const slotItem = equippedMapping.slotItems.get(slotKey);

          return (
            <div
              key={slotKey}
              data-testid="vault-equipped-slot-frame"
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
                  <VaultTile
                    item={slotItem}
                    iconLookup={iconLookup}
                    selected={slotItem.id === selectedItemId}
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

export function ItemVault() {
  const { t } = useTranslation();
  const grailItems = useGrailStore((state) => state.items);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [categories, setCategories] = useState<VaultCategory[]>([]);
  const [isUnvaulting, setIsUnvaulting] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [presence, setPresence] = useState<PresenceFilter>('all');
  const [locationContext, setLocationContext] = useState<'all' | VaultLocationContext>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('');
  const [dragOverUnvaultDropzone, setDragOverUnvaultDropzone] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>(undefined);
  const [equipmentWeaponSet, setEquipmentWeaponSet] = useState<EquippedWeaponSet>('i');
  const spriteIconLookup = useMemo(() => createSpriteIconLookupIndex(grailItems), [grailItems]);

  const loadData = useCallback(async (): Promise<void> => {
    const filter = buildVaultSearchFilter({
      searchText,
      locationContext,
      presence,
      selectedCategoryId,
    });

    const [vaultItems, vaultCategories] = await Promise.all([
      window.electronAPI.vault.search(filter),
      window.electronAPI.vault.listCategories(),
    ]);

    setItems(vaultItems.items);
    setCategories(vaultCategories);
  }, [locationContext, presence, searchText, selectedCategoryId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setSelectedItemId((current) => getNextSelectedItemId(items, current));
  }, [items]);

  const createCategory = useCallback(async (): Promise<void> => {
    await createVaultCategoryAndReload({
      name: newCategoryName,
      color: newCategoryColor,
      loadData,
      setName: setNewCategoryName,
      setColor: setNewCategoryColor,
    });
  }, [loadData, newCategoryColor, newCategoryName]);

  const toggleCategory = async (item: VaultItem, categoryId: string): Promise<void> => {
    const currentCategoryIds = item.categoryIds ?? [];
    const nextCategoryIds = getNextCategoryIds(currentCategoryIds, categoryId);

    await window.electronAPI.vault.updateItemTags(item.id, nextCategoryIds);
    await loadData();
  };

  const unvaultItem = useCallback(
    async (itemId: string): Promise<void> => {
      await unvaultItemAndReload({
        itemId,
        isUnvaulting,
        items,
        setIsUnvaulting,
        setItems,
        loadData,
      });
    },
    [isUnvaulting, items, loadData],
  );

  const categoriesById = useMemo(() => {
    const map = new Map<string, VaultCategory>();

    for (const category of categories) {
      map.set(category.id, category);
    }

    return map;
  }, [categories]);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId),
    [items, selectedItemId],
  );

  const groupedBySource = useMemo(() => groupVaultItemsBySource(items, t), [items, t]);

  const handleCardDragStart = (event: DragEvent<HTMLButtonElement>, item: VaultItem) => {
    const payload: DragVaultPayload = {
      type: 'vault-item',
      itemId: item.id,
    };

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/json', JSON.stringify(payload));
  };

  const handleUnvaultDrop = async (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragOverUnvaultDropzone(false);

    const rawPayload = event.dataTransfer.getData('application/json');
    if (!rawPayload) {
      return;
    }

    const payload = JSON.parse(rawPayload) as DragVaultPayload;
    if (payload.type !== 'vault-item') {
      return;
    }

    await unvaultItem(payload.itemId);
  };

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t(translations.vault.title)}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <Input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={t(translations.vault.searchPlaceholder)}
              aria-label={t(translations.common.search)}
              className="md:col-span-2"
            />
            <Select
              value={locationContext}
              onValueChange={(value) =>
                setLocationContext((value as 'all' | VaultLocationContext | null) ?? 'all')
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t(translations.vault.allLocations)} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t(translations.vault.allLocations)}</SelectItem>
                <SelectItem value="equipped">{t(translations.vault.location.equipped)}</SelectItem>
                <SelectItem value="inventory">
                  {t(translations.vault.location.inventory)}
                </SelectItem>
                <SelectItem value="stash">{t(translations.vault.location.stash)}</SelectItem>
                <SelectItem value="mercenary">
                  {t(translations.vault.location.mercenary)}
                </SelectItem>
                <SelectItem value="corpse">{t(translations.vault.location.corpse)}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={presence}
              onValueChange={(value) => setPresence((value as PresenceFilter | null) ?? 'all')}
            >
              <SelectTrigger>
                <SelectValue placeholder={t(translations.vault.allPresence)} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t(translations.vault.presenceOptions.all)}</SelectItem>
                <SelectItem value="present">
                  {t(translations.vault.presenceOptions.present)}
                </SelectItem>
                <SelectItem value="missing">
                  {t(translations.vault.presenceOptions.missing)}
                </SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={selectedCategoryId}
              onValueChange={(value) => setSelectedCategoryId(value ?? 'all')}
            >
              <SelectTrigger>
                <SelectValue placeholder={t(translations.vault.allCategories)} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t(translations.vault.allCategories)}</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <button
          type="button"
          className={[
            'rounded-lg border border-dashed p-3 text-center text-sm transition-colors',
            dragOverUnvaultDropzone
              ? 'border-primary bg-primary/10'
              : 'border-border text-muted-foreground',
          ].join(' ')}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOverUnvaultDropzone(true);
          }}
          onDragLeave={() => setDragOverUnvaultDropzone(false)}
          onDrop={(event) => {
            void handleUnvaultDrop(event);
          }}
        >
          {t(translations.vault.dropToUnvault)}
        </button>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t(translations.vault.manageCategories)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <Input
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                placeholder={t(translations.vault.newCategoryName)}
              />
              <Input
                value={newCategoryColor}
                onChange={(event) => setNewCategoryColor(event.target.value)}
                placeholder={t(translations.vault.newCategoryColor)}
              />
              <Button onClick={createCategory}>{t(translations.vault.saveCategory)}</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <Badge key={category.id} variant="secondary" className="flex items-center gap-2">
                  <TagIcon className="h-3 w-3" />
                  {category.name}
                  <button
                    type="button"
                    aria-label={t(translations.vault.delete)}
                    onClick={async () => {
                      await window.electronAPI.vault.deleteCategory(category.id);
                      await loadData();
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {items.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              {t(translations.vault.noItems)}
            </CardContent>
          </Card>
        )}

        {items.length > 0 && (
          <>
            {groupedBySource.map((sourceGroup) => {
              const grouped = groupSpatialItems(sourceGroup.items);
              const stashTabs = getSortedStashTabs(grouped.stashByTab);
              const stashTabsToRender =
                stashTabs.length > 0 ? stashTabs : [{ stashTab: 0, items: [] }];
              const { belt: beltItems, otherUnknown } = partitionUnknownItems(grouped.unknown);

              return (
                <Card key={sourceGroup.key}>
                  <CardHeader>
                    <CardTitle className="text-base">{sourceGroup.sourceLabel}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {(locationContext === 'all' || locationContext === 'equipped') && (
                      <VaultEquipmentSection
                        items={grouped.equipped}
                        iconLookup={spriteIconLookup}
                        selectedItemId={selectedItemId}
                        weaponSet={equipmentWeaponSet}
                        onWeaponSetChange={setEquipmentWeaponSet}
                        onSelect={(item) => setSelectedItemId(item.id)}
                        onDragStart={handleCardDragStart}
                      />
                    )}

                    {(locationContext === 'all' || locationContext === 'inventory') && (
                      <VaultGridSection
                        title={t(translations.vault.sections.inventory)}
                        testId={`vault-inventory-board-${sourceGroup.key}`}
                        items={grouped.inventory}
                        gridSize={DEFAULT_INVENTORY_GRID_SIZE}
                        showRawOverflowBoard
                        rawOverflowTitle={t(translations.vault.sections.expandedInventory)}
                        iconLookup={spriteIconLookup}
                        selectedItemId={selectedItemId}
                        onSelect={(item) => setSelectedItemId(item.id)}
                        onDragStart={handleCardDragStart}
                      />
                    )}

                    {(locationContext === 'all' || locationContext === 'stash') &&
                      stashTabsToRender.map(({ stashTab, items: stashItems }) => (
                        <VaultGridSection
                          key={`${sourceGroup.key}-stash-${stashTab}`}
                          title={t(translations.vault.sections.stashTab, {
                            tab: stashTab + 1,
                          })}
                          testId={`vault-stash-board-${sourceGroup.key}-${stashTab}`}
                          items={stashItems}
                          gridSize={DEFAULT_STASH_GRID_SIZE}
                          showRawOverflowBoard
                          rawOverflowTitle={t(translations.vault.sections.expandedStash)}
                          iconLookup={spriteIconLookup}
                          selectedItemId={selectedItemId}
                          onSelect={(item) => setSelectedItemId(item.id)}
                          onDragStart={handleCardDragStart}
                        />
                      ))}

                    {locationContext === 'all' && beltItems.length > 0 && (
                      <VaultGridSection
                        title={t(translations.vault.sections.belt)}
                        testId={`vault-belt-board-${sourceGroup.key}`}
                        items={beltItems}
                        gridSize={DEFAULT_BELT_GRID_SIZE}
                        iconLookup={spriteIconLookup}
                        selectedItemId={selectedItemId}
                        onSelect={(item) => setSelectedItemId(item.id)}
                        onDragStart={handleCardDragStart}
                      />
                    )}

                    {(locationContext === 'all' || locationContext === 'mercenary') && (
                      <VaultGridSection
                        title={t(translations.vault.sections.mercenary)}
                        testId={`vault-mercenary-board-${sourceGroup.key}`}
                        items={grouped.mercenary}
                        gridSize={DEFAULT_INVENTORY_GRID_SIZE}
                        iconLookup={spriteIconLookup}
                        selectedItemId={selectedItemId}
                        onSelect={(item) => setSelectedItemId(item.id)}
                        onDragStart={handleCardDragStart}
                      />
                    )}

                    {(locationContext === 'all' || locationContext === 'corpse') && (
                      <VaultGridSection
                        title={t(translations.vault.sections.corpse)}
                        testId={`vault-corpse-board-${sourceGroup.key}`}
                        items={grouped.corpse}
                        gridSize={DEFAULT_INVENTORY_GRID_SIZE}
                        iconLookup={spriteIconLookup}
                        selectedItemId={selectedItemId}
                        onSelect={(item) => setSelectedItemId(item.id)}
                        onDragStart={handleCardDragStart}
                      />
                    )}

                    {otherUnknown.length > 0 && (
                      <div className="space-y-2 rounded-md border border-border/60 bg-muted/10 p-3">
                        <div className="flex items-center gap-2 font-medium text-sm">
                          <Sparkles className="h-4 w-4" />
                          {t(translations.vault.sections.unknown)}
                        </div>
                        <div
                          className="flex flex-wrap gap-2"
                          data-testid={`vault-unknown-${sourceGroup.key}`}
                        >
                          {otherUnknown.map((item) => (
                            <div key={item.id} className="h-16 w-16">
                              <VaultTile
                                item={item}
                                iconLookup={spriteIconLookup}
                                selected={item.id === selectedItemId}
                                onSelect={(selected) => setSelectedItemId(selected.id)}
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
                  {t(translations.vault.selectedItemTitle)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedItem ? (
                  <div className="text-muted-foreground text-sm">
                    {t(translations.vault.noSelectedItem)}
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
                          variant={selectedItem.isPresentInLatestScan ? 'default' : 'secondary'}
                        >
                          {getPresenceLabel(selectedItem, t)}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                      <div>
                        <span className="text-muted-foreground">
                          {t(translations.vault.details.coordinatesLabel)}
                        </span>{' '}
                        {getCoordinatesLabel(selectedItem, t)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          {t(translations.vault.details.dimensionsLabel)}
                        </span>{' '}
                        {getDimensionsLabel(selectedItem, t)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          {t(translations.vault.details.slotLabel)}
                        </span>{' '}
                        {getSlotLabel(selectedItem, t)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          {t(translations.vault.details.characterLabel)}
                        </span>{' '}
                        {selectedItem.sourceCharacterName ??
                          t(translations.vault.lastSeenUnknownCharacter)}
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          {t(translations.vault.details.lastSeenLabel)}
                        </span>{' '}
                        {selectedItem.lastSeenAt
                          ? selectedItem.lastSeenAt.toLocaleString()
                          : t(translations.vault.details.neverSeen)}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-muted-foreground text-xs">
                        {t(translations.vault.assignTags)}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {categories.map((category) => {
                          const isSelected = (selectedItem.categoryIds ?? []).includes(category.id);
                          return (
                            <Button
                              key={`${selectedItem.id}-${category.id}`}
                              type="button"
                              variant={isSelected ? 'default' : 'outline'}
                              size="sm"
                              className="h-7"
                              onClick={async () => {
                                await toggleCategory(selectedItem, category.id);
                              }}
                            >
                              <Tag className="mr-1 h-3 w-3" />
                              {categoriesById.get(category.id)?.name ?? category.name}
                            </Button>
                          );
                        })}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={isUnvaulting}
                      onClick={() => {
                        void unvaultItem(selectedItem.id);
                      }}
                    >
                      <PackageMinus className="mr-1 h-4 w-4" />
                      {t(translations.vault.unvaultAction)}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
