import type { IItem } from '@dschu012/d2s/lib/d2/types';
import { items } from '../items/index';
import { isRunewordId } from '../items/indexes';
import {
  GameMode,
  type HolyGrailStats,
  type Item,
  type ItemsInSaves,
  type SaveFileItem,
  type Settings,
  type Stats,
} from '../types/grail';

/**
 * Simplifies an item name by removing all non-alphanumeric characters and converting to lowercase.
 * @param {string} name - The item name to simplify.
 * @returns {string} The simplified item name.
 * @example
 * simplifyItemName("Harlequin Crest") // Returns: "harlequincrest"
 */
export const simplifyItemName = (name: string): string =>
  name.replace(/[^a-z0-9]/gi, '').toLowerCase();
/**
 * Determines if an item is a rune based on its type identifier.
 * @param {SaveFileItem | IItem} item - The item to check.
 * @returns {boolean} True if the item is a rune (type matches pattern r01-r33), false otherwise.
 */
export const isRune = (item: SaveFileItem | IItem): boolean =>
  !!item.type && !!item.type.match(/^r[0-3][0-9]$/);

export const isRuneword = (itemId: string): boolean => isRunewordId(itemId);

/**
 * Gets a filtered catalog of items based on settings.
 * @param {Settings} settings - The application settings.
 * @returns {Item[]} Filtered array of items based on settings.
 */
export const getCatalogForSettings = (_settings: Settings): Item[] => {
  return items.filter((_item) => {
    // Filter by game version (placeholder for future Classic/Resurrected filtering)
    // For now, include all items

    // Filter by grail type (placeholder for future grail type filtering)
    // For now, include all items

    return true;
  });
};

/**
 * Type representing a collection of statistics across different item categories.
 */
type StatsColl = {
  normal: Stats;
  ethereal: Stats;
  runes: Stats;
  runewords: Stats;
  uniqItemsList: string[]; // list of uniq items used for finding out if new item appeared
};

/**
 * Processes runes and updates the runesFound tracking object.
 * @param {ItemsInSaves} items - The items in saves.
 * @param {string} itemId - The item ID to process.
 * @param {Settings} settings - The application settings.
 * @param {Object} runesFound - Tracking object for found runes.
 * @returns {boolean} True if a new rune was found, false otherwise.
 */
const processRunes = (
  itemsInSaves: ItemsInSaves,
  itemId: string,
  settings: Settings,
  runesFound: { [runeId: string]: boolean },
): boolean => {
  const item = itemsInSaves[itemId];
  if (item && settings.grailRunes && !runesFound[itemId]) {
    // Check if this is a rune by looking at the item type in our catalog
    const catalogItem = items.find((i) => i.id === itemId);
    if (catalogItem?.type === 'rune') {
      runesFound[itemId] = true;
      return true;
    }
  }
  return false;
};

/**
 * Processes runewords and updates the runewordsFound tracking object.
 * @param {ItemsInSaves} itemsInSaves - The items in saves.
 * @param {string} itemId - The item ID to process.
 * @param {Settings} settings - The application settings.
 * @param {Object} runewordsFound - Tracking object for found runewords.
 * @returns {boolean} True if a new runeword was found, false otherwise.
 */
const processRunewords = (
  itemsInSaves: ItemsInSaves,
  itemId: string,
  settings: Settings,
  runewordsFound: { [runewordId: string]: boolean },
): boolean => {
  const item = itemsInSaves[itemId];

  if (item && isRuneword(itemId) && settings.grailRunewords && !runewordsFound[itemId]) {
    runewordsFound[itemId] = true;
    return true;
  }
  return false;
};

/**
 * Processes normal and ethereal items and updates tracking objects.
 * @param {ItemsInSaves} itemsInSaves - The normal items in saves.
 * @param {ItemsInSaves} ethItems - The ethereal items in saves.
 * @param {string} itemId - The item ID to process.
 * @param {Settings} settings - The application settings.
 * @param {Object} normalFound - Tracking object for found normal items.
 * @param {Object} etherealFound - Tracking object for found ethereal items.
 * @returns {Object} Object containing counts of newly found items.
 * @returns {number} returns.normalCount - Count of newly found normal items.
 * @returns {number} returns.etherealCount - Count of newly found ethereal items.
 */
