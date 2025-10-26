import type { Session } from 'electron/types/grail';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { formatDuration } from '@/lib/utils';
import { useRunTrackerStore } from '@/stores/runTrackerStore';

interface SessionCardProps {
  session: Session | null;
}

/**
 * SessionCard component that displays active session information including session time,
 * run count, items found, efficiency percentage, and provides controls to end or archive the session.
 */
export function SessionCard({ session }: SessionCardProps) {
  const {
    activeSession,
    loading,
    endSession,
    archiveSession,
    updateSessionNotes,
    getSessionStats,
  } = useRunTrackerStore();

  const [sessionTime, setSessionTime] = useState<number>(0);
  const [notes, setNotes] = useState<string>(session?.notes || '');
  const [isSavingNotes, setIsSavingNotes] = useState<boolean>(false);
  const notesId = useId();

  // Calculate current session time
  const currentSession = activeSession || session;
  const sessionStats = useMemo(() => {
    if (!currentSession) return null;
    return getSessionStats(currentSession.id);
  }, [currentSession, getSessionStats]);

  // Real-time timer updates
  useEffect(() => {
    if (!currentSession) {
      setSessionTime(0);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const elapsed = now - currentSession.startTime.getTime();
      setSessionTime(elapsed);
    };

    // Update immediately
    updateTimer();

    // Set up interval for updates
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [currentSession]);

  // Update notes when session changes
  useEffect(() => {
    if (currentSession?.notes !== undefined) {
      setNotes(currentSession.notes || '');
    }
  }, [currentSession?.notes]);

  // Calculate efficiency percentage
  const efficiencyPercentage = useMemo(() => {
    if (!currentSession || currentSession.totalSessionTime === 0) return 0;
    return (currentSession.totalRunTime / currentSession.totalSessionTime) * 100;
  }, [currentSession]);

  // Calculate average run time
  const averageRunTime = useMemo(() => {
    if (!sessionStats || sessionStats.totalRuns === 0) return 0;
    return sessionStats.averageRunDuration;
  }, [sessionStats]);

  // Button handlers
  const handleEndSession = useCallback(async () => {
    try {
      await endSession();
    } catch (error) {
      console.error('Error ending session:', error);
    }
  }, [endSession]);

  const handleArchiveSession = useCallback(async () => {
    if (!currentSession) return;
    try {
      await archiveSession(currentSession.id);
    } catch (error) {
      console.error('Error archiving session:', error);
    }
  }, [archiveSession, currentSession]);

  const handleNotesChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value);
  }, []);

  const handleNotesBlur = useCallback(async () => {
    if (!currentSession || notes === (currentSession.notes || '')) return;

    setIsSavingNotes(true);
    try {
      await updateSessionNotes(currentSession.id, notes);
    } catch (error) {
      console.error('Error updating session notes:', error);
      // Revert notes on error
      setNotes(currentSession.notes || '');
    } finally {
      setIsSavingNotes(false);
    }
  }, [currentSession, notes, updateSessionNotes]);

  // Empty state
  if (!currentSession) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Session Card</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="mb-4 text-muted-foreground">No active session</p>
            <p className="text-muted-foreground text-sm">
              Start a session to begin tracking your runs and items.
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
          <span>Session Card</span>
          <Badge variant="secondary" className="text-xs">
            Active
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Session Statistics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="font-medium text-muted-foreground text-sm">Session Time</p>
            <p className="font-mono text-lg">{formatDuration(sessionTime)}</p>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-muted-foreground text-sm">Run Count</p>
            <p className="font-semibold text-lg">{currentSession.runCount}</p>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-muted-foreground text-sm">Average Run Time</p>
            <p className="font-mono text-lg">{formatDuration(averageRunTime)}</p>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-muted-foreground text-sm">Efficiency</p>
            <p className="font-semibold text-lg">{efficiencyPercentage.toFixed(1)}%</p>
          </div>
        </div>

        {/* Items Found */}
        {sessionStats && (
          <div className="space-y-1">
            <p className="font-medium text-muted-foreground text-sm">Items Found</p>
            <p className="font-semibold text-lg">{sessionStats.itemsFound}</p>
          </div>
        )}

        {/* Notes Editor */}
        <div className="space-y-2">
          <label htmlFor={notesId} className="font-medium text-muted-foreground text-sm">
            Session Notes
          </label>
          <div className="relative">
            <Textarea
              id={notesId}
              placeholder="Add notes about this session..."
              value={notes}
              onChange={handleNotesChange}
              onBlur={handleNotesBlur}
              className="min-h-[80px] resize-none"
            />
            {isSavingNotes && (
              <div className="absolute top-2 right-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleEndSession}
            disabled={loading}
            className="flex-1"
          >
            End Session
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleArchiveSession}
            disabled={loading}
            className="flex-1"
          >
            Archive Session
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
