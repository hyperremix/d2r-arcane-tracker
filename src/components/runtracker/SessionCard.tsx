import type { Session } from 'electron/types/grail';
import { FileDownIcon } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { translations } from '@/i18n/translations';
import { formatDuration } from '@/lib/utils';
import { useRunTrackerStore } from '@/stores/runTrackerStore';
import { ExportDialog } from './ExportDialog';

interface SessionCardProps {
  session: Session | null;
}

/**
 * SessionCard component that displays active session information including session time,
 * run count, items found, efficiency percentage, and provides controls to end or archive the session.
 */
export function SessionCard({ session }: SessionCardProps) {
  const { t } = useTranslation();
  const {
    activeSession,
    activeRun,
    loading,
    endSession,
    archiveSession,
    updateSessionNotes,
    getSessionStats,
    startSession,
    runs,
  } = useRunTrackerStore();

  const [sessionTime, setSessionTime] = useState<number>(0);
  const [runDuration, setRunDuration] = useState<number>(0);
  const [notes, setNotes] = useState<string>(session?.notes || '');
  const [isSavingNotes, setIsSavingNotes] = useState<boolean>(false);
  const [showExportDialog, setShowExportDialog] = useState<boolean>(false);
  const notesId = useId();

  // Calculate current session time
  const currentSession = activeSession || session;
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs is needed to trigger recalculation when run data changes
  const sessionStats = useMemo(() => {
    if (!currentSession) return null;
    return getSessionStats(currentSession.id);
  }, [currentSession?.id, runs, getSessionStats]);

  // Real-time timer updates
  useEffect(() => {
    if (!currentSession || !currentSession.startTime) {
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

  // Real-time run duration updates
  useEffect(() => {
    if (!activeRun) {
      setRunDuration(0);
      return;
    }

    const updateRunTimer = () => {
      const now = Date.now();
      const elapsed = now - activeRun.startTime.getTime();
      setRunDuration(elapsed);
    };

    // Update immediately
    updateRunTimer();

    // Set up interval for updates
    const interval = setInterval(updateRunTimer, 1000);

    return () => clearInterval(interval);
  }, [activeRun]);

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

  const handleExportClick = useCallback(() => {
    if (currentSession) {
      setShowExportDialog(true);
    }
  }, [currentSession]);

  // Empty state
  if (!currentSession) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t(translations.runTracker.sessionCard.title)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="mb-4 text-muted-foreground">
              {t(translations.runTracker.sessionCard.noActiveSession)}
            </p>
            <p className="text-muted-foreground text-sm">
              {t(translations.runTracker.sessionCard.startSessionPrompt)}
            </p>
          </div>
          <Button
            onClick={async () => {
              try {
                await startSession();
              } catch (error) {
                console.error('[RunTracker] Failed to start session:', error);
              }
            }}
            className="w-full"
          >
            {t(translations.runTracker.sessionCard.startNewSession)}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const sessionCard = (
    <Card className="transition-all duration-300 ease-in-out hover:shadow-md">
      <CardHeader>
        <CardTitle>
          <span className="transition-colors duration-200">
            {t(translations.runTracker.sessionCard.activeSession)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 transition-all duration-300">
        {/* Session Statistics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="font-medium text-muted-foreground text-sm">
              {t(translations.runTracker.sessionCard.sessionTime)}
            </p>
            <p className="font-mono text-lg">{formatDuration(sessionTime)}</p>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-muted-foreground text-sm">
              {t(translations.runTracker.sessionCard.runCount)}
            </p>
            <p className="font-semibold text-lg">{currentSession.runCount}</p>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-muted-foreground text-sm">
              {t(translations.runTracker.sessionCard.averageRunTime)}
            </p>
            <p className="font-mono text-lg">{formatDuration(averageRunTime)}</p>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-muted-foreground text-sm">
              {t(translations.runTracker.sessionCard.currentRun)}
            </p>
            <p className="font-mono text-lg">{activeRun ? formatDuration(runDuration) : '0s'}</p>
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
          <div className="space-y-1">
            <p className="font-medium text-muted-foreground text-sm">
              {t(translations.runTracker.sessionCard.itemsFound)}
            </p>
            <p className="font-semibold text-lg">{sessionStats.itemsFound}</p>
          </div>
        )}

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
            {t(translations.runTracker.sessionCard.endSession)}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleArchiveSession}
            disabled={loading}
            className="flex-1"
          >
            {t(translations.runTracker.sessionCard.archiveSession)}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportClick}
            disabled={loading || currentSession.runCount === 0}
            title={
              currentSession.runCount === 0
                ? t(translations.runTracker.sessionCard.noRunsToExport)
                : t(translations.runTracker.sessionCard.exportSessionData)
            }
          >
            <FileDownIcon className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <>
      {sessionCard}
      <ExportDialog
        sessionId={currentSession?.id || ''}
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
      />
    </>
  );
}
