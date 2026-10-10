import type {
  D2SaveFile,
  D2SItem,
  GrailProgress,
  Item,
  ItemDetectionEvent,
  ParsedInventoryItem,
} from '../types/grail';
import { createServiceLogger } from '../utils/serviceLogger';
import type { EventBus } from './EventBus';
import {
  resolveGrailLookupName,
  selectDetectionCandidates,
  toDetectedItem,
} from './itemNormalizer';

const log = createServiceLogger('ItemDetection');

/**
 * Service for detecting Holy Grail items in Diablo 2 save files.
 * It matches the items the save file monitor parsed against the Holy Grail item database to
 * identify found items, and tracks previously seen items to prevent duplicate notifications.
 */
class ItemDetectionService {
  private grailItemsById: Map<string, Item> = new Map();
  private eventBus: EventBus;
  private previouslySeenItems: Set<string> = new Set();

  /**
   * Creates a new instance of the ItemDetectionService.
   * @param {EventBus} eventBus - EventBus instance for emitting events
   */
  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Sets the Holy Grail items that will be used for matching detected items.
   * @param {Item[]} items - Array of Holy Grail items to match against.
   */
  setGrailItems(items: Item[]): void {
    this.grailItemsById = new Map(items.map((item) => [item.id, item]));
  }

  /**
   * Initializes tracking with items already found in the grail database.
   * Prevents re-notification for items found in previous sessions.
   * @param {GrailProgress[]} existingProgress - Array of existing grail progress entries
   */
  initializeFromDatabase(existingProgress: GrailProgress[]): void {
    for (const progress of existingProgress) {
      const itemKey = `${progress.itemId}_${progress.isEthereal}`;
      this.previouslySeenItems.add(itemKey);
    }
    log.info(
      'initializeFromDatabase',
      `Initialized with ${this.previouslySeenItems.size} previously found items`,
    );
  }

  /**
   * Matches the items the save file monitor parsed from a save file against the Holy Grail
   * database and emits an `item-detection` event for every grail item seen for the first time.
   * @param {D2SaveFile} saveFile - The save file the items come from.
   * @param {ParsedInventoryItem[]} parsedItems - Items the save file monitor already parsed from the file.
   * @param {boolean} [silent=false] - If true, suppress notifications for detected items.
   * @param {boolean} [isInitialScan=false] - If true, marks items as being from initial scan for statistics exclusion.
   * @returns {Promise<ItemDetectionEvent[]>} The items found for the first time (also emitted as `item-detection` events).
   */
  async analyzeSaveFile(
    saveFile: D2SaveFile,
    parsedItems: ParsedInventoryItem[],
    silent: boolean = false,
    isInitialScan: boolean = false,
  ): Promise<ItemDetectionEvent[]> {
    const foundItems: ItemDetectionEvent[] = [];
    try {
      // Track items to prevent duplicate notifications globally
      for (const candidate of selectDetectionCandidates(parsedItems)) {
        const grailMatch = this.findGrailMatch(candidate.rawParsedItem);
        if (grailMatch) {
          const item = toDetectedItem(candidate, saveFile);
          // Create unique key for this item using stable properties
          // Uses grailMatch.id (grail item ID) to match database initialization format
          const itemKey = `${grailMatch.id}_${item.ethereal}`;

          // Only emit event if this is a NEW item globally
          if (!this.previouslySeenItems.has(itemKey)) {
            log.info('analyzeSaveFile', `New item detected: ${item.name} in ${saveFile.name}`);
            const foundItem = {
              type: 'item-found',
              item,
              grailItem: grailMatch,
              silent,
              isInitialScan,
            } as ItemDetectionEvent;
            this.eventBus.emit('item-detection', foundItem);
            foundItems.push(foundItem);
            this.previouslySeenItems.add(itemKey);
          }
        }
      }
    } catch (error) {
      log.error('analyzeSaveFile', error, { saveFile: saveFile.name });
    }
    return foundItems;
  }

  /**
   * Finds the Holy Grail item of a raw d2s item by its grail lookup name: the grail item id
   * (which repairs the d2s "Love" -> "Lore" runeword name), otherwise the simplified unique or
   * set name. This is the same key the detection candidates are selected and grouped by.
   * @private
   * @param {D2SItem} rawItem - The raw d2s item to match.
   * @returns {Item | null} The matching Holy Grail item, or null if no match is found.
   */
  private findGrailMatch(rawItem: D2SItem): Item | null {
    return this.grailItemsById.get(resolveGrailLookupName(rawItem)) ?? null;
  }

  /**
   * Clears the tracking of previously seen items.
   * Useful when monitoring restarts or when you want to reset detection.
   */
  clearSeenItems(): void {
    this.previouslySeenItems.clear();
    log.info('clearSeenItems', 'Cleared all seen items tracking');
  }
}

export { ItemDetectionService };
