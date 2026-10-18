import {
  type ItemRollProperty,
  ROLL_PROPERTY_DEFINITIONS,
  SET_ITEM_ROLL_PROPERTIES,
  UNIQUE_ITEM_ROLL_PROPERTIES,
} from 'electron/items/itemRollRanges';

/** d2s quality numbers of set and unique items. */
const D2S_SET_QUALITY = 5;
const D2S_UNIQUE_QUALITY = 7;

/** A magic attribute of a parsed d2s item: stat name and values (parameters first). */
export interface RollItemAttribute {
  name?: unknown;
  values?: unknown;
  description?: unknown;
}

/** The fields of a parsed d2s item that roll quality reads. */
export interface RollItemSource {
  quality?: unknown;
  unique_id?: unknown;
  set_id?: unknown;
  magic_attributes?: unknown;
  displayed_magic_attributes?: unknown;
}

/** How one variable stat of an item rolled. */
export interface ItemStatRoll {
  /** Property code in the game data, for example `ac%`. */
  propertyCode: string;
  min: number;
  max: number;
  /** Rolled value; undefined when it couldn't be read from the item. */
  value?: number;
  /** Where the value sits between min (0) and max (100); undefined when not rated. */
  percent?: number;
  /** The stat as the item tooltip shows it, if known. */
  description?: string;
}

/** How well the variable stats of a unique or set item rolled. */
export interface ItemRollQuality {
  stats: ItemStatRoll[];
  /** Average percent of the rated stats; undefined when none could be rated. */
  percent?: number;
  /** Whether every variable stat was rated and sits at its max. */
  isPerfect: boolean;
  /** Number of variable stats that couldn't be rated. */
  unratedCount: number;
}

interface ReadAttribute {
  name: string;
  values: number[];
  description?: string;
}

function readAttributes(magicAttributes: unknown, displayed: unknown): ReadAttribute[] {
  if (!Array.isArray(magicAttributes)) {
    return [];
  }

  const displayedAttributes: RollItemAttribute[] = Array.isArray(displayed) ? displayed : [];
  return magicAttributes.flatMap((attribute: RollItemAttribute): ReadAttribute[] => {
    if (!attribute || typeof attribute.name !== 'string' || !Array.isArray(attribute.values)) {
      return [];
    }
    const values = attribute.values.filter((value): value is number => typeof value === 'number');
    // The displayed attributes can be in another order, so they are matched by stat and values
    const shown = displayedAttributes.find(
      (candidate) =>
        candidate?.name === attribute.name &&
        Array.isArray(candidate.values) &&
        candidate.values.join() === values.join(),
    );
    const description = typeof shown?.description === 'string' ? shown.description : undefined;
    return values.length > 0 ? [{ name: attribute.name, values, description }] : [];
  });
}

function isRolled(property: ItemRollProperty): boolean {
  const definition = ROLL_PROPERTY_DEFINITIONS[property[0]];
  return definition !== undefined && definition.kind !== 'other' && property[1] !== property[2];
}

/**
 * The attribute that holds a stat. Stats with a parameter (skills, class skills) are matched by
 * it when the game data names one; otherwise the stat must appear once.
 */
function findAttribute(
  attributes: ReadAttribute[],
  stat: string,
  param: number | undefined,
): ReadAttribute | undefined {
  const candidates = attributes.filter((attribute) => attribute.name === stat);
  if (param !== undefined) {
    const matching = candidates.filter(
      (attribute) => attribute.values.length >= 2 && attribute.values[0] === param,
    );
    return matching.length === 1 ? matching[0] : undefined;
  }

  return candidates.length === 1 ? candidates[0] : undefined;
}

/**
 * Reads the rolled value of one property. A stat that other properties of the item also add to
 * is only used when those add a fixed amount, which is subtracted; otherwise the next stat of the
 * property is tried (for example another resistance of "all resistances").
 */
