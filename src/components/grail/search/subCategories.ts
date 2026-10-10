import type { Item, ItemCategory, ItemSubCategory } from 'electron/types/grail';
import type { TFunction } from 'i18next';
import { translations } from '@/i18n/translations';
import { parseSubCategoryFilterValue } from '@/lib/grailFilters';
import { itemCategoryLabelKeys, subCategoryLabelKeys } from '@/lib/labelKeys';
import { categoryValues } from './options';

/**
 * Character class sub-categories hold class-specific items. They are listed after the regular
 * sub-categories (e.g. "Helms", "Shields") of a category.
 */
const classSubCategories = new Set<string>([
  'amazon',
  'assassin',
  'barbarian',
  'druid',
  'necromancer',
  'paladin',
  'sorceress',
  'shared_stash',
]);

/**
 * Sub-categories available for a single category in the filters popover.
 */
export interface SubCategoryGroup {
  category: ItemCategory;
  subCategories: ItemSubCategory[];
}

/**
 * Collects the sub-categories present in the loaded items, grouped by the categories offered in
 * the filters popover. Runes and runewords are skipped since their only sub-category is the
 * category itself.
 * @param {Item[]} items - All loaded grail items
 * @returns {SubCategoryGroup[]} The sub-category groups in category order
 */
export function getSubCategoryGroups(items: Item[]): SubCategoryGroup[] {
  const byCategory = new Map<ItemCategory, Set<ItemSubCategory>>();
  for (const item of items) {
    let subCategories = byCategory.get(item.category);
    if (!subCategories) {
      subCategories = new Set();
      byCategory.set(item.category, subCategories);
    }
    subCategories.add(item.subCategory);
  }

  return categoryValues.flatMap((category) => {
    const subCategories = byCategory.get(category);
    return subCategories && subCategories.size > 0
      ? [{ category, subCategories: [...subCategories] }]
      : [];
  });
}

/**
 * Returns the translated label of a sub-category, falling back to the raw value.
 */
export function getSubCategoryLabel(subCategory: string, t: TFunction): string {
  const key = subCategoryLabelKeys[subCategory as ItemSubCategory];
  return key ? t(key) : subCategory;
}

/**
 * Returns the label of an active sub-category filter value. Category-qualified values (e.g.
 * `weapons:sorceress`) include the category so same-named sub-categories stay distinguishable.
 */
export function getSubCategoryFilterLabel(value: string, t: TFunction): string {
  const { category, subCategory } = parseSubCategoryFilterValue(value);
  if (category === undefined) return getSubCategoryLabel(subCategory, t);

  return t(translations.grail.advancedSearch.subCategoryChip, {
    category: t(itemCategoryLabelKeys[category as ItemCategory] ?? category),
    subCategory: getSubCategoryLabel(subCategory, t),
  });
}

/**
 * Orders sub-category options alphabetically, with character class sub-categories last.
 */
export function compareSubCategoryOptions(
  a: { subCategory: string; label: string },
  b: { subCategory: string; label: string },
): number {
  const classOrder =
    Number(classSubCategories.has(a.subCategory)) - Number(classSubCategories.has(b.subCategory));
  return classOrder || a.label.localeCompare(b.label);
}
