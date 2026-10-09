import type { types as d2sTypes } from '@dschu012/d2s';
import { normalizeItemCodeKey } from '../../utils/d2rFormat';
import { normalizeItemId, resolveItemCode } from './itemFields';

/**
 * Validates item locators from the renderer and finds items by id, code or grid position.
 */

export interface SaveFileItemLocator {
  itemId?: number;
  /** Item code; position-only locators (simple items) are ambiguous without it. */
  itemCode?: string;
  stashTab?: number;
  gridX?: number;
  gridY?: number;
}

function normalizeOptionalNonNegativeInteger(
  value: unknown,
  fieldName: 'stashTab' | 'gridX' | 'gridY',
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  throw new Error(`${fieldName} must be a non-negative integer`);
}

export function normalizeSaveFileItemLocator(
  itemLocator: number | SaveFileItemLocator,
): SaveFileItemLocator {
  if (typeof itemLocator === 'number') {
    if (!Number.isInteger(itemLocator)) {
      throw new Error('itemId must be an integer');
    }

    return { itemId: itemLocator };
  }

  if (!itemLocator || typeof itemLocator !== 'object') {
    throw new Error('itemLocator must be a number or an object');
  }

  const itemId = normalizeItemId(itemLocator.itemId);
  const stashTab = normalizeOptionalNonNegativeInteger(itemLocator.stashTab, 'stashTab');
  const gridX = normalizeOptionalNonNegativeInteger(itemLocator.gridX, 'gridX');
  const gridY = normalizeOptionalNonNegativeInteger(itemLocator.gridY, 'gridY');
  const hasGridCoordinates = gridX !== undefined && gridY !== undefined;

  if (itemId === undefined && !hasGridCoordinates) {
    throw new Error('itemLocator must include itemId or both gridX and gridY');
  }

  return { itemId, itemCode: normalizeItemCodeKey(itemLocator.itemCode), stashTab, gridX, gridY };
}

function itemMatchesId(item: d2sTypes.IItem, itemId: number): boolean {
  return normalizeItemId((item as { id?: unknown }).id) === itemId;
}

export function findItemById(items: d2sTypes.IItem[], itemId: number): d2sTypes.IItem | undefined {
  return items.find((item) => itemMatchesId(item, itemId));
}

export function extractItemById(
  items: d2sTypes.IItem[],
  itemId: number,
): d2sTypes.IItem | undefined {
  const index = items.findIndex((item) => itemMatchesId(item, itemId));
  if (index < 0) {
    return undefined;
  }

  const [removed] = items.splice(index, 1);
  return removed;
}

/**
 * Returns true if an item matches the given identifier — by numeric id when
 * available (non-simple items), or by grid position (simple items like gems/runes).
 */
export function itemMatchesLocator(
  item: d2sTypes.IItem,
  itemId: number | undefined,
  gridX?: number,
  gridY?: number,
  itemCode?: string,
  isResourceTabLocator = false,
): boolean {
  if (itemCode !== undefined && normalizeItemCodeKey(resolveItemCode(item)) !== itemCode) {
    return false;
  }

  // Resource-tab stacks are laid out by the game and identified by their item code: the position
  // the UI shows for them is not the one stored in the file.
  if (isResourceTabLocator && itemCode !== undefined) {
    return true;
  }

  const storedId = normalizeItemId((item as { id?: unknown }).id);

  if (gridX !== undefined && gridY !== undefined) {
    // When source coordinates are known (modern drag/drop and stack-pickup flows),
    // treat them as the authoritative locator. Falling back to id alone here can remove
    // the just-inserted copy during same-tab moves because both items share id
    // until the source is removed.
    if (item.position_x !== gridX || item.position_y !== gridY) {
      return false;
    }

    // Position alone is ambiguous when no tab was given (the same cell exists on every tab), so
    // when both sides carry an id they must agree. Otherwise a different item could be removed.
    return itemId === undefined || storedId === undefined || storedId === itemId;
  }

  return itemId !== undefined && storedId === itemId;
}

export function findItemByCode(items: d2sTypes.IItem[], code: string): d2sTypes.IItem | undefined {
  return items.find((item) => {
    const itemCode = normalizeItemCodeKey(
      (item as { code?: unknown; type?: unknown }).code ?? (item as { type?: unknown }).type,
    );
    return itemCode === code;
  });
}
