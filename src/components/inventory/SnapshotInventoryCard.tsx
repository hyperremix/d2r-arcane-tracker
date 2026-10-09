import type {
  CharacterInventorySnapshot,
  ParsedInventoryItem,
  StashTabKind,
  VaultItem,
  VaultLocationContext,
} from 'electron/types/grail';
import { Sparkles } from 'lucide-react';
import type { ComponentType, DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  ActiveInventoryDragItem,
  ActiveVaultDragItem,
} from '@/components/inventory/dragPayloads';
import { EquipmentSection } from '@/components/inventory/EquipmentSection';
import { GemsTabSection, type GemsTabSectionProps } from '@/components/inventory/GemsTabSection';
import { InventoryGridSection } from '@/components/inventory/InventoryGridSection';
import { InventoryTile } from '@/components/inventory/InventoryTile';
import { formatSourceFileTypeLabel } from '@/components/inventory/inventoryItemLabels';
import {
  getEffectiveVaultPresent,
  partitionUnknownItems,
} from '@/components/inventory/inventoryItems';
import { MaterialsTabSection } from '@/components/inventory/MaterialsTabSection';
import { MercenaryEquipmentSection } from '@/components/inventory/MercenaryEquipmentSection';
import { RunesTabSection } from '@/components/inventory/RunesTabSection';
import {
  DEFAULT_BELT_GRID_SIZE,
  DEFAULT_INVENTORY_GRID_SIZE,
  DEFAULT_STASH_GRID_SIZE,
  type EquippedWeaponSet,
  groupSpatialItems,
} from '@/components/inventory/spatialLayout';
import {
  buildStashTabsToRender,
  getStashSectionTitle,
  isStashSourceFileType,
} from '@/components/inventory/stashTabs';
import type { InventoryMoveActions } from '@/components/inventory/useInventoryMoveActions';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { translations } from '@/i18n/translations';
import type { SpriteIconLookupIndex } from '@/lib/spriteIconCandidates';

/** Tile props every board of a snapshot shares. */
export interface SnapshotBoardTileProps {
  iconLookup: SpriteIconLookupIndex;
  selectedFingerprint?: string;
  pendingVaultFingerprints: Set<string>;
  vaultItemsByFingerprint: Map<string, VaultItem>;
  onSelect: (item: ParsedInventoryItem) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>, item: ParsedInventoryItem) => void;
  onDragEnd: () => void;
}

export interface SnapshotInventoryCardProps {
  snapshot: CharacterInventorySnapshot;
  locationContext: 'all' | VaultLocationContext;
  tileProps: SnapshotBoardTileProps;
  weaponSet: EquippedWeaponSet;
  onWeaponSetChange: (weaponSet: EquippedWeaponSet) => void;
  activeVaultDragItem: ActiveVaultDragItem | null;
  activeInventoryDragItem: ActiveInventoryDragItem | null;
  moveActions: InventoryMoveActions;
  onStartPickup: (item: ParsedInventoryItem) => void;
  onDecrementPickup: (item: ParsedInventoryItem) => void;
  /** Lowers the stack count of the pickup source by the units already picked up. */
  applyPickupAdjustment: (item: ParsedInventoryItem) => ParsedInventoryItem;
}

const RESOURCE_TAB_SECTIONS: Partial<Record<StashTabKind, ComponentType<GemsTabSectionProps>>> = {
  runes: RunesTabSection,
  gems: GemsTabSection,
  materials: MaterialsTabSection,
};

/**
 * All boards of one character or stash file: equipment, inventory, stash tabs, belt,
 * mercenary, corpse and items without a known location.
 */