const processItems = (
  itemsInSaves: ItemsInSaves,
  ethItems: ItemsInSaves,
  itemId: string,
  settings: Settings,
  normalFound: { [itemId: string]: boolean },
  etherealFound: { [itemId: string]: boolean },
): { normalCount: number; etherealCount: number } => {
  let normalCount = 0;
  let etherealCount = 0;

  const isEthereal = !!ethItems[itemId];
  const isNormal = !!itemsInSaves[itemId];

  if (settings.grailNormal && settings.grailEthereal && !normalFound[itemId]) {
    normalCount++;
    normalFound[itemId] = true;
  } else {
    if (isEthereal && settings.grailEthereal && !etherealFound[itemId]) {
      etherealCount++;
      etherealFound[itemId] = true;
    }
    if (isNormal && settings.grailNormal && !normalFound[itemId]) {
      normalCount++;
      normalFound[itemId] = true;
    }
  }

  return { normalCount, etherealCount };
};

/**
 * Calculates statistics counts for all item categories.
 * @param {Item[]} catalog - The filtered item catalog.
 * @param {ItemsInSaves} itemsInSaves - The normal items in saves.
 * @param {ItemsInSaves} ethItems - The ethereal items in saves.
 * @param {Settings} settings - The application settings.
 * @returns {Object} Object containing counts and tracking for all item categories.
 * @returns {number} returns.runesCount - Count of runes found.
 * @returns {number} returns.runewordsCount - Count of runewords found.
 * @returns {number} returns.normalCount - Count of normal items found.
 * @returns {number} returns.etherealCount - Count of ethereal items found.
 * @returns {Object} returns.runesFound - Tracking object for found runes.
 * @returns {Object} returns.runewordsFound - Tracking object for found runewords.
 * @returns {Object} returns.normalFound - Tracking object for found normal items.
 * @returns {Object} returns.etherealFound - Tracking object for found ethereal items.
 */
const calculateStatsCounts = (
  catalog: Item[],
  itemsInSaves: ItemsInSaves,
  ethItems: ItemsInSaves,
  settings: Settings,
): {
  runesCount: number;
  runewordsCount: number;
  normalCount: number;
  etherealCount: number;
  runesFound: { [runeId: string]: boolean };
  runewordsFound: { [runewordId: string]: boolean };
  normalFound: { [itemId: string]: boolean };
  etherealFound: { [itemId: string]: boolean };
} => {
  let runesCount = 0;
  const runesFound: { [runeId: string]: boolean } = {};
  let runewordsCount = 0;
  const runewordsFound: { [runewordId: string]: boolean } = {};
  let normalCount = 0;
  const normalFound: { [itemId: string]: boolean } = {};
  let etherealCount = 0;
  const etherealFound: { [itemId: string]: boolean } = {};

  catalog.forEach((catalogItem) => {
    const itemId = catalogItem.id;
    const item = itemsInSaves[itemId];
    const ethItem = ethItems[itemId];
    if (!item && !ethItem) {
      return;
    }

    // Skip runes if grailRunes is disabled
    if (catalogItem.type === 'rune' && !settings.grailRunes) {
      return;
    }

    // Skip runewords if grailRunewords is disabled
    if (catalogItem.type === 'runeword' && !settings.grailRunewords) {
      return;
    }

    // Process runes
    if (processRunes(itemsInSaves, itemId, settings, runesFound)) {
      runesCount++;
      return;
    }

    // Process runewords
    if (processRunewords(itemsInSaves, itemId, settings, runewordsFound)) {
      runewordsCount++;
      return;
    }

    // Process regular items
    const itemCounts = processItems(
      itemsInSaves,
      ethItems,
      itemId,
      settings,
      normalFound,
      etherealFound,
    );
    normalCount += itemCounts.normalCount;
    etherealCount += itemCounts.etherealCount;
  });

  return {
    runesCount,
    runewordsCount,
    normalCount,
    etherealCount,
    runesFound,
    runewordsFound,
    normalFound,
    etherealFound,
  };
};

/**
 * Calculates the total number of items that exist in each category.
 * @param {Settings} settings - The application settings.
 * @param {Item[]} catalog - The filtered item catalog.
 * @returns {Object} Object containing existence counts for all categories.
 * @returns {number} returns.runesExists - Total number of runes that exist.
 * @returns {number} returns.runewordsExists - Total number of runewords that exist.
 * @returns {number} returns.normalExists - Total number of normal items that exist.
 * @returns {number} returns.etherealExists - Total number of ethereal items that exist.
 */
const calculateExistsCounts = (
  settings: Settings,
  catalog: Item[],
): {
  runesExists: number;
  runewordsExists: number;
  normalExists: number;
  etherealExists: number;
} => {
  const runesExists = settings.grailRunes
    ? catalog.filter((item) => item.type === 'rune').length
    : 0;
  const runewordsExists = settings.grailRunewords
    ? catalog.filter((item) => item.type === 'runeword').length
    : 0;
  const normalExists = settings.grailNormal
    ? catalog.filter((item) => item.etherealType === 'none' || item.etherealType === 'optional')
        .length
    : 0;
  const etherealExists = settings.grailEthereal
    ? catalog.filter((item) => item.etherealType === 'optional' || item.etherealType === 'only')
        .length
    : 0;

  return { runesExists, runewordsExists, normalExists, etherealExists };
};

