import { useVirtualizer } from '@tanstack/react-virtual';
import type { Character, GrailProgress, Item, Run, RunItem } from 'electron/types/grail';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ItemCard } from '@/components/grail/ItemCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDuration } from '@/lib/utils';
import { useGrailStore } from '@/stores/grailStore';
import { useRunTrackerStore } from '@/stores/runTrackerStore';

interface RunListProps {
  runs: Run[] | undefined;
}

type SortField = 'duration' | 'startTime' | 'itemsFound';
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
        <Skeleton className="h-4 w-20" />
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
    </TableRow>
  );
}

interface RunRowProps {
  run: Run;
  itemsCount: number;
  onViewDetails: (run: Run) => void;
  formatTimestamp: (date: Date) => string;
}

function RunRow({ run, itemsCount, onViewDetails, formatTimestamp }: RunRowProps) {
  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/70 focus-visible:bg-muted/70"
      tabIndex={0}
      onClick={() => onViewDetails(run)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onViewDetails(run);
        }
      }}
      aria-label={`View run #${run.runNumber} details`}
    >
      <TableCell className="font-medium">#{run.runNumber}</TableCell>
      <TableCell className="font-mono text-sm">{formatTimestamp(run.startTime)}</TableCell>
      <TableCell className="font-mono text-sm">
        {run.endTime ? formatTimestamp(run.endTime) : '-'}
      </TableCell>
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
    </TableRow>
  );
}

/**
 * RunList component that displays a paginated list of runs with filtering, sorting,
 * and expandable details showing items found and run statistics.
 */