function readRolledValue(
  property: ItemRollProperty,
  properties: readonly ItemRollProperty[],
  attributes: ReadAttribute[],
): { value: number; description?: string } | undefined {
  const [code, , , param] = property;
  const definition = ROLL_PROPERTY_DEFINITIONS[code];
  if (!definition) {
    return undefined;
  }

  for (const stat of definition.stats) {
    // Properties for another skill or class set the same stat with another parameter
    const others = properties.filter(
      (other) =>
        other !== property &&
        ROLL_PROPERTY_DEFINITIONS[other[0]]?.stats.includes(stat) &&
        (param === undefined || other[3] === undefined || other[3] === param),
    );
    const othersAreFixed = others.every(
      (other) => ROLL_PROPERTY_DEFINITIONS[other[0]]?.kind !== 'other' && !isRolled(other),
    );
    if (!othersAreFixed) {
      continue;
    }

    const attribute = findAttribute(attributes, stat, param);
    if (!attribute) {
      continue;
    }

    const fixedAmount = others.reduce((sum, other) => sum + other[1], 0);
    const storedValue = attribute.values[attribute.values.length - 1] ?? 0;
    return { value: storedValue - fixedAmount, description: attribute.description };
  }

  return undefined;
}

function rateProperty(
  property: ItemRollProperty,
  properties: readonly ItemRollProperty[],
  attributes: ReadAttribute[],
): ItemStatRoll {
  const [propertyCode, min, max] = property;
  const rolled = readRolledValue(property, properties, attributes);
  if (!rolled) {
    return { propertyCode, min, max };
  }

  // A value outside the range means the item doesn't match this game data (for example a patch
  // changed the range), so it is shown but not rated.
  const isInRange = rolled.value >= Math.min(min, max) && rolled.value <= Math.max(min, max);
  // Integer math: dividing first would round values like 229 in 200 to 300 down to 28.99...
  const percent = isInRange ? ((rolled.value - min) * 100) / (max - min) : undefined;
  return { propertyCode, min, max, value: rolled.value, percent, description: rolled.description };
}

/**
 * Rates the variable stats of an item against the game data properties of its unique or set
 * entry. Fixed stats are not rated.
 * @param properties - The properties of the item's unique or set entry
 * @param magicAttributes - The item's own magic attributes (`magic_attributes` of the d2s item)
 * @param displayedAttributes - The same attributes with tooltip descriptions, if available
 * @returns The rating, or undefined when the entry has no variable stat
 */
export function rateRolledProperties(
  properties: readonly ItemRollProperty[],
  magicAttributes: unknown,
  displayedAttributes?: unknown,
): ItemRollQuality | undefined {
  const rolledProperties = properties.filter(isRolled);
  if (rolledProperties.length === 0) {
    return undefined;
  }

  const attributes = readAttributes(magicAttributes, displayedAttributes);
  const stats = rolledProperties.map((property) => rateProperty(property, properties, attributes));
  const ratedPercents = stats.flatMap((stat) => (stat.percent === undefined ? [] : [stat.percent]));
  const unratedCount = stats.length - ratedPercents.length;
  const percent =
    ratedPercents.length > 0
      ? ratedPercents.reduce((sum, value) => sum + value, 0) / ratedPercents.length
      : undefined;

  return {
    stats,
    percent,
    isPerfect: unratedCount === 0 && stats.every((stat) => stat.value === stat.max),
    unratedCount,
  };
}

/** The game data properties of a parsed unique or set item, by its unique or set id. */
function findItemProperties(item: RollItemSource): readonly ItemRollProperty[] | undefined {
  if (item.quality === D2S_UNIQUE_QUALITY && typeof item.unique_id === 'number') {
    return UNIQUE_ITEM_ROLL_PROPERTIES[item.unique_id];
  }

  if (item.quality === D2S_SET_QUALITY && typeof item.set_id === 'number') {
    return SET_ITEM_ROLL_PROPERTIES[item.set_id];
  }

  return undefined;
}

/**
 * Rates how well a parsed unique or set item rolled.
 * @param item - The parsed d2s item (as stored in `rawItemJson`)
 * @returns The rating, or undefined for other items and items whose stats are all fixed
 */
export function getItemRollQuality(item: RollItemSource | undefined): ItemRollQuality | undefined {
  if (!item) {
    return undefined;
  }

  const properties = findItemProperties(item);
  return properties
    ? rateRolledProperties(properties, item.magic_attributes, item.displayed_magic_attributes)
    : undefined;
}
