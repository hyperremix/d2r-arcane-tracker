import type { Run, Session } from 'electron/types/grail';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useRunTrackerStore } from '@/stores/runTrackerStore';
import { RunList } from './RunList';
import { SessionCard } from './SessionCard';
import { SessionControls } from './SessionControls';

/**
 * RunTracker component that serves as the main entry point for the Run Counter tab.
 * Integrates SessionCard, RunList, and SessionControls components, handles loading
 * and error states, and provides the overall layout for run tracking functionality.
 */
export function RunTracker() {
  const {
    activeSession,
    runs,
    loading,
    error,
    loadSessions,
    loadSessionRuns,
    refreshActiveRun,
    handleSessionStarted,
    handleSessionEnded,
    handleRunStarted,
    handleRunEnded,
    handleRunPaused,
    handleRunResumed,
    setError,
  } = useRunTrackerStore();

  // Load initial data on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Load sessions first
        await loadSessions();

        // Load runs for active session if it exists
        if (activeSession?.id) {
          await loadSessionRuns(activeSession.id);
        }

        // Refresh active run state to sync with backend
        await refreshActiveRun();
      } catch (err) {
        console.error('[RunTracker] Error loading initial data:', err);
        setError(err instanceof Error ? err.message : String(err));
      }
    };

    loadInitialData();
  }, [loadSessions, loadSessionRuns, refreshActiveRun, activeSession?.id, setError]);

  // Set up IPC event listeners for real-time updates
  useEffect(() => {
    const handleSessionStartedEvent = (_event: Electron.IpcRendererEvent, session: Session) => {
      handleSessionStarted(session);
    };

    const handleSessionEndedEvent = (_event: Electron.IpcRendererEvent) => {
      handleSessionEnded();
    };

    const handleRunStartedEvent = (_event: Electron.IpcRendererEvent, run: Run) => {
      handleRunStarted(run);
    };

    const handleRunEndedEvent = (_event: Electron.IpcRendererEvent) => {
      handleRunEnded();
    };

    const handleRunPausedEvent = (_event: Electron.IpcRendererEvent) => {
      handleRunPaused();
    };

    const handleRunResumedEvent = (_event: Electron.IpcRendererEvent) => {
      handleRunResumed();
    };

    // Register IPC event listeners
    window.ipcRenderer?.on('run-tracker:session-started', handleSessionStartedEvent);
    window.ipcRenderer?.on('run-tracker:session-ended', handleSessionEndedEvent);
    window.ipcRenderer?.on('run-tracker:run-started', handleRunStartedEvent);
    window.ipcRenderer?.on('run-tracker:run-ended', handleRunEndedEvent);
    window.ipcRenderer?.on('run-tracker:run-paused', handleRunPausedEvent);
    window.ipcRenderer?.on('run-tracker:run-resumed', handleRunResumedEvent);

    console.log('[RunTracker] IPC event listeners registered');

    // Cleanup function to remove listeners
    return () => {
      window.ipcRenderer?.off('run-tracker:session-started', handleSessionStartedEvent);
      window.ipcRenderer?.off('run-tracker:session-ended', handleSessionEndedEvent);
      window.ipcRenderer?.off('run-tracker:run-started', handleRunStartedEvent);
      window.ipcRenderer?.off('run-tracker:run-ended', handleRunEndedEvent);
      window.ipcRenderer?.off('run-tracker:run-paused', handleRunPausedEvent);
      window.ipcRenderer?.off('run-tracker:run-resumed', handleRunResumedEvent);
      console.log('[RunTracker] IPC event listeners cleaned up');
    };
  }, [
    handleSessionStarted,
    handleSessionEnded,
    handleRunStarted,
    handleRunEnded,
    handleRunPaused,
    handleRunResumed,
  ]);

  // Handle loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 p-6">
            <div className="h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
            <p className="text-muted-foreground">Loading run tracker data...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 p-6">
            <div className="text-center text-destructive">
              <h3 className="mb-2 font-semibold">Error Loading Run Tracker</h3>
              <p className="mb-4 text-muted-foreground text-sm">{error}</p>
              <Button
                onClick={() => {
                  setError(null);
                  // Retry loading data
                  loadSessions();
                  if (activeSession?.id) {
                    loadSessionRuns(activeSession.id);
                  }
                  refreshActiveRun();
                }}
                variant="outline"
              >
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle empty state (no active session)
  if (!activeSession) {
    return (
      <div className="flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
            <div className="text-center text-muted-foreground">
              <h3 className="mb-2 font-semibold">No Active Session</h3>
              <p className="mb-4 text-sm">
                Start a new farming session to begin tracking your runs and items.
              </p>
              <Button
                onClick={() => {
                  // This would typically open a dialog to start a session
                  // For now, we'll just log it
                  console.log('[RunTracker] Start session requested');
                }}
                className="w-full"
              >
                Start New Session
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get runs for the active session
  const sessionRuns = activeSession?.id ? runs.get(activeSession.id) || [] : [];

  // Main layout with all components
  return (
    <div className="space-y-6">
      <SessionCard session={activeSession} />
      <SessionControls />
      <RunList runs={sessionRuns} />
    </div>
  );
}
