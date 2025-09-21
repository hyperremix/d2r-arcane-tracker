import type { ItemCategory, ItemType } from 'electron/types/grail';
import { RotateCcw, Search } from 'lucide-react';
import { useId, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

interface AdvancedFilter {
  searchTerm: string;
  categories: ItemCategory[];
  types: ItemType[];
  foundStatus: 'all' | 'found' | 'missing';
  sortBy: 'name' | 'category' | 'type' | 'found_date';
  sortOrder: 'asc' | 'desc';
  fuzzySearch: boolean;
}

const defaultFilter: AdvancedFilter = {
  searchTerm: '',
  categories: [],
  types: [],
  foundStatus: 'all',
  sortBy: 'name',
  sortOrder: 'asc',
  fuzzySearch: false,
};

const categories: { value: ItemCategory; label: string }[] = [
  { value: 'weapons', label: 'Weapons' },
  { value: 'armor', label: 'Armor' },
  { value: 'jewelry', label: 'Jewelry' },
  { value: 'charms', label: 'Charms' },
];

const types: { value: ItemType; label: string }[] = [
  { value: 'unique', label: 'Unique' },
  { value: 'set', label: 'Set' },
  { value: 'rune', label: 'Rune' },
  { value: 'runeword', label: 'Runeword' },
];

const sortOptions = [
  { value: 'name', label: 'Name' },
  { value: 'category', label: 'Category' },
  { value: 'type', label: 'Type' },
  { value: 'level', label: 'Level' },
  { value: 'rarity', label: 'Rarity' },
  { value: 'found_date', label: 'Found Date' },
];

export function AdvancedSearch() {
  const advancedSearchId = useId();
  const fuzzySearchId = useId();
  const [advancedFilter, setAdvancedFilter] = useState<AdvancedFilter>(defaultFilter);
  const { setFilter, setAdvancedFilter: setStoreAdvancedFilter } = useGrailStore();

  const updateAdvancedFilter = (updates: Partial<AdvancedFilter>) => {
    const newFilter = { ...advancedFilter, ...updates };
    setAdvancedFilter(newFilter);

    // Immediately update the store for real-time filtering
    setFilter({
      searchTerm: newFilter.searchTerm,
      categories: newFilter.categories,
      types: newFilter.types,
      foundStatus: newFilter.foundStatus,
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
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            <span className="text-base">Advanced Search</span>
            {getActiveFiltersCount() > 0 && (
              <Badge variant="secondary" className="text-xs">
                {getActiveFiltersCount()}
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={resetFilters}
            className="h-7 gap-1 px-2 text-xs"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Main Row - All controls in one compact row */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-end">
          {/* Search */}
          <div className="space-y-1 lg:col-span-3">
            <Label htmlFor={advancedSearchId} className="text-gray-600 text-xs">
              Search
            </Label>
            <div className="flex gap-2">
              <Input
                id={advancedSearchId}
                placeholder="Search items..."
                value={advancedFilter.searchTerm}
                onChange={(e) => updateAdvancedFilter({ searchTerm: e.target.value })}
                className="h-8 flex-1 text-sm"
              />
              <div className="flex items-center space-x-1">
                <Checkbox
                  id={fuzzySearchId}
                  checked={advancedFilter.fuzzySearch}
                  onCheckedChange={(checked) =>
                    updateAdvancedFilter({ fuzzySearch: Boolean(checked) })
                  }
                />
                <Label htmlFor={fuzzySearchId} className="text-xs">
                  Fuzzy
                </Label>
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1 lg:col-span-2">
            <Label className="text-gray-600 text-xs">Status</Label>
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

          {/* Categories */}
          <div className="space-y-1 lg:col-span-2">
            <Label className="text-gray-600 text-xs">Categories</Label>
            <div className="flex flex-wrap gap-1">
              {categories.map((category) => (
                <div key={category.value} className="flex items-center space-x-1">
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
          <div className="space-y-1 lg:col-span-2">
            <Label className="text-gray-600 text-xs">Types</Label>
            <div className="flex flex-wrap gap-1">
              {types.map((type) => (
                <div key={type.value} className="flex items-center space-x-1">
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

          {/* Sorting */}
          <div className="space-y-1 lg:col-span-3">
            <Label className="text-gray-600 text-xs">Sort</Label>
            <div className="flex gap-1">
              <Select
                value={advancedFilter.sortBy}
                onValueChange={(value) =>
                  updateAdvancedFilter({
                    sortBy: value as 'name' | 'category' | 'type' | 'found_date',
                  })
                }
              >
                <SelectTrigger className="text-xs">
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
              <Select
                value={advancedFilter.sortOrder}
                onValueChange={(value) =>
                  updateAdvancedFilter({ sortOrder: value as 'asc' | 'desc' })
                }
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascending</SelectItem>
                  <SelectItem value="desc">Descending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
