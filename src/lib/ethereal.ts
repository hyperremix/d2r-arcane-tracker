import type { EtherealType, HolyGrailItem } from 'electron/types/grail';

/**
 * Check if an item can be ethereal (either optional or only).
 * @param {HolyGrailItem} item - The Holy Grail item to check
 * @returns {boolean} True if the item can be ethereal, false otherwise
 */
export function canItemBeEthereal(item: HolyGrailItem): boolean {
  return item.etherealType === 'optional' || item.etherealType === 'only';
}

/**
 * Check if an item can only be ethereal.
 * @param {HolyGrailItem} item - The Holy Grail item to check
 * @returns {boolean} True if the item is always ethereal, false otherwise
 */
export function isEtherealOnly(item: HolyGrailItem): boolean {
  return item.etherealType === 'only';
}

/**
 * Check if an item can be normal (not ethereal-only).
 * @param {HolyGrailItem} item - The Holy Grail item to check
 * @returns {boolean} True if the item can be normal, false otherwise
 */
export function canItemBeNormal(item: HolyGrailItem): boolean {
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
 * @param {HolyGrailItem} item - The Holy Grail item to check
 * @returns {boolean} True if ethereal status should be displayed, false otherwise
 */
export function shouldShowEtherealStatus(item: HolyGrailItem): boolean {
  return canItemBeEthereal(item);
}

/**
 * Check if an item should show normal status in UI.
 * @param {HolyGrailItem} item - The Holy Grail item to check
 * @returns {boolean} True if normal status should be displayed, false otherwise
 */
export function shouldShowNormalStatus(item: HolyGrailItem): boolean {
  return canItemBeNormal(item);
}
