import type { Item } from 'electron/types/grail';
import { useTranslation } from 'react-i18next';
import { itemCategoryLabelKeys, itemSubCategoryLabelKeys } from '@/lib/labelKeys';

/**
 * Renders an item's translated category and sub-category (e.g. "Weapons • Two-Handed Swords").
 */
export function ItemCategoryLabel({ item }: { item: Pick<Item, 'category' | 'subCategory'> }) {
  const { t } = useTranslation();

  return (
    <>
      {t(itemCategoryLabelKeys[item.category])} • {t(itemSubCategoryLabelKeys[item.subCategory])}
    </>
  );
}
