import type { Item } from 'electron/types/grail';
import { runes } from '../../electron/items/runes';
import { runewords } from '../../electron/items/runewords';

/**
 * Represents the user's rune inventory
 */
export interface RuneInventory {
  [runeId: string]: number;
}

/**
 * Information about a runeword that can potentially be crafted
 */
export interface CraftableRuneword {
  runeword: Item;
  canCraft: boolean;
  missingRunes: { runeId: string; runeName: string; needed: number }[];
  hasAllRunes: boolean;
}

/**
 * Get all available runes in the game
 */
export function getAllRunes(): Item[] {
  return runes;
}

/**
 * Get all available runewords in the game
 */
export function getAllRunewords(): Item[] {
  return runewords;
}

/**
 * Get rune name by ID
 */
export function getRuneName(runeId: string): string {
  const rune = runes.find((r) => r.id === runeId);
  return rune?.name || runeId;
}

/**
 * Calculate the number of each rune needed for a specific runeword
 */
export function calculateRuneRequirements(runeword: Item): Map<string, number> {
  const requirements = new Map<string, number>();

  if (!runeword.runes || runeword.runes.length === 0) {
    return requirements;
  }

  for (const runeId of runeword.runes) {
    requirements.set(runeId, (requirements.get(runeId) || 0) + 1);
  }

  return requirements;
}

/**
 * Check if a runeword can be crafted with the given inventory
 */
export function canCraftRuneword(runeword: Item, inventory: RuneInventory): boolean {
  if (!runeword.runes || runeword.runes.length === 0) {
    return false;
  }

  const requirements = calculateRuneRequirements(runeword);

  for (const [runeId, needed] of requirements.entries()) {
    const available = inventory[runeId] || 0;
    if (available < needed) {
      return false;
    }
  }

  return true;
}

/**
 * Get missing runes needed to craft a runeword
 */
export function getMissingRunes(
  runeword: Item,
  inventory: RuneInventory
): { runeId: string; runeName: string; needed: number }[] {
  if (!runeword.runes || runeword.runes.length === 0) {
    return [];
  }

  const requirements = calculateRuneRequirements(runeword);
  const missing: { runeId: string; runeName: string; needed: number }[] = [];

  for (const [runeId, needed] of requirements.entries()) {
    const available = inventory[runeId] || 0;
    if (available < needed) {
      missing.push({
        runeId,
        runeName: getRuneName(runeId),
        needed: needed - available,
      });
    }
  }

  return missing;
}

/**
 * Get all craftable runewords based on the current inventory
 */
export function getCraftableRunewords(inventory: RuneInventory): CraftableRuneword[] {
  return runewords.map((runeword) => {
    const canCraft = canCraftRuneword(runeword, inventory);
    const missingRunes = getMissingRunes(runeword, inventory);

    return {
      runeword,
      canCraft,
      missingRunes,
      hasAllRunes: missingRunes.length === 0,
    };
  });
}

/**
 * Filter runewords by craftability
 */
export function filterCraftableRunewords(
  craftableRunewords: CraftableRuneword[],
  showOnlyCraftable: boolean
): CraftableRuneword[] {
  if (!showOnlyCraftable) {
    return craftableRunewords;
  }

  return craftableRunewords.filter((cr) => cr.canCraft);
}

/**
 * Search runewords by name
 */
export function searchRunewords(
  craftableRunewords: CraftableRuneword[],
  searchTerm: string
): CraftableRuneword[] {
  if (!searchTerm.trim()) {
    return craftableRunewords;
  }

  const lowerSearch = searchTerm.toLowerCase();
  return craftableRunewords.filter((cr) =>
    cr.runeword.name.toLowerCase().includes(lowerSearch)
  );
}

/**
 * Sort runewords by various criteria
 */
export function sortRunewords(
  craftableRunewords: CraftableRuneword[],
  sortBy: 'name' | 'runes' | 'craftable'
): CraftableRuneword[] {
  const sorted = [...craftableRunewords];

  switch (sortBy) {
    case 'name':
      sorted.sort((a, b) => a.runeword.name.localeCompare(b.runeword.name));
      break;
    case 'runes':
      sorted.sort((a, b) => {
        const aRuneCount = a.runeword.runes?.length || 0;
        const bRuneCount = b.runeword.runes?.length || 0;
        return aRuneCount - bRuneCount;
      });
      break;
    case 'craftable':
      sorted.sort((a, b) => {
        if (a.canCraft && !b.canCraft) return -1;
        if (!a.canCraft && b.canCraft) return 1;
        if (a.hasAllRunes && !b.hasAllRunes) return -1;
        if (!a.hasAllRunes && b.hasAllRunes) return 1;
        return a.missingRunes.length - b.missingRunes.length;
      });
      break;
  }

  return sorted;
}

/**
 * Add runes to inventory
 */
export function addRuneToInventory(
  inventory: RuneInventory,
  runeId: string,
  quantity = 1
): RuneInventory {
  return {
    ...inventory,
    [runeId]: (inventory[runeId] || 0) + quantity,
  };
}

/**
 * Remove runes from inventory
 */
export function removeRuneFromInventory(
  inventory: RuneInventory,
  runeId: string,
  quantity = 1
): RuneInventory {
  const current = inventory[runeId] || 0;
  const newQuantity = Math.max(0, current - quantity);

  const newInventory = { ...inventory };
  if (newQuantity === 0) {
    delete newInventory[runeId];
  } else {
    newInventory[runeId] = newQuantity;
  }

  return newInventory;
}

/**
 * Clear all runes from inventory
 */
export function clearInventory(): RuneInventory {
  return {};
}

/**
 * Get total rune count in inventory
 */
export function getTotalRuneCount(inventory: RuneInventory): number {
  return Object.values(inventory).reduce((sum, count) => sum + count, 0);
}
