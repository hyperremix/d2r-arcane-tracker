import type { ItemCategory, ItemType } from 'electron/types/grail';
import { Grid, List, RotateCcw } from 'lucide-react';
import { startTransition, useId, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useGrailStore } from '@/stores/grailStore';

/**
 * Interface defining the structure of advanced filter options.
 */
interface AdvancedFilter {
  searchTerm: string;
  categories: ItemCategory[];
  types: ItemType[];
  foundStatus: 'all' | 'found' | 'missing';
  sortBy: 'name' | 'category' | 'type' | 'found_date';
  sortOrder: 'asc' | 'desc';
  fuzzySearch: boolean;
}

/**
 * Default filter configuration with no active filters.
 */
const defaultFilter: AdvancedFilter = {
  searchTerm: '',
  categories: [],
  types: [],
  foundStatus: 'all',
  sortBy: 'name',
  sortOrder: 'asc',
  fuzzySearch: false,
};

/**
 * Available item categories for filtering.
 */
const categories: { value: ItemCategory; label: string }[] = [
  { value: 'weapons', label: 'Weapons' },
  { value: 'armor', label: 'Armor' },
  { value: 'jewelry', label: 'Jewelry' },
  { value: 'charms', label: 'Charms' },
];

/**
 * Available sort options for item display.
 */
const sortOptions = [
  { value: 'name', label: 'Name' },
  { value: 'category', label: 'Category' },
  { value: 'type', label: 'Type' },
  { value: 'found_date', label: 'Found Date' },
];

/**
 * AdvancedSearch component that provides comprehensive filtering and sorting options for Holy Grail items.
 * Includes search, category filters, type filters, found status filters, and sorting controls.
 * @returns {JSX.Element} An advanced search interface with multiple filter controls
 */
