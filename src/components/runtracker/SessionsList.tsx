import type { Session } from 'electron/types/grail';
import { ArrowDown, ArrowUp, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDuration, formatSessionDateRelative, formatTime } from '@/lib/utils';
import { useRunTrackerStore } from '@/stores/runTrackerStore';

interface SessionsListProps {
  onSessionSelect: (sessionId: string) => void;
}

type SortField = 'startTime' | 'duration' | 'runCount' | 'itemsFound';
type SortOrder = 'asc' | 'desc';

const ITEMS_PER_PAGE = 10;

interface SessionTableRowProps {
  session: Session;
  onSessionClick: (sessionId: string) => void;
  getSessionStats: (sessionId: string) => { itemsFound: number } | null;
  getSessionDuration: (session: Session) => number;
  formatSessionDate: (date: Date) => string;
}

// Session table row component
function SessionTableRow({
  session,
  onSessionClick,
  getSessionStats,
  getSessionDuration,
  formatSessionDate,
}: SessionTableRowProps) {
  const sessionStats = getSessionStats(session.id);
  const duration = getSessionDuration(session);
  const sessionDate = formatSessionDate(session.startTime);

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/70 focus-visible:bg-muted/70"
      tabIndex={0}
      onClick={() => onSessionClick(session.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSessionClick(session.id);
        }
      }}
      aria-label={`View session from ${sessionDate} details`}
    >
      <TableCell className="font-medium">{sessionDate}</TableCell>
      <TableCell className="font-mono text-sm">{formatTime(session.startTime)}</TableCell>
      <TableCell className="font-mono text-sm">{formatTime(session.endTime)}</TableCell>
      <TableCell className="font-mono text-sm">{formatDuration(duration)}</TableCell>
      <TableCell className="text-center">{session.runCount}</TableCell>
      <TableCell className="text-center">{sessionStats ? sessionStats.itemsFound : 0}</TableCell>
    </TableRow>
  );
}

// Loading skeleton for table rows
function TableRowSkeleton() {
  return (
    <TableRow>
      <TableCell>
        <Skeleton className="h-4 w-20" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-16" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-16" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-20" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-12" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-12" />
      </TableCell>
    </TableRow>
  );
}

/**
 * SessionsList component that displays a list of previous sessions with filtering
 * and the ability to select a session to view its details.
 */
