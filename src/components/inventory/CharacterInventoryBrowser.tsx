import type {
  CharacterInventorySnapshot,
  ParsedInventoryItem,
  VaultItem,
  VaultItemFilter,
  VaultItemUpsertInput,
  VaultLocationContext,
} from 'electron/types/grail';
import { GripVertical, PackageCheck, PackagePlus, PackageX, ShieldQuestion } from 'lucide-react';
import { type DragEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { translations } from '@/i18n/translations';

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

type DragInventoryPayload = {
  type: 'inventory-item';
  item: ParsedInventoryItem;
};

interface InventoryItemCardProps {
  item: ParsedInventoryItem;
  isVaultPresent?: boolean;
  isVaulting: boolean;
  vaultStatus: string;
  onVault: (item: ParsedInventoryItem) => Promise<void>;
  onDragStart: (event: DragEvent<HTMLButtonElement>, item: ParsedInventoryItem) => void;
}

function formatLocation(
  item: ParsedInventoryItem,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (item.locationContext === 'stash' && item.stashTab !== undefined) {
    return t(translations.inventoryBrowser.location.stashTab, { tab: item.stashTab });
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

function InventoryItemCard({
  item,
  isVaultPresent,
  isVaulting,
  vaultStatus,
  onVault,
  onDragStart,
}: InventoryItemCardProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="font-medium text-sm">{item.itemName}</div>
        <div className="flex items-center gap-1">
          <Badge variant="secondary" className="capitalize">
            {item.quality}
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            draggable
            onDragStart={(event) => {
              onDragStart(event, item);
            }}
            aria-label={t(translations.inventoryBrowser.dragToVault)}
          >
            <GripVertical className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        <Badge variant="outline" className="capitalize">
          {formatLocation(item, t)}
        </Badge>
        {item.type && (
          <Badge variant="outline" className="capitalize">
            {item.type}
          </Badge>
        )}
        <Badge variant="outline">{item.sourceFileType.toUpperCase()}</Badge>
      </div>

      <div className="mt-3 flex items-center justify-between text-muted-foreground text-xs">
        <span>{t(translations.inventoryBrowser.vaultStatus)}</span>
        <span className="inline-flex items-center gap-1">
          {isVaultPresent === undefined ? (
            <ShieldQuestion className="h-3 w-3" />
          ) : isVaultPresent ? (
            <PackageCheck className="h-3 w-3 text-emerald-500" />
          ) : (
            <PackageX className="h-3 w-3 text-amber-500" />
          )}
          {vaultStatus}
        </span>
      </div>

      <div className="mt-3">
        <Button
          size="sm"
          className="w-full"
          disabled={isVaulting || isVaultPresent === true}
          onClick={() => {
            void onVault(item);
          }}
        >
          <PackagePlus className="mr-1 h-4 w-4" />
          {isVaultPresent
            ? t(translations.inventoryBrowser.vaulted)
            : t(translations.inventoryBrowser.vaultAction)}
        </Button>
      </div>
    </div>
  );
}

export function CharacterInventoryBrowser() {
  const { t } = useTranslation();
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

  const loadInventorySearch = useCallback(async (): Promise<void> => {
    const filter: VaultItemFilter = {
      text: searchText.trim() || undefined,
      characterId: characterId === 'all' ? undefined : characterId,
      locationContext: locationContext === 'all' ? undefined : locationContext,
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

  const characterOptions = useMemo(() => {
    const options = new Map<string, string>();

    for (const snapshot of inventoryResponse?.inventory.snapshots ?? []) {
      const key = snapshot.characterId ?? snapshot.characterName;
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

        {snapshots.map((snapshot) => (
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
            <CardContent>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {snapshot.items.map((item) => {
                  const isVaultPresent = getEffectiveVaultPresent(
                    item,
                    vaultItemsByFingerprint,
                    optimisticPresent,
                  );
                  const vaultStatus =
                    isVaultPresent === undefined
                      ? t(translations.inventoryBrowser.vaultUntracked)
                      : isVaultPresent
                        ? t(translations.inventoryBrowser.vaultPresent)
                        : t(translations.inventoryBrowser.vaultMissing);

                  return (
                    <InventoryItemCard
                      key={item.fingerprint}
                      item={item}
                      isVaultPresent={isVaultPresent}
                      isVaulting={isVaulting}
                      vaultStatus={vaultStatus}
                      onVault={vaultItem}
                      onDragStart={handleCardDragStart}
                    />
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
