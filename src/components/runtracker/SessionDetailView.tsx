import type { Session } from 'electron/types/grail';
import { Archive, ArrowLeft, FileDown } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { formatDuration } from '@/lib/utils';
import { useRunTrackerStore } from '@/stores/runTrackerStore';
import { ExportDialog } from './ExportDialog';
import { RunList } from './RunList';
import { SessionControls } from './SessionControls';

interface SessionDetailViewProps {
  sessionId: string;
  onBack: () => void;
}

/**
 * SessionDetailView component that displays detailed information about a specific session
 * including session stats, notes, controls (if active), and the list of runs.
 */
export function SessionDetailView({ sessionId, onBack }: SessionDetailViewProps) {
  const {
    sessions,
    activeSession,
    runs,
    loading,
    archiveSession,
    updateSessionNotes,
    loadSessionRuns,
    getSessionStats,
  } = useRunTrackerStore();

  const [notes, setNotes] = useState<string>('');
  const [isSavingNotes, setIsSavingNotes] = useState<boolean>(false);
  const [showExportDialog, setShowExportDialog] = useState<boolean>(false);
  const notesId = useId();

  // Find the session
  const session = useMemo(() => {
    return sessions.find((s) => s.id === sessionId) || null;
  }, [sessions, sessionId]);

  // Check if this is the active session
  const isActiveSession = useMemo(() => {
    return activeSession?.id === sessionId;
  }, [activeSession?.id, sessionId]);

  // Get session stats
  const sessionStats = useMemo(() => {
    if (!session) return null;
    return getSessionStats(session.id);
  }, [session, getSessionStats]);

  // Get runs for this session
  const sessionRuns = useMemo(() => {
    if (!session) return [];
    return runs.get(session.id) || [];
  }, [session, runs]);

  // Load session runs when component mounts
  useEffect(() => {
    // Only load if we don't already have runs for this session
    const existingRuns = runs.get(sessionId);
    if (sessionId && !existingRuns) {
      loadSessionRuns(sessionId);
    }
  }, [sessionId, loadSessionRuns, runs.get]);

  // Update notes when session changes
  useEffect(() => {
    if (session?.notes !== undefined) {
      setNotes(session.notes || '');
    }
  }, [session?.notes]);

  // Calculate session duration
  const getSessionDuration = useCallback((session: Session) => {
    if (session.endTime) {
      return session.endTime.getTime() - session.startTime.getTime();
    }
    return Date.now() - session.startTime.getTime();
  }, []);

  // Calculate efficiency percentage
  const efficiencyPercentage = useMemo(() => {
    if (!session || session.totalSessionTime === 0) return 0;
    return (session.totalRunTime / session.totalSessionTime) * 100;
  }, [session]);

  // Calculate average run time
  const averageRunTime = useMemo(() => {
    if (!sessionStats || sessionStats.totalRuns === 0) return 0;
    return sessionStats.averageRunDuration;
  }, [sessionStats]);

  // Handle notes change
  const handleNotesChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value);
  }, []);

  // Handle notes save
  const handleNotesBlur = useCallback(async () => {
    if (!session || notes === (session.notes || '')) return;

    setIsSavingNotes(true);
    try {
      await updateSessionNotes(session.id, notes);
    } catch (error) {
      console.error('Error updating session notes:', error);
      // Revert notes on error
      setNotes(session.notes || '');
    } finally {
      setIsSavingNotes(false);
    }
  }, [session, notes, updateSessionNotes]);

  // Handle archive session
  const handleArchiveSession = useCallback(async () => {
    if (!session) return;
    try {
      await archiveSession(session.id);
      // Navigate back after archiving
      onBack();
    } catch (error) {
      console.error('Error archiving session:', error);
    }
  }, [archiveSession, session, onBack]);

  // Handle export
  const handleExportClick = useCallback(() => {
    if (session) {
      setShowExportDialog(true);
    }
  }, [session]);

  // Format session date
  const formatSessionDate = useCallback((date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, []);

  // Loading state
  if (loading && !session) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // Session not found
  if (!session) {
    return (
      <div className="flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 p-6">
            <h3 className="font-semibold">Session Not Found</h3>
            <p className="text-muted-foreground text-sm">
              The requested session could not be found.
            </p>
            <Button onClick={onBack} variant="outline">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sessionDuration = getSessionDuration(session);

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div>
          <h2 className="font-semibold text-xl">Session Details</h2>
          <p className="text-muted-foreground text-sm">{formatSessionDate(session.startTime)}</p>
        </div>
      </div>

      {/* Session Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Session Information</span>
            <div className="flex items-center gap-2">
              {isActiveSession && (
                <Badge variant="secondary" className="text-xs">
                  Active
                </Badge>
              )}
              {session.archived && (
                <Badge variant="outline" className="text-xs">
                  <Archive className="mr-1 h-3 w-3" />
                  Archived
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Session Statistics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="font-medium text-muted-foreground text-sm">Session Duration</p>
              <p className="font-mono text-lg">{formatDuration(sessionDuration)}</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-muted-foreground text-sm">Run Count</p>
              <p className="font-semibold text-lg">{session.runCount}</p>
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

          {/* Session Times */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="font-medium text-muted-foreground text-sm">Start Time</p>
              <p className="font-mono text-sm">
                {session.startTime.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </p>
            </div>
            {session.endTime && (
              <div className="space-y-1">
                <p className="font-medium text-muted-foreground text-sm">End Time</p>
                <p className="font-mono text-sm">
                  {session.endTime.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </p>
              </div>
            )}
          </div>

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
                disabled={session.archived}
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
            {!session.archived && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleArchiveSession}
                disabled={loading}
                className="flex-1"
              >
                <Archive className="mr-2 h-4 w-4" />
                Archive Session
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportClick}
              disabled={loading || session.runCount === 0}
              title={session.runCount === 0 ? 'No runs to export' : 'Export session data'}
              className="flex-1"
            >
              <FileDown className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Session Controls (only for active session) */}
      {isActiveSession && <SessionControls />}

      {/* Runs List */}
      <RunList runs={sessionRuns} />

      {/* Export Dialog */}
      <ExportDialog
        sessionId={sessionId}
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
      />
    </div>
  );
}