/**
 * Calculates completion percentage with special handling for near-complete progress.
 * @param {number} counts - The number of items found.
 * @param {number} exists - The total number of items that exist.
 * @returns {number} The completion percentage (0-100), capped at 99 if between 99.5 and 100.
 */
const calculatePercentages = (counts: number, exists: number): number => {
  const percent = !exists ? 0 : (counts / exists) * 100;
  return percent > 99.5 && percent < 100 ? 99 : Math.round(percent);
};

/**
 * Computes sub-statistics for a specific category of items (armor, weapons, etc.).
 * @param {ItemsInSaves} itemsInSaves - The normal items in saves.
 * @param {ItemsInSaves} ethItems - The ethereal items in saves.
 * @param {string} category - The category to filter by (e.g., 'armor', 'weapons', 'jewelry').
 * @param {Settings} settings - The application settings.
 * @returns {StatsColl} Statistics collection for this category.
 */
export const computeSubStats = (
  itemsInSaves: ItemsInSaves,
  ethItems: ItemsInSaves,
  category: string,
  settings: Settings,
): StatsColl => {
  const catalog = getCatalogForSettings(settings);
  const categoryCatalog = catalog.filter((item) => item.category === category);

  // Calculate counts
  const counts = calculateStatsCounts(categoryCatalog, itemsInSaves, ethItems, settings);
  const exists = calculateExistsCounts(settings, categoryCatalog);

  return {
    normal: {
      exists: exists.normalExists,
      owned: counts.normalCount,
      percent: calculatePercentages(counts.normalCount, exists.normalExists),
      remaining: exists.normalExists - counts.normalCount,
    },
    ethereal: {
      exists: exists.etherealExists,
      owned: counts.etherealCount,
      percent: calculatePercentages(counts.etherealCount, exists.etherealExists),
      remaining: exists.etherealExists - counts.etherealCount,
    },
    runes: {
      exists: exists.runesExists,
      owned: counts.runesCount,
      percent: calculatePercentages(counts.runesCount, exists.runesExists),
      remaining: exists.runesExists - counts.runesCount,
    },
    runewords: {
      exists: exists.runewordsExists,
      owned: counts.runewordsCount,
      percent: calculatePercentages(counts.runewordsCount, exists.runewordsExists),
      remaining: exists.runewordsExists - counts.runewordsCount,
    },
    uniqItemsList: Object.keys({
      ...counts.normalFound,
      ...counts.runesFound,
      ...counts.runewordsFound,
    }).concat(Object.keys(counts.etherealFound)),
  };
};

/**
 * Previous unique items found, used for tracking new item discoveries.
 */
let prevUniqItemsFound: string[] = [];
/**
 * Previous timestamp when sound was played, used for throttling notifications.
 */
let prevSoundTimestamp = Date.now();

/**
 * Clears the previous unique items found tracking and resets the sound timestamp.
 */
export const clearPrevUniqItemsFound = () => {
  prevUniqItemsFound = [];
  prevSoundTimestamp = Date.now();
};

/**
 * Calculates total statistics by aggregating stats from all item categories.
 * @param {StatsColl} armorStats - Statistics for armor items.
 * @param {StatsColl} weaponStats - Statistics for weapon items.
 * @param {StatsColl} otherStats - Statistics for other items.
 * @param {StatsColl} setsStats - Statistics for set items.
 * @returns {Object} Object containing total statistics.
 * @returns {number} returns.normalExists - Total normal items that exist.
 * @returns {number} returns.etherealExists - Total ethereal items that exist.
 * @returns {number} returns.normalOwned - Total normal items owned.
 * @returns {number} returns.etherealOwned - Total ethereal items owned.
 * @returns {number} returns.normalPercent - Completion percentage for normal items.
 * @returns {number} returns.etherealPercent - Completion percentage for ethereal items.
 */
const calculateTotalStats = (
  armorStats: StatsColl,
  weaponStats: StatsColl,
  otherStats: StatsColl,
  setsStats: StatsColl,
): {
  normalExists: number;
  etherealExists: number;
  normalOwned: number;
  etherealOwned: number;
  normalPercent: number;
  etherealPercent: number;
} => {
  const normalExists =
    armorStats.normal.exists +
    weaponStats.normal.exists +
    otherStats.normal.exists +
    setsStats.normal.exists;
  const etherealExists =
    armorStats.ethereal.exists + weaponStats.ethereal.exists + otherStats.ethereal.exists;
  const normalOwned =
    armorStats.normal.owned +
    weaponStats.normal.owned +
    otherStats.normal.owned +
    setsStats.normal.owned;
  const etherealOwned =
    armorStats.ethereal.owned + weaponStats.ethereal.owned + otherStats.ethereal.owned;
  const normalPercent = !normalExists ? 0 : (normalOwned / normalExists) * 100;
  const etherealPercent = !etherealExists ? 0 : (etherealOwned / etherealExists) * 100;

  return {
    normalExists,
    etherealExists,
    normalOwned,
    etherealOwned,
    normalPercent,
    etherealPercent,
  };
};

