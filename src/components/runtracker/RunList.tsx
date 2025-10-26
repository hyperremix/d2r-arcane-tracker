import { useVirtualizer } from '@tanstack/react-virtual';
import type { Run, RunItem } from 'electron/types/grail';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronRight as ChevronRightIcon,
} from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDuration } from '@/lib/utils';
import { useGrailStore } from '@/stores/grailStore';
import { useRunTrackerStore } from '@/stores/runTrackerStore';

interface RunListProps {
  runs: Run[] | undefined;
}

type SortField = 'duration' | 'startTime' | 'runType' | 'itemsFound';
type SortOrder = 'asc' | 'desc';

const ITEMS_PER_PAGE = 10;
const VIRTUAL_SCROLLING_THRESHOLD = 100;

// Skeleton loader for table rows
function TableRowSkeleton() {
  return (
    <TableRow>
      <TableCell>
        <Skeleton className="h-4 w-8" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-16" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-20" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-16" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-8" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-8" />
      </TableCell>
    </TableRow>
  );
}

interface RunRowProps {
  run: Run;
  itemsCount: number;
  isExpanded: boolean;
  runItemsData: RunItem[];
  loading: boolean;
  onToggleExpansion: (runId: string) => void;
  formatTimestamp: (date: Date) => string;
  getItemInfo: (runItem: RunItem) => { name: string; isNewGrail: boolean };
}