export function SnapshotInventoryCard({
  snapshot,
  locationContext,
  tileProps,
  weaponSet,
  onWeaponSetChange,
  activeVaultDragItem,
  activeInventoryDragItem,
  moveActions,
  onStartPickup,
  onDecrementPickup,
  applyPickupAdjustment,
}: SnapshotInventoryCardProps) {
  const { t } = useTranslation();
  const grouped = groupSpatialItems(snapshot.items);
  const stashTabsToRender = buildStashTabsToRender(snapshot, grouped.stashByTab);
  const stashOnlySnapshot = isStashSourceFileType(snapshot.sourceFileType);
  const { belt: beltItems, otherUnknown } = partitionUnknownItems(grouped.unknown);
  const snapshotReadOnly = snapshot.readOnly === true;
  const showsLocation = (location: VaultLocationContext) =>
    locationContext === 'all' || locationContext === location;
  const {
    moveInventoryItem,
    dropInventoryItemOnResourceTab,
    dropVaultItemOnSection,
    placeStackPickupOnGrid,
  } = moveActions;

  const renderTile = (item: ParsedInventoryItem) => (
    <InventoryTile
      item={item}
      iconLookup={tileProps.iconLookup}
      selected={item.fingerprint === tileProps.selectedFingerprint}
      disableInteractions={snapshotReadOnly}
      isVaultPresent={getEffectiveVaultPresent(
        item,
        tileProps.vaultItemsByFingerprint,
        tileProps.pendingVaultFingerprints,
      )}
      onSelect={tileProps.onSelect}
      onDragStart={tileProps.onDragStart}
      onDragEnd={tileProps.onDragEnd}
    />
  );

  return (
    <Card>
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
        {!stashOnlySnapshot && showsLocation('equipped') && (
          <EquipmentSection
            {...tileProps}
            items={grouped.equipped}
            weaponSet={weaponSet}
            onWeaponSetChange={onWeaponSetChange}
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
              moveInventoryItem(
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

        {!stashOnlySnapshot && showsLocation('inventory') && (
          <InventoryGridSection
            {...tileProps}
            title={t(translations.inventoryBrowser.sections.inventory)}
            testId={`inventory-board-${snapshot.snapshotId}`}
            items={grouped.inventory}
            gridSize={DEFAULT_INVENTORY_GRID_SIZE}
            showRawOverflowBoard
            disableInteractions={snapshotReadOnly}
            snapshotSourceFilePath={snapshot.sourceFilePath}
            snapshotSourceFileType={snapshot.sourceFileType}
            sectionLocationContext="inventory"
            draggingVaultItem={activeVaultDragItem}
            draggingInventoryItem={activeInventoryDragItem}
            onDropVaultItem={dropVaultItemOnSection}
            onDropInventoryItem={moveInventoryItem}
            onPickupClick={placeStackPickupOnGrid}
          />
        )}

        {showsLocation('stash') &&
          stashTabsToRender.map(({ stashTab, items, fallbackTabKind }) => {
            const key = `${snapshot.snapshotId}-stash-${stashTab}`;
            const title = getStashSectionTitle(stashTab, items, t, fallbackTabKind);
            const testId = `stash-board-${snapshot.snapshotId}-${stashTab}`;
            const ResourceTabSection = fallbackTabKind
              ? RESOURCE_TAB_SECTIONS[fallbackTabKind]
              : undefined;

            if (ResourceTabSection) {
              return (
                <ResourceTabSection
                  key={key}
                  title={title}
                  testId={testId}
                  items={items.map(applyPickupAdjustment)}
                  disableInteractions={snapshotReadOnly}
                  onItemClick={onStartPickup}
                  onItemContextMenu={onDecrementPickup}
                  onDropInventoryItem={(event, targetGridX, targetGridY) =>
                    dropInventoryItemOnResourceTab(
                      event,
                      snapshot.sourceFilePath,
                      snapshot.sourceFileType,
                      stashTab,
                      targetGridX,
                      targetGridY,
                    )
                  }
                  renderOwnedTile={renderTile}
                />
              );
            }

            return (
              <InventoryGridSection
                {...tileProps}
                key={key}
                title={title}
                testId={testId}
                items={items}
                gridSize={DEFAULT_STASH_GRID_SIZE}
                showRawOverflowBoard
                disableInteractions={snapshotReadOnly}
                snapshotSourceFilePath={snapshot.sourceFilePath}
                snapshotSourceFileType={snapshot.sourceFileType}
                sectionLocationContext="stash"
                sectionStashTab={stashTab}
                draggingVaultItem={activeVaultDragItem}
                draggingInventoryItem={activeInventoryDragItem}
                onDropVaultItem={dropVaultItemOnSection}
                onDropInventoryItem={moveInventoryItem}
                onPickupClick={placeStackPickupOnGrid}
              />
            );
          })}

        {locationContext === 'all' && beltItems.length > 0 && (
          <InventoryGridSection
            {...tileProps}
            title={t(translations.inventoryBrowser.sections.belt)}
            testId={`belt-board-${snapshot.snapshotId}`}
            items={beltItems}
            gridSize={DEFAULT_BELT_GRID_SIZE}
            disableInteractions={snapshotReadOnly}
          />
        )}

        {!stashOnlySnapshot && showsLocation('mercenary') && (
          <MercenaryEquipmentSection
            {...tileProps}
            title={t(translations.inventoryBrowser.sections.mercenary)}
            testId={`mercenary-board-${snapshot.snapshotId}`}
            items={grouped.mercenary}
            disableInteractions={snapshotReadOnly}
          />
        )}

        {!stashOnlySnapshot && showsLocation('corpse') && (
          <InventoryGridSection
            {...tileProps}
            title={t(translations.inventoryBrowser.sections.corpse)}
            testId={`corpse-board-${snapshot.snapshotId}`}
            items={grouped.corpse}
            gridSize={DEFAULT_INVENTORY_GRID_SIZE}
            disableInteractions={snapshotReadOnly}
          />
        )}

        {otherUnknown.length > 0 && (
          <div className="space-y-2 rounded-md border border-border/60 bg-muted/10 p-3">
            <div className="flex items-center gap-2 font-medium text-sm">
              <Sparkles className="h-4 w-4" />
              {t(translations.inventoryBrowser.sections.unknown)}
            </div>
            <div className="flex flex-wrap gap-2" data-testid={`unknown-${snapshot.snapshotId}`}>
              {otherUnknown.map((item) => (
                <div key={item.fingerprint} className="h-16 w-16">
                  {renderTile(item)}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
