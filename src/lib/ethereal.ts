import type { EtherealType, HolyGrailItem } from 'electron/types/grail';

/**
 * Check if an item can be ethereal (either optional or only)
 */
export function canItemBeEthereal(item: HolyGrailItem): boolean {
  return item.etherealType === 'optional' || item.etherealType === 'only';
}

/**
 * Check if an item can only be ethereal
 */
export function isEtherealOnly(item: HolyGrailItem): boolean {
  return item.etherealType === 'only';
}

/**
 * Check if an item can be normal (not ethereal-only)
 */
export function canItemBeNormal(item: HolyGrailItem): boolean {
  return item.etherealType === 'none' || item.etherealType === 'optional';
}

/**
 * Get a human-readable description of the item's ethereal type
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
 * Check if an item should show ethereal status in UI
 */
export function shouldShowEtherealStatus(item: HolyGrailItem): boolean {
  return canItemBeEthereal(item);
}

/**
 * Check if an item should show normal status in UI
 */
export function shouldShowNormalStatus(item: HolyGrailItem): boolean {
  return canItemBeNormal(item);
}
