import type {
  AdvancedGrailFilter,
  Item,
  ItemCategory,
  ItemSubCategory,
  ItemType,
} from 'electron/types/grail';
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
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import { subCategoryLabelKeys } from '@/lib/labelKeys';
import { cn } from '@/lib/utils';
import {
  parseSubCategoryFilterValue,
  toSubCategoryFilterValue,
  useGrailStore,
  useItemResultCount,
} from '@/stores/grailStore';

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
 * Item type colors for the inline type toggle chips, using the shared `--item-*` theme tokens.
 */
const typeChipStyles: Record<ItemType, { dot: string; pressed: string }> = {
  unique: { dot: 'bg-item-unique', pressed: 'border-item-unique bg-item-unique/15' },
  set: { dot: 'bg-item-set', pressed: 'border-item-set bg-item-set/15' },
  rune: { dot: 'bg-item-rune', pressed: 'border-item-rune bg-item-rune/15' },
  runeword: { dot: 'bg-item-runeword', pressed: 'border-item-runeword bg-item-runeword/15' },
};

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
interface SubCategoryGroup {
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
function getSubCategoryGroups(items: Item[]): SubCategoryGroup[] {
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
function getSubCategoryLabel(subCategory: string, t: TFunction): string {
  const key = subCategoryLabelKeys[subCategory as ItemSubCategory];
  return key ? t(key) : subCategory;
}

/**
 * Returns the label of an active sub-category filter value. Category-qualified values (e.g.
 * `weapons:sorceress`) include the category so same-named sub-categories stay distinguishable.
 */
function getSubCategoryFilterLabel(value: string, t: TFunction): string {
  const { category, subCategory } = parseSubCategoryFilterValue(value);
  if (category === undefined) return getSubCategoryLabel(subCategory, t);

  return t(translations.grail.advancedSearch.subCategoryChip, {
    category: t(categoryLabelKeys[category as ItemCategory] ?? category),
    subCategory: getSubCategoryLabel(subCategory, t),
  });
}

/**
 * Orders sub-category options alphabetically, with character class sub-categories last.
 */
function compareSubCategoryOptions(
  a: { subCategory: string; label: string },
  b: { subCategory: string; label: string },
): number {
  const classOrder =
    Number(classSubCategories.has(a.subCategory)) - Number(classSubCategories.has(b.subCategory));
  return classOrder || a.label.localeCompare(b.label);
}

/**
 * Checks whether the keyboard event target is a text field or other editable element
 * where typing must not be intercepted by global shortcuts.
 */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
}

/**
 * Checks whether a dialog, alert dialog or an open select listbox is currently displayed.
 * The filters popover is itself a dialog, so it counts as open too.
 */
function isDialogOpen(): boolean {
  return document.querySelector('[role="dialog"], [role="alertdialog"], [role="listbox"]') !== null;
}

/**
 * Identifies which focus-search shortcut, if any, a key press is.
 * @returns {'find' | 'slash' | undefined} `find` for Ctrl/Cmd+F, `slash` for `/`
 */
function getSearchShortcut(event: globalThis.KeyboardEvent): 'find' | 'slash' | undefined {
  if (event.defaultPrevented || event.isComposing || event.altKey) return undefined;
  const hasCommandModifier = event.ctrlKey || event.metaKey;
  if (hasCommandModifier && !event.shiftKey && event.key.toLowerCase() === 'f') return 'find';
  if (!hasCommandModifier && event.key === '/') return 'slash';
  return undefined;
}

/**
 * Checks whether a focus-search shortcut should move focus to the search input. It must not
 * interrupt typing in another field (or typing "/" into the search itself) or an open dialog.
 */
function shouldFocusSearch(
  event: globalThis.KeyboardEvent,
  shortcut: 'find' | 'slash',
  input: HTMLInputElement,
): boolean {
  if (event.target === input) return shortcut === 'find';
  return !isEditableTarget(event.target) && !isDialogOpen();
}

/**
 * Focuses the search field when the user presses `/` or Ctrl/Cmd+F, unless they are typing in
 * another field or a dialog is open. The listener is removed when the toolbar unmounts.
 * @param {string} inputId - The id of the search input
 */
function useFocusSearchShortcut(inputId: string) {
  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const input = document.getElementById(inputId);
      const shortcut = getSearchShortcut(event);
      if (!(input instanceof HTMLInputElement) || !shortcut) return;
      if (!shouldFocusSearch(event, shortcut, input)) return;

      event.preventDefault();
      input.focus();
      input.select();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [inputId]);
}

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
  subCategories: string[];
  types: ItemType[];
  t: TFunction;
  onClearSearch: () => void;
  onClearStatus: () => void;
  onToggleCategory: (category: ItemCategory) => void;
  onToggleSubCategory: (subCategory: string) => void;
  onToggleType: (type: ItemType) => void;
}

/**
 * Builds the removable chips for all currently active filters.
 */
