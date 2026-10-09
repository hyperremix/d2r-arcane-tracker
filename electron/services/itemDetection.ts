import type {
  D2Item,
  D2SaveFile,
  GrailProgress,
  Item,
  ItemDetectionEvent,
  ParsedInventoryItem,
} from '../types/grail';
import { createServiceLogger } from '../utils/serviceLogger';
import type { EventBus } from './EventBus';
import { selectDetectionCandidates, toDetectedItem } from './itemNormalizer';

const log = createServiceLogger('ItemDetection');

/**
 * Service for detecting Holy Grail items in Diablo 2 save files.
 * It matches the items the save file monitor parsed against the Holy Grail item database to
 * identify found items, and tracks previously seen items to prevent duplicate notifications.
 */
class ItemDetectionService {
  private grailItems: Item[] = [];
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
    this.grailItems = items;
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
   * @returns {Promise<void>} A promise that resolves when analysis is complete.
   */
  async analyzeSaveFile(
    saveFile: D2SaveFile,
    parsedItems: ParsedInventoryItem[],
    silent: boolean = false,
    isInitialScan: boolean = false,
  ): Promise<void> {
    try {
      // Track items to prevent duplicate notifications globally
      for (const candidate of selectDetectionCandidates(parsedItems)) {
        const item = toDetectedItem(candidate, saveFile);
        const grailMatch = this.findGrailMatch(item);
        if (grailMatch) {
          // Create unique key for this item using stable properties
          // Uses grailMatch.id (grail item ID) to match database initialization format
          const itemKey = `${grailMatch.id}_${item.ethereal}`;

          // Only emit event if this is a NEW item globally
          if (!this.previouslySeenItems.has(itemKey)) {
            log.info('analyzeSaveFile', `New item detected: ${item.name} in ${saveFile.name}`);
            this.eventBus.emit('item-detection', {
              type: 'item-found',
              item,
              grailItem: grailMatch,
              silent,
              isInitialScan,
            } as ItemDetectionEvent);
            this.previouslySeenItems.add(itemKey);
          }
        }
      }
    } catch (error) {
      log.error('analyzeSaveFile', error, { saveFile: saveFile.name });
    }
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
