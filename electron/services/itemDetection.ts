import type {
  ChronicleEntry,
  D2Item,
  D2SaveFile,
  D2SItem,
  GrailProgress,
  Item,
  ItemDetectionEvent,
  ParsedInventoryItemWithRaw,
} from '../types/grail';
import { createServiceLogger } from '../utils/serviceLogger';
import { resolveChronicleGrailItemId } from './chronicle';
import type { EventBus } from './EventBus';
import {
  resolveGrailLookupName,
  selectDetectionCandidates,
  toDetectedItem,
} from './itemNormalizer';

const log = createServiceLogger('ItemDetection');

/** Item id of every Chronicle find, so its grail progress row is the same on every scan. */
const CHRONICLE_ITEM_ID = 'chronicle';

/** The detected item of a Chronicle entry, which only names the grail item and when it was found. */
function toChronicleItem(entry: ChronicleEntry, grailItem: Item, saveFile: D2SaveFile): D2Item {
  return {
    id: `${CHRONICLE_ITEM_ID}_${entry.category}_${entry.index}`,
    name: grailItem.name,
    type: grailItem.type,
    quality: entry.category === 'runeword' ? 'normal' : entry.category,
    location: 'stash',
    characterName: saveFile.name,
    level: 1,
    ethereal: false,
    sockets: 0,
    timestamp: entry.foundAt,
  };
}

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
   * @param {ParsedInventoryItemWithRaw[]} parsedItems - Items the save file monitor already parsed from the file.
   * @param {boolean} [silent=false] - If true, suppress notifications for detected items.
   * @param {boolean} [isInitialScan=false] - If true, marks items as being from initial scan for statistics exclusion.
   * @returns {Promise<ItemDetectionEvent[]>} The items found for the first time (also emitted as `item-detection` events).
   */
  async analyzeSaveFile(
    saveFile: D2SaveFile,
    parsedItems: ParsedInventoryItemWithRaw[],
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
   * Matches the entries of the in-game Chronicle of a shared stash against the Holy Grail database
   * and emits an `item-detection` event for every grail item seen for the first time, found at the
   * time the Chronicle recorded it. These finds are always silent: they fill in history the save
   * files no longer show (an item that was sold, dropped or used up), while a new find notifies
   * through the item itself, which the save files hold. The Chronicle does not record whether an
   * item was ethereal, so its finds count as normal items.
   * @param {D2SaveFile} saveFile - The shared stash the Chronicle comes from.
   * @param {ChronicleEntry[]} entries - The entries of its Chronicle.
   * @param {boolean} [isInitialScan=false] - If true, marks items as being from initial scan for statistics exclusion.
   * @returns {ItemDetectionEvent[]} The items found for the first time (also emitted as `item-detection` events).
   */
  analyzeChronicle(
    saveFile: D2SaveFile,
    entries: ChronicleEntry[],
    isInitialScan: boolean = false,
  ): ItemDetectionEvent[] {
    const foundItems: ItemDetectionEvent[] = [];
    for (const entry of entries) {
      const grailItem = this.grailItemsById.get(resolveChronicleGrailItemId(entry) ?? '');
      if (!grailItem) {
        continue;
      }

      const itemKey = `${grailItem.id}_false`;
      if (this.previouslySeenItems.has(itemKey)) {
        continue;
      }

      log.info('analyzeChronicle', `New item from the Chronicle: ${grailItem.name}`);
      const foundItem: ItemDetectionEvent = {
        type: 'item-found',
        item: toChronicleItem(entry, grailItem, saveFile),
        grailItem,
        silent: true,
        isInitialScan,
        d2sItemId: CHRONICLE_ITEM_ID,
        foundDate: entry.foundAt,
      };
      this.eventBus.emit('item-detection', foundItem);
      foundItems.push(foundItem);
      this.previouslySeenItems.add(itemKey);
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
   * Stops treating items returned by {@link analyzeSaveFile} as seen, so the next analysis detects
   * them again. Used when they could not be recorded, so a later scan retries instead of dropping them.
   * @param {ItemDetectionEvent[]} foundItems - Events returned by analyzeSaveFile.
   */
  forgetFoundItems(foundItems: ItemDetectionEvent[]): void {
    for (const { grailItem, item } of foundItems) {
      this.previouslySeenItems.delete(`${grailItem.id}_${item.ethereal}`);
    }
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