export function RunList({ runs }: RunListProps) {
  const { runItems, loadRunItems, loading } = useRunTrackerStore();
  const { items, progress, characters } = useGrailStore();

  // State management
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('startTime');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [isRunDialogOpen, setIsRunDialogOpen] = useState(false);

  // Calculate items count for each run (memoized)
  const getRunItemsCount = useCallback(
    (runId: string) => {
      const items = runItems.get(runId) || [];
      return items.length;
    },
    [runItems],
  );

  const filteredRuns = useMemo(() => {
    if (!runs || runs.length === 0) return [];
    return runs;
  }, [runs]);

  // Pre-load run items for all runs when runs are displayed
  useEffect(() => {
    if (!runs || runs.length === 0) return;

    // Find runs that don't have items loaded yet
    const runsToLoad = runs.filter((run) => !runItems.has(run.id));

    if (runsToLoad.length === 0) return;

    // Load items for all runs in parallel
    Promise.all(runsToLoad.map((run) => loadRunItems(run.id))).catch((error) => {
      console.error('[RunList] Error loading run items:', error);
    });
  }, [runs, runItems, loadRunItems]);

  const sortedRuns = useMemo(() => {
    if (filteredRuns.length === 0) return [];
    return [...filteredRuns].sort((a, b) => {
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
        case 'itemsFound': {
          const itemsA = getRunItemsCount(a.id);
          const itemsB = getRunItemsCount(b.id);
          comparison = itemsA - itemsB;
          break;
        }
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredRuns, sortField, sortOrder, getRunItemsCount]);

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

  // Handle sorting
  const handleSort = useCallback(
    (field: SortField) => {
      setCurrentPage(1);
      if (sortField === field) {
        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
        setSortField(field);
        setSortOrder('asc');
      }
    },
    [sortField, sortOrder],
  );

  // Helper to render sort icon
  const renderSortIcon = useCallback(
    (field: SortField) => {
      if (sortField !== field) return null;
      return sortOrder === 'asc' ? (
        <ArrowUp className="ml-1 h-3 w-3" />
      ) : (
        <ArrowDown className="ml-1 h-3 w-3" />
      );
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

  const openRunDetails = useCallback(
    (run: Run) => {
      if (selectedRun?.id === run.id && isRunDialogOpen) {
        return;
      }
      setSelectedRun(run);
      setIsRunDialogOpen(true);
      if (!runItems.has(run.id)) {
        loadRunItems(run.id);
      }
    },
    [isRunDialogOpen, loadRunItems, runItems, selectedRun?.id],
  );

  const handleRunDialogChange = useCallback((open: boolean) => {
    setIsRunDialogOpen(open);
    if (!open) {
      setSelectedRun(null);
    }
  }, []);

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
      // First find the progress record by matching the grailProgressId
      const progressRecord = progress.find((p) => p.id === runItem.grailProgressId);
      // Then use the progress record's itemId to find the actual item
      const item = progressRecord ? items.find((i) => i.id === progressRecord.itemId) : undefined;
      return {
        name: item?.name || 'Unknown Item',
        isNewGrail: Boolean(
          progressRecord?.foundDate && progressRecord.foundDate >= runItem.foundTime,
        ),
      };
    },
    [items, progress],
  );

  // Helper function to get ItemCard data from RunItem
  const getItemCardData = useCallback(
    (runItem: RunItem) => {
      // First find the progress record by matching the grailProgressId
      const progressRecord = progress.find((p) => p.id === runItem.grailProgressId);
      if (!progressRecord) {
        return { item: undefined, normalProgress: [], etherealProgress: [] };
      }

      // Find the actual item using the progress record's itemId
      const item = items.find((i) => i.id === progressRecord.itemId);
      if (!item) {
        return { item: undefined, normalProgress: [], etherealProgress: [] };
      }

      // Get all progress records for this item
      const allItemProgress = progress.filter((p) => p.itemId === item.id);

      // Separate into normal and ethereal progress
      const normalProgress = allItemProgress.filter((p) => !p.isEthereal);
      const etherealProgress = allItemProgress.filter((p) => p.isEthereal);

      return { item, normalProgress, etherealProgress };
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
          {/* Table Skeleton */}
          <div className="space-y-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Run #</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead>End Time</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="w-24">Items</TableHead>
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
                          <TableHead
                            className="cursor-pointer select-none hover:bg-muted/50"
                            onClick={() => handleSort('startTime')}
                          >
                            <div className="flex items-center">
                              Start Time
                              {renderSortIcon('startTime')}
                            </div>
                          </TableHead>
                          <TableHead>End Time</TableHead>
                          <TableHead
                            className="cursor-pointer select-none hover:bg-muted/50"
                            onClick={() => handleSort('duration')}
                          >
                            <div className="flex items-center">
                              Duration
                              {renderSortIcon('duration')}
                            </div>
                          </TableHead>
                          <TableHead
                            className="w-24 cursor-pointer select-none text-center hover:bg-muted/50"
                            onClick={() => handleSort('itemsFound')}
                          >
                            <div className="flex items-center justify-center">
                              Items
                              {renderSortIcon('itemsFound')}
                            </div>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {virtualizer.getVirtualItems().map((virtualItem) => {
                          const run = sortedRuns[virtualItem.index];
                          const itemsCount = getRunItemsCount(run.id);

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
                                onViewDetails={openRunDetails}
                                formatTimestamp={formatTimestamp}
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
                      <TableHead
                        className="cursor-pointer select-none hover:bg-muted/50"
                        onClick={() => handleSort('startTime')}
                      >
                        <div className="flex items-center">
                          Start Time
                          {renderSortIcon('startTime')}
                        </div>
                      </TableHead>
                      <TableHead>End Time</TableHead>
                      <TableHead
                        className="cursor-pointer select-none hover:bg-muted/50"
                        onClick={() => handleSort('duration')}
                      >
                        <div className="flex items-center">
                          Duration
                          {renderSortIcon('duration')}
                        </div>
                      </TableHead>
                      <TableHead
                        className="w-24 cursor-pointer select-none text-center hover:bg-muted/50"
                        onClick={() => handleSort('itemsFound')}
                      >
                        <div className="flex items-center justify-center">
                          Items
                          {renderSortIcon('itemsFound')}
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRuns.map((run) => {
                      const itemsCount = getRunItemsCount(run.id);

                      return (
                        <RunRow
                          key={run.id}
                          run={run}
                          itemsCount={itemsCount}
                          onViewDetails={openRunDetails}
                          formatTimestamp={formatTimestamp}
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
        <RunDetailsDialog
          open={isRunDialogOpen}
          onOpenChange={handleRunDialogChange}
          run={selectedRun}
          runItems={selectedRun ? runItems.get(selectedRun.id) || [] : []}
          loading={loading && selectedRun !== null && !runItems.has(selectedRun.id)}
          formatTimestamp={formatTimestamp}
          getItemInfo={getItemInfo}
          getItemCardData={getItemCardData}
          characters={characters}
        />
      </CardContent>
    </Card>
  );
}

interface RunDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  run: Run | null;
  runItems: RunItem[];
  loading: boolean;
  formatTimestamp: (date: Date) => string;
  getItemInfo: (runItem: RunItem) => { name: string; isNewGrail: boolean };
  getItemCardData: (runItem: RunItem) => {
    item: Item | undefined;
    normalProgress: GrailProgress[];
    etherealProgress: GrailProgress[];
  };
  characters: Character[];
}

function RunDetailsDialog({
  open,
  onOpenChange,
  run,
  runItems,
  loading,
  formatTimestamp,
  getItemInfo,
  getItemCardData,
  characters,
}: RunDetailsDialogProps) {
  if (!run) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">Select a run to view details.</DialogContent>
      </Dialog>
    );
  }

  const itemsCount = runItems.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Run #{run.runNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <p className="font-medium text-muted-foreground text-sm">Start Time</p>
              <p className="font-mono text-sm">{formatTimestamp(run.startTime)}</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-muted-foreground text-sm">Duration</p>
              <p className="font-mono text-sm">
                {run.duration ? formatDuration(run.duration) : 'In progress'}
              </p>
            </div>
            {run.endTime && (
              <div className="space-y-1">
                <p className="font-medium text-muted-foreground text-sm">End Time</p>
                <p className="font-mono text-sm">{formatTimestamp(run.endTime)}</p>
              </div>
            )}
            <div className="space-y-1">
              <p className="font-medium text-muted-foreground text-sm">Items Found</p>
              <Badge variant="secondary" className="text-xs">
                {itemsCount}
              </Badge>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Items Found</h4>
              <Badge variant="outline" className="text-xs">
                {itemsCount} items
              </Badge>
            </div>

            {loading ? (
              <div className="space-y-2">
                {['one', 'two', 'three'].map((placeholder) => (
                  <div key={`dialog-loading-${placeholder}`} className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
              </div>
            ) : runItems.length > 0 ? (
              <div className="space-y-2">
                {runItems.map((runItem) => {
                  const { item, normalProgress, etherealProgress } = getItemCardData(runItem);
                  if (!item) {
                    // Fallback to simple display if item not found
                    const itemInfo = getItemInfo(runItem);
                    return (
                      <div key={runItem.id} className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded bg-primary/20" />
                        <span className="text-sm">{itemInfo.name}</span>
                        {itemInfo.isNewGrail && (
                          <Badge variant="secondary" className="text-xs">
                            New
                          </Badge>
                        )}
                      </div>
                    );
                  }
                  return (
                    <ItemCard
                      key={runItem.id}
                      item={item}
                      normalProgress={normalProgress}
                      etherealProgress={etherealProgress}
                      characters={characters}
                      viewMode="list"
                      withoutStatusIndicators
                    />
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No items found in this run.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
