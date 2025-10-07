import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import type * as d2s from '@dschu012/d2s';
import { read } from '@dschu012/d2s';
import { runesByCode } from '../items/indexes';
import type { D2SaveFile } from '../services/saveFileMonitor';
import type { D2Item, D2SItem, Item, ItemDetectionEvent } from '../types/grail';

/**
 * Service for detecting and analyzing items from Diablo 2 save files.
 * This service parses D2 save files, extracts items, and matches them against
 * the Holy Grail item database to identify found items.
 */
class ItemDetectionService extends EventEmitter {
  private grailItems: Item[] = [];

  /**
   * Sets the Holy Grail items that will be used for matching detected items.
   * @param {Item[]} items - Array of Holy Grail items to match against.
   */
  setGrailItems(items: Item[]): void {
    this.grailItems = items;
  }

  /**
   * Analyzes a Diablo 2 save file to detect and match items against the Holy Grail database.
   * @param {D2SaveFile} saveFile - The save file to analyze.
   * @param {d2s.types.IItem[]} [preExtractedItems] - Optional pre-extracted items to avoid re-parsing.
   * @param {boolean} [silent=false] - If true, suppress notifications for detected items.
   * @returns {Promise<void>} A promise that resolves when analysis is complete.
   */
  async analyzeSaveFile(
    saveFile: D2SaveFile,
    preExtractedItems?: d2s.types.IItem[],
    silent: boolean = false,
  ): Promise<void> {
    try {
      let items: D2Item[];

      if (preExtractedItems && preExtractedItems.length > 0) {
        // Use pre-extracted items to avoid duplicate parsing
        console.log(`Using ${preExtractedItems.length} pre-extracted items for ${saveFile.name}`);
        items = this.convertD2SItemsToD2Items(preExtractedItems, saveFile.name);
      } else {
        // Fallback to parsing the save file again
        console.log(`No pre-extracted items provided, parsing save file: ${saveFile.name}`);
        items = await this.extractItemsFromSaveFile(saveFile);
      }

      // Simple processing - no complex state tracking
      for (const item of items) {
        const grailMatch = this.findGrailMatch(item);
        if (grailMatch) {
          this.emit('item-detection', {
            type: 'item-found',
            item,
            grailItem: grailMatch,
            silent,
          } as ItemDetectionEvent);
        }
      }
    } catch (error) {
      console.error('Error analyzing save file:', error);
    }
  }

  /**
   * Converts D2S items to D2Item format for grail detection.
   * @private
   * @param {d2s.types.IItem[]} d2sItems - Array of D2S items to convert.
   * @param {string} characterName - Name of the character owning these items.
   * @returns {D2Item[]} Array of converted D2Item objects.
   */
  private convertD2SItemsToD2Items(d2sItems: d2s.types.IItem[], characterName: string): D2Item[] {
    const items: D2Item[] = [];

    const processItems = (
      itemList: d2s.types.IItem[],
      defaultLocation: D2Item['location'] = 'inventory',
    ) => {
      for (const item of itemList) {
        // Convert the D2S item to D2Item format
        const d2Item: D2Item = {
          id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: this.getItemName(item),
          type: this.getItemType(item),
          quality: this.getItemQuality(item),
          location: defaultLocation,
          characterName,
          level: item.level || 1,
          ethereal: !!item.ethereal,
          sockets: this.getItemSockets(item),
          timestamp: new Date(),
        };

        items.push(d2Item);

        // Process socketed items recursively
        if (item.socketed_items?.length) {
          processItems(item.socketed_items, defaultLocation);
        }
      }
    };

    processItems(d2sItems);
    return items;
  }

