import type { types as d2sTypes } from '@dschu012/d2s';
import type { CharacterClass, VaultLocationContext } from '../../types/grail';
import { assertEquipValidationRules } from './equipValidation';

/**
 * Places items at a location and grid cell, and refuses placements onto occupied cells.
 */

export function withTargetCoordinates(
  item: d2sTypes.IItem,
  targetGridX?: number,
  targetGridY?: number,
): d2sTypes.IItem {
  if (targetGridX === undefined || targetGridY === undefined) {
    return item;
  }

  return {
    ...item,
    position_x: targetGridX,
    position_y: targetGridY,
  };
}

export function withD2SLocationContext(
  item: d2sTypes.IItem,
  locationContext: VaultLocationContext,
  equippedItems: d2sTypes.IItem[],
  targetCharacterClass: CharacterClass | undefined,
  targetEquippedSlotId?: number,
): d2sTypes.IItem {
  switch (locationContext) {
    case 'inventory':
      return {
        ...item,
        location_id: 0,
        alt_position_id: 1,
        equipped_id: 0,
      };
    case 'stash':
      return {
        ...item,
        location_id: 0,
        alt_position_id: 5,
        equipped_id: 0,
      };
    case 'equipped':
      if (targetEquippedSlotId !== undefined) {
        assertEquipValidationRules(item, targetEquippedSlotId, equippedItems, targetCharacterClass);
      }

      return {
        ...item,
        location_id: 1,
        alt_position_id: 0,
        equipped_id: targetEquippedSlotId ?? item.equipped_id ?? 0,
        position_x: 0,
        position_y: 0,
      };
    case 'mercenary':
      return {
        ...item,
        location_id: 3,
        alt_position_id: 0,
        equipped_id: 0,
      };
    case 'corpse':
      return {
        ...item,
        location_id: 3,
        alt_position_id: 0,
        equipped_id: 0,
      };
    default:
      return item;
  }
}

const OCCUPIED_CELL_ERROR = 'TARGET_CELL_OCCUPIED';

function resolveGridSpan(item: d2sTypes.IItem): { width: number; height: number } {
  const width = (item as { inv_width?: unknown }).inv_width;
  const height = (item as { inv_height?: unknown }).inv_height;
  return {
    width: typeof width === 'number' && width > 0 ? width : 1,
    height: typeof height === 'number' && height > 0 ? height : 1,
  };
}

/**
 * Throws when `candidate` would overlap any item of `containerItems` (the items already stored in
 * the target grid). Dimensions are used when known (`inv_width`/`inv_height`, present on items
 * parsed with their item data); items without dimensions count as a single cell. The UI performs
 * the full check as well, this is the last line of defence against writing overlapping items.
 */
export function assertTargetCellsFree(
  containerItems: d2sTypes.IItem[],
  candidate: d2sTypes.IItem,
): void {
  if (candidate.position_x === undefined || candidate.position_y === undefined) {
    return;
  }

  const candidateSpan = resolveGridSpan(candidate);
  const overlaps = containerItems.some((existing) => {
    if (existing.position_x === undefined || existing.position_y === undefined) {
      return false;
    }

    const existingSpan = resolveGridSpan(existing);
    return (
      candidate.position_x < existing.position_x + existingSpan.width &&
      existing.position_x < candidate.position_x + candidateSpan.width &&
      candidate.position_y < existing.position_y + existingSpan.height &&
      existing.position_y < candidate.position_y + candidateSpan.height
    );
  });

  if (overlaps) {
    throw new Error(OCCUPIED_CELL_ERROR);
  }
}

/** Overlap check against the character grid (inventory / stash / cube) the candidate is stored in. */
export function assertCharacterGridCellsFree(
  allItems: d2sTypes.IItem[],
  candidate: d2sTypes.IItem,
): void {
  if (candidate.location_id !== 0) {
    return;
  }

  assertTargetCellsFree(
    allItems.filter(
      (existing) =>
        existing.location_id === 0 && existing.alt_position_id === candidate.alt_position_id,
    ),
    candidate,
  );
}
