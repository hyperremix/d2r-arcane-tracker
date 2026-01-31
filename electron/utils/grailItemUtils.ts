import { itemsByNameSimple, runesByCode, runewordsByNameSimple } from '../items/indexes';
import type { D2SItem } from '../types/grail';
import { simplifyItemName } from './objects';

/**
 * Checks if a D2S item is grail-trackable (unique, set, rune, or runeword).
 * Single source of truth.
 */
export function isGrailTrackable(item: D2SItem): boolean {
  return getGrailItemId(item) !== null;
}

/**
 * Resolves the specific Rainbow Facet name based on magic attributes.
 */
function resolveRainbowFacetName(item: D2SItem, simpleName: string): string {
  let type = '';
  let skill = '';

  item.magic_attributes?.forEach((attr) => {
    switch (attr.name) {
      case 'item_skillondeath':
        type = 'death';
        break;
      case 'item_skillonlevelup':
        type = 'levelup';
        break;
      case 'passive_cold_mastery':
        skill = 'cold';
        break;
      case 'passive_pois_mastery':
        skill = 'poison';
        break;
      case 'passive_fire_mastery':
        skill = 'fire';
        break;
      case 'passive_ltng_mastery':
        skill = 'lightning';
        break;
    }
  });

  return `${simpleName}${skill}${type}`;
}

/**
 * Gets the item ID for a D2S item by matching against various item properties.
 * Centralized logic for identifying grail items.
 */
export function getGrailItemId(d2sItem: unknown): string | null {
  const item = d2sItem as D2SItem; // Type assertion for D2S item structure

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
    let simpleName = simplifyItemName(name);

    // Handle Rainbow Facets
    if (simpleName.includes('rainbowfacet')) {
      simpleName = resolveRainbowFacetName(item, simpleName);
    }

    return itemsByNameSimple[simpleName]?.id || null;
  }

  return null;
}

/**
 * Legacy alias for backward compatibility during refactor
 */
export const getItemIdForD2SItem = getGrailItemId;