  /**
   * Extracts items from a D2 save file using the d2s library.
   * @private
   * @param {D2SaveFile} saveFile - The save file to extract items from.
   * @returns {Promise<D2Item[]>} A promise that resolves with an array of extracted items.
   */
  private async extractItemsFromSaveFile(saveFile: D2SaveFile): Promise<D2Item[]> {
    const items: D2Item[] = [];

    try {
      const buffer = await fs.readFile(saveFile.path);

      // Parse the D2 save file using the d2s library
      const saveData = await read(buffer);

      if (!saveData) {
        console.warn('Failed to parse save file:', saveFile.path);
        return []; // Return empty array instead of fallback
      }

      // Extract items from all possible locations
      const allItemLists = [
        { items: saveData.items || [], location: 'inventory' },
        { items: saveData.merc_items || [], location: 'equipment' },
        { items: saveData.corpse_items || [], location: 'inventory' },
      ];

      for (const { items: itemList, location } of allItemLists) {
        this.extractItemsFromList(
          itemList as D2SItem[],
          items,
          saveFile.name,
          location as D2Item['location'],
        );
      }

      console.log(`Extracted ${items.length} items from ${saveFile.name}`);
    } catch (error) {
      console.error('Error parsing save file with d2s:', error);
      return []; // Return empty array instead of fallback
    }

    return items;
  }

  /**
   * Extracts items from a list of D2S items and adds them to the results array.
   * @private
   * @param {D2SItem[]} itemList - The list of D2S items to process.
   * @param {D2Item[]} items - The array to add extracted items to.
   * @param {string} characterName - The name of the character owning these items.
   * @param {D2Item['location']} defaultLocation - The default location for items.
   * @param {boolean} [_isEmbed=false] - Whether these items are embedded in other items.
   */
  private extractItemsFromList(
    itemList: D2SItem[],
    items: D2Item[],
    characterName: string,
    defaultLocation: D2Item['location'],
    _isEmbed: boolean = false,
  ): void {
    for (const d2Item of itemList) {
      try {
        // Only extract items that are unique, set, rare, or have specific names
        if (
          d2Item.unique_name ||
          d2Item.set_name ||
          d2Item.rare_name ||
          d2Item.rare_name2 ||
          this.isRune(d2Item) ||
          d2Item.runeword_name
        ) {
          const item: D2Item = {
            id: `${characterName}_${d2Item.id || Date.now()}_${Math.random()}`,
            name: this.getItemName(d2Item),
            type: this.getItemType(d2Item),
            quality: this.getItemQuality(d2Item),
            level: d2Item.level || 1,
            ethereal: Boolean(d2Item.ethereal),
            sockets: this.getItemSockets(d2Item),
            timestamp: new Date(),
            characterName,
            location: this.getItemLocation(d2Item) || defaultLocation,
          };

          items.push(item);
        }

        // Recursively process socketed items
        if (d2Item.socketed_items?.length) {
          this.extractItemsFromList(
            d2Item.socketed_items,
            items,
            characterName,
            defaultLocation,
            true,
          );
        }
      } catch (itemError) {
        console.warn('Error parsing individual item:', itemError);
      }
    }
  }

  /**
   * Determines if a D2S item is a rune based on its type.
   * @private
   * @param {D2SItem} item - The D2S item to check.
   * @returns {boolean} True if the item is a rune, false otherwise.
   */
  private isRune(item: D2SItem): boolean {
    // Improved rune detection based on d2rHolyGrail
    return Boolean(item.type && runesByCode[item.type]);
  }

  /**
   * Extracts and normalizes the name of a D2S item.
   * Handles unique items, set items, rare items, runes, runewords, and rainbow facets.
   * @private
   * @param {D2SItem} d2Item - The D2S item to get the name from.
   * @returns {string} The normalized item name.
   */
  private getItemName(d2Item: D2SItem): string {
    let name = d2Item.unique_name || d2Item.set_name || d2Item.rare_name || d2Item.rare_name2 || '';

    if (name) {
      name = name.toLowerCase().replace(/[^a-z0-9]/gi, '');
    }

    // Handle rainbow facets with magic attribute processing (from d2rHolyGrail)
    if (name.includes('rainbowfacet')) {
      name = this.processRainbowFacet(d2Item, name);
    } else if (this.isRune(d2Item)) {
      // Proper rune name mapping (from d2rHolyGrail)
      const runeType = d2Item.type;
      if (runeType && runesByCode[runeType]) {
        name = runesByCode[runeType].name.toLowerCase();
      }
    } else if (d2Item.runeword_name) {
      // Handle runewords with name simplification (from d2rHolyGrail)
      name = this.simplifyItemName(d2Item.runeword_name);
    }

    return name || d2Item.name || d2Item.type_name || d2Item.code || 'Unknown Item';
  }

