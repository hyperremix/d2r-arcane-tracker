import type { AdvancedGrailFilter, ItemCategory } from 'electron/types/grail';
import { translations } from '@/i18n/translations';

export type FoundStatus = 'all' | 'found' | 'missing';
export type SortBy = AdvancedGrailFilter['sortBy'];
export type SortOrder = AdvancedGrailFilter['sortOrder'];
export type GroupMode = 'none' | 'category' | 'type' | 'ethereal';

/**
 * Default sort configuration, matching the grail store defaults.
 */
export const DEFAULT_SORT_BY: SortBy = 'found_date';
export const DEFAULT_SORT_ORDER: SortOrder = 'desc';

/**
 * Available item category values for filtering.
 */
export const categoryValues: ItemCategory[] = ['weapons', 'armor', 'jewelry', 'charms'];

/**
 * Available sort option values for item display.
 */
export const sortOptionValues: SortBy[] = ['name', 'category', 'type', 'found_date'];

/**
 * Available found status values for the segmented control.
 */
export const foundStatusValues: FoundStatus[] = ['all', 'found', 'missing'];

/**
 * Translation keys for the found status segmented control.
 */
export const foundStatusLabelKeys: Record<FoundStatus, string> = {
  all: translations.grail.advancedSearch.statusAll,
  found: translations.grail.advancedSearch.statusFound,
  missing: translations.grail.advancedSearch.statusMissing,
};

/**
 * Translation keys for the sort options.
 */
export const sortLabelKeys: Record<SortBy, string> = {
  name: translations.grail.advancedSearch.sortName,
  category: translations.grail.advancedSearch.sortCategory,
  type: translations.grail.advancedSearch.sortType,
  found_date: translations.grail.advancedSearch.sortFoundDate,
};

/**
 * Toggles a value in a list, adding it when absent and removing it when present.
 */
export function toggleValue<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}