export function AdvancedSearch() {
  const advancedSearchId = useId();
  const fuzzySearchId = useId();
  const [advancedFilter, setAdvancedFilter] = useState<AdvancedFilter>(defaultFilter);

  // Use individual selectors to prevent unnecessary re-renders
  const setFilter = useGrailStore((state) => state.setFilter);
  const setStoreAdvancedFilter = useGrailStore((state) => state.setAdvancedFilter);
  const viewMode = useGrailStore((state) => state.viewMode);
  const setViewMode = useGrailStore((state) => state.setViewMode);
  const groupMode = useGrailStore((state) => state.groupMode);
  const setGroupMode = useGrailStore((state) => state.setGroupMode);
  const settings = useGrailStore((state) => state.settings);

  /**
   * Available item types for filtering, filtered based on grail settings.
   */
  const types: { value: ItemType; label: string }[] = [
    { value: 'unique', label: 'Unique' },
    { value: 'set', label: 'Set' },
    ...(settings.grailRunes ? [{ value: 'rune' as ItemType, label: 'Rune' }] : []),
    ...(settings.grailRunewords ? [{ value: 'runeword' as ItemType, label: 'Runeword' }] : []),
  ];

  const updateAdvancedFilter = (updates: Partial<AdvancedFilter>) => {
    const newFilter = { ...advancedFilter, ...updates };
    setAdvancedFilter(newFilter); // Local state - immediate

    // Mark filter update as non-urgent so React keeps input responsive
    startTransition(() => {
      setFilter({
        searchTerm: newFilter.searchTerm,
        categories: newFilter.categories,
        types: newFilter.types,
        foundStatus: newFilter.foundStatus,
      });
    });

    setStoreAdvancedFilter({
      sortBy: newFilter.sortBy,
      sortOrder: newFilter.sortOrder,
      fuzzySearch: newFilter.fuzzySearch,
    });
  };

  const resetFilters = () => {
    const resetFilter = defaultFilter;
    setAdvancedFilter(resetFilter);

    // Immediately update the store
    setFilter({
      categories: resetFilter.categories,
      types: resetFilter.types,
      foundStatus: resetFilter.foundStatus,
      searchTerm: resetFilter.searchTerm,
    });
    setStoreAdvancedFilter({
      sortBy: resetFilter.sortBy,
      sortOrder: resetFilter.sortOrder,
      fuzzySearch: resetFilter.fuzzySearch,
    });
  };

  const toggleCategory = (category: ItemCategory) => {
    const current = advancedFilter.categories;
    const updated = current.includes(category)
      ? current.filter((c) => c !== category)
      : [...current, category];
    updateAdvancedFilter({ categories: updated });
  };

  const toggleType = (type: ItemType) => {
    const current = advancedFilter.types;
    const updated = current.includes(type) ? current.filter((t) => t !== type) : [...current, type];
    updateAdvancedFilter({ types: updated });
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (advancedFilter.searchTerm) count++;
    if (advancedFilter.categories.length > 0) count++;
    if (advancedFilter.types.length > 0) count++;
    if (advancedFilter.foundStatus !== 'all') count++;
    return count;
  };

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-end gap-2">
          {getActiveFiltersCount() > 0 && (
            <Badge variant="secondary" className="text-xs">
              {getActiveFiltersCount()}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={resetFilters}
            className="h-7 gap-1 px-2 text-xs"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        </div>

        {/* Group By */}
        <div className="space-y-2">
          <Select
            value={groupMode}
            onValueChange={(value) => setGroupMode(value as typeof groupMode)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Grouping</SelectItem>
              <SelectItem value="category">By Category</SelectItem>
              <SelectItem value="type">By Type</SelectItem>
              {settings.grailEthereal && <SelectItem value="ethereal">By Ethereal</SelectItem>}
            </SelectContent>
          </Select>
        </div>

        {/* View Mode */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="flex-1"
            >
              <Grid className="mr-2 h-4 w-4" />
              Grid
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="flex-1"
            >
              <List className="mr-2 h-4 w-4" />
              List
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          {/* Search */}
          <div className="space-y-2">
            <Label htmlFor={advancedSearchId} className="text-gray-600 text-xs dark:text-gray-400">
              Search
            </Label>
            <Input
              id={advancedSearchId}
              placeholder="Search items..."
              value={advancedFilter.searchTerm}
              onChange={(e) => updateAdvancedFilter({ searchTerm: e.target.value })}
              className="h-8 text-sm"
            />
            <div className="flex items-center space-x-2">
              <Checkbox
                id={fuzzySearchId}
                checked={advancedFilter.fuzzySearch}
                onCheckedChange={(checked) =>
                  updateAdvancedFilter({ fuzzySearch: Boolean(checked) })
                }
              />
              <Label htmlFor={fuzzySearchId} className="text-xs">
                Fuzzy Search
              </Label>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label className="text-gray-600 text-xs dark:text-gray-400">Status</Label>
            <Select
              value={advancedFilter.foundStatus}
              onValueChange={(value) =>
                updateAdvancedFilter({ foundStatus: value as 'all' | 'found' | 'missing' })
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                <SelectItem value="found">Found Only</SelectItem>
                <SelectItem value="missing">Missing Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2">
          {/* Categories */}
          <div className="space-y-2">
            <Label className="text-gray-600 text-xs dark:text-gray-400">Categories</Label>
            <div className="space-y-2">
              {categories.map((category) => (
                <div key={category.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`cat-${category.value}`}
                    checked={advancedFilter.categories.includes(category.value)}
                    onCheckedChange={() => toggleCategory(category.value)}
                  />
                  <Label htmlFor={`cat-${category.value}`} className="text-xs">
                    {category.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Types */}
          <div className="space-y-2">
            <Label className="text-gray-600 text-xs dark:text-gray-400">Types</Label>
            <div className="space-y-2">
              {types.map((type) => (
                <div key={type.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`type-${type.value}`}
                    checked={advancedFilter.types.includes(type.value)}
                    onCheckedChange={() => toggleType(type.value)}
                  />
                  <Label htmlFor={`type-${type.value}`} className="text-xs">
                    {type.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sorting */}
        <div className="flex items-center gap-2">
          <div className="space-y-2">
            <Label className="text-gray-600 text-xs dark:text-gray-400">Sort By</Label>
            <Select
              value={advancedFilter.sortBy}
              onValueChange={(value) =>
                updateAdvancedFilter({
                  sortBy: value as 'name' | 'category' | 'type' | 'found_date',
                })
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-gray-600 text-xs dark:text-gray-400">Sort Order</Label>
            <Select
              value={advancedFilter.sortOrder}
              onValueChange={(value) =>
                updateAdvancedFilter({ sortOrder: value as 'asc' | 'desc' })
              }
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Ascending</SelectItem>
                <SelectItem value="desc">Descending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
