import type {
  ParsedInventoryItem,
  VaultItem,
  VaultLocationContext,
  VaultSourceFileType,
} from 'electron/types/grail';
import { X } from 'lucide-react';
import { type DragEvent, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BoardSurface } from '@/components/inventory/boardPrimitives';
import {
  type ActiveInventoryDragItem,
  resolveActiveInventoryDragItem,
} from '@/components/inventory/dragPayloads';
import {
  resolveEligibleEquipmentSlots,
  resolveTargetEquippedSlotId,
} from '@/components/inventory/equipValidation';
import { InventoryTile } from '@/components/inventory/InventoryTile';
import { getEffectiveVaultPresent } from '@/components/inventory/inventoryItems';
import {
  buildEquippedSlotMapForSet,
  EQUIPPED_BOARD_SIZE,
  EQUIPPED_SLOT_LAYOUT,
  EQUIPPED_WEAPON_SET_ORDER,
  type EquippedWeaponSet,
  PAPER_DOLL_SLOT_ORDER,
  type PaperDollSlotKey,
} from '@/components/inventory/spatialLayout';
import { translations } from '@/i18n/translations';
import type { SpriteIconLookupIndex } from '@/lib/spriteIconCandidates';
import { cn } from '@/lib/utils';

export interface EquipmentSectionProps {
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
  disableInteractions?: boolean;
  snapshotSourceFilePath?: string;
  snapshotSourceFileType?: VaultSourceFileType;
  draggingInventoryItem?: ActiveInventoryDragItem | null;
  onDropInventoryItem?: (
    inventoryItem: ActiveInventoryDragItem,
    targetFilePath: string,
    targetFileType: VaultSourceFileType,
    targetLocationContext: VaultLocationContext,
    targetEquippedSlotId: number,
  ) => Promise<void>;
}

export function EquipmentSection({
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
  disableInteractions = false,
  snapshotSourceFilePath,
  snapshotSourceFileType,
  draggingInventoryItem,
  onDropInventoryItem,
}: EquipmentSectionProps) {
  const { t } = useTranslation();
  const [dragPreviewSlot, setDragPreviewSlot] = useState<{
    slotKey: PaperDollSlotKey;
    valid: boolean;
  } | null>(null);
  const equippedMapping = useMemo(
    () => buildEquippedSlotMapForSet(items, weaponSet),
    [items, weaponSet],
  );
  const canDropOnSection =
    !disableInteractions && !!snapshotSourceFilePath && !!snapshotSourceFileType;
  const clearSlotPreview = useCallback(() => {
    setDragPreviewSlot(null);
  }, []);

  const evaluateSlotDrop = useCallback(
    (slotKey: PaperDollSlotKey, inventoryItem: ActiveInventoryDragItem): boolean => {
      const eligibleSlots = resolveEligibleEquipmentSlots(inventoryItem);
      const slotItem = equippedMapping.slotItems.get(slotKey);
      const isOccupiedByOther = !!slotItem && slotItem.fingerprint !== inventoryItem.fingerprint;

      return eligibleSlots.has(slotKey) && !isOccupiedByOther;
    },
    [equippedMapping.slotItems],
  );

  const handleDragOverSlot = useCallback(
    (event: DragEvent<HTMLDivElement>, slotKey: PaperDollSlotKey) => {
      if (!canDropOnSection || !onDropInventoryItem) {
        clearSlotPreview();
        return;
      }

      const inventoryItem = resolveActiveInventoryDragItem(event, draggingInventoryItem);
      if (!inventoryItem) {
        clearSlotPreview();
        return;
      }

      setDragPreviewSlot({
        slotKey,
        valid: evaluateSlotDrop(slotKey, inventoryItem),
      });
    },
    [
      canDropOnSection,
      clearSlotPreview,
      draggingInventoryItem,
      evaluateSlotDrop,
      onDropInventoryItem,
    ],
  );

  const handleDropOnSlot = useCallback(
    async (event: DragEvent<HTMLDivElement>, slotKey: PaperDollSlotKey) => {
      if (
        !canDropOnSection ||
        !snapshotSourceFilePath ||
        !snapshotSourceFileType ||
        !onDropInventoryItem
      ) {
        clearSlotPreview();
        return;
      }

      const inventoryItem = resolveActiveInventoryDragItem(event, draggingInventoryItem);
      clearSlotPreview();
      if (!inventoryItem || !evaluateSlotDrop(slotKey, inventoryItem)) {
        return;
      }

      await onDropInventoryItem(
        inventoryItem,
        snapshotSourceFilePath,
        snapshotSourceFileType,
        'equipped',
        resolveTargetEquippedSlotId(slotKey, weaponSet),
      );
    },
    [
      canDropOnSection,
      clearSlotPreview,
      draggingInventoryItem,
      evaluateSlotDrop,
      onDropInventoryItem,
      snapshotSourceFilePath,
      snapshotSourceFileType,
      weaponSet,
    ],
  );

  return (
    <div className="space-y-2">
      <div className="inline-flex w-fit flex-col gap-2">
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
              /* biome-ignore lint/a11y/noStaticElementInteractions: equipment slot frames are drag/drop targets by design. */
              <div
                key={slotKey}
                data-testid="equipped-slot-frame"
                className={cn(
                  'relative z-[1] rounded border border-border/80 bg-black/10',
                  slotItem ? 'border-border/80' : '',
                  dragPreviewSlot?.slotKey === slotKey && dragPreviewSlot.valid
                    ? 'border-success bg-success/20'
                    : '',
                  dragPreviewSlot?.slotKey === slotKey && !dragPreviewSlot.valid
                    ? 'border-destructive bg-destructive/20'
                    : '',
                )}
                style={{
                  gridColumn: `${layout.column} / span ${layout.width}`,
                  gridRow: `${layout.row} / span ${layout.height}`,
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  handleDragOverSlot(event, slotKey);
                }}
                onDragLeave={() => clearSlotPreview()}
                onDrop={(event) => {
                  void handleDropOnSlot(event, slotKey);
                }}
              >
                {slotItem ? (
                  <div className="absolute inset-[1px] z-10">
                    <InventoryTile
                      item={slotItem}
                      iconLookup={iconLookup}
                      selected={slotItem.fingerprint === selectedFingerprint}
                      disableInteractions={disableInteractions}
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
                {dragPreviewSlot?.slotKey === slotKey && !dragPreviewSlot.valid && (
                  <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                    <X className="h-1/2 w-1/2 text-destructive" />
                  </div>
                )}
              </div>
            );
          })}
        </BoardSurface>
      </div>
    </div>
  );
}
