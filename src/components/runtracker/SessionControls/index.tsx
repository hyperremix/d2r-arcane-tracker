import { AlertTriangle, Loader2, Timer } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useNow } from '@/hooks/useNow';
import { translations } from '@/i18n/translations';
import { matchesShortcut } from '@/lib/hotkeys';
import { useGrailStore } from '@/stores/grailStore';
import type { RunTrackerAction } from '@/stores/runTrackerStore';
import { useRunTrackerStore } from '@/stores/runTrackerStore';
import { getLiveSessionState } from '../liveSession';
import { SessionStateBadge } from '../SessionStateBadge';
import type { ControlButtonsPending } from './ControlButtons';
import { ControlButtons, ShortcutsInfo } from './ControlButtons';
import { LiveRunTimer } from './LiveRunTimer';
import { ManualItemEntry } from './ManualItemEntry';

// Helper function to check if user is typing in input fields
// Used in SessionControls component
const _isTypingInInput = (target: EventTarget | null) => {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
};

// Helper function to check if there are any runs in a session
function _hasRunsInSession(
  activeSession: { id: string } | null,
  activeRun: { id: string } | null,
  runs: Map<string, unknown[]>,
): boolean {
  if (!activeSession) {
    return false;
  }
  // Check if there's an active run
  if (activeRun) {
    return true;
  }
  // Check if there are any runs in the session
  const sessionRuns = runs.get(activeSession.id);
  return sessionRuns !== undefined && sessionRuns.length > 0;
}

interface PendingLabelProps {
  pending: boolean;
  label: string;
  pendingLabel: string;
}

// Confirm button content that swaps to a spinner and pending label while the action is in flight
function PendingLabel({ pending, label, pendingLabel }: PendingLabelProps) {
  if (!pending) {
    return <>{label}</>;
  }
  return (
    <>
      <Loader2 className="h-4 w-4 animate-spin" />
      {pendingLabel}
    </>
  );
}

// Helper function to map store action pending flags to the control buttons
function _getControlsPending(
  pendingActions: Partial<Record<RunTrackerAction, boolean>>,
): ControlButtonsPending {
  return {
    startSession: Boolean(pendingActions.startSession),
    startRun: Boolean(pendingActions.startRun),
    pauseResume: Boolean(pendingActions.pauseRun || pendingActions.resumeRun),
    endRun: Boolean(pendingActions.endRun),
    endSession: Boolean(pendingActions.endSession),
  };
}

/**
 * SessionControls component that renders the live session area: a large current-run timer,
 * a session state badge and the state-dependent run actions (with keyboard shortcuts),
 * plus auto mode and manual item entry.
 */
