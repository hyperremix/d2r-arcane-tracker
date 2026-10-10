import type { ItemCategory } from 'electron/types/grail';
import { SlidersHorizontal } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { translations } from '@/i18n/translations';
import { toSubCategoryFilterValue } from '@/lib/grailFilters';
import { itemCategoryLabelKeys } from '@/lib/labelKeys';
import { cn } from '@/lib/utils';
import { categoryValues } from './options';
import {
  compareSubCategoryOptions,
  getSubCategoryLabel,
  type SubCategoryGroup,
} from './subCategories';

/**
 * Props for the FilterCheckboxGroup component.
 */
interface FilterCheckboxGroupProps<T extends string> {
  legend: string;
  idPrefix: string;
  options: { value: T; label: string }[];
  selected: string[];
  onToggle: (value: T) => void;
  className?: string;
}

/**
 * A labeled group of checkboxes used inside the filters popover.
 */
function FilterCheckboxGroup<T extends string>({
  legend,
  idPrefix,
  options,
  selected,
  onToggle,
  className,
}: FilterCheckboxGroupProps<T>) {
  return (
    <fieldset className={cn('space-y-2', className)}>
      <legend className="mb-2 font-medium text-muted-foreground text-xs">{legend}</legend>
      {options.map((option) => {
        const id = `${idPrefix}-${option.value}`;
        return (
          <div key={option.value} className="flex min-w-0 items-center gap-2">
            <Checkbox
              id={id}
              checked={selected.includes(option.value)}
              onCheckedChange={() => onToggle(option.value)}
            />
            <Label htmlFor={id} className="font-normal text-sm">
              {option.label}
            </Label>
          </div>
        );
      })}
    </fieldset>
  );
}

/**
 * Props for the FiltersPopover component.
 */
interface FiltersPopoverProps {
  selectedCategories: ItemCategory[];
  selectedSubCategories: string[];
  subCategoryGroups: SubCategoryGroup[];
  onToggleCategory: (category: ItemCategory) => void;
  onToggleSubCategory: (subCategory: string) => void;
  fuzzySearch: boolean;
  onFuzzySearchChange: (fuzzySearch: boolean) => void;
}

/**
 * Popover with the fuzzy search switch and the category and sub-category filters. Sub-categories
 * are grouped by category. The trigger shows the number of active category and sub-category
 * filters.
 */
export function FiltersPopover({
  selectedCategories,
  selectedSubCategories,
  subCategoryGroups,
  onToggleCategory,
  onToggleSubCategory,
  fuzzySearch,
  onFuzzySearchChange,
}: FiltersPopoverProps) {
  const { t } = useTranslation();
  const idPrefix = useId();
  const fuzzySearchLabelId = `${idPrefix}-fuzzy-label`;
  const fuzzySearchDescriptionId = `${idPrefix}-fuzzy-description`;
  const activeCount = selectedCategories.length + selectedSubCategories.length;
  const filtersLabel = t(translations.grail.advancedSearch.filters);

  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="outline" size="sm" className="h-9" />}
        aria-label={
          activeCount > 0
            ? t(translations.grail.advancedSearch.filtersWithCount, { count: activeCount })
            : filtersLabel
        }
      >
        <SlidersHorizontal aria-hidden="true" />
        {filtersLabel}
        {activeCount > 0 && (
          <Badge variant="secondary" className="tabular-nums" aria-hidden="true">
            {activeCount}
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-[min(70vh,36rem)] w-96 overflow-y-auto">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span id={fuzzySearchLabelId} className="font-medium text-sm">
              {t(translations.grail.advancedSearch.fuzzySearch)}
            </span>
            <p id={fuzzySearchDescriptionId} className="text-muted-foreground text-xs">
              {t(translations.grail.advancedSearch.fuzzySearchDescription)}
            </p>
          </div>
          <Switch
            checked={fuzzySearch}
            onCheckedChange={onFuzzySearchChange}
            aria-labelledby={fuzzySearchLabelId}
            aria-describedby={fuzzySearchDescriptionId}
          />
        </div>
        <FilterCheckboxGroup
          legend={t(translations.grail.advancedSearch.categories)}
          idPrefix={`${idPrefix}-category`}
          options={categoryValues.map((value) => ({
            value,
            label: t(itemCategoryLabelKeys[value]),
          }))}
          selected={selectedCategories}
          onToggle={onToggleCategory}
          className="grid grid-cols-2 gap-x-4 gap-y-2 space-y-0"
        />
        {subCategoryGroups.length > 0 && (
          <fieldset className="space-y-3">
            <legend className="mb-2 font-medium text-muted-foreground text-xs">
              {t(translations.grail.advancedSearch.subCategories)}
            </legend>
            {subCategoryGroups.map((group) => (
              <FilterCheckboxGroup
                key={group.category}
                legend={t(itemCategoryLabelKeys[group.category] ?? group.category)}
                idPrefix={`${idPrefix}-subcategory-${group.category}`}
                options={group.subCategories
                  .map((subCategory) => ({
                    value: toSubCategoryFilterValue(group.category, subCategory),
                    subCategory,
                    label: getSubCategoryLabel(subCategory, t),
                  }))
                  .sort(compareSubCategoryOptions)}
                selected={selectedSubCategories}
                onToggle={onToggleSubCategory}
                className="grid grid-cols-2 gap-x-4 gap-y-2 space-y-0"
              />
            ))}
          </fieldset>
        )}
      </PopoverContent>
    </Popover>
  );
}
