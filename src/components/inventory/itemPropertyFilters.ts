import {
  getItemProperties,
  getItemStatValue,
  type ItemProperties,
  type ItemPropertiesSource,
  type ItemStatFilterKey,
} from '@/lib/itemProperties';

export type SocketMatch = 'exactly' | 'atLeast';
export type EtherealFilter = 'any' | 'ethereal' | 'notEthereal';
export type ItemSortOrder = 'default' | 'rollQuality';

/** "Has stat X at least N"; a condition without a value matches every item that has the stat. */
export interface StatCondition {
  id: number;
  stat: ItemStatFilterKey;
  minValue?: number;
}

/** Filters on the properties of an item, applied on top of the search, character and type. */
export interface ItemPropertyFilters {
  /** Number of sockets, or undefined for any. */
  socketCount?: number;
  socketMatch: SocketMatch;
  ethereal: EtherealFilter;
  /** Text the base item name, code or category must contain. */
  baseText: string;
  statConditions: StatCondition[];
  /** Lowest overall roll quality in percent; set, only rated unique and set items match. */
  minRollPercent?: number;
}

export const DEFAULT_ITEM_PROPERTY_FILTERS: ItemPropertyFilters = {
  socketMatch: 'exactly',
  ethereal: 'any',
  baseText: '',
  statConditions: [],
};

/** The fields of an inventory or vault item the property filters read. */
export interface FilterableItem extends ItemPropertiesSource {
  ethereal: boolean;
}

/** Whether any property filter narrows the items. */
export function hasActiveItemPropertyFilters(filters: ItemPropertyFilters): boolean {
  return (
    filters.socketCount !== undefined ||
    filters.ethereal !== 'any' ||
    filters.baseText.trim() !== '' ||
    filters.statConditions.length > 0 ||
    filters.minRollPercent !== undefined
  );
}

function matchesSockets(socketCount: number, filters: ItemPropertyFilters): boolean {
  if (filters.socketCount === undefined) {
    return true;
  }

  return filters.socketMatch === 'atLeast'
    ? socketCount >= filters.socketCount
    : socketCount === filters.socketCount;
}

function matchesEthereal(ethereal: boolean, filter: EtherealFilter): boolean {
  return filter === 'any' || (filter === 'ethereal') === ethereal;
}

function matchesBaseText(
  { baseCode, baseName, categories }: ItemProperties,
  baseText: string,
): boolean {
  const query = baseText.trim().toLowerCase();
  if (!query) {
    return true;
  }

  return [baseName, baseCode, ...categories].some((value) => value?.toLowerCase().includes(query));
}

/**
 * Whether an inventory or vault item matches the property filters.
 * @param item - Inventory or vault item
 * @param filters - Property filters
 */
export function matchesItemPropertyFilters(
  item: FilterableItem,
  filters: ItemPropertyFilters,
): boolean {
  if (!hasActiveItemPropertyFilters(filters)) {
    return true;
  }

  const properties = getItemProperties(item);
  if (
    !matchesSockets(properties.socketCount, filters) ||
    !matchesEthereal(item.ethereal, filters.ethereal) ||
    !matchesBaseText(properties, filters.baseText)
  ) {
    return false;
  }

  const matchesStats = filters.statConditions.every((condition) => {
    const value = getItemStatValue(properties, condition.stat);
    return value !== undefined && value >= (condition.minValue ?? Number.NEGATIVE_INFINITY);
  });
  if (!matchesStats) {
    return false;
  }

  if (filters.minRollPercent === undefined) {
    return true;
  }

  const rollPercent = properties.rollQuality?.percent;
  return rollPercent !== undefined && rollPercent >= filters.minRollPercent;
}

/** Overall roll quality of an item, or -1 when it has none (sorts after every rated item). */
function getRollSortValue(item: ItemPropertiesSource): number {
  return getItemProperties(item).rollQuality?.percent ?? -1;
}

/**
 * Items in the chosen order: as they are, or best overall roll quality first (items without a
 * roll quality last). Ties keep their original order.
 * @param items - Inventory or vault items
 * @param sortOrder - The chosen order
 */
export function sortItems<T extends ItemPropertiesSource>(
  items: T[],
  sortOrder: ItemSortOrder,
): T[] {
  if (sortOrder === 'default') {
    return items;
  }

  return [...items].sort((a, b) => getRollSortValue(b) - getRollSortValue(a));
}
