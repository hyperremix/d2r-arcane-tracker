import type { Item } from '../types/grail';
import { simplifyItemName } from '../utils/objects';
import { items } from './index';

/**
 * Read-only indexes for efficient item lookups.
 * `itemsByNameSimple` holds every non-runeword catalog entry by simplified name. Today it is only read
 * for uniques and sets: runes are in it too, but they are resolved through `runesByCode`.
 */
export const itemsByNameSimple: Record<string, Item> = {};
export const runesByCode: Record<string, Item> = {};
export const runewordsByNameSimple: Record<string, Item> = {};

// Build indexes at module load time
for (const item of items) {
  const simpleName = simplifyItemName(item.name);

  // Index runes by code
  if (item.type === 'rune' && item.code) {
    runesByCode[item.code] = item;
  }

  // Runewords get their own index so a runeword never shadows a unique of the same name
  // (e.g. the Crescent Moon runeword and the Crescent Moon unique amulet)
  if (item.type === 'runeword') {
    runewordsByNameSimple[simpleName] = item;
  } else {
    itemsByNameSimple[simpleName] = item;
  }
}