function RunRow({
  run,
  itemsCount,
  isExpanded,
  runItemsData,
  loading,
  onToggleExpansion,
  formatTimestamp,
  getItemInfo,
}: RunRowProps) {
  return (
    <Collapsible open={isExpanded} onOpenChange={() => onToggleExpansion(run.id)}>
      <TableRow className="cursor-pointer hover:bg-muted/50">
        <TableCell className="font-medium">#{run.runNumber}</TableCell>
        <TableCell>
          {run.runType ? (
            <Badge variant="outline" className="text-xs">
              {run.runType}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-sm">-</span>
          )}
        </TableCell>
        <TableCell className="font-mono text-sm">{formatTimestamp(run.startTime)}</TableCell>
        <TableCell className="font-mono text-sm">
          {run.duration ? formatDuration(run.duration) : '-'}
        </TableCell>
        <TableCell className="text-center">
          {itemsCount > 0 ? (
            <Badge variant="secondary" className="text-xs">
              {itemsCount}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-sm">-</span>
          )}
        </TableCell>
        <TableCell>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
        </TableCell>
      </TableRow>

      {/* Expanded Details */}
      <CollapsibleContent asChild>
        <TableRow>
          <TableCell colSpan={6} className="p-0">
            <div className="border-t bg-muted/20 p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Items Found</h4>
                  <Badge variant="outline" className="text-xs">
                    {itemsCount} items
                  </Badge>
                </div>

                {loading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }, (_, i) => (
                      <div
                        key={`loading-skeleton-${i}-${Date.now()}`}
                        className="flex items-center gap-2"
                      >
                        <Skeleton className="h-4 w-4" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    ))}
                  </div>
                ) : runItemsData.length > 0 ? (
                  <div className="space-y-2">
                    {runItemsData.map((item) => {
                      const itemInfo = getItemInfo(item);
                      return (
                        <div key={item.id} className="flex items-center gap-2">
                          <div className="h-4 w-4 rounded bg-primary/20" />
                          <span className="text-sm">{itemInfo.name}</span>
                          {itemInfo.isNewGrail && (
                            <Badge variant="secondary" className="text-xs">
                              New
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No items found in this run.</p>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * RunList component that displays a paginated list of runs with filtering, sorting,
 * and expandable details showing items found and run statistics.
 */
export function RunList({ runs }: RunListProps) {
  const { runItems, loadRunItems, loading } = useRunTrackerStore();
  const { items, progress } = useGrailStore();
  const runTypeFilterId = useId();
  const sortFieldId = useId();

  // State management
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('startTime');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedRunTypes, setSelectedRunTypes] = useState<string[]>([]);
  const [expandedRunIds, setExpandedRunIds] = useState<Set<string>>(new Set());
  const [filteredRuns, setFilteredRuns] = useState<Run[]>([]);
  const [sortedRuns, setSortedRuns] = useState<Run[]>([]);

  // Get unique run types from all runs
  const availableRunTypes = useMemo(() => {
    if (!runs) return [];
    const types = runs
      .map((run) => run.runType)
      .filter((type): type is string => type !== undefined && type !== null);
    return Array.from(new Set(types)).sort();
  }, [runs]);

  // Calculate items count for each run (memoized)
  const getRunItemsCount = useCallback(
    (runId: string) => {
      const items = runItems.get(runId) || [];
      return items.length;
    },
    [runItems],
  );

  // Debounced filter and sort operations
  const debouncedFilterRuns = useDebouncedCallback(
    (runs: Run[], selectedTypes: string[]): Run[] => {
      if (!runs || runs.length === 0) return [];
      if (selectedTypes.length === 0) return runs;
      return runs.filter((run) => run.runType && selectedTypes.includes(run.runType));
    },
    300,
  );

  const debouncedSortRuns = useDebouncedCallback(
    (runs: Run[], sortField: SortField, sortOrder: SortOrder): Run[] => {
      if (!runs || runs.length === 0) return [];
      return [...runs].sort((a, b) => {
        let comparison = 0;

        switch (sortField) {
          case 'duration': {
            const durationA = a.duration || 0;
            const durationB = b.duration || 0;
            comparison = durationA - durationB;
            break;
          }
          case 'startTime': {
            comparison = a.startTime.getTime() - b.startTime.getTime();
            break;
          }
          case 'runType': {
            const typeA = a.runType || '';
            const typeB = b.runType || '';
            comparison = typeA.localeCompare(typeB);
            break;
          }
          case 'itemsFound': {
            const itemsA = getRunItemsCount(a.id);
            const itemsB = getRunItemsCount(b.id);
            comparison = itemsA - itemsB;
            break;
          }
        }

        return sortOrder === 'asc' ? comparison : -comparison;
      });
    },
    300,
  );

  // Effect to trigger filtering when runs or selectedRunTypes change
  useEffect(() => {
    if (!runs) {
      setFilteredRuns([]);
      return;
    }
    const filtered = debouncedFilterRuns(runs, selectedRunTypes);
    if (filtered) {
      setFilteredRuns(filtered);
    }
  }, [runs, selectedRunTypes, debouncedFilterRuns]);

  // Effect to trigger sorting when filteredRuns, sortField, or sortOrder change
  useEffect(() => {
    if (filteredRuns.length === 0) {
      setSortedRuns([]);
      return;
    }
    const sorted = debouncedSortRuns(filteredRuns, sortField, sortOrder);
    if (sorted) {
      setSortedRuns(sorted);
    }
  }, [filteredRuns, sortField, sortOrder, debouncedSortRuns]);

  // Virtual scrolling setup
  const parentRef = useRef<HTMLDivElement>(null);
  const shouldUseVirtualScrolling = sortedRuns.length > VIRTUAL_SCROLLING_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: sortedRuns.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // Estimated row height
    enabled: shouldUseVirtualScrolling,
  });

  // Paginate runs
  const totalPages = Math.ceil(sortedRuns.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedRuns = sortedRuns.slice(startIndex, endIndex);

  // Reset to first page when filters change
  // biome-ignore lint/correctness/useExhaustiveDependencies: Dependencies are necessary to reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedRunTypes.length, sortField, sortOrder]);

  // Handle run type filter changes
  const handleRunTypeFilter = useCallback((value: string) => {
    if (value === 'all') {
      setSelectedRunTypes([]);
    } else {
      setSelectedRunTypes([value]);
    }
  }, []);

  // Handle sorting
  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
        setSortField(field);
        setSortOrder('asc');
      }
    },
    [sortField, sortOrder],
  );

  // Handle pagination
  const goToPage = useCallback(
    (page: number) => {
      setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    },
    [totalPages],
  );

  // Handle run expansion
  const toggleRunExpansion = useCallback(
    (runId: string) => {
      setExpandedRunIds((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(runId)) {
          newSet.delete(runId);
        } else {
          newSet.add(runId);
          // Load run items when expanding
          loadRunItems(runId);
        }
        return newSet;
      });
    },
    [loadRunItems],
  );

  // Format timestamp helper
  const formatTimestamp = useCallback((date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }, []);

  // Helper function to get item information
  const getItemInfo = useCallback(
    (runItem: RunItem) => {
      const item = items.find((i) => i.id === runItem.grailProgressId);
      const progressRecord = progress.find((p) => p.itemId === runItem.grailProgressId);
      return {
        name: item?.name || 'Unknown Item',
        isNewGrail: Boolean(
          progressRecord?.foundDate && progressRecord.foundDate >= runItem.foundTime,
        ),
      };
    },
    [items, progress],
  );

  // Show loading state if runs are undefined
  if (runs === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-6 w-16" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter and Sort Controls Skeleton */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-40" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-8 w-8" />
            </div>
          </div>

          {/* Table Skeleton */}
          <div className="space-y-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Run #</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="w-24">Items</TableHead>
                  <TableHead className="w-16">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }, (_, i) => (
                  <TableRowSkeleton key={`table-skeleton-${i}-${Date.now()}`} />
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Run History
          <Badge variant="outline" className="text-xs">
            {sortedRuns.length} runs
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filter and Sort Controls */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <label
                  htmlFor={runTypeFilterId}
                  className="font-medium text-muted-foreground text-sm"
                >
                  Filter by type:
                </label>
              </TooltipTrigger>
              <TooltipContent>
                <p>Filter runs by their type (e.g., Mephisto, Chaos, etc.)</p>
              </TooltipContent>
            </Tooltip>
            <Select
              value={selectedRunTypes.length === 0 ? 'all' : selectedRunTypes[0]}
              onValueChange={handleRunTypeFilter}
            >
              <SelectTrigger id={runTypeFilterId} className="w-40">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {availableRunTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <label htmlFor={sortFieldId} className="font-medium text-muted-foreground text-sm">
                  Sort by:
                </label>
              </TooltipTrigger>
              <TooltipContent>
                <p>Choose how to sort the runs list</p>
              </TooltipContent>
            </Tooltip>
            <Select value={sortField} onValueChange={(value) => handleSort(value as SortField)}>
              <SelectTrigger id={sortFieldId} className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="startTime">Start Time</SelectItem>
                <SelectItem value="duration">Duration</SelectItem>
                <SelectItem value="runType">Type</SelectItem>
                <SelectItem value="itemsFound">Items Found</SelectItem>
              </SelectContent>
            </Select>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-2"
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{sortOrder === 'asc' ? 'Sort ascending' : 'Sort descending'}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Runs Table */}
        {sortedRuns.length > 0 ? (
          <div className="space-y-2">
            {shouldUseVirtualScrolling ? (
              // Virtual scrolling table
              <div className="space-y-2">
                <div className="text-muted-foreground text-sm">
                  Showing {sortedRuns.length} runs (virtual scrolling enabled)
                </div>
                <div ref={parentRef} className="h-[600px] overflow-auto rounded-md border">
                  <div
                    style={{
                      height: `${virtualizer.getTotalSize()}px`,
                      width: '100%',
                      position: 'relative',
                    }}
                  >
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-background">
                        <TableRow>
                          <TableHead className="w-16">Run #</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Start Time</TableHead>
                          <TableHead>Duration</TableHead>
                          <TableHead className="w-24">Items</TableHead>
                          <TableHead className="w-16">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {virtualizer.getVirtualItems().map((virtualItem) => {
                          const run = sortedRuns[virtualItem.index];
                          const itemsCount = getRunItemsCount(run.id);
                          const isExpanded = expandedRunIds.has(run.id);
                          const runItemsData = runItems.get(run.id) || [];

                          return (
                            <div
                              key={virtualItem.key}
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: `${virtualItem.size}px`,
                                transform: `translateY(${virtualItem.start}px)`,
                              }}
                            >
                              <RunRow
                                run={run}
                                itemsCount={itemsCount}
                                isExpanded={isExpanded}
                                runItemsData={runItemsData}
                                loading={loading}
                                onToggleExpansion={toggleRunExpansion}
                                formatTimestamp={formatTimestamp}
                                getItemInfo={getItemInfo}
                              />
                            </div>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            ) : (
              // Regular paginated table
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Run #</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Start Time</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead className="w-24">Items</TableHead>
                      <TableHead className="w-16">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRuns.map((run) => {
                      const itemsCount = getRunItemsCount(run.id);
                      const isExpanded = expandedRunIds.has(run.id);
                      const runItemsData = runItems.get(run.id) || [];

                      return (
                        <RunRow
                          key={run.id}
                          run={run}
                          itemsCount={itemsCount}
                          isExpanded={isExpanded}
                          runItemsData={runItemsData}
                          loading={loading}
                          onToggleExpansion={toggleRunExpansion}
                          formatTimestamp={formatTimestamp}
                          getItemInfo={getItemInfo}
                        />
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4">
                    <div className="text-muted-foreground text-sm">
                      Showing {startIndex + 1}-{Math.min(endIndex, sortedRuns.length)} of{' '}
                      {sortedRuns.length} runs
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          const page = i + 1;
                          const isCurrentPage = page === currentPage;
                          return (
                            <Button
                              key={page}
                              variant={isCurrentPage ? 'default' : 'outline'}
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => goToPage(page)}
                            >
                              {page}
                            </Button>
                          );
                        })}
                        {totalPages > 5 && (
                          <>
                            <span className="text-muted-foreground text-sm">...</span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => goToPage(totalPages)}
                            >
                              {totalPages}
                            </Button>
                          </>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        Next
                        <ChevronRightIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="mb-2 font-medium text-muted-foreground">No runs match your filters</p>
            <p className="text-muted-foreground text-sm">
              Try adjusting your filter criteria to see more runs.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
