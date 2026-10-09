import { INVENTORY_DRAG_STATE_CHANNEL, VAULT_DRAG_STATE_CHANNEL } from 'electron/ipc/contract';
import type {
  CharacterInventorySnapshot,
  VaultItem,
  VaultItemUpsertInput,
} from 'electron/types/grail';
import { isGrailBookmark } from 'electron/utils/vaultState';
import { type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  hasInventoryOrVaultDragData,
  parseInventoryDragStatePayload,
  parseInventoryTextPayload,
  parseVaultDragStatePayload,
  serializeVaultTextPayload,
  toActiveVaultDragItem,
  VAULT_DRAG_MIME,
} from '@/components/inventory/dragPayloads';
import { InventoryFilterBar, type LocationFilter } from '@/components/inventory/InventoryFilterBar';
import { getTypeValue, type TypeFilter } from '@/components/inventory/inventoryItems';
import { useInventoryIconLookup } from '@/components/inventory/useInventoryIconLookup';
import { useInventorySearch } from '@/components/inventory/useInventorySearch';
import { VaultDropzone } from '@/components/inventory/VaultDropzone';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSpriteIcon } from '@/hooks/useSpriteIcon';
import { translations } from '@/i18n/translations';
import { combineUnsubscribers, onMainEvent } from '@/lib/ipcEvents';
import {
  createSpatialIconCandidates,
  type SpriteIconLookupIndex,
} from '@/lib/spriteIconCandidates';
import { cn } from '@/lib/utils';
import { showInventoryOperationErrorToast } from './operationErrors';

const SNAPSHOT_HOVER_OPEN_DELAY_MS = 650;
const SNAPSHOT_DRAG_SESSION_IDLE_RESET_MS = 900;

