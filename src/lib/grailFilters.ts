import type { AdvancedGrailFilter, GrailFilter, GrailProgress, Item } from 'electron/types/grail';
import { itemMatchesSearch, tokenizeSearchQuery } from '@/lib/itemSearch';

/**
 * Counts the number of user-facing filters that are currently narrowing the item list.
 * Sorting and fuzzy-search mode are not counted since they never hide items on their own.
 * @param {GrailFilter} filter - The current grail filter
 * @returns {number} The number of active filters
 */
export const countActiveFilters = (filter: GrailFilter): number => {
  let count = 0;
  if (filter.searchTerm) count++;
  if (filter.categories && filter.categories.length > 0) count++;
  if (filter.subCategories && filter.subCategories.length > 0) count++;
  if (filter.types && filter.types.length > 0) count++;
  if (filter.foundStatus && filter.foundStatus !== 'all') count++;
  return count;
};

/**
 * Checks if an item matches the specified categories filter.
 * @param {Item} item - The item to check
 * @param {string[]} [categories] - Optional array of categories to match
 * @returns {boolean} True if item matches (or no filter applied), false otherwise
 */
const matchesCategories = (item: Item, categories?: string[]): boolean => {
  return !categories || categories.length === 0 || categories.includes(item.category);
};

/**
 * Builds the category-qualified sub-category filter value, e.g. `weapons:sorceress`.
 * Some sub-categories (such as `sorceress`) exist under more than one category, so the filters
 * popover stores qualified values to keep each selection specific to its category.
 * @param {string} category - The item category
 * @param {string} subCategory - The item sub-category
 * @returns {string} The qualified sub-category filter value
 */
export const toSubCategoryFilterValue = (category: string, subCategory: string): string =>
  `${category}:${subCategory}`;

/**
 * Splits a sub-category filter value into its parts; the inverse of {@link toSubCategoryFilterValue}.
 * Bare sub-category values have no category.
 * @param {string} value - A bare or category-qualified sub-category filter value
 * @returns {{ category: string | undefined; subCategory: string }} The category (if qualified) and sub-category
 */
export const parseSubCategoryFilterValue = (
  value: string,
): { category: string | undefined; subCategory: string } => {
  const separatorIndex = value.indexOf(':');
  if (separatorIndex === -1) return { category: undefined, subCategory: value };
  return {
    category: value.slice(0, separatorIndex),
    subCategory: value.slice(separatorIndex + 1),
  };
};

/**
 * Checks if an item matches the specified subcategories filter. Entries may be bare
 * sub-categories (matching that sub-category in every category) or category-qualified values
 * created by {@link toSubCategoryFilterValue} (matching only the given category).
 * @param {Item} item - The item to check
 * @param {string[]} [subCategories] - Optional array of subcategories to match
 * @returns {boolean} True if item matches (or no filter applied), false otherwise
 */
const matchesSubCategories = (item: Item, subCategories?: string[]): boolean => {
  if (!subCategories || subCategories.length === 0) return true;
  return (
    subCategories.includes(item.subCategory) ||
    subCategories.includes(toSubCategoryFilterValue(item.category, item.subCategory))
  );
};

/**
 * Checks if an item matches the specified types filter.
 * @param {Item} item - The item to check
 * @param {string[]} [types] - Optional array of types to match
 * @returns {boolean} True if item matches (or no filter applied), false otherwise
 */
const matchesTypes = (item: Item, types?: string[]): boolean => {
  return !types || types.length === 0 || types.includes(item.type);
};

/**
 * Builds a lookup map from progress array for O(1) access by item ID.
 * @param {GrailProgress[]} progress - Progress records to index
 * @returns {Map<string, GrailProgress[]>} Map with item IDs as keys and progress arrays as values
 */
const buildProgressMap = (progress: GrailProgress[]): Map<string, GrailProgress[]> => {
  const map = new Map<string, GrailProgress[]>();
  for (const p of progress) {
    const existing = map.get(p.itemId);
    if (existing) {
      existing.push(p);
    } else {
      map.set(p.itemId, [p]);
    }
  }
  return map;
};

/**
 * Checks if an item matches the specified found status filter.
 * @param {Item} item - The item to check
 * @param {string} [foundStatus] - Optional found status ('all', 'found', 'missing')
 * @param {Map<string, GrailProgress[]>} [progressMap] - Pre-built progress lookup map for O(1) access
 * @returns {boolean} True if item matches the found status, false otherwise
 */
