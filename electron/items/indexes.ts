import type { Item } from '../types/grail';
import { simplifyItemName } from '../utils/objects';
import { items } from './index';

/**
 * Read-only indexes for efficient item lookups
 */
export const itemsById: Record<string, Item> = {};
export const itemsByNameSimple: Record<string, Item> = {};
export const runesByCode: Record<string, Item> = {};
export const runewordsByNameSimple: Record<string, Item> = {};

// Build indexes at module load time
for (const item of items) {
  // Index by id
  itemsById[item.id] = item;

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

/**
 * Checks if an item ID represents a rune
 */
export function isRuneId(id: string): boolean {
  return itemsById[id]?.type === 'rune';
}

/**
 * Checks if an item ID represents a runeword
 */
export function isRunewordId(id: string): boolean {
  return itemsById[id]?.type === 'runeword';
}

/**
 * Gets all rune IDs
 */
export function getAllRuneIds(): string[] {
  return Object.keys(runesByCode).map((code) => runesByCode[code].id);
}

/**
 * Gets all runeword IDs
 */
export function getAllRunewordIds(): string[] {
  return Object.keys(runewordsByNameSimple).map((name) => runewordsByNameSimple[name].id);
}

/**
 * Gets items filtered by category
 */
export function getItemsByCategory(category: string): Item[] {
  return items.filter((item) => item.category === category);
}

/**
 * Gets items filtered by type
 */
export function getItemsByType(type: string): Item[] {
  return items.filter((item) => item.type === type);
}

/**
 * Gets items filtered by subcategory
 */
export function getItemsBySubCategory(subCategory: string): Item[] {
  return items.filter((item) => item.subCategory === subCategory);
}

/**
 * Gets the item code for a given item name
 * Returns null for runewords since they don't have item codes
 */
export function getItemCode(itemName: string): string | null {
  const simpleName = simplifyItemName(itemName);
  const item = itemsByNameSimple[simpleName];

  // Runewords don't have item codes
  if (item?.type === 'runeword') {
    return null;
  }

  return item?.code || null;
}

/**
 * Gets popular item codes for preloading
 */
export function getPopularItemCodes(): string[] {
  // Return codes for some popular items that are commonly displayed
  const popularItems = items.filter((item) => {
    // Include high-level runes and popular uniques (exclude runewords since they don't have item codes)
    return (
      (item.type === 'rune' &&
        ['r25', 'r26', 'r27', 'r28', 'r29', 'r30', 'r31', 'r32', 'r33'].includes(
          item.code || '',
        )) ||
      (item.type === 'unique' && item.treasureClass === 'elite')
    );
  });

  return popularItems.map((item) => item.code).filter((code): code is string => code !== undefined);
}
