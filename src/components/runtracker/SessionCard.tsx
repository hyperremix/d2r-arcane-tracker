import type { Run, Session } from 'electron/types/grail';
import { MAX_SESSION_NOTES_LENGTH } from 'electron/utils/sessionNotes';
import { ChevronDown, FileDownIcon, Loader2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';
import { useNow } from '@/hooks/useNow';
import { translations } from '@/i18n/translations';
import { formatDuration } from '@/lib/utils';
import { useRunTrackerStore, useSessionStats } from '@/stores/runTrackerStore';
import { ArchiveSessionDialog } from './ArchiveSessionDialog';
import { ExportDialog } from './ExportDialog';
import { calculateLiveEfficiency } from './liveSession';
import { RecentRuns } from './RecentRuns';
import { useSessionNotes } from './useSessionNotes';

interface SessionCardProps {
  session: Session | null;
  /** Opens the full run history of the session. */
  onViewAllRuns?: () => void;
}

interface CompactStatProps {
  label: string;
  value: string;
}

// Single entry of the compact secondary statistics row
function CompactStat({ label, value }: CompactStatProps) {
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="truncate text-muted-foreground text-xs">{label}</dt>
      <dd className="font-mono text-sm tabular-nums">{value}</dd>
    </div>
  );
}

interface SessionStatsRowProps {
  session: Session;
  activeRun: Run | null;
}

// Compact row of the live session statistics
function SessionStatsRow({ session, activeRun }: SessionStatsRowProps) {
  const { t } = useTranslation();
  const sessionStats = useSessionStats(session);

  // Live clock for session time and efficiency while the session is running
  const isLive = !session.endTime;
  const now = useNow(isLive);
  const sessionEnd = session.endTime?.getTime() ?? now;
  const sessionElapsed = Math.max(0, sessionEnd - session.startTime.getTime());
  const currentRunElapsed =
    isLive && activeRun ? Math.max(0, now - activeRun.startTime.getTime()) : 0;
  const efficiencyPercentage = calculateLiveEfficiency({
    completedRunTime: session.totalRunTime,
    currentRunElapsed,
    sessionElapsed,
  });

  return (
    <dl className="grid grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-4 lg:grid-cols-7">
      <CompactStat
        label={t(translations.runTracker.sessionCard.sessionTime)}
        value={formatDuration(sessionElapsed)}
      />
      <CompactStat
        label={t(translations.runTracker.sessionCard.runCount)}
        value={String(session.runCount)}
      />
      <CompactStat
        label={t(translations.runTracker.sessionCard.averageRunTime)}
        value={formatDuration(sessionStats?.averageRunDuration ?? 0)}
      />
      <CompactStat
        label={t(translations.runTracker.sessionCard.fastestRun)}
        value={formatDuration(sessionStats?.fastestRun ?? 0)}
      />
      <CompactStat
        label={t(translations.runTracker.sessionCard.efficiency)}
        value={`${efficiencyPercentage.toFixed(1)}%`}
      />
      <CompactStat
        label={t(translations.runTracker.sessionCard.itemsFound)}
        value={String(sessionStats?.itemsFound ?? 0)}
      />
      <CompactStat
        label={t(translations.runTracker.sessionCard.newGrailItems)}
        value={String(sessionStats?.newGrailItems ?? 0)}
      />
    </dl>
  );
}

/**
 * SessionCard component that summarizes the active session: a compact row of live statistics,
 * the most recent runs with their loot, collapsible notes, and archive/export actions.
 * The live timer and run/session actions are rendered by SessionControls.
 * Renders nothing while no session is active; SessionControls offers starting one.
 */
export function SessionCard({ session, onViewAllRuns }: SessionCardProps) {
  const { t } = useTranslation();
  const { activeSession, activeRun, pendingActions, archiveSession, updateSessionNotes, runs } =
    useRunTrackerStore(
      useShallow((state) => ({
        activeSession: state.activeSession,
        activeRun: state.activeRun,
        pendingActions: state.pendingActions,
        archiveSession: state.archiveSession,
        updateSessionNotes: state.updateSessionNotes,
        runs: state.runs,
      })),
    );

  const [showExportDialog, setShowExportDialog] = useState<boolean>(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState<boolean>(false);
  const isArchiving = Boolean(pendingActions.archiveSession);

  const currentSession = activeSession || session;
  const { notes, isSavingNotes, handleNotesChange, handleNotesBlur } = useSessionNotes(
    currentSession,
    updateSessionNotes,
  );

  const sessionRuns = useMemo(
    () => (currentSession ? (runs.get(currentSession.id) ?? []) : []),
    [currentSession, runs],
  );

  // Button handlers
  const handleArchiveSession = useCallback(async () => {
    if (!currentSession) return;
    try {
      await archiveSession(currentSession.id);
    } catch (error) {
      console.error('Error archiving session:', error);
    } finally {
      setShowArchiveDialog(false);
    }
  }, [archiveSession, currentSession]);

  const handleExportClick = useCallback(() => {
    if (currentSession) {
      setShowExportDialog(true);
    }
  }, [currentSession]);

  // Starting a session is offered by SessionControls
  if (!currentSession) {
    return null;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t(translations.runTracker.sessionCard.activeSession)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <SessionStatsRow session={currentSession} activeRun={activeRun} />

          <RecentRuns runs={sessionRuns} onViewAllRuns={onViewAllRuns} />

          {/* Notes Editor (collapsed by default to keep the live view glanceable) */}
          <Collapsible>
            <CollapsibleTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  className="group -ml-2.5 gap-1 text-muted-foreground"
                />
              }
            >
              <ChevronDown
                className="h-4 w-4 transition-transform group-aria-expanded:rotate-180"
                aria-hidden="true"
              />
              {t(translations.runTracker.sessionCard.sessionNotes)}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="relative pt-2">
                <Textarea
                  aria-label={t(translations.runTracker.sessionCard.sessionNotes)}
                  placeholder={t(translations.runTracker.sessionCard.notesPlaceholder)}
                  value={notes}
                  onChange={handleNotesChange}
                  onBlur={handleNotesBlur}
                  maxLength={MAX_SESSION_NOTES_LENGTH}
                  className="min-h-[80px] resize-none"
                />
                {isSavingNotes && (
                  <div className="absolute top-4 right-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowArchiveDialog(true)}
              disabled={isArchiving}
              aria-busy={isArchiving}
              className="flex-1"
            >
              {isArchiving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t(translations.runTracker.sessionCard.archiveSession)}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportClick}
              disabled={currentSession.runCount === 0}
              title={
                currentSession.runCount === 0
                  ? t(translations.runTracker.sessionCard.noRunsToExport)
                  : t(translations.runTracker.sessionCard.exportSessionData)
              }
              aria-label={t(translations.runTracker.sessionCard.exportSessionData)}
            >
              <FileDownIcon className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </CardContent>
      </Card>
      <ExportDialog
        sessionId={currentSession.id}
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
      />
      <ArchiveSessionDialog
        open={showArchiveDialog}
        onOpenChange={setShowArchiveDialog}
        onConfirm={handleArchiveSession}
        pending={isArchiving}
      />
    </>
  );
}
