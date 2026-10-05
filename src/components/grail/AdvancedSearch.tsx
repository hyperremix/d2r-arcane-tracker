import type { AdvancedGrailFilter, ItemCategory, ItemType } from 'electron/types/grail';
import type { TFunction } from 'i18next';
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  LayoutGrid,
  List,
  RotateCcw,
  Search,
  SlidersHorizontal,
  WandSparkles,
  X,
} from 'lucide-react';
import { type ReactNode, useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDebouncedCallback } from 'use-debounce';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { translations } from '@/i18n/translations';
import { cn } from '@/lib/utils';
import { useGrailStore } from '@/stores/grailStore';

type FoundStatus = 'all' | 'found' | 'missing';
type SortBy = AdvancedGrailFilter['sortBy'];
type SortOrder = AdvancedGrailFilter['sortOrder'];
type GroupMode = 'none' | 'category' | 'type' | 'ethereal';

/**
 * Default sort configuration, matching the grail store defaults.
 */
const DEFAULT_SORT_BY: SortBy = 'found_date';
const DEFAULT_SORT_ORDER: SortOrder = 'desc';

/**
 * Delay in milliseconds before the typed search term is written to the store.
 * Keeps typing responsive while the (potentially expensive) item filtering catches up.
 */
const SEARCH_DEBOUNCE_MS = 150;

/**
 * Available item category values for filtering.
 */
const categoryValues: ItemCategory[] = ['weapons', 'armor', 'jewelry', 'charms'];

/**
 * Available sort option values for item display.
 */
const sortOptionValues: SortBy[] = ['name', 'category', 'type', 'found_date'];

/**
 * Available found status values for the segmented control.
 */
const foundStatusValues: FoundStatus[] = ['all', 'found', 'missing'];

/**
 * Translation keys for the found status segmented control.
 */
const foundStatusLabelKeys: Record<FoundStatus, string> = {
  all: translations.grail.advancedSearch.statusAll,
  found: translations.grail.advancedSearch.statusFound,
  missing: translations.grail.advancedSearch.statusMissing,
};

/**
 * Translation keys for the sort options.
 */
const sortLabelKeys: Record<SortBy, string> = {
  name: translations.grail.advancedSearch.sortName,
  category: translations.grail.advancedSearch.sortCategory,
  type: translations.grail.advancedSearch.sortType,
  found_date: translations.grail.advancedSearch.sortFoundDate,
};

/**
 * Translation keys for the category filters offered in the filters popover.
 */
const categoryLabelKeys: Partial<Record<ItemCategory, string>> = {
  weapons: translations.grail.advancedSearch.categoryWeapons,
  armor: translations.grail.advancedSearch.categoryArmor,
  jewelry: translations.grail.advancedSearch.categoryJewelry,
  charms: translations.grail.advancedSearch.categoryCharms,
};

/**
 * Translation keys for the item type filters.
 */
const typeLabelKeys: Record<ItemType, string> = {
  unique: translations.grail.advancedSearch.typeUnique,
  set: translations.grail.advancedSearch.typeSet,
  rune: translations.grail.advancedSearch.typeRune,
  runeword: translations.grail.advancedSearch.typeRuneword,
};

/**
 * Toggles a value in a list, adding it when absent and removing it when present.
 */
function toggleValue<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

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
  foundStatus: FoundStatus;
  categories: ItemCategory[];
  types: ItemType[];
  t: TFunction;
  onClearSearch: () => void;
  onClearStatus: () => void;
  onToggleCategory: (category: ItemCategory) => void;
  onToggleType: (type: ItemType) => void;
}

/**
 * Builds the removable chips for all currently active filters.
 */
