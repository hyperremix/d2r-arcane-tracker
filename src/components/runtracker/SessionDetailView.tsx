import type { Session } from 'electron/types/grail';
import { Archive, ArrowLeft, FileDown, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { translations } from '@/i18n/translations';
import { formatDuration, formatSessionDate } from '@/lib/utils';
import { useRunTrackerStore, useSessionStats } from '@/stores/runTrackerStore';
import { ArchiveSessionDialog } from './ArchiveSessionDialog';
import { ExportDialog } from './ExportDialog';
import { RunList } from './RunList';
import { SessionControls } from './SessionControls';

interface SessionDetailViewProps {
  sessionId: string;
  onBack: () => void;
}

const TIME_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
};

/**
 * SessionDetailView component that displays detailed information about a specific session
 * including session stats, notes, controls (if active), and the list of runs.
 */
export function SessionDetailView({ sessionId, onBack }: SessionDetailViewProps) {
  const { t, i18n } = useTranslation();
  const {
    sessions,
    activeSession,
    runs,
    sessionsLoading,
    pendingActions,
    archiveSession,
    updateSessionNotes,
    loadSessionRuns,
  } = useRunTrackerStore();

  const [notes, setNotes] = useState<string>('');
  const [isSavingNotes, setIsSavingNotes] = useState<boolean>(false);
  const [showExportDialog, setShowExportDialog] = useState<boolean>(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState<boolean>(false);
  const notesId = useId();
  const isArchiving = Boolean(pendingActions.archiveSession);

  // Find the session; prefer the live active session since the sessions list entry can be a stale snapshot
  const session = useMemo(() => {
    return (
      (activeSession?.id === sessionId ? activeSession : undefined) ||
      sessions.find((s) => s.id === sessionId)
    );
  }, [sessions, sessionId, activeSession]);

  // Check if this is the active session
  const isActiveSession = useMemo(() => {
    return activeSession?.id === sessionId;
  }, [activeSession?.id, sessionId]);

  const sessionStats = useSessionStats(session);

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
  }, [sessionId, loadSessionRuns, runs]);

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
      setShowArchiveDialog(false);
      // Navigate back after archiving
      onBack();
    } catch (error) {
      console.error('Error archiving session:', error);
      setShowArchiveDialog(false);
    }
  }, [archiveSession, session, onBack]);

  // Handle export
  const handleExportClick = useCallback(() => {
    if (session) {
      setShowExportDialog(true);
    }
  }, [session]);

  // Format session date (using Day.js from utils)
  const formatSessionDateCallback = useCallback(
    (date: Date) => {
      return formatSessionDate(date);
    },
    // formatSessionDate is a pure function, no dependencies needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Loading state
  if (sessionsLoading && !session) {
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
            <h3 className="font-semibold">
              {t(translations.runTracker.sessionDetail.sessionNotFound)}
            </h3>
            <p className="text-muted-foreground text-sm">
              {t(translations.runTracker.sessionDetail.sessionNotFoundDescription)}
            </p>
            <Button onClick={onBack} variant="outline">
              {t(translations.runTracker.sessionDetail.goBack)}
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
          {t(translations.runTracker.sessionDetail.back)}
        </Button>
        <div>
          <h2 className="font-semibold text-xl">
            {t(translations.runTracker.sessionDetail.title)}
          </h2>
          <p className="text-muted-foreground text-sm">
            {formatSessionDateCallback(session.startTime)}
          </p>
        </div>
      </div>

      {/* Session Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{t(translations.runTracker.sessionDetail.sessionInformation)}</span>
            <div className="flex items-center gap-2">
              {isActiveSession && (
                <Badge variant="secondary" className="text-xs">
                  {t(translations.runTracker.sessionDetail.active)}
                </Badge>
              )}
              {session.archived && (
                <Badge variant="outline" className="text-xs">
                  <Archive className="mr-1 h-3 w-3" />
                  {t(translations.runTracker.sessionDetail.archived)}
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Session Statistics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="font-medium text-muted-foreground text-sm">
                {t(translations.runTracker.sessionDetail.sessionDuration)}
              </p>
              <p className="font-mono text-lg">{formatDuration(sessionDuration)}</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-muted-foreground text-sm">
                {t(translations.runTracker.sessionCard.runCount)}
              </p>
              <p className="font-semibold text-lg">{session.runCount}</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-muted-foreground text-sm">
                {t(translations.runTracker.sessionCard.averageRunTime)}
              </p>
              <p className="font-mono text-lg">{formatDuration(averageRunTime)}</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-muted-foreground text-sm">
                {t(translations.runTracker.sessionCard.fastestRun)}
              </p>
              <p className="font-mono text-lg">{formatDuration(sessionStats?.fastestRun || 0)}</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-muted-foreground text-sm">
                {t(translations.runTracker.sessionCard.efficiency)}
              </p>
              <p className="font-semibold text-lg">{efficiencyPercentage.toFixed(1)}%</p>
            </div>
          </div>

          {/* Items Found */}
          {sessionStats && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="font-medium text-muted-foreground text-sm">
                  {t(translations.runTracker.sessionCard.itemsFound)}
                </p>
                <p className="font-semibold text-lg">{sessionStats.itemsFound}</p>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-muted-foreground text-sm">
                  {t(translations.runTracker.sessionCard.newGrailItems)}
                </p>
                <p className="font-semibold text-lg">{sessionStats.newGrailItems}</p>
              </div>
            </div>
          )}

          {/* Session Times */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="font-medium text-muted-foreground text-sm">
                {t(translations.runTracker.table.startTime)}
              </p>
              <p className="font-mono text-sm">
                {session.startTime.toLocaleTimeString(i18n.language, TIME_FORMAT_OPTIONS)}
              </p>
            </div>
            {session.endTime && (
              <div className="space-y-1">
                <p className="font-medium text-muted-foreground text-sm">
                  {t(translations.runTracker.table.endTime)}
                </p>
                <p className="font-mono text-sm">
                  {session.endTime.toLocaleTimeString(i18n.language, TIME_FORMAT_OPTIONS)}
                </p>
              </div>
            )}
          </div>

          {/* Notes Editor */}
          <div className="space-y-2">
            <label htmlFor={notesId} className="font-medium text-muted-foreground text-sm">
              {t(translations.runTracker.sessionCard.sessionNotes)}
            </label>
            <div className="relative">
              <Textarea
                id={notesId}
                placeholder={t(translations.runTracker.sessionCard.notesPlaceholder)}
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
                onClick={() => setShowArchiveDialog(true)}
                disabled={isArchiving}
                aria-busy={isArchiving}
                className="flex-1"
              >
                {isArchiving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Archive className="mr-2 h-4 w-4" />
                )}
                {t(translations.runTracker.sessionCard.archiveSession)}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportClick}
              disabled={session.runCount === 0}
              title={
                session.runCount === 0
                  ? t(translations.runTracker.sessionCard.noRunsToExport)
                  : t(translations.runTracker.sessionCard.exportSessionData)
              }
              className="flex-1"
            >
              <FileDown className="mr-2 h-4 w-4" />
              {t(translations.runTracker.sessionDetail.export)}
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

      {/* Archive Confirmation Dialog */}
      <ArchiveSessionDialog
        open={showArchiveDialog}
        onOpenChange={setShowArchiveDialog}
        onConfirm={handleArchiveSession}
        pending={isArchiving}
      />
    </div>
  );
}
