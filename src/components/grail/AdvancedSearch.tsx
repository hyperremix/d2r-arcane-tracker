import type { ItemCategory, ItemType } from 'electron/types/grail';
import { RotateCcw } from 'lucide-react';
import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { translations } from '@/i18n/translations';
import { useGrailStore } from '@/stores/grailStore';
import { ActiveFilterChips, buildActiveFilterChips } from './search/ActiveFilterChips';
import { FiltersPopover } from './search/FiltersPopover';
import {
  DEFAULT_SORT_BY,
  DEFAULT_SORT_ORDER,
  type FoundStatus,
  foundStatusLabelKeys,
  foundStatusValues,
  toggleValue,
} from './search/options';
import { ResultCount } from './search/ResultCount';
import { SearchField } from './search/SearchField';
import { SegmentButton, SegmentedControl } from './search/SegmentedControl';
import { getSubCategoryGroups } from './search/subCategories';
import { TypeToggleChips } from './search/TypeToggleChips';
import { useFocusSearchShortcut } from './search/useFocusSearchShortcut';
import { useSearchInput } from './search/useSearchInput';
import { ViewOptionsPopover } from './search/ViewOptionsPopover';

/**
 * AdvancedSearch renders the Holy Grail toolbar shown above the item grid.
 * It provides search (with a `/` / Ctrl+F shortcut), a found-status segmented control, item type
 * toggle chips, a filters popover (fuzzy search, categories and sub-categories), a view popover
 * (grid/list, sorting and grouping) and a live result count.
 * The grail store is the single source of truth for all filter values.
 * @returns {JSX.Element} The grail toolbar with active filter chips
 */
export function AdvancedSearch() {
  const { t } = useTranslation();
  const searchId = useId();

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

  const { searchInput, changeSearchInput, discardSearchInput } = useSearchInput({
    searchTerm,
    filterResetCount,
    commitSearchTerm: (value) => setFilter({ searchTerm: value }),
  });

  const clearSearch = () => {
    discardSearchInput();
    setFilter({ searchTerm: '' });
  };

  const toggleCategory = (category: ItemCategory) =>
    setFilter({ categories: toggleValue(selectedCategories, category) });

  const toggleSubCategory = (subCategory: string) =>
    setFilter({ subCategories: toggleValue(selectedSubCategories, subCategory) });

  const toggleType = (type: ItemType) => setFilter({ types: toggleValue(selectedTypes, type) });

  const resetAll = () => {
    discardSearchInput();
    resetStoreFilters();
  };

  const setFuzzySearch = (value: boolean) => setAdvancedFilter({ fuzzySearch: value });

  const activeChips = buildActiveFilterChips({
    searchTerm,
    fuzzySearch,
    categories: selectedCategories,
    subCategories: selectedSubCategories,
    t,
    onClearSearch: clearSearch,
    onDisableFuzzySearch: () => setFuzzySearch(false),
    onToggleCategory: toggleCategory,
    onToggleSubCategory: toggleSubCategory,
  });

  const isSortCustomized = sortBy !== DEFAULT_SORT_BY || sortOrder !== DEFAULT_SORT_ORDER;
  const hasActiveState =
    activeChips.length > 0 || foundStatus !== 'all' || selectedTypes.length > 0 || isSortCustomized;

  return (
    <section
      aria-label={t(translations.grail.advancedSearch.toolbarLabel)}
      className="flex flex-col gap-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <SearchField
          id={searchId}
          value={searchInput}
          onChange={changeSearchInput}
          onClear={clearSearch}
        />

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

        {/* Fuzzy search, category and sub-category filters */}
        <FiltersPopover
          selectedCategories={selectedCategories}
          selectedSubCategories={selectedSubCategories}
          subCategoryGroups={subCategoryGroups}
          onToggleCategory={toggleCategory}
          onToggleSubCategory={toggleSubCategory}
          fuzzySearch={fuzzySearch}
          onFuzzySearchChange={setFuzzySearch}
        />

        {/* Grid/list, sorting and grouping */}
        <ViewOptionsPopover
          viewMode={viewMode}
          sortBy={sortBy}
          sortOrder={sortOrder}
          groupMode={groupMode}
          showEthereal={Boolean(settings.grailEthereal)}
          onViewModeChange={setViewMode}
          onSortByChange={(value) => setAdvancedFilter({ sortBy: value })}
          onSortOrderChange={(value) => setAdvancedFilter({ sortOrder: value })}
          onGroupModeChange={setGroupMode}
        />
      </div>

      {/* Active filter chips, reset and result count */}
      <div className="flex flex-wrap items-center gap-2">
        {activeChips.length > 0 && <ActiveFilterChips chips={activeChips} />}
        {/* Reset everything back to defaults */}
        {hasActiveState && (
          <Button variant="ghost" size="sm" className="h-7" onClick={resetAll}>
            <RotateCcw aria-hidden="true" />
            {t(translations.grail.advancedSearch.clearAll)}
          </Button>
        )}
        <ResultCount className="ml-auto" />
      </div>
    </section>
  );
}
