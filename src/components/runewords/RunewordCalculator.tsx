import type { JSX } from 'react';
import { useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRunewordStore } from '@/stores/runewordStore';
import { RuneInventory } from './RuneInventory';
import { RunewordList } from './RunewordList';

/**
 * Main Runeword Calculator component.
 * Provides functionality to track rune inventory and see which runewords can be crafted.
 */
export function RunewordCalculator(): JSX.Element {
  const { loadInventory, searchTerm, setSearchTerm, showOnlyCraftable, setShowOnlyCraftable, sortBy, setSortBy } =
    useRunewordStore();

  // Load inventory on mount
  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b bg-background px-6 py-4">
        <h1 className="font-bold text-2xl">Runeword Calculator</h1>
        <p className="text-muted-foreground text-sm">
          Track your runes and discover which runewords you can craft
        </p>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Tabs for Inventory and Runewords */}
        <Tabs defaultValue="runewords" className="flex w-full flex-col">
          <TabsList className="mx-6 mt-4 grid w-auto grid-cols-2">
            <TabsTrigger value="runewords">Runewords</TabsTrigger>
            <TabsTrigger value="inventory">Rune Inventory</TabsTrigger>
          </TabsList>

          {/* Runewords Tab */}
          <TabsContent value="runewords" className="flex flex-1 flex-col overflow-hidden px-6 pb-6 pt-4">
            {/* Filters and Search */}
            <div className="mb-4 flex flex-col gap-4">
              {/* Search */}
              <div className="flex-1">
                <Label htmlFor="search" className="mb-2 block text-sm">
                  Search Runewords
                </Label>
                <Input
                  id="search"
                  type="text"
                  placeholder="Search by name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Filters Row */}
              <div className="flex items-center gap-6">
                {/* Show Only Craftable */}
                <div className="flex items-center space-x-2">
                  <Switch
                    id="craftable"
                    checked={showOnlyCraftable}
                    onCheckedChange={setShowOnlyCraftable}
                  />
                  <Label htmlFor="craftable" className="cursor-pointer text-sm">
                    Show only craftable
                  </Label>
                </div>

                {/* Sort By */}
                <div className="flex items-center gap-2">
                  <Label htmlFor="sort" className="text-sm">
                    Sort by:
                  </Label>
                  <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'name' | 'runes' | 'craftable')}>
                    <SelectTrigger id="sort" className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="runes">Rune Count</SelectItem>
                      <SelectItem value="craftable">Craftable First</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Runeword List */}
            <div className="flex-1 overflow-hidden">
              <RunewordList />
            </div>
          </TabsContent>

          {/* Inventory Tab */}
          <TabsContent value="inventory" className="flex-1 overflow-hidden px-6 pb-6 pt-4">
            <RuneInventory />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
