import type {
  CharacterInventorySnapshot,
  VaultItem,
  VaultItemFilter,
  VaultItemUpsertInput,
  VaultLocationContext,
} from 'electron/types/grail';
import { type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  parseInventoryTextPayload,
  serializeVaultTextPayload,
  VAULT_DRAG_MIME,
} from '@/components/inventory/dragPayloads';
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
import { useSpriteIcon } from '@/hooks/useSpriteIcon';
import { translations } from '@/i18n/translations';
import {
  createSpatialIconCandidates,
  createSpriteIconLookupIndex,
  type SpriteIconLookupIndex,
} from '@/lib/spriteIconCandidates';
import { cn } from '@/lib/utils';
import { useGrailStore } from '@/stores/grailStore';

const VAULT_DRAG_STATE_CHANNEL = 'inventory:vault-drag-state';

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

function toVaultDragStatePayload(item: VaultItem): {
  id: string;
  gridWidth: number;
  gridHeight: number;
} {
  return {
    id: item.id,
    gridWidth:
      Number.isInteger(item.gridWidth) && item.gridWidth && item.gridWidth > 0 ? item.gridWidth : 1,
    gridHeight:
      Number.isInteger(item.gridHeight) && item.gridHeight && item.gridHeight > 0
        ? item.gridHeight
        : 1,
  };
}

interface MainVaultTileProps {
  item: VaultItem;
  iconLookup: SpriteIconLookupIndex;
  selected: boolean;
  onSelect: (item: VaultItem) => void;
}

function MainVaultTile({ item, iconLookup, selected, onSelect }: MainVaultTileProps) {
  const { t } = useTranslation();
  const iconCandidates = useMemo(
    () => createSpatialIconCandidates(item, iconLookup),
    [iconLookup, item],
  );
  const { iconUrl } = useSpriteIcon(iconCandidates, { forceEnabled: true });

  return (
    <button
      type="button"
      draggable
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
        const dragStatePayload = toVaultDragStatePayload(item);
        const textPayload = serializeVaultTextPayload(dragStatePayload);
        event.dataTransfer.setData('text/plain', textPayload);
        event.dataTransfer.setData('text', textPayload);
        window.ipcRenderer?.send(VAULT_DRAG_STATE_CHANNEL, {
          active: true,
          ...dragStatePayload,
        });
      }}
      onDragEnd={() => {
        window.ipcRenderer?.send(VAULT_DRAG_STATE_CHANNEL, {
          active: false,
          ...toVaultDragStatePayload(item),
        });
      }}
    >
      <img
        src={iconUrl}
        alt={item.itemName}
        draggable={false}
        className="pointer-events-none h-full w-full object-contain"
        loading="lazy"
      />
    </button>
  );
}

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

