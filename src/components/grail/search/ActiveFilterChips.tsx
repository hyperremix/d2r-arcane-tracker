import type { ItemCategory } from 'electron/types/grail';
import type { TFunction } from 'i18next';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { translations } from '@/i18n/translations';
import { itemCategoryLabelKeys } from '@/lib/labelKeys';
import { getSubCategoryFilterLabel } from './subCategories';

/**
 * Describes a removable chip representing an active filter.
 */
interface ActiveFilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

/**
 * Input for building the list of active filter chips.
 */
interface ActiveFilterChipsInput {
  searchTerm: string;
  fuzzySearch: boolean;
  categories: ItemCategory[];
  subCategories: string[];
  t: TFunction;
  onClearSearch: () => void;
  onDisableFuzzySearch: () => void;
  onToggleCategory: (category: ItemCategory) => void;
  onToggleSubCategory: (subCategory: string) => void;
}

/**
 * Builds the removable chips for the search text and the options set in the filters popover
 * (fuzzy search, categories and sub-categories). The found status and item types are not
 * repeated as chips since their toolbar controls already show them.
 */
export function buildActiveFilterChips({
  searchTerm,
  fuzzySearch,
  categories,
  subCategories,
  t,
  onClearSearch,
  onDisableFuzzySearch,
  onToggleCategory,
  onToggleSubCategory,
}: ActiveFilterChipsInput): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];

  if (searchTerm) {
    chips.push({
      key: 'search',
      label: t(translations.grail.advancedSearch.searchChip, { term: searchTerm }),
      onRemove: onClearSearch,
    });
  }

  if (fuzzySearch) {
    chips.push({
      key: 'fuzzySearch',
      label: t(translations.grail.advancedSearch.fuzzySearch),
      onRemove: onDisableFuzzySearch,
    });
  }

  for (const category of categories) {
    chips.push({
      key: `category-${category}`,
      label: t(itemCategoryLabelKeys[category]),
      onRemove: () => onToggleCategory(category),
    });
  }

  for (const subCategory of subCategories) {
    chips.push({
      key: `subCategory-${subCategory}`,
      label: getSubCategoryFilterLabel(subCategory, t),
      onRemove: () => onToggleSubCategory(subCategory),
    });
  }

  return chips;
}

/**
 * Props for the ActiveFilterChips component.
 */
interface ActiveFilterChipsProps {
  chips: ActiveFilterChip[];
}

/**
 * Renders the active filters as removable chips.
 */
export function ActiveFilterChips({ chips }: ActiveFilterChipsProps) {
  const { t } = useTranslation();

  return (
    <ul
      aria-label={t(translations.grail.advancedSearch.activeFilters)}
      className="flex flex-wrap items-center gap-1.5"
    >
      {chips.map((chip) => (
        <li key={chip.key}>
          <span className="inline-flex h-6 items-center gap-1 rounded-full border border-border bg-muted pr-1 pl-2.5 text-foreground text-xs">
            <span className="max-w-48 truncate">{chip.label}</span>
            <button
              type="button"
              onClick={chip.onRemove}
              aria-label={t(translations.grail.advancedSearch.removeFilter, { label: chip.label })}
              className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-background hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <X aria-hidden="true" className="size-3" />
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}
