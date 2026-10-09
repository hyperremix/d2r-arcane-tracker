import type { types as d2sTypes } from '@dschu012/d2s';
import {
  isResourceCodeOfKind,
  isResourceItemCode,
  RESOURCE_STASH_STACK_ATTR_ID,
  type ResourceStashTabKind,
  resolveResourceStashTabKind,
  resolveStackCount,
} from '../../utils/d2rFormat';
import { resolveItemCode } from './itemFields';

/**
 * Resource-stash stacks (runes, gems, materials): their stack attribute, quantities and the rule
 * that a stack can only leave the resource tabs one unit at a time.
 */

function isResourceStackAttributeId(value: unknown): boolean {
  if (value === RESOURCE_STASH_STACK_ATTR_ID) {
    return true;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed === RESOURCE_STASH_STACK_ATTR_ID;
  }

  return false;
}

function hasResourceStackAttribute(item: d2sTypes.IItem): boolean {
  const magicAttributes = item.magic_attributes as Array<{ id?: unknown }> | undefined;
  return (
    Array.isArray(magicAttributes) &&
    magicAttributes.some((attribute) => isResourceStackAttributeId(attribute?.id))
  );
}

function isResourceStackableItem(item: d2sTypes.IItem): boolean {
  if (hasResourceStackAttribute(item)) {
    return true;
  }

  return isResourceItemCode(resolveItemCode(item));
}

/**
 * A resource-stash stack (runes/gems/materials tabs) is a single item carrying a count. Outside the
 * resource tabs the game has no such stack, so only one unit can be materialized per item. Moving
 * the whole stack anywhere else would keep one unit and delete the rest, so it must go through a
 * stack split instead.
 */
export function assertStackMoveIsLossless(
  item: d2sTypes.IItem,
  targetKeepsStackCount: boolean,
): void {
  if (
    !targetKeepsStackCount &&
    isResourceStackableItem(item) &&
    resolveStackCount(item as unknown as Parameters<typeof resolveStackCount>[0]) > 1
  ) {
    throw new Error('STACK_MOVE_REQUIRES_SPLIT');
  }
}

export function stripResourceStashStackMetadata(item: d2sTypes.IItem): d2sTypes.IItem {
  const magicAttributes = item.magic_attributes as Array<{ id?: unknown }> | undefined;
  if (!Array.isArray(magicAttributes) || !hasResourceStackAttribute(item)) {
    return item;
  }

  return {
    ...item,
    quantity: 1,
    magic_attributes: magicAttributes.filter(
      (attribute) => !isResourceStackAttributeId(attribute?.id),
    ),
    id: undefined,
  };
}

export function withUpdatedResourceStackCount(
  item: d2sTypes.IItem,
  newCount: number,
): d2sTypes.IItem {
  const magicAttributes = item.magic_attributes as
    | Array<{ id?: unknown; values?: unknown; [key: string]: unknown }>
    | undefined;

  if (!Array.isArray(magicAttributes)) {
    return { ...item, quantity: newCount };
  }

  let hasResourceStackAttribute = false;
  const nextMagicAttributes = magicAttributes.map((attribute) => {
    const rawId = attribute?.id;
    const normalizedId =
      typeof rawId === 'string' && rawId.trim().length > 0 ? Number.parseInt(rawId, 10) : rawId;

    if (normalizedId !== RESOURCE_STASH_STACK_ATTR_ID) {
      return attribute;
    }

    hasResourceStackAttribute = true;
    return {
      ...attribute,
      values: [newCount],
    };
  });

  if (!hasResourceStackAttribute) {
    return { ...item, quantity: newCount };
  }

  return {
    ...item,
    quantity: newCount,
    magic_attributes: nextMagicAttributes,
  };
}

/**
 * Quantity to write for an item placed in a shared tab. Resource stacks (runes/gems/materials) are
 * one unit per item there, but natively stackable items (tomes, keys, arrows, javelins) carry
 * their own quantity, which must be preserved.
 */
export function shouldKeepQuantity(item: d2sTypes.IItem): number {
  return isResourceStackableItem(item) ? 1 : getItemQuantity(item);
}

/**
 * `quantity` is the number of units of a resource stack (runes/gems/materials) to materialize.
 * Only the resource tabs can hold more than one unit per item, so anything else must be written
 * one unit at a time; refusing beats silently keeping one unit and dropping the rest.
 */
export function applyWriteQuantity(
  item: d2sTypes.IItem,
  quantity: number | undefined,
  targetKeepsStackCount: boolean,
): d2sTypes.IItem {
  if (quantity === undefined || !isResourceStackableItem(item)) {
    return item;
  }

  const itemWithQuantity = withUpdatedResourceStackCount(item, quantity);
  assertStackMoveIsLossless(itemWithQuantity, targetKeepsStackCount);
  return itemWithQuantity;
}

export function isModernResourceTab(stashTab: number | undefined): stashTab is number {
  return resolveResourceStashTabKind(stashTab) !== undefined;
}

export function isResourceCodeAllowedForTab(itemCode: string, stashTab: number): boolean {
  const tabKind: ResourceStashTabKind | undefined = resolveResourceStashTabKind(stashTab);
  return tabKind !== undefined && isResourceCodeOfKind(itemCode, tabKind);
}

export function getItemQuantity(item: d2sTypes.IItem): number {
  const qty = (item as { quantity?: unknown }).quantity;
  if (typeof qty === 'number' && Number.isInteger(qty) && qty >= 1) {
    return qty;
  }
  return 1;
}

export function withQuantityOne(item: d2sTypes.IItem): d2sTypes.IItem {
  return { ...item, quantity: 1 };
}

export function withReducedQuantity(item: d2sTypes.IItem, reduceBy: number): d2sTypes.IItem {
  const current = getItemQuantity(item);
  const next = Math.max(0, current - reduceBy);
  return { ...item, quantity: next };
}
