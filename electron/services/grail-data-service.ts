import type { DatabaseItem, GrailDatabase } from '../database/database';

/**
 * Service for managing Holy Grail item data
 */
export class GrailDataService {
  private database: GrailDatabase;

  constructor(database: GrailDatabase) {
    this.database = database;
  }

  /**
   * Get all items by category
   */
  getItemsByCategory(category: string): DatabaseItem[] {
    const allItems = this.database.getAllItems();
    return allItems.filter((item) => item.category === category);
  }

  /**
   * Get all items by type
   */
  getItemsByType(type: 'unique' | 'set' | 'rune'): DatabaseItem[] {
    const allItems = this.database.getAllItems();
    return allItems.filter((item) => item.type === type);
  }

  /**
   * Get all items by rarity
   */
  getItemsByRarity(_rarity: 'common' | 'rare' | 'very_rare' | 'extremely_rare'): DatabaseItem[] {
    // Since rarity is no longer stored, return all items for now
    // This could be enhanced by mapping item names to rarities if needed
    return this.database.getAllItems();
  }

  /**
   * Search items by name
   */
  searchItemsByName(searchTerm: string): DatabaseItem[] {
    const allItems = this.database.getAllItems();
    const lowerSearchTerm = searchTerm.toLowerCase();
    return allItems.filter((item) => item.name.toLowerCase().includes(lowerSearchTerm));
  }

  /**
   * Get items by difficulty
   */
  getItemsByDifficulty(_difficulty: 'normal' | 'nightmare' | 'hell'): DatabaseItem[] {
    // Since difficulties are no longer stored, return all items for now
    // All items are available in all difficulties in D2R
    return this.database.getAllItems();
  }

  /**
   * Get item statistics
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
   * Get grail completion statistics for a character
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
