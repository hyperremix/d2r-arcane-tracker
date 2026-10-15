import { constants as constants105 } from '@dschu012/d2s/lib/data/versions/105_constant_data';
import { itemsByNameSimple, runesByCode, runewordsByNameSimple } from '../items/indexes';
import type { D2SItem } from '../types/grail';
import { isRuneCode, normalizeItemCodeKey } from './d2rFormat';
import { simplifyItemName } from './objects';

// The v105 table is a superset of the v99 one and includes the Reign of the Warlock base items
const armorItemCodes = new Set(Object.keys(constants105.armor_items));

/**
 * Runeword that took over a Hustle find. Reign of the Warlock renamed Hustle to Hysteria in body
 * armor and to Mania in weapons, but the d2s parser still names both Hustle.
 * @param itemCode - Code of the base item, for example `uui` (Dusk Shroud)
 */
export function resolveHustleSuccessorName(itemCode: unknown): 'Hysteria' | 'Mania' {
  const codeKey = normalizeItemCodeKey(itemCode);
  return codeKey && armorItemCodes.has(codeKey) ? 'Hysteria' : 'Mania';
}

/**
 * In-game name of the runeword of an item, correcting the names the d2s parser gets wrong: "Love"
 * is Lore, and Hustle is Mania or Hysteria depending on the base item.
 * @returns The runeword name, or `undefined` when the item is no runeword
 */
export function resolveRunewordName(item: D2SItem): string | undefined {
  const name = item.runeword_name;
  if (typeof name !== 'string' || !name) {
    return undefined;
  }

  if (name === 'Love') {
    return 'Lore';
  }

  return name === 'Hustle' ? resolveHustleSuccessorName(item.type) : name;
}

/**
 * Resolves the specific Rainbow Facet name based on magic attributes.
 */
export function resolveRainbowFacetName(item: D2SItem, simpleName: string): string {
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

  // Handle runes by code; the lookup uses the same normalized code the predicate matched
  if (typeof item?.type === 'string' && isRuneCode(item.type)) {
    const rune = runesByCode[normalizeItemCodeKey(item.type) ?? ''];
    return rune?.id || null;
  }

  // Handle runewords by name
  const runewordName = item ? resolveRunewordName(item) : undefined;
  if (runewordName) {
    const runeword = runewordsByNameSimple[simplifyItemName(runewordName)];
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
