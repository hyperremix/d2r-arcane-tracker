import { AlertCircle, Timer } from 'lucide-react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { translations } from '@/i18n/translations';
import { matchesShortcut } from '@/lib/hotkeys';
import { useGrailStore } from '@/stores/grailStore';
import { useRunTrackerStore } from '@/stores/runTrackerStore';
import { ControlButtons } from './ControlButtons';
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

/**
 * SessionControls component that provides controls for managing run tracking.
 * Includes buttons for start, pause, resume, end run, and end session with keyboard shortcuts.
 */
export function SessionControls() {
  const { t } = useTranslation();
  const {
    activeSession,
    activeRun,
    isTracking,
    isPaused,
    loading,
    runs,
    startRun,
    endRun,
    pauseRun,
    resumeRun,
    endSession,
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

  // Check if there are any runs in the session (active run or finished runs)
  const hasRuns = useMemo(
    () => _hasRunsInSession(activeSession, activeRun, runs),
    [activeSession, activeRun, runs],
  );

  // Keyboard shortcut handlers
  const handleStartRunShortcut = useCallback(
    (event: KeyboardEvent) => {
      event.preventDefault();
      if (activeSession && !activeRun && !loading) {
        handleStartRun();
      }
    },
    [activeSession, activeRun, loading, handleStartRun],
  );

  const handlePauseResumeShortcut = useCallback(
    (event: KeyboardEvent) => {
      event.preventDefault();
      if (activeRun && !loading) {
        if (isPaused) {
          handleResumeRun();
        } else {
          handlePauseRun();
        }
      }
    },
    [activeRun, isPaused, loading, handlePauseRun, handleResumeRun],
  );

  const handleEndRunShortcut = useCallback(
    (event: KeyboardEvent) => {
      event.preventDefault();
      if (activeRun && !loading) {
        setShowEndRunDialog(true);
      }
    },
    [activeRun, loading],
  );

  const handleEndSessionShortcut = useCallback(
    (event: KeyboardEvent) => {
      event.preventDefault();
      if (activeSession && !loading) {
        setShowEndSessionDialog(true);
      }
    },
    [activeSession, loading],
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

  // Determine button states
  const canStartRun = Boolean(activeSession && !activeRun && !loading && !autoModeEnabled);
  const canPauseResume = Boolean(activeRun && !loading && !autoModeEnabled);
  const canEndRun = Boolean(activeRun && !loading && !autoModeEnabled);
  const canEndSession = Boolean(activeSession && !loading && !autoModeEnabled);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {t(translations.runTracker.controls.sessionControls)}
            {isTracking && (
              <div className="flex items-center gap-1">
                <div
                  className={`h-2 w-2 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-green-500'}`}
                />
                <span className="text-muted-foreground text-sm">
                  {isPaused
                    ? t(translations.runTracker.controls.paused)
                    : t(translations.runTracker.controls.running)}
                </span>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-8">
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

            {/* Warning when memory reading is unavailable */}
            {isWindows && memoryStatus && !memoryStatus.available && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>{t(translations.settings.runTracker.autoModeUnavailable)}</strong>{' '}
                  {t(translations.settings.runTracker.autoModeUnavailableDescription)}
                </AlertDescription>
              </Alert>
            )}

            <ControlButtons
              shortcuts={shortcuts}
              canStartRun={canStartRun}
              canPauseResume={canPauseResume}
              canEndRun={canEndRun}
              canEndSession={canEndSession}
              isPaused={isPaused}
              loading={loading}
              onStartRun={handleStartRun}
              onPauseRun={handlePauseRun}
              onResumeRun={handleResumeRun}
              onEndRun={() => setShowEndRunDialog(true)}
              onEndSession={() => setShowEndSessionDialog(true)}
            />

            {/* Manual Item Entry */}
            <ManualItemEntry
              hasRuns={hasRuns}
              loading={loading}
              addManualRunItem={addManualRunItem}
            />
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
            <AlertDialogCancel disabled={loading}>
              {t(translations.common.cancel)}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEndRun}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700"
            >
              {loading
                ? t(translations.runTracker.controls.ending)
                : t(translations.runTracker.controls.endRun)}
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
            <AlertDialogCancel disabled={loading}>
              {t(translations.common.cancel)}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEndSession}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700"
            >
              {loading
                ? t(translations.runTracker.controls.ending)
                : t(translations.runTracker.controls.endSession)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
