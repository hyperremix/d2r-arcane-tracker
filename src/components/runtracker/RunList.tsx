import type { Run, RunItem } from 'electron/types/grail';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronRight as ChevronRightIcon,
} from 'lucide-react';
import { useCallback, useId, useMemo, useState } from 'react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDuration } from '@/lib/utils';
import { useRunTrackerStore } from '@/stores/runTrackerStore';

interface RunListProps {
  runs: Run[] | undefined;
}

type SortField = 'duration' | 'startTime' | 'runType' | 'itemsFound';
type SortOrder = 'asc' | 'desc';

const ITEMS_PER_PAGE = 10;

interface RunRowProps {
  run: Run;
  itemsCount: number;
  isExpanded: boolean;
  runItemsData: RunItem[];
  loading: boolean;
  onToggleExpansion: (runId: string) => void;
  formatTimestamp: (date: Date) => string;
}

function RunRow({
  run,
  itemsCount,
  isExpanded,
  runItemsData,
  loading,
  onToggleExpansion,
  formatTimestamp,
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
            <div className="border-t bg-muted/25 p-4">
              <div className="space-y-4">
                {/* Run Statistics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="font-medium text-muted-foreground text-sm">Area</p>
                    <p className="text-sm">{run.area || 'Unknown'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-muted-foreground text-sm">End Time</p>
                    <p className="font-mono text-sm">
                      {run.endTime ? formatTimestamp(run.endTime) : 'Incomplete'}
                    </p>
                  </div>
                </div>

                {/* Items Found */}
                <div className="space-y-2">
                  <p className="font-medium text-muted-foreground text-sm">
                    Items Found ({itemsCount})
                  </p>
                  {loading && !runItemsData.length ? (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      Loading items...
                    </div>
                  ) : itemsCount > 0 ? (
                    <div className="space-y-1">
                      {runItemsData.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 rounded bg-background p-2 text-sm"
                        >
                          <Badge variant="outline" className="text-xs">
                            {item.foundTime.toLocaleTimeString()}
                          </Badge>
                          <span className="text-muted-foreground">
                            Item ID: {item.grailProgressId}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">No items found in this run</p>
                  )}
                </div>
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
  const runTypeFilterId = useId();
  const sortFieldId = useId();

  // State management
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('startTime');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedRunTypes, setSelectedRunTypes] = useState<string[]>([]);
  const [expandedRunIds, setExpandedRunIds] = useState<Set<string>>(new Set());

  // Get unique run types from all runs
  const availableRunTypes = useMemo(() => {
    if (!runs) return [];
    const types = runs
      .map((run) => run.runType)
      .filter((type): type is string => type !== undefined && type !== null);
    return Array.from(new Set(types)).sort();
  }, [runs]);

  // Calculate items count for each run
  const getRunItemsCount = useCallback(
    (runId: string) => {
      const items = runItems.get(runId) || [];
      return items.length;
    },
    [runItems],
  );

  // Filter runs by selected run types
  const filteredRuns = useMemo(() => {
    if (!runs) return [];
    if (selectedRunTypes.length === 0) return runs;
    return runs.filter((run) => run.runType && selectedRunTypes.includes(run.runType));
  }, [runs, selectedRunTypes]);

  // Sort runs based on selected field and order
  const sortedRuns = useMemo(() => {
    const sorted = [...filteredRuns].sort((a, b) => {
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

    return sorted;
  }, [filteredRuns, sortField, sortOrder, getRunItemsCount]);

  // Paginate runs
  const totalPages = Math.ceil(sortedRuns.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedRuns = sortedRuns.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useMemo(() => {
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
        setSortOrder('desc');
      }
    },
    [sortField, sortOrder],
  );

  // Handle row expansion
  const toggleRunExpansion = useCallback(
    async (runId: string) => {
      const newExpanded = new Set(expandedRunIds);
      if (newExpanded.has(runId)) {
        newExpanded.delete(runId);
      } else {
        newExpanded.add(runId);
        // Load items for this run if not already loaded
        if (!runItems.has(runId)) {
          await loadRunItems(runId);
        }
      }
      setExpandedRunIds(newExpanded);
    },
    [expandedRunIds, runItems, loadRunItems],
  );

  // Handle pagination
  const goToPage = useCallback(
    (page: number) => {
      setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    },
    [totalPages],
  );

  // Format timestamp for display
  const formatTimestamp = useCallback((date: Date) => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  // Empty state
  if (!runs || runs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Run History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="mb-2 font-medium text-muted-foreground">No runs recorded</p>
            <p className="text-muted-foreground text-sm">
              Start tracking runs to see your farming history here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Run History</span>
          <Badge variant="secondary" className="text-xs">
            {sortedRuns.length} runs
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filter and Sort Controls */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor={runTypeFilterId} className="font-medium text-muted-foreground text-sm">
              Filter by type:
            </label>
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
            <label htmlFor={sortFieldId} className="font-medium text-muted-foreground text-sm">
              Sort by:
            </label>
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-2"
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </Button>
          </div>
        </div>

        {/* Runs Table */}
        {paginatedRuns.length > 0 ? (
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