const matchesFoundStatus = (
  item: Item,
  foundStatus?: string,
  progressMap?: Map<string, GrailProgress[]>,
): boolean => {
  // Always show all items by default, regardless of found status
  if (!foundStatus || foundStatus === 'all') return true;

  const itemProgress = progressMap?.get(item.id);
  const isFound = itemProgress?.some((p) => p.foundDate !== undefined) ?? false;

  if (foundStatus === 'found') return isFound;
  if (foundStatus === 'missing') return !isFound;
  return true;
};

/**
 * Builds a map of item ID to latest found date timestamp for efficient sorting.
 * @param {GrailProgress[]} progress - Progress records to index
 * @returns {Map<string, number>} Map with item IDs as keys and latest found date timestamps as values
 */
const buildFoundDateMap = (progress: GrailProgress[]): Map<string, number> => {
  const map = new Map<string, number>();
  for (const p of progress) {
    if (p.foundDate) {
      const time = p.foundDate.getTime();
      const existing = map.get(p.itemId);
      if (existing === undefined || time > existing) {
        map.set(p.itemId, time);
      }
    }
  }
  return map;
};

/**
 * Collator used for name comparisons. Reusing one instance is much faster than calling
 * `String.prototype.localeCompare` for every comparison.
 */
const nameCollator = new Intl.Collator();

/**
 * Compares two items by the given sort key only.
 * @returns {number} Negative, zero or positive like any sort comparator
 */
const compareBySortKey = (
  a: Item,
  b: Item,
  sortBy: string,
  foundDateMap?: Map<string, number>,
): number => {
  switch (sortBy) {
    case 'name':
      return nameCollator.compare(a.name, b.name);
    case 'category':
      return a.category.localeCompare(b.category);
    case 'type':
      return a.type.localeCompare(b.type);
    case 'found_date':
      return (foundDateMap?.get(a.id) ?? 0) - (foundDateMap?.get(b.id) ?? 0);
    default:
      return 0;
  }
};

/**
 * Sorts items based on the specified criteria and order.
 * Items with equal sort keys (e.g. all missing items when sorting by found date) are ordered
 * by name A–Z and then by ID, regardless of the sort order, so the result is always stable.
 * @param {Item[]} items - Array of items to sort
 * @param {string} sortBy - Property to sort by ('name', 'category', 'type', 'found_date')
 * @param {string} sortOrder - Sort order ('asc' or 'desc')
 * @param {Map<string, number>} [foundDateMap] - Pre-built map of item ID to found date timestamp for found_date sorting
 * @returns {Item[]} Sorted array of items
 */
const sortItems = (
  items: Item[],
  sortBy: string,
  sortOrder: string,
  foundDateMap?: Map<string, number>,
): Item[] => {
  const direction = sortOrder === 'desc' ? -1 : 1;
  return [...items].sort((a, b) => {
    const comparison = compareBySortKey(a, b, sortBy, foundDateMap);
    if (comparison !== 0) return comparison * direction;
    const nameComparison = sortBy === 'name' ? 0 : nameCollator.compare(a.name, b.name);
    if (nameComparison !== 0) return nameComparison;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
};

/**
 * Filters and sorts items according to the given filter and sort settings.
 * Uses pre-built lookup maps for O(1) access instead of O(N) array searches, and tokenizes the
 * search query once per call instead of once per item.
 * @param {Item[]} items - All Holy Grail items
 * @param {GrailProgress[]} progress - All progress records
 * @param {GrailFilter} filter - The active filter
 * @param {AdvancedGrailFilter} advancedFilter - The active sort and search options
 * @returns {Item[]} The filtered and sorted items
 */
export const filterAndSortItems = (
  items: Item[],
  progress: GrailProgress[],
  filter: GrailFilter,
  advancedFilter: AdvancedGrailFilter,
): Item[] => {
  // Build lookup maps once for O(1) access during filtering and sorting
  const progressMap = buildProgressMap(progress);
  const foundDateMap =
    advancedFilter.sortBy === 'found_date' ? buildFoundDateMap(progress) : undefined;
  const searchTerm = filter.searchTerm ?? '';
  const searchTokens = tokenizeSearchQuery(searchTerm);
  // A query made only of unsearchable characters (e.g. "龙" or "???") can never match an item;
  // only a blank query means "no search".
  if (searchTerm.trim() !== '' && searchTokens.length === 0) return [];

  const filtered = items.filter((item) => {
    return (
      matchesCategories(item, filter.categories) &&
      matchesSubCategories(item, filter.subCategories) &&
      matchesTypes(item, filter.types) &&
      matchesFoundStatus(item, filter.foundStatus, progressMap) &&
      itemMatchesSearch(item, searchTokens, advancedFilter.fuzzySearch)
    );
  });

  return sortItems(filtered, advancedFilter.sortBy, advancedFilter.sortOrder, foundDateMap);
};
