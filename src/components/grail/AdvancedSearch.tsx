import type { ItemCategory, ItemType } from 'electron/types/grail';
import { LayoutGrid, List, RotateCcw } from 'lucide-react';
import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { translations } from '@/i18n/translations';
import { useGrailStore } from '@/stores/grailStore';
import { ActiveFilterChips, buildActiveFilterChips } from './search/ActiveFilterChips';
import { FiltersPopover } from './search/FiltersPopover';
import { GroupBySelect } from './search/GroupBySelect';
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
import { SortControls } from './search/SortControls';
import { getSubCategoryGroups } from './search/subCategories';
import { TypeToggleChips } from './search/TypeToggleChips';
import { useFocusSearchShortcut } from './search/useFocusSearchShortcut';
import { useSearchInput } from './search/useSearchInput';

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
          fuzzySearch={fuzzySearch}
          onToggleFuzzySearch={() => setAdvancedFilter({ fuzzySearch: !fuzzySearch })}
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

        {/* Category / sub-category filters */}
        <FiltersPopover
          selectedCategories={selectedCategories}
          selectedSubCategories={selectedSubCategories}
          subCategoryGroups={subCategoryGroups}
          onToggleCategory={toggleCategory}
          onToggleSubCategory={toggleSubCategory}
        />

        <SortControls
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortByChange={(value) => setAdvancedFilter({ sortBy: value })}
          onToggleSortOrder={() =>
            setAdvancedFilter({ sortOrder: sortOrder === 'asc' ? 'desc' : 'asc' })
          }
        />

        <GroupBySelect
          groupMode={groupMode}
          showEthereal={Boolean(settings.grailEthereal)}
          onGroupModeChange={setGroupMode}
        />

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
