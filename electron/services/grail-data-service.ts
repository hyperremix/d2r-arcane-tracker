import type { DatabaseItem, GrailDatabase } from '../database/database';

/**
 * Service for managing Holy Grail item data and providing various filtering and querying capabilities.
 * This service acts as a high-level interface to the grail database, offering methods to retrieve
 * items by different criteria and calculate completion statistics.
 */
export class GrailDataService {
  private database: GrailDatabase;

  /**
   * Creates a new instance of the GrailDataService.
   * @param {GrailDatabase} database - The grail database instance to use for data operations.
   */
  constructor(database: GrailDatabase) {
    this.database = database;
  }

  /**
   * Retrieves all items that belong to the specified category.
   * @param {string} category - The category to filter by (e.g., "armor", "weapons", "runes").
   * @returns {DatabaseItem[]} An array of items matching the specified category.
   */
  getItemsByCategory(category: string): DatabaseItem[] {
    const allItems = this.database.getAllItems();
    return allItems.filter((item) => item.category === category);
  }

  /**
   * Retrieves all items of the specified type.
   * @param {'unique' | 'set' | 'rune'} type - The item type to filter by.
   * @returns {DatabaseItem[]} An array of items matching the specified type.
   */
  getItemsByType(type: 'unique' | 'set' | 'rune'): DatabaseItem[] {
    const allItems = this.database.getAllItems();
    return allItems.filter((item) => item.type === type);
  }

  /**
   * Retrieves all items by rarity level.
   * Note: Since rarity is no longer stored in the database, this method returns all items.
   * This could be enhanced by mapping item names to rarities if needed in the future.
   * @param {'common' | 'rare' | 'very_rare' | 'extremely_rare'} _rarity - The rarity level to filter by (currently unused).
   * @returns {DatabaseItem[]} An array of all items (rarity filtering not implemented).
   */
  getItemsByRarity(_rarity: 'common' | 'rare' | 'very_rare' | 'extremely_rare'): DatabaseItem[] {
    // Since rarity is no longer stored, return all items for now
    // This could be enhanced by mapping item names to rarities if needed
    return this.database.getAllItems();
  }

  /**
   * Searches for items whose names contain the specified search term.
   * The search is case-insensitive and performs partial matching.
   * @param {string} searchTerm - The term to search for in item names.
   * @returns {DatabaseItem[]} An array of items whose names contain the search term.
   */
  searchItemsByName(searchTerm: string): DatabaseItem[] {
    const allItems = this.database.getAllItems();
    const lowerSearchTerm = searchTerm.toLowerCase();
    return allItems.filter((item) => item.name.toLowerCase().includes(lowerSearchTerm));
  }

  /**
   * Calculates and returns comprehensive statistics about all items in the database.
   * @returns {Object} An object containing item statistics with the following properties:
   * @returns {number} returns.total - The total number of items in the database.
   * @returns {Record<string, number>} returns.byType - Count of items grouped by type (unique, set, rune, etc.).
   * @returns {Record<string, number>} returns.byCategory - Count of items grouped by category (armor, weapons, etc.).
   */
  getItemStatistics(): {
    total: number;
    byType: Record<string, number>;
    byCategory: Record<string, number>;
  } {
    const allItems = this.database.getAllItems();

    const stats = {
      total: allItems.length,
      byType: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
    };

    allItems.forEach((item) => {
      // Count by type
      stats.byType[item.type] = (stats.byType[item.type] || 0) + 1;

      // Count by category
      stats.byCategory[item.category] = (stats.byCategory[item.category] || 0) + 1;
    });

    return stats;
  }

  /**
   * Calculates Holy Grail completion statistics for a specific character or overall progress.
   * @param {string} [characterId] - Optional character ID to calculate completion for. If not provided, returns 0% completion.
   * @returns {Object} An object containing completion statistics with the following properties:
   * @returns {number} returns.totalItems - The total number of items in the Holy Grail.
   * @returns {number} returns.foundItems - The number of items found by the character.
   * @returns {number} returns.completionPercentage - The completion percentage (0-100).
   * @returns {DatabaseItem[]} returns.missingItems - An array of items that have not been found yet.
   */
  getGrailCompletion(characterId?: string): {
    totalItems: number;
    foundItems: number;
    completionPercentage: number;
    missingItems: DatabaseItem[];
  } {
    const allItems = this.database.getAllItems();
    let foundItems = 0;
    const missingItems: DatabaseItem[] = [];

    if (characterId) {
      const progress = this.database.getProgressByCharacter(characterId);
      const foundItemIds = new Set(progress.filter((p) => p.found).map((p) => p.item_id));

      allItems.forEach((item) => {
        if (foundItemIds.has(item.id)) {
          foundItems++;
        } else {
          missingItems.push(item);
        }
      });
    } else {
      // No character specified, consider all items as missing
      missingItems.push(...allItems);
    }

    const completionPercentage =
      allItems.length > 0 ? Math.round((foundItems / allItems.length) * 100) : 0;

    return {
      totalItems: allItems.length,
      foundItems,
      completionPercentage,
      missingItems,
    };
  }
}