function getSnapshotWindowTargetKey(snapshot: CharacterInventorySnapshot): string {
  return `${snapshot.sourceFileType}:${snapshot.sourceFilePath}`;
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
        selected ? 'border-primary ring-1 ring-primary/70' : 'border-success/60',
      )}
      onClick={() => onSelect(item)}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData(VAULT_DRAG_MIME, item.id);
        const dragStatePayload = toActiveVaultDragItem(item);
        const textPayload = serializeVaultTextPayload(dragStatePayload);
        event.dataTransfer.setData('text/plain', textPayload);
        event.dataTransfer.setData('text', textPayload);
        window.electronAPI?.inventory.sendVaultDragState({
          active: true,
          ...dragStatePayload,
        });
      }}
      onDragEnd={() => {
        window.electronAPI?.inventory.sendVaultDragState({
          active: false,
          ...toActiveVaultDragItem(item),
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

export function InventoryBrowserMain() {
  const { t } = useTranslation();
  const [isVaulting, setIsVaulting] = useState(false);
  const [isUnvaulting, setIsUnvaulting] = useState(false);
  const [selectedVaultItemId, setSelectedVaultItemId] = useState<string | undefined>(undefined);
  const [searchText, setSearchText] = useState('');
  const [characterId, setCharacterId] = useState('all');
  const [locationContext, setLocationContext] = useState<LocationFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const hasCrossWindowVaultDragRef = useRef(false);
  const hasCrossWindowInventoryDragRef = useRef(false);
  const snapshotHoverTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const snapshotHoverKeyRef = useRef<string | undefined>(undefined);
  const lastSnapshotDragSeenAtRef = useRef(0);
  const autoOpenedSnapshotKeysRef = useRef<Set<string>>(new Set());
  const spriteIconLookup = useInventoryIconLookup();
  const { isLoading, inventoryResponse, loadInventorySearch, reloadInventoryAfterSaveWrite } =
    useInventorySearch({ searchText, characterId, locationContext });

  const clearSnapshotHoverTimer = useCallback((): void => {
    if (snapshotHoverTimerRef.current) {
      clearTimeout(snapshotHoverTimerRef.current);
      snapshotHoverTimerRef.current = undefined;
    }

    snapshotHoverKeyRef.current = undefined;
  }, []);

  const resetSnapshotHoverSession = useCallback((): void => {
    clearSnapshotHoverTimer();
    autoOpenedSnapshotKeysRef.current.clear();
    lastSnapshotDragSeenAtRef.current = 0;
  }, [clearSnapshotHoverTimer]);

  useEffect(() => {
    const resetIfRemoteDragInactive = () => {
      if (!hasCrossWindowVaultDragRef.current && !hasCrossWindowInventoryDragRef.current) {
        resetSnapshotHoverSession();
      }
    };

    const handleVaultDragState = (payload: unknown) => {
      const parsedPayload = parseVaultDragStatePayload(payload);
      if (!parsedPayload) {
        return;
      }

      hasCrossWindowVaultDragRef.current = parsedPayload.active;
      if (!parsedPayload.active) {
        resetIfRemoteDragInactive();
      }
    };

    const handleInventoryDragState = (payload: unknown) => {
      const parsedPayload = parseInventoryDragStatePayload(payload);
      if (!parsedPayload) {
        return;
      }

      hasCrossWindowInventoryDragRef.current = parsedPayload.active;
      if (!parsedPayload.active) {
        resetIfRemoteDragInactive();
      }
    };

    return combineUnsubscribers([
      onMainEvent(VAULT_DRAG_STATE_CHANNEL, handleVaultDragState),
      onMainEvent(INVENTORY_DRAG_STATE_CHANNEL, handleInventoryDragState),
    ]);
  }, [resetSnapshotHoverSession]);

  useEffect(() => {
    const resetDragSession = () => {
      hasCrossWindowVaultDragRef.current = false;
      hasCrossWindowInventoryDragRef.current = false;
      resetSnapshotHoverSession();
    };

    window.addEventListener('dragend', resetDragSession);
    window.addEventListener('drop', resetDragSession);

    return () => {
      window.removeEventListener('dragend', resetDragSession);
      window.removeEventListener('drop', resetDragSession);
      resetDragSession();
    };
  }, [resetSnapshotHoverSession]);

  // Grail bookmarks are tracker bookmarks, not items: they must not show up as vault tiles.
  const vaultItems = useMemo(
    () => (inventoryResponse?.vault.items ?? []).filter((item) => !isGrailBookmark(item)),
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
      showInventoryOperationErrorToast(error, t);
      await loadInventorySearch();
    } finally {
      setIsUnvaulting(false);
    }
  }, [isUnvaulting, loadInventorySearch, reloadInventoryAfterSaveWrite, selectedVaultItemId, t]);

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
        showInventoryOperationErrorToast(error, t);
        await loadInventorySearch();
      } finally {
        setIsVaulting(false);
      }
    },
    [isVaulting, loadInventorySearch, t],
  );

  const handleVaultDrop = useCallback(
    async (event: DragEvent<HTMLButtonElement>) => {
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

  const isSupportedSnapshotHoverDrag = useCallback((event: DragEvent<HTMLElement>): boolean => {
    if (hasCrossWindowVaultDragRef.current || hasCrossWindowInventoryDragRef.current) {
      return true;
    }

    return hasInventoryOrVaultDragData(event);
  }, []);

  const trackSnapshotDragSession = useCallback((): void => {
    const now = Date.now();
    if (now - lastSnapshotDragSeenAtRef.current > SNAPSHOT_DRAG_SESSION_IDLE_RESET_MS) {
      autoOpenedSnapshotKeysRef.current.clear();
    }

    lastSnapshotDragSeenAtRef.current = now;
  }, []);

  const handleSnapshotRowDragOver = useCallback(
    (event: DragEvent<HTMLButtonElement>, snapshot: CharacterInventorySnapshot): void => {
      if (!isSupportedSnapshotHoverDrag(event)) {
        return;
      }

      event.preventDefault();
      trackSnapshotDragSession();

      const targetKey = getSnapshotWindowTargetKey(snapshot);
      if (autoOpenedSnapshotKeysRef.current.has(targetKey)) {
        return;
      }

      if (snapshotHoverKeyRef.current === targetKey && snapshotHoverTimerRef.current) {
        return;
      }

      clearSnapshotHoverTimer();
      snapshotHoverKeyRef.current = targetKey;
      snapshotHoverTimerRef.current = setTimeout(() => {
        if (snapshotHoverKeyRef.current !== targetKey) {
          return;
        }

        autoOpenedSnapshotKeysRef.current.add(targetKey);
        snapshotHoverTimerRef.current = undefined;
        void handleOpenSnapshotWindow(snapshot);
      }, SNAPSHOT_HOVER_OPEN_DELAY_MS);
    },
    [
      clearSnapshotHoverTimer,
      handleOpenSnapshotWindow,
      isSupportedSnapshotHoverDrag,
      trackSnapshotDragSession,
    ],
  );

  const handleSnapshotRowDragLeave = useCallback(
    (snapshot: CharacterInventorySnapshot): void => {
      if (snapshotHoverKeyRef.current !== getSnapshotWindowTargetKey(snapshot)) {
        return;
      }

      clearSnapshotHoverTimer();
    },
    [clearSnapshotHoverTimer],
  );

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="flex w-full flex-col gap-4">
        <InventoryFilterBar
          searchText={searchText}
          onSearchTextChange={setSearchText}
          characterId={characterId}
          onCharacterIdChange={setCharacterId}
          characterOptions={characterOptions}
          locationContext={locationContext}
          onLocationContextChange={setLocationContext}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
        />

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

        <VaultDropzone onDropItem={handleVaultDrop} />

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
                  onDragOver={(event) => {
                    handleSnapshotRowDragOver(event, snapshot);
                  }}
                  onDragLeave={() => {
                    handleSnapshotRowDragLeave(snapshot);
                  }}
                  onDrop={() => {
                    resetSnapshotHoverSession();
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
