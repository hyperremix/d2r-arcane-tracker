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
 * Gets the item ID for a D2S item by matching against various item properties
 */
export function getItemIdForD2SItem(d2sItem: unknown): string | null {
  const item = d2sItem as Record<string, unknown>; // Type assertion for D2S item structure

  // Handle runes by code
  if (item?.type && typeof item.type === 'string' && item.type.match(/^r[0-3][0-9]$/)) {
    const rune = runesByCode[item.type];
    return rune?.id || null;
  }

  // Handle runewords by name
  if (item?.runeword_name && typeof item.runeword_name === 'string') {
    // Fix known D2S parser bug: "Love" should be "Lore"
    const runewordName = item.runeword_name === 'Love' ? 'Lore' : item.runeword_name;
    const simpleName = simplifyItemName(runewordName);
    const runeword = runewordsByNameSimple[simpleName];
    return runeword?.id || null;
  }

  // Handle unique/set items by name
  // NOTE: Do NOT use rare_name/rare_name2 - these are randomly generated names
  // for rare items that can coincidentally match runeword/unique names (e.g., "Beast")
  const name = (item?.unique_name || item?.set_name) as string;
  if (name && typeof name === 'string') {
    const simpleName = simplifyItemName(name);
    return itemsByNameSimple[simpleName]?.id || null;
  }

  return null;
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
