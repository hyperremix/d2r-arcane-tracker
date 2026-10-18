import { parseRawItemJson } from 'electron/utils/rawItemJson';
import { getItemRollQuality, type ItemRollQuality, type RollItemSource } from '@/lib/rollQuality';

/** Stats the inventory stat filter offers, with the d2s stat names they read. */
export const ITEM_STAT_FILTER_KEYS = [
  'life',
  'mana',
  'allResistances',
  'fireResistance',
  'coldResistance',
  'lightningResistance',
  'poisonResistance',
  'allSkills',
  'classSkills',
  'skillTreeSkills',
  'fasterHitRecovery',
  'fasterCastRate',
  'increasedAttackSpeed',
  'fasterRunWalk',
  'enhancedDamage',
  'enhancedDefense',
  'maxDamage',
  'attackRating',
  'lifeSteal',
  'manaSteal',
  'magicFind',
  'strength',
  'dexterity',
  'vitality',
  'energy',
] as const;

export type ItemStatFilterKey = (typeof ITEM_STAT_FILTER_KEYS)[number];

const RESISTANCE_STATS = ['fireresist', 'coldresist', 'lightresist', 'poisonresist'];

/**
 * The d2s stats behind each filter. Every stat must be present; with several stats the lowest
 * value counts (all resistances are as high as the lowest resistance).
 */
const STAT_FILTER_STATS: Record<ItemStatFilterKey, readonly string[]> = {
  life: ['maxhp'],
  mana: ['maxmana'],
  allResistances: RESISTANCE_STATS,
  fireResistance: ['fireresist'],
  coldResistance: ['coldresist'],
  lightningResistance: ['lightresist'],
  poisonResistance: ['poisonresist'],
  allSkills: ['item_allskills'],
  classSkills: ['item_addclassskills'],
  skillTreeSkills: ['item_addskill_tab'],
  fasterHitRecovery: ['item_fastergethitrate'],
  fasterCastRate: ['item_fastercastrate'],
  increasedAttackSpeed: ['item_fasterattackrate'],
  fasterRunWalk: ['item_fastermovevelocity'],
  enhancedDamage: ['item_maxdamage_percent'],
  enhancedDefense: ['item_armor_percent'],
  maxDamage: ['maxdamage'],
  attackRating: ['tohit'],
  lifeSteal: ['lifedrainmindam'],
  manaSteal: ['manadrainmindam'],
  magicFind: ['item_magicbonus'],
  strength: ['strength'],
  dexterity: ['dexterity'],
  vitality: ['vitality'],
  energy: ['energy'],
};

interface RawItemProperties extends RollItemSource {
  type?: unknown;
  type_name?: unknown;
  categories?: unknown;
  total_nr_of_sockets?: unknown;
  combined_magic_attributes?: unknown;
  runeword_attributes?: unknown;
}

/** Base item, sockets and stats of a parsed item, read once from its raw d2s JSON. */
export interface ItemProperties {
  /** Base item code, for example `7s8`. */
  baseCode?: string;
  /** Base item name, for example `Thresher`. */
  baseName?: string;
  /** Base item categories, for example `Polearm`, `Melee Weapon`. */
  categories: string[];
  /** Total sockets (filled and open). */
  socketCount: number;
  /** Highest value of each stat over the item and what is socketed in it, by d2s stat name. */
  statValues: Map<string, number>;
  rollQuality?: ItemRollQuality;
}

/** The fields of an inventory or vault item this module reads. */
export interface ItemPropertiesSource {
  rawItemJson: string;
  socketCount?: number;
}

function toText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Stat values of the item, its runeword and what is socketed in it. Stats that appear several
 * times with different parameters (class or skill tab) keep their highest value.
 */
function readStatValues(raw: RawItemProperties): Map<string, number> {
  const combined = Array.isArray(raw.combined_magic_attributes)
    ? raw.combined_magic_attributes
    : [
        ...(Array.isArray(raw.magic_attributes) ? raw.magic_attributes : []),
        ...(Array.isArray(raw.runeword_attributes) ? raw.runeword_attributes : []),
      ];
  const statValues = new Map<string, number>();
  for (const attribute of combined as Array<{ name?: unknown; values?: unknown }>) {
    if (!attribute || typeof attribute.name !== 'string' || !Array.isArray(attribute.values)) {
      continue;
    }
    const value = attribute.values[attribute.values.length - 1];
    if (typeof value !== 'number') {
      continue;
    }
    const previous = statValues.get(attribute.name);
    statValues.set(attribute.name, previous === undefined ? value : Math.max(previous, value));
  }
  return statValues;
}

function readItemProperties(item: ItemPropertiesSource): ItemProperties {
  const raw = parseRawItemJson<RawItemProperties>(item.rawItemJson) ?? {};
  const totalSockets = raw.total_nr_of_sockets;
  return {
    baseCode: toText(raw.type),
    baseName: toText(raw.type_name),
    categories: Array.isArray(raw.categories)
      ? raw.categories.filter((category): category is string => typeof category === 'string')
      : [],
    socketCount:
      typeof totalSockets === 'number' && Number.isInteger(totalSockets)
        ? totalSockets
        : (item.socketCount ?? 0),
    statValues: readStatValues(raw),
    rollQuality: getItemRollQuality(raw),
  };
}

const propertiesCache = new WeakMap<ItemPropertiesSource, ItemProperties>();

/**
 * Base item, sockets, stats and roll quality of an inventory or vault item. The result is cached
 * per item object, so filtering and sorting a list parses each item once.
 * @param item - Inventory or vault item
 */
export function getItemProperties(item: ItemPropertiesSource): ItemProperties {
  const cached = propertiesCache.get(item);
  if (cached) {
    return cached;
  }

  const properties = readItemProperties(item);
  propertiesCache.set(item, properties);
  return properties;
}

/**
 * Value of a filter stat on an item; undefined when the item doesn't have it.
 * @param properties - The item's properties
 * @param key - The filter stat
 */
export function getItemStatValue(
  properties: ItemProperties,
  key: ItemStatFilterKey,
): number | undefined {
  const values = STAT_FILTER_STATS[key].map((stat) => properties.statValues.get(stat));
  if (values.some((value) => value === undefined)) {
    return undefined;
  }

  return Math.min(...(values as number[]));
}
