import type { ParsedInventoryItem, VaultItem } from 'electron/types/grail';
import { type DragEvent, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BoardSurface } from '@/components/inventory/boardPrimitives';
import { InventoryTile } from '@/components/inventory/InventoryTile';
import type { EquipmentUnplacedReason } from '@/components/inventory/inventoryItemLabels';
import { getEffectiveVaultPresent } from '@/components/inventory/inventoryItems';
import {
  EQUIPPED_BOARD_SIZE,
  EQUIPPED_SLOT_LAYOUT,
  PAPER_DOLL_SLOT_ORDER,
  type PaperDollSlotKey,
  resolvePaperDollSlotKey,
} from '@/components/inventory/spatialLayout';
import { translations } from '@/i18n/translations';
import type { SpriteIconLookupIndex } from '@/lib/spriteIconCandidates';
import { cn } from '@/lib/utils';

const DEFAULT_MERCENARY_SLOT_ORDER: PaperDollSlotKey[] = ['head', 'leftHand', 'armor', 'rightHand'];
const DEFAULT_MERCENARY_SLOT_SET = new Set(DEFAULT_MERCENARY_SLOT_ORDER);

export interface MercenaryEquipmentSectionProps {
  title: string;
  testId: string;
  items: ParsedInventoryItem[];
  iconLookup: SpriteIconLookupIndex;
  selectedFingerprint?: string;
  pendingVaultFingerprints: Set<string>;
  vaultItemsByFingerprint: Map<string, VaultItem>;
  onSelect: (item: ParsedInventoryItem) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>, item: ParsedInventoryItem) => void;
  onDragEnd: () => void;
  disableInteractions?: boolean;
}

export function MercenaryEquipmentSection({
  title,
  testId,
  items,
  iconLookup,
  selectedFingerprint,
  pendingVaultFingerprints,
  vaultItemsByFingerprint,
  onSelect,
  onDragStart,
  onDragEnd,
  disableInteractions = false,
}: MercenaryEquipmentSectionProps) {
  const { t } = useTranslation();
  const mappedMercenaryItems = useMemo(() => {
    const slotItems = new Map<PaperDollSlotKey, ParsedInventoryItem>();
    const unplaced: Array<{
      item: ParsedInventoryItem;
      reason: EquipmentUnplacedReason;
    }> = [];

    for (const item of items) {
      const slotKey = resolvePaperDollSlotKey(item.equippedSlotId);
      if (!slotKey) {
        unplaced.push({
          item,
          reason: 'unknownEquippedSlot',
        });
        continue;
      }

      if (slotItems.has(slotKey)) {
        unplaced.push({
          item,
          reason: 'overlap',
        });
        continue;
      }

      slotItems.set(slotKey, item);
    }

    const extraFilledSlots = PAPER_DOLL_SLOT_ORDER.filter(
      (slotKey) => !DEFAULT_MERCENARY_SLOT_SET.has(slotKey) && slotItems.has(slotKey),
    );

    return {
      slotItems,
      slotOrder: [...DEFAULT_MERCENARY_SLOT_ORDER, ...extraFilledSlots],
      unplaced,
    };
  }, [items]);

  return (
    <div className="space-y-2">
      <div className="font-medium text-sm">{title}</div>
      <BoardSurface gridSize={EQUIPPED_BOARD_SIZE} testId={testId} showBaseGrid={false}>
        {mappedMercenaryItems.slotOrder.map((slotKey) => {
          const layout = EQUIPPED_SLOT_LAYOUT[slotKey];
          const slotItem = mappedMercenaryItems.slotItems.get(slotKey);

          return (
            <div
              key={slotKey}
              data-testid="mercenary-slot-frame"
              className={cn('relative z-[1] rounded border border-border/80 bg-black/10')}
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
            </div>
          );
        })}
      </BoardSurface>

      {mappedMercenaryItems.unplaced.length > 0 && (
        <div className="space-y-2">
          <div className="text-muted-foreground text-xs">
            {t(translations.inventoryBrowser.unplaced)}
          </div>
          <div className="flex flex-wrap gap-2" data-testid={`${testId}-unplaced`}>
            {mappedMercenaryItems.unplaced.map(({ item, reason }) => (
              <div key={`${item.fingerprint}-${reason}`} className="h-16 w-16">
                <InventoryTile
                  item={item}
                  iconLookup={iconLookup}
                  selected={item.fingerprint === selectedFingerprint}
                  disableInteractions={disableInteractions}
                  isVaultPresent={getEffectiveVaultPresent(
                    item,
                    vaultItemsByFingerprint,
                    pendingVaultFingerprints,
                  )}
                  unplacedReason={reason}
                  onSelect={onSelect}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
