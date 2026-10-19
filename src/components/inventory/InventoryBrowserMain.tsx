import { INVENTORY_DRAG_STATE_CHANNEL, VAULT_DRAG_STATE_CHANNEL } from 'electron/ipc/contract';
import type {
  CharacterInventorySnapshot,
  InventorySnapshotWindowTarget,
} from 'electron/types/grail';
import { isGrailBookmark } from 'electron/utils/vaultState';
import { Loader2 } from 'lucide-react';
import { type DragEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  hasInventoryOrVaultDragData,
  INVENTORY_DRAG_MIME,
  type InventoryDragStatePayload,
  parseInventoryDragStatePayload,
  parseInventoryTextPayload,
  parseVaultDragStatePayload,
  toActiveVaultDragItem,
} from '@/components/inventory/dragPayloads';
import { InventoryFilterBar, type LocationFilter } from '@/components/inventory/InventoryFilterBar';
import { getTypeValue, type TypeFilter } from '@/components/inventory/inventoryItems';
import {
  DEFAULT_ITEM_PROPERTY_FILTERS,
  hasActiveItemPropertyFilters,
  type ItemPropertyFilters,
  type ItemSortOrder,
  matchesItemPropertyFilters,
  sortItems,
} from '@/components/inventory/itemPropertyFilters';
import { MatchingItemsList } from '@/components/inventory/MatchingItemsList';
import { SaveWriteNotice } from '@/components/inventory/SaveWriteNotice';
import { SelectedVaultItemPanel } from '@/components/inventory/SelectedVaultItemPanel';
import { SnapshotListRow } from '@/components/inventory/SnapshotListRow';
import {
  groupSnapshotList,
  type SnapshotListGroupKind,
} from '@/components/inventory/snapshotListGroups';
import { useInventoryIconLookup } from '@/components/inventory/useInventoryIconLookup';
import { useInventorySearch } from '@/components/inventory/useInventorySearch';
import { useVaultActions } from '@/components/inventory/useVaultActions';
import { VaultDropzone } from '@/components/inventory/VaultDropzone';
import { VaultedItemTile } from '@/components/inventory/VaultedItemTile';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { translations } from '@/i18n/translations';
import { combineUnsubscribers, onMainEvent } from '@/lib/ipcEvents';
import { useGrailStore } from '@/stores/grailStore';

const SNAPSHOT_HOVER_OPEN_DELAY_MS = 650;
const SNAPSHOT_DRAG_SESSION_IDLE_RESET_MS = 900;

const SNAPSHOT_GROUP_TITLE_KEYS: Record<SnapshotListGroupKind, string> = {
  sharedStashes: translations.inventoryBrowser.snapshotList.sharedStashes,
  characters: translations.inventoryBrowser.snapshotList.characters,
};

function getSnapshotWindowTargetKey(snapshot: CharacterInventorySnapshot): string {
  return `${snapshot.sourceFileType}:${snapshot.sourceFilePath}`;
}

/** Whether a drag state reported by another window is an inventory item that could be vaulted. */
function isVaultableInventoryDrag(payload: InventoryDragStatePayload | undefined): boolean {
  // A stack pickup is placed by clicking, not dropped, so the vault drop area can't take it
  return payload?.active === true && payload.stackPickup !== true;
}

/** Whether a `dragleave` means the pointer left this window, not just moved between elements. */
function isDragLeavingWindow(event: globalThis.DragEvent): boolean {
  if (event.relatedTarget !== null) {
    return false;
  }

  // Some browsers report no related element for moves inside the page, so the position decides.
  // Pixels 0 to innerWidth/innerHeight - 1 are inside the window, so only a position past those
  // edges is a leave. Chromium reports (0, 0) when a drag leaves the window, so that pair counts
  // as a leave too; a single coordinate of 0 is just an element at the edge.
  const isOutsideViewport =
    event.clientX < 0 ||
    event.clientY < 0 ||
    event.clientX >= window.innerWidth ||
    event.clientY >= window.innerHeight;
  const isUnknownPosition = event.clientX === 0 && event.clientY === 0;

  return isOutsideViewport || isUnknownPosition;
}

