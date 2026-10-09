import type {
  ParsedInventoryItem,
  VaultItem,
  VaultLocationContext,
  VaultSourceFileType,
} from 'electron/types/grail';
import { X } from 'lucide-react';
import { type DragEvent, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BoardSurface, getItemGridPlacement } from '@/components/inventory/boardPrimitives';
import {
  type ActiveInventoryDragItem,
  type ActiveVaultDragItem,
  resolveActiveInventoryDragItem,
  resolveActiveVaultDragItem,
} from '@/components/inventory/dragPayloads';
import { InventoryTile } from '@/components/inventory/InventoryTile';
import { getEffectiveVaultPresent } from '@/components/inventory/inventoryItems';
import {
  buildOverflowBoardLayout,
  classifyBoardItems,
  type GridSize,
  getGridHeight,
  getGridWidth,
  hasBoardOverlap,
} from '@/components/inventory/spatialLayout';
import { translations } from '@/i18n/translations';
import type { SpriteIconLookupIndex } from '@/lib/spriteIconCandidates';
import { cn } from '@/lib/utils';

export interface InventoryGridSectionProps {
  title: string;
  testId: string;
  items: ParsedInventoryItem[];
  gridSize: GridSize;
  showRawOverflowBoard?: boolean;
  iconLookup: SpriteIconLookupIndex;
  selectedFingerprint?: string;
  pendingVaultFingerprints: Set<string>;
  vaultItemsByFingerprint: Map<string, VaultItem>;
  onSelect: (item: ParsedInventoryItem) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>, item: ParsedInventoryItem) => void;
  onDragEnd: () => void;
  disableInteractions?: boolean;
  snapshotSourceFilePath?: string;
  snapshotSourceFileType?: VaultSourceFileType;
  sectionLocationContext?: VaultLocationContext;
  sectionStashTab?: number;
  draggingVaultItem?: ActiveVaultDragItem | null;
  draggingInventoryItem?: ActiveInventoryDragItem | null;
  onDropVaultItem?: (
    vaultItemId: string,
    targetFilePath: string,
    targetFileType: VaultSourceFileType,
    targetLocationContext: VaultLocationContext,
    targetStashTab: number | undefined,
    targetGridX: number,
    targetGridY: number,
  ) => Promise<void>;
  onDropInventoryItem?: (
    inventoryItem: ActiveInventoryDragItem,
    targetFilePath: string,
    targetFileType: VaultSourceFileType,
    targetLocationContext: VaultLocationContext,
    targetStashTab: number | undefined,
    targetGridX: number,
    targetGridY: number,
  ) => Promise<void>;
  onPickupClick?: (
    items: ParsedInventoryItem[],
    gridSize: GridSize,
    targetFilePath: string,
    targetFileType: VaultSourceFileType,
    targetLocationContext: VaultLocationContext,
    targetStashTab?: number,
    preferredGridX?: number,
    preferredGridY?: number,
  ) => Promise<void>;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This component coordinates multiple DnD + pickup interaction paths in a single grid renderer. Splitting would require complex prop threading.
