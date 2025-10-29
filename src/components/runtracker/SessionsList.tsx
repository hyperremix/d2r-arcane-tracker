import type { Session } from 'electron/types/grail';
import { Archive, Calendar, Clock, Play } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { formatDuration } from '@/lib/utils';
import { useRunTrackerStore } from '@/stores/runTrackerStore';

interface SessionsListProps {
  onSessionSelect: (sessionId: string) => void;
}

interface SessionCardProps {
  session: Session;
  onSessionClick: (sessionId: string) => void;
  getSessionStats: (sessionId: string) => { itemsFound: number } | null;
  getSessionDuration: (session: Session) => number;
  formatSessionDate: (date: Date) => string;
}

// Session card component
function SessionCard({
  session,
  onSessionClick,
  getSessionStats,
  getSessionDuration,
  formatSessionDate,
}: SessionCardProps) {
  const sessionStats = getSessionStats(session.id);
  const duration = getSessionDuration(session);
  const sessionDate = formatSessionDate(session.startTime);

  return (
    <Card
      className="cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-md"
      onClick={() => onSessionClick(session.id)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">{sessionDate}</span>
              {session.archived && (
                <Badge variant="secondary" className="text-xs">
                  <Archive className="mr-1 h-3 w-3" />
                  Archived
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-4 text-muted-foreground text-sm">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{formatDuration(duration)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Play className="h-4 w-4" />
                <span>{session.runCount} runs</span>
              </div>
              {sessionStats && (
                <div className="flex items-center gap-1">
                  <span>{sessionStats.itemsFound} items</span>
                </div>
              )}
            </div>

            {session.notes && (
              <p className="line-clamp-2 text-muted-foreground text-sm">{session.notes}</p>
            )}
          </div>

          <div className="text-right">
            <div className="text-muted-foreground text-xs">
              {session.startTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
            {session.endTime && (
              <div className="text-muted-foreground text-xs">
                Ended:{' '}
                {session.endTime.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Loading skeleton
function SessionCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-4 w-32" />
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * SessionsList component that displays a list of previous sessions with filtering
 * and the ability to select a session to view its details.
 */
export function SessionsList({ onSessionSelect }: SessionsListProps) {
  const { sessions, loading, getSessionStats } = useRunTrackerStore();
  const [showArchived, setShowArchived] = useState(false);

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

  // Sort sessions by start time (most recent first)
  const sortedSessions = useMemo(() => {
    return [...filteredSessions].sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }, [filteredSessions]);

  // Handle session selection
  const handleSessionClick = useCallback(
    (sessionId: string) => {
      onSessionSelect(sessionId);
    },
    [onSessionSelect],
  );

  // Format session date
  const formatSessionDate = useCallback((date: Date) => {
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }, []);

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
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <SessionCardSkeleton key={`session-skeleton-${Date.now()}-${i}`} />
            ))}
          </div>
        ) : sortedSessions.length > 0 ? (
          <div className="space-y-3">
            {sortedSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onSessionClick={handleSessionClick}
                getSessionStats={getSessionStats}
                getSessionDuration={getSessionDuration}
                formatSessionDate={formatSessionDate}
              />
            ))}
          </div>
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
