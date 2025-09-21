import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import { read } from '@dschu012/d2s';
import type { D2SaveFile } from '../services/saveFileMonitor';
import type { HolyGrailItem } from '../types/grail';

// Type definition for d2s library item structure
interface D2SItem {
  id?: string | number;
  type?: string;
  type_name?: string;
  code?: string;
  name?: string;
  unique_name?: string;
  set_name?: string;
  rare_name?: string;
  rare_name2?: string;
  runeword_name?: string;
  level?: number;
  ethereal?: number;
  quality?: number;
  location?: string;
  equipped?: boolean;
  socketed?: number;
  socket_count?: number;
  socketed_items?: D2SItem[];
  gems?: unknown[];
  magic_attributes?: Array<{ name: string; value?: unknown }>;
}

// Simplified item structure
interface D2Item {
  id: string;
  name: string;
  type: string;
  quality: 'normal' | 'magic' | 'rare' | 'set' | 'unique' | 'crafted';
  level: number;
  ethereal: boolean;
  sockets: number;
  timestamp: Date;
  characterName: string;
  location: 'inventory' | 'stash' | 'equipment';
}

// Simplified event structure - only item-found events
interface ItemDetectionEvent {
  type: 'item-found';
  item: D2Item;
  grailItem: HolyGrailItem;
}

// Rune mapping for proper rune detection
const runesMapping: Record<string, string> = {
  r01: 'El',
  r02: 'Eld',
  r03: 'Tir',
  r04: 'Nef',
  r05: 'Eth',
  r06: 'Ith',
  r07: 'Tal',
  r08: 'Ral',
  r09: 'Ort',
  r10: 'Thul',
  r11: 'Amn',
  r12: 'Sol',
  r13: 'Shael',
  r14: 'Dol',
  r15: 'Hel',
  r16: 'Io',
  r17: 'Lum',
  r18: 'Ko',
  r19: 'Fal',
  r20: 'Lem',
  r21: 'Pul',
  r22: 'Um',
  r23: 'Mal',
  r24: 'Ist',
  r25: 'Gul',
  r26: 'Vex',
  r27: 'Ohm',
  r28: 'Lo',
  r29: 'Sur',
  r30: 'Ber',
  r31: 'Jah',
  r32: 'Cham',
  r33: 'Zod',
};

class ItemDetectionService extends EventEmitter {
  private grailItems: HolyGrailItem[] = [];
  private isEnabled = false;

  setGrailItems(items: HolyGrailItem[]): void {
    this.grailItems = items;
  }

  enable(): void {
    this.isEnabled = true;
  }

  disable(): void {
    this.isEnabled = false;
  }

  async analyzeSaveFile(saveFile: D2SaveFile): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    try {
      const items = await this.extractItemsFromSaveFile(saveFile);

      // Simple processing - no complex state tracking
      for (const item of items) {
        const grailMatch = this.findGrailMatch(item);
        if (grailMatch) {
          this.emit('item-detection', {
            type: 'item-found',
            item,
            grailItem: grailMatch,
          } as ItemDetectionEvent);
        }
      }
    } catch (error) {
      console.error('Error analyzing save file:', error);
    }
  }

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

  private isRune(item: D2SItem): boolean {
    // Improved rune detection based on d2rHolyGrail
    return Boolean(item.type && runesMapping[item.type]);
  }

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
      if (runeType && runesMapping[runeType]) {
        name = runesMapping[runeType].toLowerCase();
      }
    } else if (d2Item.runeword_name) {
      // Handle runewords with name simplification (from d2rHolyGrail)
      name = `runeword${this.simplifyItemName(d2Item.runeword_name)}`;
    }

    return name || d2Item.name || d2Item.type_name || d2Item.code || 'Unknown Item';
  }

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

  private simplifyItemName(name: string): string {
    // Simplified name processing from d2rHolyGrail
    return name.toLowerCase().replace(/[^a-z0-9]/gi, '');
  }

  private getItemType(d2Item: D2SItem): string {
    const type = d2Item.type || d2Item.type_name || d2Item.code || '';
    return type.toLowerCase() || 'misc';
  }

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

  private getItemLocation(d2Item: D2SItem): 'inventory' | 'stash' | 'equipment' {
    // Determine item location based on d2s data
    if (d2Item.location === 'equipped' || d2Item.equipped) return 'equipment';
    if (d2Item.location === 'stash') return 'stash';
    return 'inventory';
  }

  private getItemSockets(d2Item: D2SItem): number {
    // Safely get socket count from d2s item data
    if (Array.isArray(d2Item.gems)) return d2Item.gems.length;
    if (typeof d2Item.socket_count === 'number') return d2Item.socket_count;
    if (typeof d2Item.socketed === 'number') return d2Item.socketed;
    return 0;
  }

  private findGrailMatch(item: D2Item): HolyGrailItem | null {
    // Simple exact name matching - no complex algorithms
    return this.grailItems.find((grailItem) => grailItem.name === item.name) || null;
  }
}

export { ItemDetectionService };
export type { D2Item, ItemDetectionEvent };
