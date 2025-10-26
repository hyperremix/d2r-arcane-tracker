import { Pause, Play, Square, StopCircle } from 'lucide-react';
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
import { useRunTrackerStore } from '@/stores/runTrackerStore';

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

  // Helper function to check if user is typing in input fields
  const isTypingInInput = useCallback((target: EventTarget | null) => {
    return (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    );
  }, []);

  // Helper function to get the correct modifier key
  const getModifierKey = useCallback((event: KeyboardEvent) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    return isMac ? event.metaKey : event.ctrlKey;
  }, []);

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
      if (isTypingInInput(event.target)) {
        return;
      }

      const ctrlKey = getModifierKey(event);

      // Start Run: Ctrl+R (Cmd+R on Mac)
      if (ctrlKey && event.key.toLowerCase() === 'r') {
        handleStartRunShortcut(event);
        return;
      }

      // Pause/Resume Run: Ctrl+Space (Cmd+Space on Mac)
      if (ctrlKey && event.key === ' ') {
        handlePauseResumeShortcut(event);
        return;
      }

      // End Run: Ctrl+E (Cmd+E on Mac)
      if (ctrlKey && event.key.toLowerCase() === 'e' && !event.shiftKey) {
        handleEndRunShortcut(event);
        return;
      }

      // End Session: Ctrl+Shift+E (Cmd+Shift+E on Mac)
      if (ctrlKey && event.shiftKey && event.key.toLowerCase() === 'e') {
        handleEndSessionShortcut(event);
      }
    },
    [
      isTypingInInput,
      getModifierKey,
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
  const canStartRun = activeSession && !activeRun && !loading;
  const canPauseResume = activeRun && !loading;
  const canEndRun = activeRun && !loading;
  const canEndSession = activeSession && !loading;

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
          <div className="flex flex-wrap gap-2">
            {/* Start Run Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleStartRun}
                  disabled={!canStartRun}
                  className="flex items-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  Start Run
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Start a new run (Ctrl+R)</p>
              </TooltipContent>
            </Tooltip>

            {/* Pause/Resume Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={isPaused ? handleResumeRun : handlePauseRun}
                  disabled={!canPauseResume}
                  className="flex items-center gap-2"
                >
                  {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  {isPaused ? 'Resume' : 'Pause'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isPaused ? 'Resume run (Ctrl+Space)' : 'Pause run (Ctrl+Space)'}</p>
              </TooltipContent>
            </Tooltip>

            {/* End Run Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEndRunDialog(true)}
                  disabled={!canEndRun}
                  className="flex items-center gap-2"
                >
                  <Square className="h-4 w-4" />
                  End Run
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>End current run (Ctrl+E)</p>
              </TooltipContent>
            </Tooltip>

            {/* End Session Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowEndSessionDialog(true)}
                  disabled={!canEndSession}
                  className="flex items-center gap-2"
                >
                  <StopCircle className="h-4 w-4" />
                  End Session
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>End current session (Ctrl+Shift+E)</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Keyboard Shortcuts Info */}
          <div className="mt-4 rounded-md bg-muted p-3">
            <p className="text-muted-foreground text-xs">
              <strong>Keyboard Shortcuts:</strong> Ctrl+R (Start), Ctrl+Space (Pause/Resume), Ctrl+E
              (End Run), Ctrl+Shift+E (End Session)
            </p>
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