function buildActiveFilterChips({
  searchTerm,
  foundStatus,
  categories,
  types,
  t,
  onClearSearch,
  onClearStatus,
  onToggleCategory,
  onToggleType,
}: ActiveFilterChipsInput): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];

  if (searchTerm) {
    chips.push({
      key: 'search',
      label: t(translations.grail.advancedSearch.searchChip, { term: searchTerm }),
      onRemove: onClearSearch,
    });
  }

  if (foundStatus !== 'all') {
    chips.push({
      key: 'status',
      label: t(
        foundStatus === 'found'
          ? translations.grail.advancedSearch.foundOnly
          : translations.grail.advancedSearch.missingOnly,
      ),
      onRemove: onClearStatus,
    });
  }

  for (const category of categories) {
    chips.push({
      key: `category-${category}`,
      label: t(categoryLabelKeys[category] ?? category),
      onRemove: () => onToggleCategory(category),
    });
  }

  for (const type of types) {
    chips.push({
      key: `type-${type}`,
      label: t(typeLabelKeys[type]),
      onRemove: () => onToggleType(type),
    });
  }

  return chips;
}

/**
 * Props for a single toggle button inside a segmented control.
 */
interface SegmentButtonProps {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
  ariaLabel?: string;
}

/**
 * A single button inside a segmented control. Uses aria-pressed to expose its state.
 */
function SegmentButton({ pressed, onClick, children, ariaLabel }: SegmentButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center justify-center gap-1.5 rounded-[5px] px-2.5 font-medium text-muted-foreground text-sm outline-none transition-colors',
        'hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50',
        '[&_svg]:size-4 [&_svg]:shrink-0',
        pressed && 'bg-background text-foreground shadow-xs',
      )}
    >
      {children}
    </button>
  );
}

/**
 * Props for the SegmentedControl component.
 */
interface SegmentedControlProps {
  legend: string;
  children: ReactNode;
}

/**
 * A group of mutually exclusive toggle buttons rendered as a labeled fieldset.
 */
function SegmentedControl({ legend, children }: SegmentedControlProps) {
  return (
    <fieldset className="inline-flex items-center rounded-md border border-border bg-muted p-0.5">
      <legend className="sr-only">{legend}</legend>
      {children}
    </fieldset>
  );
}

/**
 * Props for the FilterCheckboxGroup component.
 */