export function InventoryBrowserMain() {
  const { t } = useTranslation();
  const snapshotListTitleId = useId();
  const [selectedVaultItemId, setSelectedVaultItemId] = useState<string | undefined>(undefined);
  const [searchText, setSearchText] = useState('');
  const [characterId, setCharacterId] = useState('all');
  const [locationContext, setLocationContext] = useState<LocationFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [propertyFilters, setPropertyFilters] = useState<ItemPropertyFilters>(
    DEFAULT_ITEM_PROPERTY_FILTERS,
  );
  const [sortOrder, setSortOrder] = useState<ItemSortOrder>('default');
  // The vault drop area is only shown while an inventory item can be dropped on it: another window
  // reports its drags over IPC, and a drag that enters this window with inventory drag data counts
  // too. `hasCrossWindowInventoryDragRef` (declared below) is wider than the remote state: it is
  // set for every active drag another window reports, stack pickups included. A pickup keeps
  // snapshot windows auto-opening on hover but can't be dropped on the vault. Refs hold the
  // cross-window flags because the drag handlers read them without needing a render.
  const [hasRemoteInventoryDrag, setHasRemoteInventoryDrag] = useState(false);
  const [hasInventoryDragInWindow, setHasInventoryDragInWindow] = useState(false);
  const characters = useGrailStore((state) => state.characters);
  const hasCrossWindowVaultDragRef = useRef(false);
  const hasCrossWindowInventoryDragRef = useRef(false);
  const snapshotHoverTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const snapshotHoverKeyRef = useRef<string | undefined>(undefined);
  const lastSnapshotDragSeenAtRef = useRef(0);
  const autoOpenedSnapshotKeysRef = useRef<Set<string>>(new Set());
  const spriteIconLookup = useInventoryIconLookup();
  const { isLoading, inventoryResponse, loadInventorySearch, reloadInventoryAfterSaveWrite } =
    useInventorySearch({ searchText, characterId, locationContext });
  const { isUnvaulting, vaultItem, unvaultItem } = useVaultActions({
    loadInventorySearch,
    reloadInventoryAfterSaveWrite,
  });

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
      setHasRemoteInventoryDrag(isVaultableInventoryDrag(parsedPayload));
      if (!parsedPayload.active) {
        setHasInventoryDragInWindow(false);
        resetIfRemoteDragInactive();
      }
    };

    // A drag that was already running when this page opened
    let isDisposed = false;
    const getActiveDragState = window.electronAPI?.inventory?.getActiveDragState;
    if (typeof getActiveDragState === 'function') {
      void getActiveDragState()
        .then((payload) => {
          if (isDisposed || !payload || typeof payload !== 'object') {
            return;
          }

          const rawPayload: { inventory?: unknown } = payload;
          const inventoryPayload = parseInventoryDragStatePayload(rawPayload.inventory);
          // Same as the live handler: any active drag counts for hover, only a vaultable one shows the area
          if (inventoryPayload?.active === true) {
            hasCrossWindowInventoryDragRef.current = true;
          }
          if (isVaultableInventoryDrag(inventoryPayload)) {
            setHasRemoteInventoryDrag(true);
          }
        })
        .catch((error) => {
          if (!isDisposed) {
            console.warn('Failed to get active inventory drag state', error);
          }
        });
    }

    const unsubscribe = combineUnsubscribers([
      onMainEvent(VAULT_DRAG_STATE_CHANNEL, handleVaultDragState),
      onMainEvent(INVENTORY_DRAG_STATE_CHANNEL, handleInventoryDragState),
    ]);

    return () => {
      isDisposed = true;
      unsubscribe();
    };
  }, [resetSnapshotHoverSession]);

  useEffect(() => {
    const resetDragSession = () => {
      hasCrossWindowVaultDragRef.current = false;
      hasCrossWindowInventoryDragRef.current = false;
      setHasRemoteInventoryDrag(false);
      setHasInventoryDragInWindow(false);
      resetSnapshotHoverSession();
    };

    // Fallback for a missed IPC drag state, for a drag that carries inventory data into this
    // window. It ends with a drop, with the drag leaving this window, with `dragend` or with the
    // IPC state. A drag another window reports over IPC ends only when that window reports it.
    const trackInventoryDragEnter = (event: globalThis.DragEvent) => {
      if (event.dataTransfer?.types.includes(INVENTORY_DRAG_MIME)) {
        setHasInventoryDragInWindow(true);
      }
    };

    const trackInventoryDragLeave = (event: globalThis.DragEvent) => {
      if (isDragLeavingWindow(event)) {
        setHasInventoryDragInWindow(false);
      }
    };

    window.addEventListener('dragenter', trackInventoryDragEnter);
    window.addEventListener('dragleave', trackInventoryDragLeave);
    window.addEventListener('dragend', resetDragSession);
    window.addEventListener('drop', resetDragSession);

    return () => {
      window.removeEventListener('dragenter', trackInventoryDragEnter);
      window.removeEventListener('dragleave', trackInventoryDragLeave);
      window.removeEventListener('dragend', resetDragSession);
      window.removeEventListener('drop', resetDragSession);
      resetDragSession();
    };
  }, [resetSnapshotHoverSession]);

  // Grail bookmarks are tracker bookmarks, not items: they must not show up as vault tiles. The
  // type and item property filters and the sort order are applied here; search, character and
  // location are part of the vault query.
  const vaultItems = useMemo(
    () =>
      sortItems(
        (inventoryResponse?.vault.items ?? []).filter(
          (item) =>
            !isGrailBookmark(item) &&
            (typeFilter === 'all' || getTypeValue(item.type) === typeFilter) &&
            matchesItemPropertyFilters(item, propertyFilters),
        ),
        sortOrder,
      ),
    [inventoryResponse?.vault.items, typeFilter, propertyFilters, sortOrder],
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

          return (
            (typeFilter === 'all' || getTypeValue(item.type) === typeFilter) &&
            matchesItemPropertyFilters(item, propertyFilters)
          );
        }),
      }))
      .filter((snapshot) => snapshot.items.length > 0);
  }, [inventoryResponse?.inventory.snapshots, typeFilter, propertyFilters]);

  const snapshotGroups = useMemo(
    () => groupSnapshotList(snapshots, characters),
    [snapshots, characters],
  );

  const matchingItems = useMemo(
    () =>
      sortItems(
        snapshots.flatMap((snapshot) => snapshot.items),
        sortOrder,
      ),
    [snapshots, sortOrder],
  );

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

  const handleVaultDrop = useCallback(
    async (event: DragEvent<HTMLElement>) => {
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
    async (snapshot: InventorySnapshotWindowTarget): Promise<void> => {
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

  const isInitialLoad = isLoading && !inventoryResponse;
  const hasActiveFilters =
    searchText.trim() !== '' ||
    characterId !== 'all' ||
    locationContext !== 'all' ||
    typeFilter !== 'all' ||
    hasActiveItemPropertyFilters(propertyFilters);
  const isVaultDropzoneVisible = hasRemoteInventoryDrag || hasInventoryDragInWindow;
  // With filters on, an empty vault can mean "nothing matches", so say so instead of hiding it.
  // Not tied to `isLoading`, so the card stays mounted while a reload is in flight; before the
  // first response (or after a failed first load) there is no response and nothing is claimed.
  const isVaultCardVisible =
    vaultItems.length > 0 || (hasActiveFilters && inventoryResponse !== null);

  return (
    <PageShell>
      <PageHeader title={t(translations.inventoryBrowser.title)} />

      <SaveWriteNotice />

      <section aria-labelledby={snapshotListTitleId} className="space-y-4">
        <div className="space-y-1">
          <h2 id={snapshotListTitleId} className="font-semibold text-base">
            {t(translations.inventoryBrowser.snapshotList.title)}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t(translations.inventoryBrowser.snapshotList.description)}
          </p>
        </div>
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
          propertyFilterProps={{
            filters: propertyFilters,
            onChange: setPropertyFilters,
            sortOrder,
            onSortOrderChange: setSortOrder,
          }}
        />
        {isInitialLoad ? (
          <output className="flex items-center justify-center gap-2 py-4 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t(translations.common.loading)}
          </output>
        ) : !isLoading && snapshots.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm">
            {t(translations.inventoryBrowser.snapshotList.empty)}
          </div>
        ) : (
          snapshotGroups.map((group) => {
            const groupTitleId = `${snapshotListTitleId}-${group.kind}`;
            return (
              <section key={group.kind} aria-labelledby={groupTitleId} className="space-y-2">
                <h3 id={groupTitleId} className="font-medium text-sm">
                  {t(SNAPSHOT_GROUP_TITLE_KEYS[group.kind])}
                </h3>
                <ul className="space-y-2">
                  {group.entries.map(({ snapshot, character }) => (
                    <li key={snapshot.snapshotId}>
                      <SnapshotListRow
                        snapshot={snapshot}
                        character={character}
                        onOpen={(target) => {
                          void handleOpenSnapshotWindow(target);
                        }}
                        onDragOver={handleSnapshotRowDragOver}
                        onDragLeave={handleSnapshotRowDragLeave}
                        onDrop={resetSnapshotHoverSession}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
        {hasActiveFilters && inventoryResponse !== null && (
          <MatchingItemsList
            items={matchingItems}
            onOpen={(item) => {
              void handleOpenSnapshotWindow(item);
            }}
          />
        )}
      </section>

      {isVaultCardVisible && (
        <Card>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle className="text-base">
                {t(translations.inventoryBrowser.vaultedItems)}
              </CardTitle>
              {hasActiveFilters && (
                <div className="text-muted-foreground text-sm">
                  {t(translations.inventoryBrowser.filters.vaultFiltered)}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {vaultItems.length === 0 && (
              <div className="text-muted-foreground text-sm">
                {t(translations.inventoryBrowser.empty)}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {vaultItems.map((item) => (
                <VaultedItemTile
                  key={item.id}
                  item={item}
                  iconLookup={spriteIconLookup}
                  selected={item.id === selectedVaultItemId}
                  onSelect={(selected) => setSelectedVaultItemId(selected.id)}
                  onDragStart={(dragged) => {
                    window.electronAPI?.inventory.sendVaultDragState({
                      active: true,
                      ...toActiveVaultDragItem(dragged),
                    });
                  }}
                  onDragEnd={() => {
                    window.electronAPI?.inventory.sendVaultDragState({
                      active: false,
                      ...toActiveVaultDragItem(item),
                    });
                  }}
                />
              ))}
            </div>
            {selectedVaultItem && (
              <SelectedVaultItemPanel
                item={selectedVaultItem}
                isUnvaulting={isUnvaulting}
                onUnvault={(item) => {
                  void unvaultItem(item, () => setSelectedVaultItemId(undefined));
                }}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Appended last and sticky, so showing it mid-drag doesn't move the rows above */}
      {isVaultDropzoneVisible && (
        <div className="sticky bottom-0 rounded-lg bg-background shadow-lg">
          <VaultDropzone onDropItem={handleVaultDrop} className="py-6" />
        </div>
      )}
    </PageShell>
  );
}