  /**
   * Processes rainbow facet items to determine their specific type and skill.
   * @private
   * @param {D2SItem} d2Item - The D2S item containing rainbow facet data.
   * @param {string} name - The base name of the rainbow facet.
   * @returns {string} The processed rainbow facet name with type and skill information.
   */
  private processRainbowFacet(d2Item: D2SItem, name: string): string {
    let type = '';
    let skill = '';

    d2Item.magic_attributes?.forEach((attr) => {
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

    return `${name}${skill}${type}`;
  }

  /**
   * Simplifies an item name by converting to lowercase and removing special characters.
   * @private
   * @param {string} name - The item name to simplify.
   * @returns {string} The simplified item name.
   */
  private simplifyItemName(name: string): string {
    // Simplified name processing from d2rHolyGrail
    return name.toLowerCase().replace(/[^a-z0-9]/gi, '');
  }

  /**
   * Extracts the item type from a D2S item.
   * @private
   * @param {D2SItem} d2Item - The D2S item to get the type from.
   * @returns {string} The item type in lowercase, or "misc" if no type is found.
   */
  private getItemType(d2Item: D2SItem): string {
    const type = d2Item.type || d2Item.type_name || d2Item.code || '';
    return type.toLowerCase() || 'misc';
  }

  /**
   * Maps D2S quality values to our quality enum.
   * @private
   * @param {D2SItem} d2Item - The D2S item to get the quality from.
   * @returns {D2Item['quality']} The mapped quality value.
   */
  private getItemQuality(d2Item: D2SItem): D2Item['quality'] {
    // Map d2s quality values to our quality enum
    const quality = d2Item.quality || 0;

    switch (quality) {
      case 1:
        return 'normal';
      case 2:
        return 'magic';
      case 3:
        return 'rare';
      case 4:
        return 'set';
      case 5:
        return 'unique';
      case 6:
        return 'crafted';
      default:
        return 'normal';
    }
  }

  /**
   * Determines the location of a D2S item.
   * @private
   * @param {D2SItem} d2Item - The D2S item to get the location from.
   * @returns {'inventory' | 'stash' | 'equipment'} The item location.
   */
  private getItemLocation(d2Item: D2SItem): 'inventory' | 'stash' | 'equipment' {
    // Determine item location based on d2s data
    if (d2Item.location === 'equipped' || d2Item.equipped) return 'equipment';
    if (d2Item.location === 'stash') return 'stash';
    return 'inventory';
  }

  /**
   * Extracts the socket count from a D2S item.
   * @private
   * @param {D2SItem} d2Item - The D2S item to get the socket count from.
   * @returns {number} The number of sockets, or 0 if no socket information is available.
   */
  private getItemSockets(d2Item: D2SItem): number {
    // Safely get socket count from d2s item data
    if (Array.isArray(d2Item.gems)) return d2Item.gems.length;
    if (typeof d2Item.socket_count === 'number') return d2Item.socket_count;
    if (typeof d2Item.socketed === 'number') return d2Item.socketed;
    return 0;
  }

  /**
   * Finds a matching Holy Grail item for a detected D2 item.
   * @private
   * @param {D2Item} item - The detected D2 item to match.
   * @returns {Item | null} The matching Holy Grail item, or null if no match is found.
   */
  private findGrailMatch(item: D2Item): Item | null {
    // Simple exact name matching - no complex algorithms
    return this.grailItems.find((grailItem) => grailItem.id === item.name) || null;
  }
}

export { ItemDetectionService };
