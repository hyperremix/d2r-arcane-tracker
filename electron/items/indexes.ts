import type { Item } from '../types/grail';
import { simplifyItemName } from '../utils/objects';
import { items } from './index';

/**
 * Read-only indexes for efficient item lookups
 */
export const itemsByNameSimple: Record<string, Item> = {};
export const runesByCode: Record<string, Item> = {};
export const runewordsByNameSimple: Record<string, Item> = {};

// Build indexes at module load time
for (const item of items) {
  // Index by simplified name
  const simpleName = simplifyItemName(item.name);
  itemsByNameSimple[simpleName] = item;

  // Index runes by code
  if (item.type === 'rune' && item.code) {
    runesByCode[item.code] = item;
  }

  // Index runewords by simplified name
  if (item.type === 'runeword') {
    runewordsByNameSimple[simpleName] = item;
  }
}