export function InventoryBrowserMain() {
  const { t } = useTranslation();
  const grailItems = useGrailStore((state) => state.items);
  const setGrailItems = useGrailStore((state) => state.setItems);
  const [isLoading, setIsLoading] = useState(true);
  const [isVaulting, setIsVaulting] = useState(false);
  const [isUnvaulting, setIsUnvaulting] = useState(false);
  const [selectedVaultItemId, setSelectedVaultItemId] = useState<string | undefined>(undefined);
  const [searchText, setSearchText] = useState('');
  const [characterId, setCharacterId] = useState('all');
  const [locationContext, setLocationContext] = useState<'all' | VaultLocationContext>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [dragOverVaultDropzone, setDragOverVaultDropzone] = useState(false);
  const [inventoryResponse, setInventoryResponse] = useState<InventorySearchAllResponse | null>(
    null,
  );
  const latestSearchRequestRef = useRef(0);
  const spriteIconLookup = useMemo(() => createSpriteIconLookupIndex(grailItems), [grailItems]);

  useEffect(() => {
    if (grailItems.length > 0 || !window.electronAPI?.grail?.getItems) {
      return;
    }

    let cancelled = false;

    void window.electronAPI.grail
      .getItems()
      .then((items) => {
        if (cancelled || !items) {
          return;
        }

        setGrailItems(items);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Failed to load grail items for inventory icon lookup', error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [grailItems.length, setGrailItems]);

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

  useEffect(() => {
    let reloadTimeout: ReturnType<typeof setTimeout> | undefined;

    const handleSaveFileEvent = () => {
      if (reloadTimeout) {
        clearTimeout(reloadTimeout);
      }

      reloadTimeout = setTimeout(() => {
        void loadInventorySearch();
      }, 250);
    };

    window.ipcRenderer?.on('save-file-event', handleSaveFileEvent);

    return () => {
      if (reloadTimeout) {
        clearTimeout(reloadTimeout);
      }
      window.ipcRenderer?.off('save-file-event', handleSaveFileEvent);
    };
  }, [loadInventorySearch]);

  const vaultItems = useMemo(
    () => inventoryResponse?.vault.items ?? [],
    [inventoryResponse?.vault.items],
  );

  const snapshots = useMemo(() => {
    const sourceSnapshots = inventoryResponse?.inventory.snapshots ?? [];

    return sourceSnapshots
      .map((snapshot) => ({
        ...snapshot,
        items: snapshot.items.filter((item) => {
          if (item.isSocketedItem) {
            return false;
          }

          return typeFilter === 'all' || getTypeValue(item.type) === typeFilter;
        }),
      }))
      .filter((snapshot) => snapshot.items.length > 0);
  }, [inventoryResponse?.inventory.snapshots, typeFilter]);

  const characterOptions = useMemo(() => {
    const options = new Map<string, string>();

    for (const snapshot of inventoryResponse?.inventory.snapshots ?? []) {
      const key = snapshot.characterId ?? `name:${snapshot.characterName}`;
      options.set(key, snapshot.characterName);
    }

    return [...options.entries()];
  }, [inventoryResponse?.inventory.snapshots]);

  useEffect(() => {
    if (characterId === 'all') {
      return;
    }

    const hasSelectedCharacter = characterOptions.some(([id]) => id === characterId);
    if (!hasSelectedCharacter) {
      setCharacterId('all');
    }
  }, [characterId, characterOptions]);

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
  }, [isUnvaulting, reloadInventoryAfterSaveWrite, selectedVaultItemId]);

  const vaultItem = useCallback(
    async (itemInput: VaultItemUpsertInput): Promise<void> => {
      if (isVaulting) {
        return;
      }

      setIsVaulting(true);

      try {
        await window.electronAPI.vault.addItem(itemInput);
        await loadInventorySearch();
      } catch (error) {
        console.error('Failed to vault inventory item', error);
        await loadInventorySearch();
      } finally {
        setIsVaulting(false);
      }
    },
    [isVaulting, loadInventorySearch],
  );

  const handleVaultDrop = useCallback(
    async (event: DragEvent<HTMLButtonElement>) => {
      event.preventDefault();
      setDragOverVaultDropzone(false);

      const textPayload = event.dataTransfer.getData('text/plain');
      const payloadItemInput = parseInventoryTextPayload(textPayload);
      if (!payloadItemInput) {
        return;
      }

      await vaultItem(payloadItemInput);
    },
    [vaultItem],
  );

  const handleOpenSnapshotWindow = useCallback(
    async (snapshot: CharacterInventorySnapshot): Promise<void> => {
      try {
        await window.electronAPI.inventory.openSnapshotWindow({
          sourceFilePath: snapshot.sourceFilePath,
          sourceFileType: snapshot.sourceFileType,
          characterName: snapshot.characterName,
        });
      } catch (error) {
        console.error('Failed to open snapshot window', error);
      }
    },
    [],
  );

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
                  <MainVaultTile
                    key={item.id}
                    item={item}
                    iconLookup={spriteIconLookup}
                    selected={item.id === selectedVaultItemId}
                    onSelect={(selected) => setSelectedVaultItemId(selected.id)}
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

        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle className="text-base">
                {t(translations.inventoryBrowser.snapshotList.title)}
              </CardTitle>
              <div className="text-muted-foreground text-sm">
                {t(translations.inventoryBrowser.snapshotList.description)}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {!isLoading && snapshots.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm">
                {t(translations.inventoryBrowser.snapshotList.empty)}
              </div>
            ) : (
              snapshots.map((snapshot) => (
                <button
                  key={snapshot.snapshotId}
                  type="button"
                  className="flex w-full items-start justify-between gap-3 rounded-md border border-border/60 bg-card/40 px-3 py-2 text-left hover:border-primary/60 hover:bg-primary/5"
                  onClick={() => {
                    void handleOpenSnapshotWindow(snapshot);
                  }}
                >
                  <div className="space-y-1">
                    <div className="font-medium text-sm">
                      {t(translations.inventoryBrowser.groupHeader, {
                        characterName: snapshot.characterName,
                        sourceFileType: snapshot.sourceFileType.toUpperCase(),
                      })}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {t(translations.inventoryBrowser.capturedAt, {
                        date: snapshot.capturedAt.toLocaleString(),
                      })}
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {t(translations.inventoryBrowser.itemsCount, { count: snapshot.items.length })}
                  </Badge>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