export function InventoryGridSection({
  title,
  testId,
  items,
  gridSize,
  showRawOverflowBoard = false,
  iconLookup,
  selectedFingerprint,
  pendingVaultFingerprints,
  vaultItemsByFingerprint,
  onSelect,
  onDragStart,
  onDragEnd,
  disableInteractions = false,
  snapshotSourceFilePath,
  snapshotSourceFileType,
  sectionLocationContext,
  sectionStashTab,
  draggingVaultItem,
  draggingInventoryItem,
  onDropVaultItem,
  onDropInventoryItem,
  onPickupClick,
}: InventoryGridSectionProps) {
  const { t } = useTranslation();
  const [dragOverCell, setDragOverCell] = useState<{ x: number; y: number } | null>(null);
  const [activeVaultDragItem, setActiveVaultDragItem] = useState<ActiveVaultDragItem | null>(null);
  const [activeInventoryDragItem, setActiveInventoryDragItem] =
    useState<ActiveInventoryDragItem | null>(null);
  const [activeDragKind, setActiveDragKind] = useState<'vault' | 'inventory' | null>(null);
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
  const renderedGridSize = useMemo(() => {
    if (!showRawOverflowBoard || overflowLayout.items.length === 0) {
      return gridSize;
    }

    const maxColumns = overflowLayout.items.reduce(
      (max, item) => Math.max(max, (item.gridX ?? 0) + getGridWidth(item)),
      gridSize.columns,
    );
    const maxRows = overflowLayout.items.reduce(
      (max, item) => Math.max(max, (item.gridY ?? 0) + getGridHeight(item)),
      gridSize.rows,
    );

    return {
      columns: Math.max(1, maxColumns),
      rows: Math.max(1, maxRows),
    };
  }, [gridSize, overflowLayout.items, showRawOverflowBoard]);
  const renderedItems = useMemo(
    () => [...classified.placed, ...overflowLayout.items],
    [classified.placed, overflowLayout.items],
  );
  const remainingUnplaced = useMemo(
    () => classified.unplaced.filter(({ item }) => !overflowLayout.itemKeys.has(item.fingerprint)),
    [classified.unplaced, overflowLayout.itemKeys],
  );
  const canDropOnSection =
    !disableInteractions &&
    !!snapshotSourceFilePath &&
    !!snapshotSourceFileType &&
    !!sectionLocationContext;
  const clearDragPreview = useCallback(() => {
    setActiveDragKind(null);
    setActiveVaultDragItem(null);
    setActiveInventoryDragItem(null);
    setDragOverCell(null);
  }, []);
  const previewPlacement = useMemo(() => {
    if (!dragOverCell) {
      return null;
    }

    const activeDimensions =
      activeDragKind === 'vault' ? activeVaultDragItem : activeInventoryDragItem;
    if (!activeDimensions) {
      return null;
    }

    const { x, y } = dragOverCell;
    const width = activeDimensions.gridWidth;
    const height = activeDimensions.gridHeight;

    if (x < 0 || y < 0 || x + width > gridSize.columns || y + height > gridSize.rows) {
      return { x, y, valid: false };
    }

    const hasOverlap = hasBoardOverlap(
      items,
      x,
      y,
      width,
      height,
      activeDragKind === 'inventory' ? activeInventoryDragItem?.fingerprint : undefined,
    );

    return { x, y, valid: !hasOverlap };
  }, [
    activeDragKind,
    activeInventoryDragItem,
    activeVaultDragItem,
    dragOverCell,
    gridSize.columns,
    gridSize.rows,
    items,
  ]);

  const handleDragOverBoard = useCallback(
    (event: DragEvent<HTMLDivElement>, x: number, y: number) => {
      if (!canDropOnSection) {
        clearDragPreview();
        return;
      }

      const resolvedVaultItem = resolveActiveVaultDragItem(event, draggingVaultItem);
      if (resolvedVaultItem && onDropVaultItem) {
        setActiveDragKind('vault');
        setActiveInventoryDragItem(null);
        setActiveVaultDragItem(resolvedVaultItem);
        setDragOverCell({ x, y });
        return;
      }

      const resolvedInventoryItem = resolveActiveInventoryDragItem(event, draggingInventoryItem);
      if (resolvedInventoryItem && onDropInventoryItem) {
        setActiveDragKind('inventory');
        setActiveVaultDragItem(null);
        setActiveInventoryDragItem(resolvedInventoryItem);
        setDragOverCell({ x, y });
        return;
      }

      clearDragPreview();
    },
    [
      canDropOnSection,
      clearDragPreview,
      draggingInventoryItem,
      draggingVaultItem,
      onDropInventoryItem,
      onDropVaultItem,
    ],
  );

  const isDropOutOfBounds = useCallback(
    (dropX: number, dropY: number, width: number, height: number): boolean =>
      dropX < 0 || dropY < 0 || dropX + width > gridSize.columns || dropY + height > gridSize.rows,
    [gridSize.columns, gridSize.rows],
  );

  const tryDropVaultItem = useCallback(
    async (
      event: DragEvent<HTMLDivElement>,
      dropX: number,
      dropY: number,
      targetFilePath: string,
      targetFileType: VaultSourceFileType,
      targetLocationContext: VaultLocationContext,
    ): Promise<boolean> => {
      const resolvedVaultItem = resolveActiveVaultDragItem(event, draggingVaultItem);
      if (!resolvedVaultItem || !onDropVaultItem) {
        return false;
      }

      const width = resolvedVaultItem.gridWidth;
      const height = resolvedVaultItem.gridHeight;
      const isOutOfBounds = isDropOutOfBounds(dropX, dropY, width, height);
      const hasOverlap = hasBoardOverlap(items, dropX, dropY, width, height);
      if (isOutOfBounds || hasOverlap || !resolvedVaultItem.id) {
        return true;
      }

      await onDropVaultItem(
        resolvedVaultItem.id,
        targetFilePath,
        targetFileType,
        targetLocationContext,
        sectionStashTab,
        dropX,
        dropY,
      );
      return true;
    },
    [draggingVaultItem, isDropOutOfBounds, items, onDropVaultItem, sectionStashTab],
  );

  const tryDropInventoryItem = useCallback(
    async (
      event: DragEvent<HTMLDivElement>,
      dropX: number,
      dropY: number,
      targetFilePath: string,
      targetFileType: VaultSourceFileType,
      targetLocationContext: VaultLocationContext,
    ): Promise<void> => {
      const resolvedInventoryItem = resolveActiveInventoryDragItem(event, draggingInventoryItem);
      if (!resolvedInventoryItem || !onDropInventoryItem) {
        return;
      }

      const width = resolvedInventoryItem.gridWidth;
      const height = resolvedInventoryItem.gridHeight;
      const isOutOfBounds = isDropOutOfBounds(dropX, dropY, width, height);
      const hasOverlap = hasBoardOverlap(
        items,
        dropX,
        dropY,
        width,
        height,
        resolvedInventoryItem.fingerprint,
      );
      if (isOutOfBounds || hasOverlap) {
        return;
      }

      await onDropInventoryItem(
        resolvedInventoryItem,
        targetFilePath,
        targetFileType,
        targetLocationContext,
        sectionStashTab,
        dropX,
        dropY,
      );
    },
    [draggingInventoryItem, isDropOutOfBounds, items, onDropInventoryItem, sectionStashTab],
  );

  const handleDropOnBoard = useCallback(
    async (event: DragEvent<HTMLDivElement>, dropX: number, dropY: number) => {
      if (
        !canDropOnSection ||
        !snapshotSourceFilePath ||
        !snapshotSourceFileType ||
        !sectionLocationContext
      ) {
        clearDragPreview();
        return;
      }

      const handledVaultDrop = await tryDropVaultItem(
        event,
        dropX,
        dropY,
        snapshotSourceFilePath,
        snapshotSourceFileType,
        sectionLocationContext,
      );
      if (handledVaultDrop) {
        clearDragPreview();
        return;
      }

      await tryDropInventoryItem(
        event,
        dropX,
        dropY,
        snapshotSourceFilePath,
        snapshotSourceFileType,
        sectionLocationContext,
      );
      clearDragPreview();
    },
    [
      canDropOnSection,
      clearDragPreview,
      sectionLocationContext,
      snapshotSourceFilePath,
      snapshotSourceFileType,
      tryDropInventoryItem,
      tryDropVaultItem,
    ],
  );

  const activePreviewDimensions =
    activeDragKind === 'vault' ? activeVaultDragItem : activeInventoryDragItem;

  return (
    <div className="space-y-2">
      <div className="font-medium text-sm">{title}</div>
      <BoardSurface
        gridSize={renderedGridSize}
        testId={testId}
        onDragOverCell={
          canDropOnSection && (onDropVaultItem || onDropInventoryItem)
            ? handleDragOverBoard
            : undefined
        }
        onDragLeaveBoard={
          canDropOnSection && (onDropVaultItem || onDropInventoryItem)
            ? () => {
                clearDragPreview();
              }
            : undefined
        }
        onDropOnBoard={
          canDropOnSection && (onDropVaultItem || onDropInventoryItem)
            ? handleDropOnBoard
            : undefined
        }
        onClickBoard={
          onPickupClick &&
          snapshotSourceFilePath &&
          snapshotSourceFileType &&
          sectionLocationContext
            ? (_, x, y) => {
                void onPickupClick(
                  items,
                  gridSize,
                  snapshotSourceFilePath,
                  snapshotSourceFileType,
                  sectionLocationContext,
                  sectionStashTab,
                  x,
                  y,
                );
              }
            : undefined
        }
      >
        {renderedItems.map((item) => {
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
                disableInteractions={disableInteractions}
                isVaultPresent={isVaultPresent}
                onSelect={onSelect}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
              />
            </div>
          );
        })}
        {previewPlacement && activePreviewDimensions && (
          <div
            className={cn(
              'pointer-events-none z-20 rounded-sm border-2',
              previewPlacement.valid
                ? 'border-success bg-success/20'
                : 'border-destructive bg-destructive/20',
            )}
            style={{
              gridColumn: `${previewPlacement.x + 1} / span ${activePreviewDimensions.gridWidth}`,
              gridRow: `${previewPlacement.y + 1} / span ${activePreviewDimensions.gridHeight}`,
            }}
          >
            {!previewPlacement.valid && (
              <div className="flex h-full w-full items-center justify-center">
                <X className="h-1/2 w-1/2 text-destructive" />
              </div>
            )}
          </div>
        )}
      </BoardSurface>

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
                    disableInteractions={disableInteractions}
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
