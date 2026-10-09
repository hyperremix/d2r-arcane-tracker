import type {
  InventorySnapshotWindowTarget,
  ParsedInventoryItem,
  VaultItem,
} from 'electron/types/grail';
import { isGrailBookmark } from 'electron/utils/vaultState';
import { type DragEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { InventoryFilterBar, type LocationFilter } from '@/components/inventory/InventoryFilterBar';
import {
  getEffectiveVaultPresent,
  getTypeValue,
  type TypeFilter,
  toVaultUpsertInput,
} from '@/components/inventory/inventoryItems';
import { SelectedItemCard } from '@/components/inventory/SelectedItemCard';
import {
  type SnapshotBoardTileProps,
  SnapshotInventoryCard,
} from '@/components/inventory/SnapshotInventoryCard';
import { StackPickupCursor } from '@/components/inventory/StackPickupCursor';
import type { EquippedWeaponSet } from '@/components/inventory/spatialLayout';
import { useInventoryDragSync } from '@/components/inventory/useInventoryDragSync';
import { useInventoryIconLookup } from '@/components/inventory/useInventoryIconLookup';
import { useInventoryMoveActions } from '@/components/inventory/useInventoryMoveActions';
import { useInventorySearch } from '@/components/inventory/useInventorySearch';
import { useStackPickup } from '@/components/inventory/useStackPickup';
import { useVaultActions } from '@/components/inventory/useVaultActions';
import { VaultDropzone } from '@/components/inventory/VaultDropzone';
import { VaultedItemTile } from '@/components/inventory/VaultedItemTile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { translations } from '@/i18n/translations';

interface CharacterInventoryBrowserProps {
  mode?: 'full' | 'snapshot';
  snapshotTarget?: InventorySnapshotWindowTarget;
}

/**
 * Inventory browser with every board of each character and stash file. In `snapshot` mode it
 * shows a single file in its own window, without the filters and the vault.
 */
export function CharacterInventoryBrowser({
  mode = 'full',
  snapshotTarget,
}: CharacterInventoryBrowserProps) {
  const { t } = useTranslation();
  const isSnapshotMode = mode === 'snapshot';
  const [selectedVaultItemId, setSelectedVaultItemId] = useState<string | undefined>(undefined);
  const [searchText, setSearchText] = useState('');
  const [characterId, setCharacterId] = useState('all');
  const [locationContext, setLocationContext] = useState<LocationFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [selectedItemFingerprint, setSelectedItemFingerprint] = useState<string | undefined>(
    undefined,
  );
  const [equipmentWeaponSet, setEquipmentWeaponSet] = useState<EquippedWeaponSet>('i');
  const spriteIconLookup = useInventoryIconLookup();

  const { isLoading, inventoryResponse, loadInventorySearch, reloadInventoryAfterSaveWrite } =
    useInventorySearch({
      searchText: isSnapshotMode ? '' : searchText,
      characterId: isSnapshotMode ? 'all' : characterId,
      locationContext: isSnapshotMode ? 'all' : locationContext,
    });
  const { isVaulting, isUnvaulting, pendingVaultFingerprints, vaultItem, unvaultItem } =
    useVaultActions({ loadInventorySearch, reloadInventoryAfterSaveWrite });
  const { pickupState, startPickup, decrementPickup, consumePickup, cancelPickup } =
    useStackPickup();
  const dragSync = useInventoryDragSync({ pickupState, cancelPickup, consumePickup });
  const {
    activeVaultDragItem,
    activeInventoryDragItem,
    resolvedStackPickupState,
    cursorPickupState,
    isStackPickupMode,
    handleItemDragStart,
    handleItemDragEnd,
    handleVaultItemDragStart,
    handleVaultItemDragEnd,
    resolveVaultDropInput,
    finishVaultDrop,
    cancelStackPickup,
  } = dragSync;

  const vaultItemsByFingerprint = useMemo(() => {
    const map = new Map<string, VaultItem>();

    for (const item of inventoryResponse?.vault.items ?? []) {
      map.set(item.fingerprint, item);
    }

    return map;
  }, [inventoryResponse?.vault.items]);

  const snapshots = useMemo(() => {
    const sourceSnapshots = inventoryResponse?.inventory.snapshots ?? [];
    const matchingSnapshots =
      isSnapshotMode && snapshotTarget
        ? sourceSnapshots.filter(
            (snapshot) =>
              snapshot.sourceFilePath === snapshotTarget.sourceFilePath &&
              snapshot.sourceFileType === snapshotTarget.sourceFileType,
          )
        : sourceSnapshots;

    return matchingSnapshots
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

          const matchesType =
            isSnapshotMode || typeFilter === 'all' || getTypeValue(item.type) === typeFilter;
          return matchesType;
        }),
      }))
      .filter((snapshot) => snapshot.items.length > 0);
  }, [
    inventoryResponse?.inventory.snapshots,
    isSnapshotMode,
    snapshotTarget,
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

  // Grail bookmarks are tracker bookmarks, not items: they must not show up as draggable vault tiles.
  const vaultItems = useMemo(
    () => (inventoryResponse?.vault.items ?? []).filter((item) => !isGrailBookmark(item)),
    [inventoryResponse?.vault.items],
  );

  const selectedVaultItem = useMemo(
    () => vaultItems.find((item) => item.id === selectedVaultItemId),
    [selectedVaultItemId, vaultItems],
  );

  const characterOptions = useMemo(() => {
    const options = new Map<string, string>();

    for (const snapshot of inventoryResponse?.inventory.snapshots ?? []) {
      const key = snapshot.characterId ?? `name:${snapshot.characterName}`;
      options.set(key, snapshot.characterName);
    }

    return [...options.entries()];
  }, [inventoryResponse?.inventory.snapshots]);

  const moveActions = useInventoryMoveActions({
    vaultItems,
    pickupState,
    consumePickup,
    dragSync,
    reloadInventoryAfterSaveWrite,
  });

  // Returns an item with stackCount reduced by the current pickup count when that item is the
  // active pickup source, so tab sections show the remaining (not-yet-picked-up) quantity.
  const applyPickupAdjustment = useCallback(
    (item: ParsedInventoryItem): ParsedInventoryItem => {
      if (!resolvedStackPickupState || resolvedStackPickupState.fingerprint !== item.fingerprint) {
        return item;
      }
      return {
        ...item,
        stackCount: Math.max(0, (item.stackCount ?? 1) - resolvedStackPickupState.count),
      };
    },
    [resolvedStackPickupState],
  );

  const handleSelectItem = useCallback((item: ParsedInventoryItem) => {
    setSelectedItemFingerprint(item.fingerprint);
  }, []);

  const handleUnvault = (): void => {
    if (!selectedVaultItemId) {
      return;
    }

    void unvaultItem(selectedVaultItemId, () => setSelectedVaultItemId(undefined));
  };

  const handleVaultDrop = async (event: DragEvent<HTMLButtonElement>) => {
    const itemInput = resolveVaultDropInput(event, visibleItems);
    if (!itemInput) {
      return;
    }

    await vaultItem(itemInput);
    finishVaultDrop();
  };

  const tileProps: SnapshotBoardTileProps = {
    iconLookup: spriteIconLookup,
    selectedFingerprint: selectedItemFingerprint,
    pendingVaultFingerprints,
    vaultItemsByFingerprint,
    onSelect: handleSelectItem,
    onDragStart: handleItemDragStart,
    onDragEnd: handleItemDragEnd,
  };

  const emptyStateMessage =
    isSnapshotMode && snapshotTarget
      ? t(translations.inventoryBrowser.snapshotWindow.notFound, {
          characterName: snapshotTarget.characterName,
        })
      : t(translations.inventoryBrowser.empty);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: outer scroll container captures click-to-cancel for pickup mode; interactive children handle keyboard accessibility.
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape key is handled globally in useStackPickup; this click handler only cancels pickup on empty-space clicks.
    <div
      className="flex-1 overflow-auto p-4"
      onClick={(event) => {
        if (!isStackPickupMode) return;
        // If the click landed on a board surface or a tab section tile, let those handlers run.
        const target = event.target as HTMLElement;
        const isOnBoard = target.closest('[data-testid]') !== null;
        if (!isOnBoard) {
          cancelStackPickup();
          toast.info(t(translations.inventoryBrowser.stackPickup.cancelled));
        }
      }}
    >
      {cursorPickupState && <StackPickupCursor pickupState={cursorPickupState} />}
      <div className="flex w-full flex-col gap-4">
        {!isSnapshotMode && (
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
        )}

        {!isSnapshotMode && vaultItems.length > 0 && (
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
                    onClick={handleUnvault}
                  >
                    {t(translations.vault.unvaultAction)}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!isSnapshotMode && <VaultDropzone onDropItem={handleVaultDrop} />}

        {!isLoading && snapshots.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              {emptyStateMessage}
            </CardContent>
          </Card>
        )}

        {snapshots.map((snapshot) => (
          <SnapshotInventoryCard
            key={snapshot.snapshotId}
            snapshot={snapshot}
            locationContext={locationContext}
            tileProps={tileProps}
            weaponSet={equipmentWeaponSet}
            onWeaponSetChange={setEquipmentWeaponSet}
            activeVaultDragItem={activeVaultDragItem}
            activeInventoryDragItem={activeInventoryDragItem}
            moveActions={moveActions}
            onStartPickup={startPickup}
            onDecrementPickup={decrementPickup}
            applyPickupAdjustment={applyPickupAdjustment}
          />
        ))}

        <SelectedItemCard
          item={selectedItem}
          isVaultPresent={
            selectedItem
              ? getEffectiveVaultPresent(
                  selectedItem,
                  vaultItemsByFingerprint,
                  pendingVaultFingerprints,
                )
              : undefined
          }
          isVaulting={isVaulting}
          onVault={(item) => {
            void vaultItem(toVaultUpsertInput(item));
          }}
        />
      </div>
    </div>
  );
}