interface FilterCheckboxGroupProps<T extends string> {
  legend: string;
  idPrefix: string;
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (value: T) => void;
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
}: FilterCheckboxGroupProps<T>) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 font-medium text-muted-foreground text-xs">{legend}</legend>
      {options.map((option) => {
        const id = `${idPrefix}-${option.value}`;
        return (
          <div key={option.value} className="flex items-center gap-2">
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
  selectedTypes: ItemType[];
  typeValues: ItemType[];
  onToggleCategory: (category: ItemCategory) => void;
  onToggleType: (type: ItemType) => void;
}

/**
 * Popover with category and type filters. The trigger shows the number of active filters.
 */
function FiltersPopover({
  selectedCategories,
  selectedTypes,
  typeValues,
  onToggleCategory,
  onToggleType,
}: FiltersPopoverProps) {
  const { t } = useTranslation();
  const idPrefix = useId();
  const activeCount = selectedCategories.length + selectedTypes.length;
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
      <PopoverContent align="start" className="w-64">
        <FilterCheckboxGroup
          legend={t(translations.grail.advancedSearch.categories)}
          idPrefix={`${idPrefix}-category`}
          options={categoryValues.map((value) => ({
            value,
            label: t(categoryLabelKeys[value] ?? value),
          }))}
          selected={selectedCategories}
          onToggle={onToggleCategory}
        />
        <FilterCheckboxGroup
          legend={t(translations.grail.advancedSearch.types)}
          idPrefix={`${idPrefix}-type`}
          options={typeValues.map((value) => ({ value, label: t(typeLabelKeys[value]) }))}
          selected={selectedTypes}
          onToggle={onToggleType}
        />
      </PopoverContent>
    </Popover>
  );
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
function ActiveFilterChips({ chips }: ActiveFilterChipsProps) {
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

/**
 * AdvancedSearch renders the Holy Grail toolbar shown above the item grid.
 * It provides search (with optional fuzzy matching), a found-status segmented control,
 * a filters popover for categories and types, sorting, grouping, and view mode controls.
 * The grail store is the single source of truth for all filter values.
 * @returns {JSX.Element} The grail toolbar with active filter chips
 */
export function AdvancedSearch() {
  const { t } = useTranslation();
  const searchId = useId();
  const sortById = useId();
  const groupById = useId();

  // Use individual selectors to prevent unnecessary re-renders
  const filter = useGrailStore((state) => state.filter);
  const advancedFilter = useGrailStore((state) => state.advancedFilter);
  const setFilter = useGrailStore((state) => state.setFilter);
  const setAdvancedFilter = useGrailStore((state) => state.setAdvancedFilter);
  const resetStoreFilters = useGrailStore((state) => state.resetFilters);
  const viewMode = useGrailStore((state) => state.viewMode);
  const setViewMode = useGrailStore((state) => state.setViewMode);
  const groupMode = useGrailStore((state) => state.groupMode);
  const setGroupMode = useGrailStore((state) => state.setGroupMode);
  const settings = useGrailStore((state) => state.settings);

  const searchTerm = filter.searchTerm ?? '';
  const foundStatus: FoundStatus = filter.foundStatus ?? 'all';
  const selectedCategories = filter.categories ?? [];
  const selectedTypes = filter.types ?? [];
  const { sortBy, sortOrder, fuzzySearch } = advancedFilter;

  /**
   * Available item types for filtering, filtered based on grail settings.
   */
  const typeValues = useMemo<ItemType[]>(
    () => [
      'unique',
      'set',
      ...(settings.grailRunes ? (['rune'] as const) : []),
      ...(settings.grailRunewords ? (['runeword'] as const) : []),
    ],
    [settings.grailRunes, settings.grailRunewords],
  );

  // Only the raw search text is kept locally so typing stays responsive;
  // it is written to the store after a short debounce.
  const [searchInput, setSearchInput] = useState(searchTerm);
  const debouncedSetSearchTerm = useDebouncedCallback((value: string) => {
    setFilter({ searchTerm: value });
  }, SEARCH_DEBOUNCE_MS);

  // Sync external store changes (e.g. filters cleared elsewhere) into the input,
  // unless the user has a pending edit that has not been committed yet.
  useEffect(() => {
    if (!debouncedSetSearchTerm.isPending()) {
      setSearchInput(searchTerm);
    }
  }, [searchTerm, debouncedSetSearchTerm]);

  // Commit any pending search edit when unmounting so it is not lost on navigation
  useEffect(() => () => debouncedSetSearchTerm.flush(), [debouncedSetSearchTerm]);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    debouncedSetSearchTerm(value);
  };

  const clearSearch = () => {
    debouncedSetSearchTerm.cancel();
    setSearchInput('');
    setFilter({ searchTerm: '' });
  };

  const toggleCategory = (category: ItemCategory) =>
    setFilter({ categories: toggleValue(selectedCategories, category) });

  const toggleType = (type: ItemType) => setFilter({ types: toggleValue(selectedTypes, type) });

  const resetAll = () => {
    debouncedSetSearchTerm.cancel();
    setSearchInput('');
    resetStoreFilters();
  };

  const activeChips = buildActiveFilterChips({
    searchTerm,
    foundStatus,
    categories: selectedCategories,
    types: selectedTypes,
    t,
    onClearSearch: clearSearch,
    onClearStatus: () => setFilter({ foundStatus: 'all' }),
    onToggleCategory: toggleCategory,
    onToggleType: toggleType,
  });

  const isSortCustomized = sortBy !== DEFAULT_SORT_BY || sortOrder !== DEFAULT_SORT_ORDER;
  const hasActiveState = activeChips.length > 0 || fuzzySearch || isSortCustomized;

  const sortOrderLabel = t(translations.grail.advancedSearch.sortOrderValue, {
    order: t(
      sortOrder === 'asc'
        ? translations.grail.advancedSearch.ascending
        : translations.grail.advancedSearch.descending,
    ),
  });
  const fuzzySearchLabel = t(translations.grail.advancedSearch.fuzzySearch);

  return (
    <section
      aria-label={t(translations.grail.advancedSearch.toolbarLabel)}
      className="flex flex-col gap-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative min-w-48 flex-1 basis-64">
          <Label htmlFor={searchId} className="sr-only">
            {t(translations.grail.advancedSearch.searchLabel)}
          </Label>
          <Search
            aria-hidden="true"
            className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2.5 size-4 text-muted-foreground"
          />
          <Input
            id={searchId}
            placeholder={t(translations.grail.advancedSearch.searchPlaceholder)}
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-9 pr-10 pl-8"
          />
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-pressed={fuzzySearch}
                  aria-label={fuzzySearchLabel}
                  onClick={() => setAdvancedFilter({ fuzzySearch: !fuzzySearch })}
                  className={cn(
                    '-translate-y-1/2 absolute top-1/2 right-1.5 text-muted-foreground',
                    fuzzySearch && 'bg-muted text-foreground',
                  )}
                />
              }
            >
              <WandSparkles aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent>
              <p>{fuzzySearchLabel}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Found status */}
        <SegmentedControl legend={t(translations.grail.advancedSearch.status)}>
          {foundStatusValues.map((value) => (
            <SegmentButton
              key={value}
              pressed={foundStatus === value}
              onClick={() => setFilter({ foundStatus: value })}
            >
              {t(foundStatusLabelKeys[value])}
            </SegmentButton>
          ))}
        </SegmentedControl>

        {/* Category / type filters */}
        <FiltersPopover
          selectedCategories={selectedCategories}
          selectedTypes={selectedTypes}
          typeValues={typeValues}
          onToggleCategory={toggleCategory}
          onToggleType={toggleType}
        />

        {/* Sorting */}
        <div className="flex items-center gap-1.5">
          <Label htmlFor={sortById} className="text-muted-foreground text-xs">
            {t(translations.grail.advancedSearch.sortBy)}
          </Label>
          <Select
            value={sortBy}
            onValueChange={(value) => setAdvancedFilter({ sortBy: value as SortBy })}
          >
            <SelectTrigger id={sortById} className="h-9 min-w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptionValues.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(sortLabelKeys[value])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={sortOrderLabel}
                  onClick={() =>
                    setAdvancedFilter({ sortOrder: sortOrder === 'asc' ? 'desc' : 'asc' })
                  }
                />
              }
            >
              {sortOrder === 'asc' ? (
                <ArrowUpNarrowWide aria-hidden="true" />
              ) : (
                <ArrowDownWideNarrow aria-hidden="true" />
              )}
            </TooltipTrigger>
            <TooltipContent>
              <p>{sortOrderLabel}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Grouping */}
        <div className="flex items-center gap-1.5">
          <Label htmlFor={groupById} className="text-muted-foreground text-xs">
            {t(translations.grail.advancedSearch.groupBy)}
          </Label>
          <Select value={groupMode} onValueChange={(value) => setGroupMode(value as GroupMode)}>
            <SelectTrigger id={groupById} className="h-9 min-w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                {t(translations.grail.advancedSearch.noGrouping)}
              </SelectItem>
              <SelectItem value="category">
                {t(translations.grail.advancedSearch.byCategory)}
              </SelectItem>
              <SelectItem value="type">{t(translations.grail.advancedSearch.byType)}</SelectItem>
              {settings.grailEthereal && (
                <SelectItem value="ethereal">
                  {t(translations.grail.advancedSearch.byEthereal)}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* View mode */}
        <SegmentedControl legend={t(translations.grail.advancedSearch.viewMode)}>
          <SegmentButton
            pressed={viewMode === 'grid'}
            onClick={() => setViewMode('grid')}
            ariaLabel={t(translations.grail.advancedSearch.grid)}
          >
            <LayoutGrid aria-hidden="true" />
          </SegmentButton>
          <SegmentButton
            pressed={viewMode === 'list'}
            onClick={() => setViewMode('list')}
            ariaLabel={t(translations.grail.advancedSearch.list)}
          >
            <List aria-hidden="true" />
          </SegmentButton>
        </SegmentedControl>

        {/* Reset everything back to defaults */}
        {hasActiveState && (
          <Button variant="ghost" size="sm" className="h-9" onClick={resetAll}>
            <RotateCcw aria-hidden="true" />
            {t(translations.grail.advancedSearch.clearAll)}
          </Button>
        )}
      </div>

      {/* Active filter chips */}
      {activeChips.length > 0 && <ActiveFilterChips chips={activeChips} />}
    </section>
  );
}