export function SessionControls() {
  const { t } = useTranslation();
  const {
    activeSession,
    activeRun,
    isPaused,
    pendingActions,
    runs,
    startRun,
    endRun,
    pauseRun,
    resumeRun,
    endSession,
    startSession,
    addManualRunItem,
  } = useRunTrackerStore();

  const { settings, setSettings } = useGrailStore();
  const shortcuts = settings.runTrackerShortcuts ?? {
    startRun: 'Ctrl+R',
    pauseRun: 'Ctrl+Space',
    endRun: 'Ctrl+E',
    endSession: 'Ctrl+Shift+E',
  };

  const isWindows = window.electronAPI?.platform === 'win32';
  const autoModeEnabled = (settings.runTrackerMemoryReading ?? false) && isWindows;

  const [showEndRunDialog, setShowEndRunDialog] = useState(false);
  const [showEndSessionDialog, setShowEndSessionDialog] = useState(false);
  const [memoryStatus, setMemoryStatus] = useState<{
    available: boolean;
    reason: string | null;
  } | null>(null);

  // Fetch memory status on mount
  useEffect(() => {
    if (isWindows) {
      window.electronAPI?.runTracker?.getMemoryStatus?.().then(setMemoryStatus);
    }
  }, [isWindows]);

  const toggleAutoMode = useCallback(
    async (checked: boolean) => {
      await setSettings({ runTrackerMemoryReading: checked });
    },
    [setSettings],
  );

  // Button click handlers
  const handleStartSession = useCallback(async () => {
    try {
      await startSession();
    } catch (error) {
      console.error('Failed to start session:', error);
    }
  }, [startSession]);

  const handleStartRun = useCallback(async () => {
    try {
      // Manual run start - no character association
      await startRun();
    } catch (error) {
      console.error('Failed to start run:', error);
    }
  }, [startRun]);

  const handlePauseRun = useCallback(async () => {
    try {
      await pauseRun();
    } catch (error) {
      console.error('Failed to pause run:', error);
    }
  }, [pauseRun]);

  const handleResumeRun = useCallback(async () => {
    try {
      await resumeRun();
    } catch (error) {
      console.error('Failed to resume run:', error);
    }
  }, [resumeRun]);

  const handleEndRun = useCallback(async () => {
    try {
      await endRun();
      setShowEndRunDialog(false);
    } catch (error) {
      console.error('Failed to end run:', error);
    }
  }, [endRun]);

  const handleEndSession = useCallback(async () => {
    try {
      await endSession();
      setShowEndSessionDialog(false);
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  }, [endSession]);

  // Per-action pending state: only the in-flight action shows a spinner,
  // but all run controls are locked while any of them is in flight.
  const pending = _getControlsPending(pendingActions);
  const controlsBusy = Object.values(pending).some(Boolean);

  // Check if there are any runs in the session (active run or finished runs)
  const hasRuns = useMemo(
    () => _hasRunsInSession(activeSession, activeRun, runs),
    [activeSession, activeRun, runs],
  );

  // Keyboard shortcut handlers
  const handleStartRunShortcut = useCallback(
    (event: KeyboardEvent) => {
      event.preventDefault();
      if (activeSession && !activeRun && !controlsBusy) {
        handleStartRun();
      }
    },
    [activeSession, activeRun, controlsBusy, handleStartRun],
  );

  const handlePauseResumeShortcut = useCallback(
    (event: KeyboardEvent) => {
      event.preventDefault();
      if (activeRun && !controlsBusy) {
        if (isPaused) {
          handleResumeRun();
        } else {
          handlePauseRun();
        }
      }
    },
    [activeRun, isPaused, controlsBusy, handlePauseRun, handleResumeRun],
  );

  const handleEndRunShortcut = useCallback(
    (event: KeyboardEvent) => {
      event.preventDefault();
      if (activeRun && !controlsBusy) {
        setShowEndRunDialog(true);
      }
    },
    [activeRun, controlsBusy],
  );

  const handleEndSessionShortcut = useCallback(
    (event: KeyboardEvent) => {
      event.preventDefault();
      if (activeSession && !controlsBusy) {
        setShowEndSessionDialog(true);
      }
    },
    [activeSession, controlsBusy],
  );

  // Keyboard shortcuts handler
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (_isTypingInInput(event.target)) {
        return;
      }

      // Check each configurable shortcut
      if (matchesShortcut(event, shortcuts.startRun)) {
        handleStartRunShortcut(event);
        return;
      }

      if (matchesShortcut(event, shortcuts.pauseRun)) {
        handlePauseResumeShortcut(event);
        return;
      }

      if (matchesShortcut(event, shortcuts.endRun)) {
        handleEndRunShortcut(event);
        return;
      }

      if (matchesShortcut(event, shortcuts.endSession)) {
        handleEndSessionShortcut(event);
      }
    },
    [
      shortcuts,
      handleStartRunShortcut,
      handlePauseResumeShortcut,
      handleEndRunShortcut,
      handleEndSessionShortcut,
    ],
  );

  // Set up keyboard event listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Runs are only tracked automatically while memory reading is not known to be unavailable;
  // otherwise the manual run controls stay usable so the user is not left without a way to track runs
  const autoTrackingActive = autoModeEnabled && memoryStatus?.available !== false;

  // Determine button states
  const canStartRun = Boolean(activeSession && !activeRun && !controlsBusy && !autoTrackingActive);
  const canPauseResume = Boolean(activeRun && !controlsBusy && !autoTrackingActive);
  const canEndRun = Boolean(activeRun && !controlsBusy && !autoTrackingActive);
  // End Session stays available in auto mode so tracked sessions can still be stopped by mouse
  const canEndSession = Boolean(activeSession && !controlsBusy);
  const canStartSession = Boolean(!activeSession && !controlsBusy);

  // Live current-run timer; only ticks while a run is in progress
  const now = useNow(Boolean(activeRun));
  const runElapsed = activeRun ? Math.max(0, now - activeRun.startTime.getTime()) : undefined;
  const liveState = getLiveSessionState({
    hasSession: Boolean(activeSession),
    hasActiveRun: Boolean(activeRun),
    isPaused,
  });
  // Only warn about unavailable memory reading when the user actually relies on auto mode
  const showAutoModeUnavailable = Boolean(
    autoModeEnabled && activeSession && memoryStatus && !memoryStatus.available,
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t(translations.runTracker.controls.liveSession)}</CardTitle>
          <CardAction>
            <SessionStateBadge state={liveState} />
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-6">
            {/* Live top row: current run timer and the state-dependent actions */}
            <div className="flex flex-wrap items-end justify-between gap-4">
              <LiveRunTimer elapsedMs={runElapsed} runNumber={activeRun?.runNumber} />
              <ControlButtons
                shortcuts={shortcuts}
                hasSession={Boolean(activeSession)}
                hasActiveRun={Boolean(activeRun)}
                autoModeEnabled={autoTrackingActive}
                canStartSession={canStartSession}
                canStartRun={canStartRun}
                canPauseResume={canPauseResume}
                canEndRun={canEndRun}
                canEndSession={canEndSession}
                isPaused={isPaused}
                pending={pending}
                onStartSession={handleStartSession}
                onStartRun={handleStartRun}
                onPauseRun={handlePauseRun}
                onResumeRun={handleResumeRun}
                onEndRun={() => setShowEndRunDialog(true)}
                onEndSession={() => setShowEndSessionDialog(true)}
              />
            </div>

            {!activeSession && (
              <p className="text-muted-foreground text-sm">
                {t(translations.runTracker.sessionCard.startSessionPrompt)}
              </p>
            )}

            {/* Auto Mode Toggle - Windows only */}
            {isWindows && activeSession && (
              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4" />
                  <span className="font-medium text-sm">
                    {t(translations.runTracker.controls.autoMode)}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {t(translations.runTracker.controls.memoryReading)}
                  </span>
                </div>
                <Switch checked={autoModeEnabled} onCheckedChange={toggleAutoMode} />
              </div>
            )}

            {/* Warning when auto mode is on but memory reading is unavailable */}
            {showAutoModeUnavailable && (
              <Alert variant="warning" live="polite">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                <AlertDescription className="text-xs">
                  <strong>{t(translations.settings.runTracker.autoModeUnavailable)}</strong>{' '}
                  {t(translations.settings.runTracker.autoModeUnavailableDescription)}
                </AlertDescription>
              </Alert>
            )}

            {/* Manual Item Entry */}
            {activeSession && (
              <ManualItemEntry
                hasRuns={hasRuns}
                loading={Boolean(pendingActions.addManualRunItem)}
                addManualRunItem={addManualRunItem}
              />
            )}

            <ShortcutsInfo shortcuts={shortcuts} />
          </div>
        </CardContent>
      </Card>

      {/* End Run Confirmation Dialog */}
      <AlertDialog open={showEndRunDialog} onOpenChange={setShowEndRunDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(translations.runTracker.controls.endCurrentRunTitle)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(translations.runTracker.controls.endCurrentRunDescription)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending.endRun}>
              {t(translations.common.cancel)}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleEndRun}
              disabled={pending.endRun}
            >
              <PendingLabel
                pending={pending.endRun}
                label={t(translations.runTracker.controls.endRun)}
                pendingLabel={t(translations.runTracker.controls.ending)}
              />
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* End Session Confirmation Dialog */}
      <AlertDialog open={showEndSessionDialog} onOpenChange={setShowEndSessionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(translations.runTracker.controls.endCurrentSessionTitle)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(translations.runTracker.controls.endCurrentSessionDescription)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending.endSession}>
              {t(translations.common.cancel)}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleEndSession}
              disabled={pending.endSession}
            >
              <PendingLabel
                pending={pending.endSession}
                label={t(translations.runTracker.controls.endSession)}
                pendingLabel={t(translations.runTracker.controls.ending)}
              />
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
