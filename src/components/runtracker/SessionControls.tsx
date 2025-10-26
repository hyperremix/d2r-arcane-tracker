import { Loader2, Pause, Play, Square, StopCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useGrailStore } from '@/stores/grailStore';
import { useRunTrackerStore } from '@/stores/runTrackerStore';
import { RunTypeSelector } from './RunTypeSelector';

// Helper function to parse keyboard shortcut string
const parseShortcut = (shortcut: string) => {
  const parts = shortcut
    .toLowerCase()
    .split('+')
    .map((s) => s.trim());
  let key = parts.find((p) => !['ctrl', 'cmd', 'shift'].includes(p)) || '';

  // Handle special key names
  if (key === 'space') {
    key = ' ';
  }

  return {
    ctrl: parts.includes('ctrl') || parts.includes('cmd'),
    shift: parts.includes('shift'),
    key,
  };
};

// Helper function to check if event matches shortcut
// Used in SessionControls component
const _matchesShortcut = (event: KeyboardEvent, shortcut: string) => {
  const parsed = parseShortcut(shortcut);
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const ctrlKey = isMac ? event.metaKey : event.ctrlKey;

  return (
    ctrlKey === parsed.ctrl &&
    event.shiftKey === parsed.shift &&
    event.key.toLowerCase() === parsed.key
  );
};

// Helper function to check if user is typing in input fields
// Used in SessionControls component
const _isTypingInInput = (target: EventTarget | null) => {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
};

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
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
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
            {isPaused ? `Resume run (${shortcuts.pauseRun})` : `Pause run (${shortcuts.pauseRun})`}
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
  );
}

/**
 * SessionControls component that provides controls for managing run tracking.
 * Includes buttons for start, pause, resume, end run, and end session with keyboard shortcuts.
 */
export function SessionControls() {
  const {
    activeSession,
    activeRun,
    isTracking,
    isPaused,
    loading,
    startRun,
    endRun,
    pauseRun,
    resumeRun,
    endSession,
  } = useRunTrackerStore();

  const { settings } = useGrailStore();
  const shortcuts = settings.runTrackerShortcuts ?? {
    startRun: 'Ctrl+R',
    pauseRun: 'Ctrl+Space',
    endRun: 'Ctrl+E',
    endSession: 'Ctrl+Shift+E',
  };

  const [showEndRunDialog, setShowEndRunDialog] = useState(false);
  const [showEndSessionDialog, setShowEndSessionDialog] = useState(false);

  // Button click handlers
  const handleStartRun = useCallback(async () => {
    if (!activeSession?.characterId) return;
    try {
      await startRun(activeSession.characterId);
    } catch (error) {
      console.error('Failed to start run:', error);
    }
  }, [activeSession, startRun]);

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
      if (_matchesShortcut(event, shortcuts.startRun)) {
        handleStartRunShortcut(event);
        return;
      }

      if (_matchesShortcut(event, shortcuts.pauseRun)) {
        handlePauseResumeShortcut(event);
        return;
      }

      if (_matchesShortcut(event, shortcuts.endRun)) {
        handleEndRunShortcut(event);
        return;
      }

      if (_matchesShortcut(event, shortcuts.endSession)) {
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
  const canStartRun = Boolean(activeSession && !activeRun && !loading);
  const canPauseResume = Boolean(activeRun && !loading);
  const canEndRun = Boolean(activeRun && !loading);
  const canEndSession = Boolean(activeSession && !loading);

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
          <div className="flex flex-col gap-4">
            {/* Run Type Selector - only show when there's an active run */}
            {activeRun && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">Run Type:</span>
                <RunTypeSelector />
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

            {/* Keyboard Shortcuts Info */}
            <div className="mt-4 rounded-md bg-muted p-3">
              <p className="text-muted-foreground text-xs">
                <strong>Keyboard Shortcuts:</strong> {shortcuts.startRun} (Start),{' '}
                {shortcuts.pauseRun} (Pause/Resume),
                {shortcuts.endRun} (End Run), {shortcuts.endSession} (End Session)
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