export function SessionsList({ onSessionSelect }: SessionsListProps) {
  const { sessions, loading, getSessionStats, runs, loadSessionRuns, loadingSessions } =
    useRunTrackerStore();
  const [showArchived, setShowArchived] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('startTime');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  // Track which sessions we've already initiated loading for to prevent duplicate triggers
  const initiatedLoadsRef = useRef<Set<string>>(new Set());

  // Filter sessions based on archived status
  const filteredSessions = useMemo(() => {
    if (!sessions) return [];
    return sessions.filter((session) => {
      // Exclude the active session (one without end_time)
      if (!session.endTime) {
        return false;
      }

      // Filter based on archived toggle
      if (showArchived) {
        return session.archived;
      }
      return !session.archived;
    });
  }, [sessions, showArchived]);

  // Helper functions for sorting
  const compareStartTime = useCallback((a: Session, b: Session) => {
    return a.startTime.getTime() - b.startTime.getTime();
  }, []);

  const compareDuration = useCallback((a: Session, b: Session) => {
    const durationA = a.endTime
      ? a.endTime.getTime() - a.startTime.getTime()
      : Date.now() - a.startTime.getTime();
    const durationB = b.endTime
      ? b.endTime.getTime() - b.startTime.getTime()
      : Date.now() - b.startTime.getTime();
    return durationA - durationB;
  }, []);

  const compareRunCount = useCallback((a: Session, b: Session) => {
    return a.runCount - b.runCount;
  }, []);

  const compareItemsFound = useCallback(
    (a: Session, b: Session) => {
      const statsA = getSessionStats(a.id);
      const statsB = getSessionStats(b.id);
      const itemsA = statsA ? statsA.itemsFound : 0;
      const itemsB = statsB ? statsB.itemsFound : 0;
      return itemsA - itemsB;
    },
    [getSessionStats],
  );

  // Sort sessions based on sort field and order
  const sortedSessions = useMemo(() => {
    if (filteredSessions.length === 0) return [];

    let compareFn: (a: Session, b: Session) => number;
    switch (sortField) {
      case 'startTime':
        compareFn = compareStartTime;
        break;
      case 'duration':
        compareFn = compareDuration;
        break;
      case 'runCount':
        compareFn = compareRunCount;
        break;
      case 'itemsFound':
        compareFn = compareItemsFound;
        break;
    }

    return [...filteredSessions].sort((a, b) => {
      const comparison = compareFn(a, b);
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [
    filteredSessions,
    sortField,
    sortOrder,
    compareStartTime,
    compareDuration,
    compareRunCount,
    compareItemsFound,
  ]);

  // Paginate sessions
  const totalPages = Math.ceil(sortedSessions.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedSessions = sortedSessions.slice(startIndex, endIndex);

  // Memoize list of session IDs that need runs loaded
  // This prevents infinite rerenders by creating a stable reference
  const sessionsNeedingRuns = useMemo(() => {
    return sortedSessions
      .filter((session) => {
        // Check if runs are already loaded for this session
        const sessionRuns = runs.get(session.id);
        if (sessionRuns !== undefined) return false;
        // Check if runs are currently loading for this session
        if (loadingSessions.has(session.id)) return false;
        // Check if we've already initiated loading for this session
        if (initiatedLoadsRef.current.has(session.id)) return false;
        return true;
      })
      .map((session) => session.id);
  }, [sortedSessions, runs, loadingSessions]);

  // Load runs (and their items) for sessions that don't have runs loaded yet
  useEffect(() => {
    if (sessionsNeedingRuns.length === 0 || loading) return;

    // Mark these sessions as initiated before starting the load
    sessionsNeedingRuns.forEach((sessionId) => {
      initiatedLoadsRef.current.add(sessionId);
    });

    // Load runs for all sessions in parallel
    Promise.all(sessionsNeedingRuns.map((sessionId) => loadSessionRuns(sessionId))).catch(
      (error) => {
        console.error('[SessionsList] Error loading session runs:', error);
      },
    );
  }, [sessionsNeedingRuns, loadSessionRuns, loading]);

  // Clean up initiated loads when runs are actually loaded or loading completes
  useEffect(() => {
    // Remove sessions from initiated set once they're loaded or no longer loading
    const toRemove: string[] = [];
    initiatedLoadsRef.current.forEach((sessionId) => {
      if (runs.has(sessionId) || !loadingSessions.has(sessionId)) {
        toRemove.push(sessionId);
      }
    });
    toRemove.forEach((sessionId) => {
      initiatedLoadsRef.current.delete(sessionId);
    });
  }, [runs, loadingSessions]);

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

  // Handle pagination
  const goToPage = useCallback(
    (page: number) => {
      setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    },
    [totalPages],
  );

  // Reset to page 1 when filter changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: We want to reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [showArchived]);

  // Handle session selection
  const handleSessionClick = useCallback(
    (sessionId: string) => {
      onSessionSelect(sessionId);
    },
    [onSessionSelect],
  );

  // Calculate session duration
  const getSessionDuration = useCallback((session: Session) => {
    if (session.endTime) {
      return session.endTime.getTime() - session.startTime.getTime();
    }
    return Date.now() - session.startTime.getTime();
  }, []);

  // Get empty state message
  const getEmptyStateMessage = useCallback(() => {
    if (showArchived) {
      return {
        title: 'No archived sessions',
        description: 'Archived sessions will appear here when you archive them.',
      };
    }
    return {
      title: 'No previous sessions',
      description: 'Start a session to begin tracking your runs.',
    };
  }, [showArchived]);

  const emptyState = getEmptyStateMessage();

  // Helper to render sort icon
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? (
      <ArrowUp className="ml-1 h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3" />
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Previous Sessions</span>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">Show archived</span>
            <Switch checked={showArchived} onCheckedChange={setShowArchived} disabled={loading} />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Start Time</TableHead>
                <TableHead>End Time</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-center">Runs</TableHead>
                <TableHead className="text-center">Items</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }, (_, i) => (
                <TableRowSkeleton key={`session-skeleton-${Date.now()}-${i}`} />
              ))}
            </TableBody>
          </Table>
        ) : sortedSessions.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer select-none hover:bg-muted/50"
                    onClick={() => handleSort('startTime')}
                  >
                    <div className="flex items-center">
                      Date
                      {renderSortIcon('startTime')}
                    </div>
                  </TableHead>
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
                    className="cursor-pointer select-none text-center hover:bg-muted/50"
                    onClick={() => handleSort('runCount')}
                  >
                    <div className="flex items-center justify-center">
                      Runs
                      {renderSortIcon('runCount')}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer select-none text-center hover:bg-muted/50"
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
                {paginatedSessions.map((session) => (
                  <SessionTableRow
                    key={session.id}
                    session={session}
                    onSessionClick={handleSessionClick}
                    getSessionStats={getSessionStats}
                    getSessionDuration={getSessionDuration}
                    formatSessionDate={formatSessionDateRelative}
                  />
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <div className="text-muted-foreground text-sm">
                  Showing {startIndex + 1}-{Math.min(endIndex, sortedSessions.length)} of{' '}
                  {sortedSessions.length} sessions
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
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Calendar className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="mb-2 font-medium text-muted-foreground">{emptyState.title}</p>
            <p className="text-muted-foreground text-sm">{emptyState.description}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
