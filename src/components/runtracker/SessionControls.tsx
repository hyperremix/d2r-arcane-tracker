import { Loader2, Pause, Play, Plus, Square, StopCircle, Timer } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { matchesShortcut } from '@/lib/hotkeys';
import { useGrailStore } from '@/stores/grailStore';
import { useRunTrackerStore } from '@/stores/runTrackerStore';

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

// Control buttons component to reduce complexity
interface ControlButtonsProps {
  shortcuts: {
    startRun: string;
    pauseRun: string;
    endRun: string;
    endSession: string;
  };
  canStartRun: boolean;
  canPauseResume: boolean;
  canEndRun: boolean;
  canEndSession: boolean;
  isPaused: boolean;
  loading: boolean;
  onStartRun: () => void;
  onPauseRun: () => void;
  onResumeRun: () => void;
  onEndRun: () => void;
  onEndSession: () => void;
}

function ControlButtons({
  shortcuts,
  canStartRun,
  canPauseResume,
  canEndRun,
  canEndSession,
  isPaused,
  loading,
  onStartRun,
  onPauseRun,
  onResumeRun,
  onEndRun,
  onEndSession,
}: ControlButtonsProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {/* Start Run Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="default"
              size="sm"
              onClick={onStartRun}
              disabled={!canStartRun || loading}
              className="flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Start Run
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Start a new run ({shortcuts.startRun})</p>
          </TooltipContent>
        </Tooltip>

        {/* Pause/Resume Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={isPaused ? onResumeRun : onPauseRun}
              disabled={!canPauseResume || loading}
              className="flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isPaused ? (
                <Play className="h-4 w-4" />
              ) : (
                <Pause className="h-4 w-4" />
              )}
              {isPaused ? 'Resume' : 'Pause'}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {isPaused
                ? `Resume run (${shortcuts.pauseRun})`
                : `Pause run (${shortcuts.pauseRun})`}
            </p>
          </TooltipContent>
        </Tooltip>

        {/* End Run Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onEndRun}
              disabled={!canEndRun || loading}
              className="flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              End Run
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>End current run ({shortcuts.endRun})</p>
          </TooltipContent>
        </Tooltip>

        {/* End Session Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              onClick={onEndSession}
              disabled={!canEndSession || loading}
              className="flex items-center gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <StopCircle className="h-4 w-4" />
              )}
              End Session
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>End current session ({shortcuts.endSession})</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Keyboard Shortcuts Info */}
      <div className="rounded-md bg-muted p-3">
        <p className="text-muted-foreground text-xs">
          <strong>Keyboard Shortcuts:</strong> {shortcuts.startRun} (Start), {shortcuts.pauseRun}{' '}
          (Pause/Resume),
          {shortcuts.endRun} (End Run), {shortcuts.endSession} (End Session)
        </p>
      </div>
    </div>
  );
}

/**
 * SessionControls component that provides controls for managing run tracking.
 * Includes buttons for start, pause, resume, end run, and end session with keyboard shortcuts.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Component handles multiple control states, keyboard shortcuts, and dialogs which requires complexity
export function SessionControls() {
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

  const autoModeEnabled = settings.runTrackerMemoryReading ?? false;
  const isWindows = window.electronAPI?.platform === 'win32';

  const [showEndRunDialog, setShowEndRunDialog] = useState(false);
  const [showEndSessionDialog, setShowEndSessionDialog] = useState(false);
  const [manualItemName, setManualItemName] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const manualItemNameId = useId();

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

  const handleAddManualItem = useCallback(async () => {
    if (!manualItemName.trim()) {
      return;
    }

    setAddingItem(true);
    try {
      await addManualRunItem(manualItemName.trim());
      setManualItemName('');
    } catch (error) {
      console.error('Failed to add manual item:', error);
    } finally {
      setAddingItem(false);
    }
  }, [manualItemName, addManualRunItem]);

  const handleManualItemKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter' && !addingItem && manualItemName.trim()) {
        handleAddManualItem();
      }
    },
    [addingItem, manualItemName, handleAddManualItem],
  );

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
            Session Controls
            {isTracking && (
              <div className="flex items-center gap-1">
                <div
                  className={`h-2 w-2 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-green-500'}`}
                />
                <span className="text-muted-foreground text-sm">
                  {isPaused ? 'Paused' : 'Running'}
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
                  <span className="font-medium text-sm">Auto Mode</span>
                  <span className="text-muted-foreground text-xs">(Memory Reading)</span>
                </div>
                <Switch checked={autoModeEnabled} onCheckedChange={toggleAutoMode} />
              </div>
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
            <div className="flex flex-col gap-2">
              <label
                htmlFor={manualItemNameId}
                className="font-medium text-muted-foreground text-sm"
              >
                Add Item Manually
              </label>
              <div className="flex gap-2">
                <Input
                  id={manualItemNameId}
                  type="text"
                  placeholder={hasRuns ? 'Enter item name...' : 'Start a run first'}
                  value={manualItemName}
                  onChange={(e) => setManualItemName(e.target.value)}
                  onKeyDown={handleManualItemKeyDown}
                  disabled={addingItem || loading || !hasRuns}
                  className="flex-1"
                />
                <Button
                  onClick={handleAddManualItem}
                  disabled={!manualItemName.trim() || addingItem || loading || !hasRuns}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  {addingItem ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Add
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                {hasRuns
                  ? 'Items will be added to the current run, or the latest finished run if no run is active.'
                  : 'Start a run to add items manually.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* End Run Confirmation Dialog */}
      <AlertDialog open={showEndRunDialog} onOpenChange={setShowEndRunDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End Current Run</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to end the current run? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEndRun}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700"
            >
              {loading ? 'Ending...' : 'End Run'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* End Session Confirmation Dialog */}
      <AlertDialog open={showEndSessionDialog} onOpenChange={setShowEndSessionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End Current Session</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to end the current session? This will end any active run and
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEndSession}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700"
            >
              {loading ? 'Ending...' : 'End Session'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