function buildActiveFilterChips({
  searchTerm,
  foundStatus,
  categories,
  subCategories,
  types,
  t,
  onClearSearch,
  onClearStatus,
  onToggleCategory,
  onToggleSubCategory,
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

  for (const subCategory of subCategories) {
    chips.push({
      key: `subCategory-${subCategory}`,
      label: getSubCategoryFilterLabel(subCategory, t),
      onRemove: () => onToggleSubCategory(subCategory),
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
}

/**
 * Popover with category and sub-category filters. Sub-categories are grouped by category.
 * The trigger shows the number of active filters inside the popover.
 */
function FiltersPopover({
  selectedCategories,
  selectedSubCategories,
  subCategoryGroups,
  onToggleCategory,
  onToggleSubCategory,
}: FiltersPopoverProps) {
  const { t } = useTranslation();
  const idPrefix = useId();
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
        <FilterCheckboxGroup
          legend={t(translations.grail.advancedSearch.categories)}
          idPrefix={`${idPrefix}-category`}
          options={categoryValues.map((value) => ({
            value,
            label: t(categoryLabelKeys[value] ?? value),
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
                legend={t(categoryLabelKeys[group.category] ?? group.category)}
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

/**
 * Props for the TypeToggleChips component.
 */
interface TypeToggleChipsProps {
  typeValues: ItemType[];
  selectedTypes: ItemType[];
  onToggleType: (type: ItemType) => void;
}

/**
 * Inline toggle chips for the tracked item types, colored like the item cards.
 */
function TypeToggleChips({ typeValues, selectedTypes, onToggleType }: TypeToggleChipsProps) {
  const { t } = useTranslation();

  return (
    <fieldset className="inline-flex flex-wrap items-center gap-1.5">
      <legend className="sr-only">{t(translations.grail.advancedSearch.types)}</legend>
      {typeValues.map((type) => {
        const pressed = selectedTypes.includes(type);
        return (
          <button
            key={type}
            type="button"
            aria-pressed={pressed}
            onClick={() => onToggleType(type)}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 font-medium text-muted-foreground text-sm outline-none transition-colors',
              'hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50',
              pressed && ['text-foreground', typeChipStyles[type].pressed],
            )}
          >
            <span
              aria-hidden="true"
              className={cn('size-2 shrink-0 rounded-full', typeChipStyles[type].dot)}
            />
            {t(typeLabelKeys[type])}
          </button>
        );
      })}
    </fieldset>
  );
}

/**
 * Props for the ResultCount component.
 */
interface ResultCountProps {
  className?: string;
}

/**
 * Live "N of M items" count of the items matching the current filters.
 * Announced politely to screen readers whenever it changes.
 */
function ResultCount({ className }: ResultCountProps) {
  const { t } = useTranslation();
  const { shown, total } = useItemResultCount();

  return (
    <output
      aria-live="polite"
      className={cn('text-muted-foreground text-xs tabular-nums', className)}
    >
      {total > 0 && t(translations.grail.advancedSearch.resultCount, { shown, count: total })}
    </output>
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
 * It provides search (with optional fuzzy matching and a `/` / Ctrl+F shortcut), a found-status
 * segmented control, item type toggle chips, a filters popover for categories and sub-categories,
 * sorting, grouping, view mode controls and a live result count.
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
  const filterResetCount = useGrailStore((state) => state.filterResetCount);
  const viewMode = useGrailStore((state) => state.viewMode);
  const setViewMode = useGrailStore((state) => state.setViewMode);
  const groupMode = useGrailStore((state) => state.groupMode);
  const setGroupMode = useGrailStore((state) => state.setGroupMode);
  const settings = useGrailStore((state) => state.settings);
  const items = useGrailStore((state) => state.items);

  const searchTerm = filter.searchTerm ?? '';
  const foundStatus: FoundStatus = filter.foundStatus ?? 'all';
  const selectedCategories = filter.categories ?? [];
  const selectedSubCategories = filter.subCategories ?? [];
  const selectedTypes = filter.types ?? [];
  const { sortBy, sortOrder, fuzzySearch } = advancedFilter;
  const subCategoryGroups = useMemo(() => getSubCategoryGroups(items), [items]);

  useFocusSearchShortcut(searchId);

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

  // When the store filters are reset from elsewhere (e.g. the empty state's "Clear filters"),
  // discard any pending edit so the debounced write cannot re-apply the old search text.
  const seenResetCountRef = useRef(filterResetCount);
  useEffect(() => {
    if (seenResetCountRef.current === filterResetCount) return;
    seenResetCountRef.current = filterResetCount;
    debouncedSetSearchTerm.cancel();
    setSearchInput('');
  }, [filterResetCount, debouncedSetSearchTerm]);

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

  const toggleSubCategory = (subCategory: string) =>
    setFilter({ subCategories: toggleValue(selectedSubCategories, subCategory) });

  const toggleType = (type: ItemType) => setFilter({ types: toggleValue(selectedTypes, type) });

  // Escape clears the search; Escape on an empty field leaves the field
  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape') return;
    if (searchInput) {
      event.preventDefault();
      clearSearch();
    } else {
      event.currentTarget.blur();
    }
  };

  const resetAll = () => {
    debouncedSetSearchTerm.cancel();
    setSearchInput('');
    resetStoreFilters();
  };

  const activeChips = buildActiveFilterChips({
    searchTerm,
    foundStatus,
    categories: selectedCategories,
    subCategories: selectedSubCategories,
    types: selectedTypes,
    t,
    onClearSearch: clearSearch,
    onClearStatus: () => setFilter({ foundStatus: 'all' }),
    onToggleCategory: toggleCategory,
    onToggleSubCategory: toggleSubCategory,
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
            aria-keyshortcuts="/ Control+F Meta+F"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
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

        {/* Item type toggles */}
        <TypeToggleChips
          typeValues={typeValues}
          selectedTypes={selectedTypes}
          onToggleType={toggleType}
        />

        {/* Category / sub-category filters */}
        <FiltersPopover
          selectedCategories={selectedCategories}
          selectedSubCategories={selectedSubCategories}
          subCategoryGroups={subCategoryGroups}
          onToggleCategory={toggleCategory}
          onToggleSubCategory={toggleSubCategory}
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

      {/* Active filter chips and result count */}
      <div className="flex flex-wrap items-center gap-2">
        {activeChips.length > 0 && <ActiveFilterChips chips={activeChips} />}
        <ResultCount className="ml-auto" />
      </div>
    </section>
  );
}