/**
 * Handles sound playing logic when new items are found.
 * @param {string[]} uniqiItemsFound - Array of unique item IDs that were found.
 * @param {Settings} settings - The application settings.
 * @param {null | (() => void)} playSound - Optional sound playing function.
 */
const handleSoundPlay = (
  uniqiItemsFound: string[],
  settings: Settings,
  playSound: null | (() => void),
): void => {
  if (
    settings.gameMode !== GameMode.Manual &&
    playSound &&
    Date.now() - prevSoundTimestamp > 1000
  ) {
    prevSoundTimestamp = Date.now();
    // play sound if new item is found
    if (prevUniqItemsFound.length) {
      for (const itemId of uniqiItemsFound) {
        if (!prevUniqItemsFound.includes(itemId)) {
          playSound();
          break;
        }
      }
    }
  }
  prevUniqItemsFound = uniqiItemsFound;
};
/**
 * Computes comprehensive Holy Grail statistics from save file data.
 * @param {ItemsInSaves} itemsInSaves - The normal items found in saves.
 * @param {ItemsInSaves} ethItems - The ethereal items found in saves.
 * @param {Settings} settings - The application settings.
 * @param {null | (() => void)} [playSound=null] - Optional sound playing function for notifications.
 * @returns {HolyGrailStats} Comprehensive Holy Grail statistics.
 */
export const computeStats = (
  itemsInSaves: ItemsInSaves,
  ethItems: ItemsInSaves,
  settings: Settings,
  playSound: null | (() => void) = null,
): HolyGrailStats => {
  const runesStats = computeSubStats(itemsInSaves, ethItems, 'runes', settings);
  const runewordsStats = computeSubStats(itemsInSaves, ethItems, 'runewords', settings);
  const armorStats = computeSubStats(itemsInSaves, ethItems, 'armor', settings);
  const weaponStats = computeSubStats(itemsInSaves, ethItems, 'weapons', settings);
  const otherStats = computeSubStats(itemsInSaves, ethItems, 'jewelry', settings);
  const setsStats = computeSubStats(itemsInSaves, ethItems, 'sets', settings);

  // Calculate total statistics
  const totalStats = calculateTotalStats(armorStats, weaponStats, otherStats, setsStats);

  // Collect all unique items found
  const uniqiItemsFound = runesStats.uniqItemsList
    .concat(runewordsStats.uniqItemsList)
    .concat(armorStats.uniqItemsList)
    .concat(weaponStats.uniqItemsList)
    .concat(otherStats.uniqItemsList)
    .concat(setsStats.uniqItemsList);

  // Handle sound playing
  handleSoundPlay(uniqiItemsFound, settings, playSound);

  return {
    normal: {
      armor: armorStats.normal,
      weapon: weaponStats.normal,
      other: otherStats.normal,
      sets: setsStats.normal,
      total: {
        exists: totalStats.normalExists,
        owned: totalStats.normalOwned,
        percent:
          totalStats.normalPercent > 99.5 && totalStats.normalPercent < 100
            ? 99
            : Math.round(totalStats.normalPercent),
        remaining: totalStats.normalExists - totalStats.normalOwned,
      },
    },
    ethereal: {
      armor: armorStats.ethereal,
      weapon: weaponStats.ethereal,
      other: otherStats.ethereal,
      sets: setsStats.ethereal,
      total: {
        exists: totalStats.etherealExists,
        owned: totalStats.etherealOwned,
        percent:
          totalStats.etherealPercent > 99.5 && totalStats.etherealPercent < 100
            ? 99
            : Math.round(totalStats.etherealPercent),
        remaining: totalStats.etherealExists - totalStats.etherealOwned,
      },
    },
    runes: runesStats.runes,
    runewords: runewordsStats.runewords,
  };
};

/**
 * Counts the total number of times an item appears across all save files.
 * @param {SaveFileItem} item - The item to count.
 * @returns {number} The total count of the item across all saves.
 */
export const countInSaves = (item: SaveFileItem) => {
  if (!item.inSaves) return 0;
  return Object.values(item.inSaves).reduce((acc, itemsInSave) => acc + itemsInSave.length, 0);
};
