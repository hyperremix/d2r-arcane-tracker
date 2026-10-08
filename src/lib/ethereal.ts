import type { EtherealType, Item, Settings } from 'electron/types/grail';

/**
 * Check if an item can be ethereal (either optional or only).
 * @param {Item} item - The Holy Grail item to check
 * @returns {boolean} True if the item can be ethereal, false otherwise
 */
export function canItemBeEthereal(item: Item): boolean {
  return item.etherealType === 'optional' || item.etherealType === 'only';
}

/**
 * Check if an item can only be ethereal.
 * @param {Item} item - The Holy Grail item to check
 * @returns {boolean} True if the item is always ethereal, false otherwise
 */
export function isEtherealOnly(item: Item): boolean {
  return item.etherealType === 'only';
}

/**
 * Check if an item can be normal (not ethereal-only).
 * @param {Item} item - The Holy Grail item to check
 * @returns {boolean} True if the item can be normal, false otherwise
 */
export function canItemBeNormal(item: Item): boolean {
  return item.etherealType === 'none' || item.etherealType === 'optional';
}

/**
 * Get a human-readable description of the item's ethereal type.
 * @param {EtherealType} etherealType - The ethereal type to describe
 * @returns {string} A human-readable description of the ethereal type
 */
export function getEtherealTypeDescription(etherealType: EtherealType): string {
  switch (etherealType) {
    case 'none':
      return 'Cannot be ethereal';
    case 'optional':
      return 'Can be normal or ethereal';
    case 'only':
      return 'Always ethereal';
    default:
      return 'Unknown';
  }
}

/**
 * Check if an item should show ethereal status in UI.
 * @param {Item} item - The Holy Grail item to check
 * @returns {boolean} True if ethereal status should be displayed, false otherwise
 */
export function shouldShowEtherealStatus(item: Item, settings: Settings): boolean {
  return settings.grailEthereal && canItemBeEthereal(item);
}

/**
 * Check if an item should show normal status in UI.
 * @param {Item} item - The Holy Grail item to check
 * @returns {boolean} True if normal status should be displayed, false otherwise
 */
export function shouldShowNormalStatus(item: Item, settings: Settings): boolean {
  return settings.grailNormal && canItemBeNormal(item);
}

/**
 * Keeps only the items that have at least one tracked version. When both normal and ethereal
 * items are tracked every item is kept; when neither is tracked no item is kept.
 * @param {Item[]} items - The items to filter
 * @param {Pick<Settings, 'grailNormal' | 'grailEthereal'>} settings - The grail tracking settings
 * @returns {Item[]} The items that are part of the tracked grail
 */
export function filterItemsByTrackedVersions(
  items: Item[],
  settings: Pick<Settings, 'grailNormal' | 'grailEthereal'>,
): Item[] {
  if (settings.grailNormal && settings.grailEthereal) return items;
  if (settings.grailNormal) return items.filter(canItemBeNormal);
  if (settings.grailEthereal) return items.filter(canItemBeEthereal);
  return [];
}
