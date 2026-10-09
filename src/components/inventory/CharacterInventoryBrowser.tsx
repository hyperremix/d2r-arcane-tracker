import { INVENTORY_DRAG_STATE_CHANNEL, VAULT_DRAG_STATE_CHANNEL } from 'electron/ipc/contract';
import type {
  InventorySnapshotWindowTarget,
  ParsedInventoryItem,
  VaultItem,
  VaultItemUpsertInput,
  VaultLocationContext,
  VaultSourceFileType,
} from 'electron/types/grail';
import { isGrailBookmark } from 'electron/utils/vaultState';
import { PackagePlus, Sparkles } from 'lucide-react';
import { type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  type ActiveInventoryDragItem,
  type ActiveVaultDragItem,
  INVENTORY_DRAG_MIME,
  type InventoryDragStatePayload,
  isSameInventoryMoveTarget,
  parseInventoryDragStatePayload,
  parseInventoryTextPayload,
  parseVaultDragStatePayload,
  resolveActiveInventoryDragItem,
  serializeInventoryTextPayload,
  toActiveVaultDragItem,
  toInventoryDragStatePayload,
} from '@/components/inventory/dragPayloads';
import { EquipmentSection } from '@/components/inventory/EquipmentSection';
import { showEquipValidationToastIfPresent } from '@/components/inventory/equipValidation';
import { GemsTabSection } from '@/components/inventory/GemsTabSection';
import { InventoryGridSection } from '@/components/inventory/InventoryGridSection';
import { InventoryTile } from '@/components/inventory/InventoryTile';
import {
  formatLocation,
  formatSourceFileTypeLabel,
  getCoordinatesLabel,
  getDimensionsLabel,
  getPresenceLabel,
  getSlotLabel,
} from '@/components/inventory/inventoryItemLabels';
import {
  getEffectiveVaultPresent,
  getTypeValue,
  partitionUnknownItems,
  type TypeFilter,
  toVaultUpsertInput,
} from '@/components/inventory/inventoryItems';
import {
  buildInventorySearchFilter,
  type InventorySearchAllResponse,
  loadInventorySearchResponse,
} from '@/components/inventory/inventorySearch';
import { MaterialsTabSection } from '@/components/inventory/MaterialsTabSection';
import { MercenaryEquipmentSection } from '@/components/inventory/MercenaryEquipmentSection';
import { RunesTabSection } from '@/components/inventory/RunesTabSection';
import {
  StackPickupCursor,
  type StackPickupCursorState,
} from '@/components/inventory/StackPickupCursor';
import {
  DEFAULT_BELT_GRID_SIZE,
  DEFAULT_INVENTORY_GRID_SIZE,
  DEFAULT_STASH_GRID_SIZE,
  type EquippedWeaponSet,
  findStackPickupSlots,
  type GridSize,
  groupSpatialItems,
} from '@/components/inventory/spatialLayout';
import {
  isStackPickupDragState,
  resolveStackPickupState,
  toStackPickupDragStatePayload,
} from '@/components/inventory/stackPickupDragState';
import {
  buildStashTabsToRender,
  canDropItemCodeInModernResourceTab,
  getStashSectionTitle,
  isStashSourceFileType,
  normalizeResourceItemCode,
  resolveWithdrawCountForGridDrop,
} from '@/components/inventory/stashTabs';
import { type StackPickupState, useStackPickup } from '@/components/inventory/useStackPickup';
import { VaultedItemTile } from '@/components/inventory/VaultedItemTile';
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
import { combineUnsubscribers, onMainEvent } from '@/lib/ipcEvents';
import { createSpriteIconLookupIndex } from '@/lib/spriteIconCandidates';
import { useGrailStore } from '@/stores/grailStore';
import {
  isModernStashReadOnlyError,
  showInventoryOperationErrorToast,
  showModernStashReadOnlyToast,
} from './operationErrors';

interface CharacterInventoryBrowserProps {
  mode?: 'full' | 'snapshot';
  snapshotTarget?: InventorySnapshotWindowTarget;
}

/* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This component intentionally coordinates multiple inventory sections and drag/drop flows in one renderer entrypoint. */
export function CharacterInventoryBrowser({
  mode = 'full',
  snapshotTarget,
}: CharacterInventoryBrowserProps) {
  const { t } = useTranslation();
  const isSnapshotMode = mode === 'snapshot';
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
  const [draggingVaultItem, setDraggingVaultItem] = useState<ActiveVaultDragItem | null>(null);
  const [crossWindowVaultDragItem, setCrossWindowVaultDragItem] =
    useState<ActiveVaultDragItem | null>(null);
  const [draggingInventoryItem, setDraggingInventoryItem] =
    useState<ActiveInventoryDragItem | null>(null);
  const [crossWindowInventoryDragItem, setCrossWindowInventoryDragItem] =
    useState<ActiveInventoryDragItem | null>(null);
  const [pendingVaultFingerprints, setPendingVaultFingerprints] = useState<Set<string>>(new Set());
  const [inventoryResponse, setInventoryResponse] = useState<InventorySearchAllResponse | null>(
    null,
  );
  const [selectedItemFingerprint, setSelectedItemFingerprint] = useState<string | undefined>(
    undefined,
  );
  const [equipmentWeaponSet, setEquipmentWeaponSet] = useState<EquippedWeaponSet>('i');
  // Only one save-file write may be in flight: a second drop/click while the first is still being
  // written would act on stale positions and could place an item twice.
  const isWriteInFlightRef = useRef(false);
  const draggingFingerprintRef = useRef<string | undefined>(undefined);
  const draggingVaultInputRef = useRef<VaultItemUpsertInput | undefined>(undefined);
  const latestSearchRequestRef = useRef(0);
  const spriteIconLookup = useMemo(() => createSpriteIconLookupIndex(grailItems), [grailItems]);

  const { pickupState, startPickup, decrementPickup, consumePickup, cancelPickup } =
    useStackPickup();
  const pickupStateRef = useRef<StackPickupState | undefined>(undefined);
  pickupStateRef.current = pickupState;
  const lastSyncedStackPickupPayloadRef = useRef<InventoryDragStatePayload | undefined>(undefined);

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

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Async loading uses guarded request ids and mode-dependent filters.
  const loadInventorySearch = useCallback(async (): Promise<void> => {
    const requestId = latestSearchRequestRef.current + 1;
    latestSearchRequestRef.current = requestId;
    const filter = buildInventorySearchFilter(
      isSnapshotMode ? '' : searchText,
      isSnapshotMode ? 'all' : characterId,
      isSnapshotMode ? 'all' : locationContext,
    );

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
  }, [characterId, isSnapshotMode, locationContext, searchText]);

  useEffect(() => {
    void loadInventorySearch();
  }, [loadInventorySearch]);

  useEffect(() => {
    let isDisposed = false;

    const handleVaultDragState = (payload: unknown) => {
      const parsedPayload = parseVaultDragStatePayload(payload);
      if (!parsedPayload) {
        return;
      }

      if (parsedPayload.active) {
        setCrossWindowVaultDragItem(parsedPayload);
        return;
      }

      setCrossWindowVaultDragItem((current) => (current?.id === parsedPayload.id ? null : current));
    };

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: inventory drag-state synchronization intentionally handles local/remote pickup reconciliation and cancellation in one guarded callback.
    const handleInventoryDragState = (payload: unknown) => {
      const parsedPayload = parseInventoryDragStatePayload(payload);
      if (!parsedPayload) {
        return;
      }

      if (parsedPayload.active) {
        if (
          isStackPickupDragState(parsedPayload) &&
          pickupStateRef.current?.sourceItem?.fingerprint === parsedPayload.fingerprint
        ) {
          const localCount = pickupStateRef.current.count;
          const remoteCount = parsedPayload.stackPickupCount ?? localCount;
          if (remoteCount <= 0) {
            cancelPickup();
          } else if (remoteCount < localCount) {
            consumePickup(localCount - remoteCount);
          }
        }

        setCrossWindowInventoryDragItem(parsedPayload);
        return;
      }

      if (
        parsedPayload.stackPickup === true &&
        pickupStateRef.current?.sourceItem?.fingerprint === parsedPayload.fingerprint
      ) {
        cancelPickup();
      }

      setCrossWindowInventoryDragItem((current) =>
        current?.fingerprint === parsedPayload.fingerprint ? null : current,
      );
    };

    const unsubscribe = combineUnsubscribers([
      onMainEvent(VAULT_DRAG_STATE_CHANNEL, handleVaultDragState),
      onMainEvent(INVENTORY_DRAG_STATE_CHANNEL, handleInventoryDragState),
    ]);

    const getActiveDragState = window.electronAPI?.inventory?.getActiveDragState;
    if (typeof getActiveDragState === 'function') {
      void getActiveDragState()
        .then((payload) => {
          if (isDisposed || !payload || typeof payload !== 'object') {
            return;
          }

          const rawPayload: { vault?: unknown; inventory?: unknown } = payload;
          const parsedVaultPayload = parseVaultDragStatePayload(rawPayload.vault);
          if (parsedVaultPayload?.active) {
            setCrossWindowVaultDragItem(parsedVaultPayload);
          }

          const parsedInventoryPayload = parseInventoryDragStatePayload(rawPayload.inventory);
          if (parsedInventoryPayload?.active) {
            setCrossWindowInventoryDragItem(parsedInventoryPayload);
          }
        })
        .catch((error) => {
          if (!isDisposed) {
            console.warn('Failed to get active inventory drag state', error);
          }
        });
    }

    return () => {
      isDisposed = true;
      unsubscribe();
    };
  }, [cancelPickup, consumePickup]);

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

    const unsubscribe = onMainEvent('save-file-event', handleSaveFileEvent);

    return () => {
      if (reloadTimeout) {
        clearTimeout(reloadTimeout);
      }
      unsubscribe();
    };
  }, [loadInventorySearch]);

  useEffect(() => {
    const payload = pickupState ? toStackPickupDragStatePayload(pickupState) : undefined;
    if (payload) {
      lastSyncedStackPickupPayloadRef.current = payload;
      setCrossWindowInventoryDragItem(payload);
      window.electronAPI?.inventory.sendItemDragState(payload);
      return;
    }

    const lastPayload = lastSyncedStackPickupPayloadRef.current;
    if (!lastPayload) {
      return;
    }

    lastSyncedStackPickupPayloadRef.current = undefined;
    setCrossWindowInventoryDragItem((current) =>
      current?.fingerprint === lastPayload.fingerprint && isStackPickupDragState(current)
        ? null
        : current,
    );
    window.electronAPI?.inventory.sendItemDragState({
      ...lastPayload,
      active: false,
    });
  }, [pickupState]);

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

  const selectedItemVaultPresent = selectedItem
    ? getEffectiveVaultPresent(selectedItem, vaultItemsByFingerprint, pendingVaultFingerprints)
    : undefined;

  // Grail bookmarks are tracker bookmarks, not items: they must not show up as draggable vault tiles.
  const vaultItems = useMemo(
    () => (inventoryResponse?.vault.items ?? []).filter((item) => !isGrailBookmark(item)),
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
      if (isModernStashReadOnlyError(error)) {
        showModernStashReadOnlyToast(t);
        return;
      }
      console.error('Failed to unvault item', error);
      showInventoryOperationErrorToast(error, t);
      await loadInventorySearch();
    } finally {
      setIsUnvaulting(false);
    }
  }, [selectedVaultItemId, isUnvaulting, loadInventorySearch, reloadInventoryAfterSaveWrite, t]);

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
        if (isModernStashReadOnlyError(error)) {
          showModernStashReadOnlyToast(t);
          return;
        }
        console.error('Failed to vault inventory item', error);
        showInventoryOperationErrorToast(error, t);
        await reloadInventoryAfterSaveWrite();
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
    [isVaulting, loadInventorySearch, reloadInventoryAfterSaveWrite, t],
  );

  const handleCardDragStart = (event: DragEvent<HTMLButtonElement>, item: ParsedInventoryItem) => {
    draggingFingerprintRef.current = item.fingerprint;
    const itemInput = toVaultUpsertInput(item);
    draggingVaultInputRef.current = itemInput;
    const dragStatePayload = toInventoryDragStatePayload(itemInput);
    if (dragStatePayload) {
      setDraggingInventoryItem(dragStatePayload);
      window.electronAPI?.inventory.sendItemDragState(dragStatePayload);
    }

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(INVENTORY_DRAG_MIME, item.fingerprint);
    event.dataTransfer.setData('text/plain', serializeInventoryTextPayload(itemInput));
    event.dataTransfer.setData('text', serializeInventoryTextPayload(itemInput));
  };

  const handleCardDragEnd = () => {
    draggingFingerprintRef.current = undefined;
    draggingVaultInputRef.current = undefined;
    setDraggingInventoryItem((current) => {
      if (current) {
        window.electronAPI?.inventory.sendItemDragState({
          ...current,
          active: false,
        });
      }

      return null;
    });
  };

  const handleVaultItemDragStart = useCallback((item: VaultItem) => {
    const dragItem = toActiveVaultDragItem(item);
    setDraggingVaultItem(dragItem);
    window.electronAPI?.inventory.sendVaultDragState({
      active: true,
      ...dragItem,
    });
  }, []);

  const handleVaultItemDragEnd = useCallback(() => {
    setDraggingVaultItem((current) => {
      if (current) {
        window.electronAPI?.inventory.sendVaultDragState({
          active: false,
          ...current,
        });
      }

      return null;
    });
  }, []);

  const activeVaultDragItem = draggingVaultItem ?? crossWindowVaultDragItem;
  const activeInventoryDragItem = draggingInventoryItem ?? crossWindowInventoryDragItem;
  const resolvedStackPickupState = resolveStackPickupState(
    pickupState,
    crossWindowInventoryDragItem,
  );
  const cursorPickupState: StackPickupCursorState | undefined =
    pickupState ?? resolvedStackPickupState;
  const isStackPickupMode = resolvedStackPickupState !== undefined;

  const getActiveSynchronizedStackPickupDragItem = useCallback(async (): Promise<
    ActiveInventoryDragItem | undefined
  > => {
    const getActiveDragState = window.electronAPI?.inventory?.getActiveDragState;
    if (typeof getActiveDragState !== 'function') {
      return undefined;
    }

    try {
      const payload = await getActiveDragState();
      if (!payload || typeof payload !== 'object') {
        return undefined;
      }

      const rawPayload: { inventory?: unknown } = payload;
      const parsedInventoryPayload = parseInventoryDragStatePayload(rawPayload.inventory);
      if (!parsedInventoryPayload?.active || !isStackPickupDragState(parsedInventoryPayload)) {
        return undefined;
      }

      setCrossWindowInventoryDragItem(parsedInventoryPayload);
      return parsedInventoryPayload;
    } catch (error) {
      console.warn('Failed to get active inventory drag state', error);
      return undefined;
    }
  }, []);

  const handleMoveInventoryItem = useCallback(
    async (
      inventoryItem: ActiveInventoryDragItem,
      targetFilePath: string,
      targetFileType: VaultSourceFileType,
      targetLocationContext: VaultLocationContext,
      targetStashTab: number | undefined,
      targetGridX: number | undefined,
      targetGridY: number | undefined,
      targetEquippedSlotId?: number,
    ): Promise<void> => {
      if (!window.electronAPI?.inventory?.moveItem) {
        return;
      }

      if (
        isSameInventoryMoveTarget(
          inventoryItem,
          targetFilePath,
          targetFileType,
          targetLocationContext,
          targetStashTab,
          targetGridX,
          targetGridY,
          targetEquippedSlotId,
        )
      ) {
        return;
      }

      if (isWriteInFlightRef.current) {
        return;
      }
      isWriteInFlightRef.current = true;

      try {
        await window.electronAPI.inventory.moveItem({
          sourceFilePath: inventoryItem.sourceFilePath,
          sourceFileType: inventoryItem.sourceFileType,
          rawItemJson: inventoryItem.rawItemJson,
          sourceStashTab: inventoryItem.sourceStashTab,
          targetFilePath,
          targetFileType,
          targetLocationContext,
          targetStashTab,
          targetGridX,
          targetGridY,
          targetEquippedSlotId,
        });
        window.electronAPI?.inventory.sendItemDragState({
          ...inventoryItem,
          active: false,
        });
        setDraggingInventoryItem(null);
        setCrossWindowInventoryDragItem(null);
        await reloadInventoryAfterSaveWrite();
      } catch (error) {
        if (isModernStashReadOnlyError(error)) {
          showModernStashReadOnlyToast(t);
          return;
        }
        if (showEquipValidationToastIfPresent(error, t)) {
          return;
        }

        console.error('Failed to move inventory item', error);
        showInventoryOperationErrorToast(error, t);
        await reloadInventoryAfterSaveWrite();
      } finally {
        isWriteInFlightRef.current = false;
      }
    },
    [reloadInventoryAfterSaveWrite, t],
  );

  const handleDropInventoryItemOnResourceTab = useCallback(
    async (
      event: DragEvent<HTMLDivElement>,
      targetFilePath: string,
      targetFileType: VaultSourceFileType,
      targetStashTab: number,
      targetGridX: number,
      targetGridY: number,
    ): Promise<void> => {
      const inventoryItem = resolveActiveInventoryDragItem(event, activeInventoryDragItem);
      if (!inventoryItem) {
        return;
      }

      const normalizedItemCode = normalizeResourceItemCode(inventoryItem.itemCode);
      if (
        !normalizedItemCode ||
        !canDropItemCodeInModernResourceTab(normalizedItemCode, targetStashTab)
      ) {
        return;
      }

      await handleMoveInventoryItem(
        inventoryItem,
        targetFilePath,
        targetFileType,
        'stash',
        targetStashTab,
        targetGridX,
        targetGridY,
      );
    },
    [activeInventoryDragItem, handleMoveInventoryItem],
  );

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
      if (isWriteInFlightRef.current) {
        return;
      }
      isWriteInFlightRef.current = true;

      try {
        const withdrawCount = resolveWithdrawCountForGridDrop(
          vaultItems.find((item) => item.id === vaultItemId),
        );
        const target = {
          targetFilePath,
          targetFileType,
          targetLocationContext,
          targetStashTab,
          targetGridX,
          targetGridY,
        };
        if (withdrawCount === undefined) {
          await window.electronAPI.vault.unvaultItem(vaultItemId, target);
        } else {
          await window.electronAPI.vault.unvaultItem(vaultItemId, target, withdrawCount);
        }
        setDraggingVaultItem(null);
        setCrossWindowVaultDragItem(null);
        await reloadInventoryAfterSaveWrite();
      } catch (error) {
        if (isModernStashReadOnlyError(error)) {
          showModernStashReadOnlyToast(t);
          return;
        }
        console.error('Failed to unvault item to target', error);
        showInventoryOperationErrorToast(error, t);
        await reloadInventoryAfterSaveWrite();
      } finally {
        isWriteInFlightRef.current = false;
      }
    },
    [reloadInventoryAfterSaveWrite, t, vaultItems],
  );

  const clearSynchronizedStackPickup = useCallback((pickupItem: ActiveInventoryDragItem): void => {
    const inactivePayload: InventoryDragStatePayload = {
      ...pickupItem,
      active: false,
    };
    lastSyncedStackPickupPayloadRef.current = undefined;
    setCrossWindowInventoryDragItem((current) =>
      current?.fingerprint === pickupItem.fingerprint && isStackPickupDragState(current)
        ? null
        : current,
    );
    window.electronAPI?.inventory.sendItemDragState(inactivePayload);
  }, []);

  const consumeSynchronizedStackPickup = useCallback(
    (pickupItem: ActiveInventoryDragItem, placedCount: number): void => {
      const remaining = (pickupItem.stackPickupCount ?? 0) - placedCount;
      if (remaining > 0) {
        const nextPayload: InventoryDragStatePayload = {
          ...pickupItem,
          active: true,
          stackPickupCount: remaining,
        };
        lastSyncedStackPickupPayloadRef.current = nextPayload;
        setCrossWindowInventoryDragItem(nextPayload);
        window.electronAPI?.inventory.sendItemDragState(nextPayload);
        return;
      }

      clearSynchronizedStackPickup(pickupItem);
    },
    [clearSynchronizedStackPickup],
  );

  // Handles clicking on a grid while pickup mode is active.
  const handleStackPickupOnGrid = useCallback(
    async (
      targetItems: ParsedInventoryItem[],
      gridSize: GridSize,
      targetFilePath: string,
      targetFileType: VaultSourceFileType,
      targetLocationContext: VaultLocationContext,
      targetStashTab?: number,
      preferredGridX?: number,
      preferredGridY?: number,
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: this callback intentionally keeps split-target calculation, write call, and synchronized/local pickup state reconciliation in one transactional path.
    ): Promise<void> => {
      if (!window.electronAPI?.inventory?.splitStack) {
        return;
      }

      let effectivePickupState = resolvedStackPickupState;
      let synchronizedPickupItem = crossWindowInventoryDragItem;

      if (!effectivePickupState) {
        const fetchedSynchronizedPickupItem = await getActiveSynchronizedStackPickupDragItem();
        if (fetchedSynchronizedPickupItem) {
          synchronizedPickupItem = fetchedSynchronizedPickupItem;
          effectivePickupState = resolveStackPickupState(undefined, fetchedSynchronizedPickupItem);
        }
      }

      if (!effectivePickupState) {
        return;
      }

      const slots = findStackPickupSlots(
        gridSize,
        targetItems,
        effectivePickupState.gridWidth,
        effectivePickupState.gridHeight,
        effectivePickupState.count,
        preferredGridX,
        preferredGridY,
      );

      if (slots.length === 0) {
        toast.warning(t(translations.inventoryBrowser.stackPickup.noSpace));
        return;
      }

      if (isWriteInFlightRef.current) {
        return;
      }
      isWriteInFlightRef.current = true;

      try {
        await window.electronAPI.inventory.splitStack({
          sourceFilePath: effectivePickupState.sourceFilePath,
          sourceFileType: effectivePickupState.sourceFileType,
          sourceStashTab: effectivePickupState.sourceStashTab,
          sourceItemCode: effectivePickupState.itemCode,
          sourceRawItemJson: effectivePickupState.sourceRawItemJson,
          splitCount: slots.length,
          targets: slots.map((slot) => ({
            targetFilePath,
            targetFileType,
            targetLocationContext,
            targetStashTab,
            targetGridX: slot.x,
            targetGridY: slot.y,
          })),
        });

        if (pickupState) {
          consumePickup(slots.length);
        } else if (isStackPickupDragState(synchronizedPickupItem)) {
          consumeSynchronizedStackPickup(synchronizedPickupItem, slots.length);
        }

        if (slots.length < effectivePickupState.count) {
          toast.info(
            t(translations.inventoryBrowser.stackPickup.partialPlace, {
              placed: slots.length,
              total: effectivePickupState.count,
            }),
          );
        } else {
          toast.success(
            t(translations.inventoryBrowser.stackPickup.placed, { count: slots.length }),
          );
        }

        await reloadInventoryAfterSaveWrite();
      } catch (error) {
        if (isModernStashReadOnlyError(error)) {
          showModernStashReadOnlyToast(t);
          if (pickupState) {
            cancelPickup();
          } else if (isStackPickupDragState(crossWindowInventoryDragItem)) {
            clearSynchronizedStackPickup(crossWindowInventoryDragItem);
          }
          return;
        }
        console.error('Failed to split stack', error);
        showInventoryOperationErrorToast(error, t);
        await reloadInventoryAfterSaveWrite();
      } finally {
        isWriteInFlightRef.current = false;
      }
    },
    [
      cancelPickup,
      crossWindowInventoryDragItem,
      clearSynchronizedStackPickup,
      consumeSynchronizedStackPickup,
      consumePickup,
      getActiveSynchronizedStackPickupDragItem,
      pickupState,
      reloadInventoryAfterSaveWrite,
      resolvedStackPickupState,
      t,
    ],
  );

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

  const handleVaultDrop = async (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragOverVaultDropzone(false);

    const textPayload =
      event.dataTransfer.getData('text/plain') ||
      event.dataTransfer.getData('text') ||
      event.dataTransfer.getData('Text');
    const payloadItemInput = parseInventoryTextPayload(textPayload);
    const fingerprint = event.dataTransfer.getData(INVENTORY_DRAG_MIME) || textPayload;
    const normalizedFingerprint = payloadItemInput
      ? undefined
      : fingerprint.trim() || draggingFingerprintRef.current;
    const droppedItemInput = normalizedFingerprint
      ? visibleItems.find((item) => item.fingerprint === normalizedFingerprint)
      : undefined;
    const itemInput = payloadItemInput
      ? payloadItemInput
      : droppedItemInput
        ? toVaultUpsertInput(droppedItemInput)
        : draggingVaultInputRef.current;

    if (!itemInput) {
      return;
    }

    await vaultItem(itemInput);
    draggingFingerprintRef.current = undefined;
    draggingVaultInputRef.current = undefined;
    setCrossWindowInventoryDragItem(null);
    setDraggingInventoryItem(null);
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
          if (pickupState) {
            cancelPickup();
          } else if (isStackPickupDragState(crossWindowInventoryDragItem)) {
            clearSynchronizedStackPickup(crossWindowInventoryDragItem);
          }
          toast.info(t(translations.inventoryBrowser.stackPickup.cancelled));
        }
      }}
    >
      {cursorPickupState && <StackPickupCursor pickupState={cursorPickupState} />}
      <div className="flex w-full flex-col gap-4">
        {!isSnapshotMode && (
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
                  <SelectItem value="all">
                    {t(translations.inventoryBrowser.allLocations)}
                  </SelectItem>
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

        {!isSnapshotMode && (
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
        )}

        {!isLoading && snapshots.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              {emptyStateMessage}
            </CardContent>
          </Card>
        )}

        {snapshots.map((snapshot) => {
          const grouped = groupSpatialItems(snapshot.items);
          const stashTabsToRender = buildStashTabsToRender(snapshot, grouped.stashByTab);
          const stashOnlySnapshot = isStashSourceFileType(snapshot.sourceFileType);
          const { belt: beltItems, otherUnknown } = partitionUnknownItems(grouped.unknown);
          const snapshotReadOnly = snapshot.readOnly === true;

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
              <CardContent className="columns-1 gap-4 sm:columns-[20rem] [&>*]:mb-4 [&>*]:break-inside-avoid">
                {!stashOnlySnapshot &&
                  (locationContext === 'all' || locationContext === 'equipped') && (
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
                      disableInteractions={snapshotReadOnly}
                      snapshotSourceFilePath={snapshot.sourceFilePath}
                      snapshotSourceFileType={snapshot.sourceFileType}
                      draggingInventoryItem={activeInventoryDragItem}
                      onDropInventoryItem={(
                        inventoryItem,
                        targetFilePath,
                        targetFileType,
                        targetLocationContext,
                        targetEquippedSlotId,
                      ) =>
                        handleMoveInventoryItem(
                          inventoryItem,
                          targetFilePath,
                          targetFileType,
                          targetLocationContext,
                          undefined,
                          undefined,
                          undefined,
                          targetEquippedSlotId,
                        )
                      }
                    />
                  )}

                {!stashOnlySnapshot &&
                  (locationContext === 'all' || locationContext === 'inventory') && (
                    <InventoryGridSection
                      title={t(translations.inventoryBrowser.sections.inventory)}
                      testId={`inventory-board-${snapshot.snapshotId}`}
                      items={grouped.inventory}
                      gridSize={DEFAULT_INVENTORY_GRID_SIZE}
                      showRawOverflowBoard
                      iconLookup={spriteIconLookup}
                      selectedFingerprint={selectedItemFingerprint}
                      pendingVaultFingerprints={pendingVaultFingerprints}
                      vaultItemsByFingerprint={vaultItemsByFingerprint}
                      onSelect={(item) => setSelectedItemFingerprint(item.fingerprint)}
                      onDragStart={handleCardDragStart}
                      onDragEnd={handleCardDragEnd}
                      disableInteractions={snapshotReadOnly}
                      snapshotSourceFilePath={snapshot.sourceFilePath}
                      snapshotSourceFileType={snapshot.sourceFileType}
                      sectionLocationContext="inventory"
                      draggingVaultItem={activeVaultDragItem}
                      draggingInventoryItem={activeInventoryDragItem}
                      onDropVaultItem={handleDropVaultItemOnSection}
                      onDropInventoryItem={handleMoveInventoryItem}
                      onPickupClick={handleStackPickupOnGrid}
                    />
                  )}

                {(locationContext === 'all' || locationContext === 'stash') &&
                  stashTabsToRender.map(({ stashTab, items, fallbackTabKind }) =>
                    fallbackTabKind === 'runes' ? (
                      <RunesTabSection
                        key={`${snapshot.snapshotId}-stash-${stashTab}`}
                        title={getStashSectionTitle(stashTab, items, t, fallbackTabKind)}
                        testId={`stash-board-${snapshot.snapshotId}-${stashTab}`}
                        items={items.map(applyPickupAdjustment)}
                        disableInteractions={snapshotReadOnly}
                        onItemClick={startPickup}
                        onItemContextMenu={decrementPickup}
                        onDropInventoryItem={(event, targetGridX, targetGridY) =>
                          handleDropInventoryItemOnResourceTab(
                            event,
                            snapshot.sourceFilePath,
                            snapshot.sourceFileType,
                            stashTab,
                            targetGridX,
                            targetGridY,
                          )
                        }
                        renderOwnedTile={(item) => (
                          <InventoryTile
                            item={item}
                            iconLookup={spriteIconLookup}
                            selected={item.fingerprint === selectedItemFingerprint}
                            disableInteractions={snapshotReadOnly}
                            isVaultPresent={getEffectiveVaultPresent(
                              item,
                              vaultItemsByFingerprint,
                              pendingVaultFingerprints,
                            )}
                            onSelect={(i) => setSelectedItemFingerprint(i.fingerprint)}
                            onDragStart={handleCardDragStart}
                            onDragEnd={handleCardDragEnd}
                          />
                        )}
                      />
                    ) : fallbackTabKind === 'gems' ? (
                      <GemsTabSection
                        key={`${snapshot.snapshotId}-stash-${stashTab}`}
                        title={getStashSectionTitle(stashTab, items, t, fallbackTabKind)}
                        testId={`stash-board-${snapshot.snapshotId}-${stashTab}`}
                        items={items.map(applyPickupAdjustment)}
                        disableInteractions={snapshotReadOnly}
                        onItemClick={startPickup}
                        onItemContextMenu={decrementPickup}
                        onDropInventoryItem={(event, targetGridX, targetGridY) =>
                          handleDropInventoryItemOnResourceTab(
                            event,
                            snapshot.sourceFilePath,
                            snapshot.sourceFileType,
                            stashTab,
                            targetGridX,
                            targetGridY,
                          )
                        }
                        renderOwnedTile={(item) => (
                          <InventoryTile
                            item={item}
                            iconLookup={spriteIconLookup}
                            selected={item.fingerprint === selectedItemFingerprint}
                            disableInteractions={snapshotReadOnly}
                            isVaultPresent={getEffectiveVaultPresent(
                              item,
                              vaultItemsByFingerprint,
                              pendingVaultFingerprints,
                            )}
                            onSelect={(i) => setSelectedItemFingerprint(i.fingerprint)}
                            onDragStart={handleCardDragStart}
                            onDragEnd={handleCardDragEnd}
                          />
                        )}
                      />
                    ) : fallbackTabKind === 'materials' ? (
                      <MaterialsTabSection
                        key={`${snapshot.snapshotId}-stash-${stashTab}`}
                        title={getStashSectionTitle(stashTab, items, t, fallbackTabKind)}
                        testId={`stash-board-${snapshot.snapshotId}-${stashTab}`}
                        items={items.map(applyPickupAdjustment)}
                        disableInteractions={snapshotReadOnly}
                        onItemClick={startPickup}
                        onItemContextMenu={decrementPickup}
                        onDropInventoryItem={(event, targetGridX, targetGridY) =>
                          handleDropInventoryItemOnResourceTab(
                            event,
                            snapshot.sourceFilePath,
                            snapshot.sourceFileType,
                            stashTab,
                            targetGridX,
                            targetGridY,
                          )
                        }
                        renderOwnedTile={(item) => (
                          <InventoryTile
                            item={item}
                            iconLookup={spriteIconLookup}
                            selected={item.fingerprint === selectedItemFingerprint}
                            disableInteractions={snapshotReadOnly}
                            isVaultPresent={getEffectiveVaultPresent(
                              item,
                              vaultItemsByFingerprint,
                              pendingVaultFingerprints,
                            )}
                            onSelect={(i) => setSelectedItemFingerprint(i.fingerprint)}
                            onDragStart={handleCardDragStart}
                            onDragEnd={handleCardDragEnd}
                          />
                        )}
                      />
                    ) : (
                      <InventoryGridSection
                        key={`${snapshot.snapshotId}-stash-${stashTab}`}
                        title={getStashSectionTitle(stashTab, items, t, fallbackTabKind)}
                        testId={`stash-board-${snapshot.snapshotId}-${stashTab}`}
                        items={items}
                        gridSize={DEFAULT_STASH_GRID_SIZE}
                        showRawOverflowBoard
                        iconLookup={spriteIconLookup}
                        selectedFingerprint={selectedItemFingerprint}
                        pendingVaultFingerprints={pendingVaultFingerprints}
                        vaultItemsByFingerprint={vaultItemsByFingerprint}
                        onSelect={(item) => setSelectedItemFingerprint(item.fingerprint)}
                        onDragStart={handleCardDragStart}
                        onDragEnd={handleCardDragEnd}
                        disableInteractions={snapshotReadOnly}
                        snapshotSourceFilePath={snapshot.sourceFilePath}
                        snapshotSourceFileType={snapshot.sourceFileType}
                        sectionLocationContext="stash"
                        sectionStashTab={stashTab}
                        draggingVaultItem={activeVaultDragItem}
                        draggingInventoryItem={activeInventoryDragItem}
                        onDropVaultItem={handleDropVaultItemOnSection}
                        onDropInventoryItem={handleMoveInventoryItem}
                        onPickupClick={handleStackPickupOnGrid}
                      />
                    ),
                  )}

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
                    disableInteractions={snapshotReadOnly}
                  />
                )}

                {!stashOnlySnapshot &&
                  (locationContext === 'all' || locationContext === 'mercenary') && (
                    <MercenaryEquipmentSection
                      title={t(translations.inventoryBrowser.sections.mercenary)}
                      testId={`mercenary-board-${snapshot.snapshotId}`}
                      items={grouped.mercenary}
                      iconLookup={spriteIconLookup}
                      selectedFingerprint={selectedItemFingerprint}
                      pendingVaultFingerprints={pendingVaultFingerprints}
                      vaultItemsByFingerprint={vaultItemsByFingerprint}
                      onSelect={(item) => setSelectedItemFingerprint(item.fingerprint)}
                      onDragStart={handleCardDragStart}
                      onDragEnd={handleCardDragEnd}
                      disableInteractions={snapshotReadOnly}
                    />
                  )}

                {!stashOnlySnapshot &&
                  (locationContext === 'all' || locationContext === 'corpse') && (
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
                      disableInteractions={snapshotReadOnly}
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
                            disableInteractions={snapshotReadOnly}
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
