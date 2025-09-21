import type { IItem } from '@dschu012/d2s/lib/d2/types';
import type {
  IEthGrailData,
  IEthUniqueArmors,
  IEthUniqueOther,
  IEthUniqueWeapons,
} from 'd2-holy-grail/client/src/common/definitions/union/IEthGrailData';
import type {
  ISetItems,
  IUniqueArmors,
  IUniqueOther,
  IUniqueWeapons,
} from 'd2-holy-grail/client/src/common/definitions/union/IHolyGrailData';
import { runesSeed, runewordsSeed } from '../items/grail';
import { runewordsMapping } from '../items/runewords';
import {
  GameMode,
  GameVersion,
  type HolyGrailSeed,
  type HolyGrailStats,
  type Item,
  type ItemsInSaves,
  type Settings,
  type Stats,
} from '../types/grail';

export const simplifyItemName = (name: string): string =>
  name.replace(/[^a-z0-9]/gi, '').toLowerCase();
export const isRune = (item: Item | IItem): boolean =>
  !!item.type && !!item.type.match(/^r[0-3][0-9]$/);

// Interface for flattened item objects
interface FlattenedItem {
  [key: string]: unknown;
}

// Interface for generic object structures in templates
interface GenericItemTemplate {
  [itemId: string]: unknown;
}

// More flexible type for template parameters
type TemplateType =
  | GenericItemTemplate
  | IUniqueArmors
  | IUniqueWeapons
  | IUniqueOther
  | ISetItems
  | IEthUniqueArmors
  | IEthUniqueWeapons
  | IEthUniqueOther
  | HolyGrailSeed
  | IEthGrailData
  | null;

export type ItemNames = { [itemId: string]: FlattenedItem };
export type FlatItemsCache = {
  runes: ItemNames;
  runewords: ItemNames;
  armor: ItemNames;
  weapon: ItemNames;
  other: ItemNames;
  weaponE: ItemNames;
  otherE: ItemNames;
  sets: ItemNames;
  all: ItemNames;
  allR: ItemNames;
  allW: ItemNames;
  allRW: ItemNames;
  allE: ItemNames;
  allRE: ItemNames;
  allWE: ItemNames;
  allRWE: ItemNames;
  ethall: ItemNames;
  etharmor: ItemNames;
  ethweapon: ItemNames;
  ethother: ItemNames;
};
const flatItemsCache: FlatItemsCache = {
  runes: {},
  runewords: {},
  armor: {},
  weapon: {},
  other: {},
  weaponE: {},
  otherE: {},
  sets: {},
  all: {},
  allR: {},
  allW: {},
  allRW: {},
  allE: {},
  allRE: {},
  allWE: {},
  allRWE: {},
  etharmor: {},
  ethweapon: {},
  ethother: {},
  ethall: {},
};

export const buildFlattenObjectCacheKey = (
  cacheKey: keyof FlatItemsCache,
  settings: Settings,
): keyof FlatItemsCache => {
  const shouldHideNormalEthItems = settings.grailNormal && !settings.grailEthereal;
  return `${cacheKey}${settings.grailRunes ? 'R' : ''}${settings.grailRunewords ? 'W' : ''}${shouldHideNormalEthItems ? 'E' : ''}` as keyof FlatItemsCache;
};

// Flattens an object recursively, taking only the key names
export const flattenObject = (
  object: TemplateType,
  cacheKey: keyof FlatItemsCache | null = null,
): ItemNames => {
  const _flattenObject = (obj: GenericItemTemplate, flat: ItemNames) => {
    Object.keys(obj).forEach((key: string) => {
      const value = obj[key];
      if (
        typeof value === 'object' &&
        value !== null &&
        Object.keys(value as Record<string, unknown>).length > 0
      ) {
        _flattenObject(value as GenericItemTemplate, flat);
      } else {
        flat[simplifyItemName(key)] = {};
      }
    });
  };

  if (
    !cacheKey ||
    !flatItemsCache[cacheKey] ||
    Object.keys(flatItemsCache[cacheKey]).length === 0
  ) {
    const flat: ItemNames = {};
    if (object) {
      _flattenObject(object as GenericItemTemplate, flat);
    }
    if (cacheKey) {
      flatItemsCache[cacheKey] = flat;
      return flatItemsCache[cacheKey];
    }
    return flat;
  }

  return flatItemsCache[cacheKey];
};

type StatsColl = {
  normal: Stats;
  ethereal: Stats;
  runes: Stats;
  runewords: Stats;
  uniqItemsList: string[]; // list of uniq items used for finding out if new item appeared
};

// Helper function to process runes
const processRunes = (
  items: ItemsInSaves,
  itemId: string,
  settings: Settings,
  runesFound: { [runeId: string]: boolean },
): boolean => {
  const item = items[itemId];
  if (item && runesSeed[itemId] && settings.grailRunes && !runesFound[itemId]) {
    runesFound[itemId] = true;
    return true;
  }
  return false;
};

