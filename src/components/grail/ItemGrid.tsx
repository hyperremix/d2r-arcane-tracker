import type { HolyGrailItem } from 'electron/types/grail';
import { Grid, List } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useProgressLookup } from '@/hooks/useProgressLookup';
import { shouldShowEtherealStatus, shouldShowNormalStatus } from '@/lib/ethereal';
import { cn } from '@/lib/utils';
import { useFilteredItems, useGrailStore } from '@/stores/grailStore';
import { ItemCard } from './ItemCard';

/**
 * Determines the ethereal grouping key for an item based on its ethereal status and progress.
 * @param {HolyGrailItem} itemData - The Holy Grail item data
 * @param {{ normalFound: boolean; etherealFound: boolean } | undefined} itemProgress - The progress data for the item
 * @returns {string} A string key representing the item's ethereal status group
 */
function getEtherealGroupKey(
  itemData: HolyGrailItem,
  itemProgress: { normalFound: boolean; etherealFound: boolean } | undefined,
) {
  const hasEthereal = itemProgress?.etherealFound;
  const hasNormal = itemProgress?.normalFound;
  const canBeEthereal = shouldShowEtherealStatus(itemData);
  const canBeNormal = shouldShowNormalStatus(itemData);

  if (!canBeEthereal && !canBeNormal) {
    return 'Not Applicable';
  }
  if (!canBeEthereal) {
    return hasNormal ? 'Normal Found' : 'Normal Not Found';
  }
  if (!canBeNormal) {
    return hasEthereal ? 'Ethereal Found' : 'Ethereal Not Found';
  }
  if (hasEthereal && hasNormal) {
    return 'Both Found';
  }
  if (hasEthereal) {
    return 'Ethereal Only';
  }
  if (hasNormal) {
    return 'Normal Only';
  }
  return 'Neither Found';
}

/**
 * Type representing the available view modes for displaying items.
 */
type ViewMode = 'grid' | 'list';
/**
 * Type representing the available grouping modes for organizing items.
 */
type GroupMode = 'none' | 'category' | 'type' | 'ethereal';

/**
 * ItemGrid component that displays Holy Grail items in a filterable, sortable, and groupable grid or list view.
 * Supports multiple view modes (grid/list) and grouping options (category, type, ethereal status).
 * @returns {JSX.Element} A grid or list of Holy Grail items with view and grouping controls
 */
export function ItemGrid() {
  const { progress, characters, selectedCharacterId, toggleItemFound, settings } = useGrailStore();
  const filteredItems = useFilteredItems(); // This uses DB items as base and applies all filters
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [groupMode, setGroupMode] = useState<GroupMode>('none');

  // Filter items based on grail settings - show items that match the current configuration
  const displayItems = useMemo(() => {
    return filteredItems.filter((item) => {
      // If both normal and ethereal are enabled, show all items
      if (settings.grailNormal && settings.grailEthereal) {
        return true;
      }

      // If only normal is enabled, show only normal items
      if (settings.grailNormal && !settings.grailEthereal) {
        return !item.id.startsWith('eth_');
      }

      // If only ethereal is enabled, show only ethereal items
      if (!settings.grailNormal && settings.grailEthereal) {
        return item.id.startsWith('eth_');
      }

      // If neither is enabled, show nothing (shouldn't happen due to DB filtering)
      return false;
    });
  }, [filteredItems, settings.grailNormal, settings.grailEthereal]);

  // Create a lookup map for progress data including both normal and ethereal versions
  const progressLookup = useProgressLookup(displayItems, progress, selectedCharacterId);

  // Reset group mode to 'none' if ethereal grouping is selected but ethereal items are enabled
  useEffect(() => {
    if (groupMode === 'ethereal' && settings.grailEthereal) {
      setGroupMode('none');
    }
  }, [groupMode, settings.grailEthereal]);

  const groupedItems = useMemo(() => {
    if (groupMode === 'none') {
      return [{ title: 'All Items', items: displayItems }];
    }

    const groups = new Map<string, typeof displayItems>();

    displayItems.forEach((itemData) => {
      let groupKey = '';

      switch (groupMode) {
        case 'category':
          groupKey = itemData.category;
          break;
        case 'type':
          groupKey = itemData.type;
          break;
        case 'ethereal': {
          // For consolidated view, group by whether either version is found
          const itemProgress = progressLookup.get(itemData.id);
          groupKey = getEtherealGroupKey(itemData, itemProgress);
          break;
        }
        default:
          groupKey = 'All Items';
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      const group = groups.get(groupKey);
      if (group) {
        group.push(itemData);
      }
    });

    return Array.from(groups.entries()).map(([title, items]) => ({
      title: title.charAt(0).toUpperCase() + title.slice(1),
      items,
    }));
  }, [displayItems, groupMode, progressLookup]);

  const handleItemClick = (itemId: string) => {
    if (!selectedCharacterId) return;
    toggleItemFound(itemId, selectedCharacterId, true);
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2">
          {/* Group Mode */}
          <select
            value={groupMode}
            onChange={(e) => setGroupMode(e.target.value as GroupMode)}
            className="rounded border px-2 py-1 text-sm"
          >
            <option value="none">No Grouping</option>
            <option value="category">By Category</option>
            <option value="type">By Type</option>
            {settings.grailEthereal && <option value="ethereal">By Ethereal</option>}
          </select>

          {/* View Mode Toggle */}
          <div className="flex rounded border">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-r-none"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-l-none"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Items Grid */}
      <div className="space-y-8">
        {groupedItems.map((group) => (
          <div key={group.title} className="space-y-4">
            {groupMode !== 'none' && (
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">{group.title}</h3>
                <Badge variant="outline">
                  {
                    group.items.filter((item) => progressLookup.get(item.id)?.overallFound || false)
                      .length
                  }
                  /{group.items.length}
                </Badge>
              </div>
            )}

            <div
              className={cn(
                viewMode === 'grid'
                  ? 'grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7'
                  : 'flex flex-col gap-2',
              )}
            >
              {group.items.map((item) => {
                const itemProgressData = progressLookup.get(item.id);
                const normalProgress = itemProgressData?.normalProgress || [];
                const etherealProgress = itemProgressData?.etherealProgress || [];

                return (
                  <ItemCard
                    key={item.id}
                    item={item}
                    normalProgress={normalProgress}
                    etherealProgress={etherealProgress}
                    characters={characters}
                    onClick={() => handleItemClick(item.id)}
                    viewMode={viewMode}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