// Helper function to process runewords
const processRunewords = (
  items: ItemsInSaves,
  itemId: string,
  settings: Settings,
  runewordsFound: { [runewordId: string]: boolean },
): boolean => {
  const item = items[itemId];
  if (
    item &&
    runewordsSeed[itemId] &&
    settings.grailRunewords &&
    !runewordsFound[itemId] &&
    !(
      settings.gameVersion === GameVersion.Classic &&
      runewordsMapping[runewordsSeed[itemId]].patch === 2.4
    )
  ) {
    runewordsFound[item.name] = true;
    return true;
  }
  return false;
};

// Helper function to process normal and ethereal items
const processItems = (
  items: ItemsInSaves,
  ethItems: ItemsInSaves,
  itemId: string,
  settings: Settings,
  normalFound: { [itemId: string]: boolean },
  etherealFound: { [itemId: string]: boolean },
): { normalCount: number; etherealCount: number } => {
  let normalCount = 0;
  let etherealCount = 0;

  const isEthereal = !!ethItems[itemId];
  const isNormal = !!items[itemId];

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

// Helper function to calculate stats counts
const calculateStatsCounts = (
  flat: ItemNames,
  items: ItemsInSaves,
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

  Object.keys(flat).forEach((itemId) => {
    const item = items[itemId];
    const ethItem = ethItems[itemId];
    if (!item && !ethItem) {
      return;
    }

    // Process runes
    if (processRunes(items, itemId, settings, runesFound)) {
      runesCount++;
      return;
    }

    // Process runewords
    if (processRunewords(items, itemId, settings, runewordsFound)) {
      runewordsCount++;
      return;
    }

    // Process regular items
    const itemCounts = processItems(items, ethItems, itemId, settings, normalFound, etherealFound);
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

// Helper function to calculate existence counts
const calculateExistsCounts = (
  settings: Settings,
  normalFlat: ItemNames,
  ethFlat: ItemNames,
): {
  runesExists: number;
  runewordsExists: number;
  normalExists: number;
  etherealExists: number;
} => {
  const runesExists = settings.grailRunes ? 33 : 0;
  const runewordsExists = settings.grailRunewords
    ? settings.gameVersion === GameVersion.Resurrected
      ? 85
      : 78
    : 0;
  const normalExists = settings.grailNormal ? Object.keys(normalFlat).length : 0;
  const etherealExists = settings.grailEthereal ? Object.keys(ethFlat).length : 0;

  return { runesExists, runewordsExists, normalExists, etherealExists };
};

// Helper function to calculate percentages
const calculatePercentages = (counts: number, exists: number): number => {
  const percent = !exists ? 0 : (counts / exists) * 100;
  return percent > 99.5 && percent < 100 ? 99 : Math.round(percent);
};

export const computeSubStats = (
  items: ItemsInSaves,
  ethItems: ItemsInSaves,
  template: GenericItemTemplate | IUniqueArmors | IUniqueWeapons | IUniqueOther | ISetItems | null,
  ethTemplate: GenericItemTemplate | IEthUniqueArmors | IEthUniqueWeapons | IEthUniqueOther | null,
  settings: Settings,
  cacheKey: keyof FlatItemsCache | null,
): StatsColl => {
  const normalFlat = template ? flattenObject(template, cacheKey) : {};
  const ethFlat = ethTemplate
    ? flattenObject(ethTemplate, `eth${cacheKey}` as keyof FlatItemsCache)
    : {};
  const flat = { ...normalFlat, ...ethFlat };

  // Calculate counts
  const counts = calculateStatsCounts(flat, items, ethItems, settings);
  const exists = calculateExistsCounts(settings, normalFlat, ethFlat);

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

let prevUniqItemsFound: string[] = [];
let prevSoundTimestamp = Date.now();

export const clearPrevUniqItemsFound = () => {
  prevUniqItemsFound = [];
  prevSoundTimestamp = Date.now();
};

// Helper function to calculate total statistics
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

// Helper function to handle sound playing logic
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
export const computeStats = (
  items: ItemsInSaves,
  ethItems: ItemsInSaves,
  template: HolyGrailSeed,
  ethTemplate: IEthGrailData,
  settings: Settings,
  playSound: null | (() => void) = null,
): HolyGrailStats => {
  const shouldHideNormalEthItems = settings.grailNormal && !settings.grailEthereal;
  const runesStats = computeSubStats(
    items,
    ethItems,
    template.runes || null,
    null,
    settings,
    'runes',
  );
  const runewordsStats = computeSubStats(
    items,
    ethItems,
    template.runewords || null,
    null,
    settings,
    'runewords',
  );
  const armorStats = computeSubStats(
    items,
    ethItems,
    template.uniques.armor,
    ethTemplate.uniques.armor,
    settings,
    'armor',
  );
  const weaponStats = computeSubStats(
    items,
    ethItems,
    template.uniques.weapons,
    ethTemplate.uniques.weapons,
    settings,
    `weapon${shouldHideNormalEthItems ? 'E' : ''}`,
  );
  const otherStats = computeSubStats(
    items,
    ethItems,
    template.uniques.other,
    ethTemplate.uniques.other,
    settings,
    `other${shouldHideNormalEthItems ? 'E' : ''}`,
  );
  const setsStats = computeSubStats(items, ethItems, template.sets, null, settings, 'sets');

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

export const countInSaves = (item: Item) => {
  if (!item.inSaves) return 0;
  return Object.values(item.inSaves).reduce((acc, itemsInSave) => acc + itemsInSave.length, 0);
};
