import type { Run, Session } from 'electron/types/grail';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useRunTrackerStore } from '@/stores/runTrackerStore';
import { ErrorDisplay } from './ErrorDisplay';
import { SessionCard } from './SessionCard';
import { SessionControls } from './SessionControls';
import { SessionDetailView } from './SessionDetailView';
import { SessionsList } from './SessionsList';

/**
 * RunTracker component that serves as the main entry point for the Run Counter tab.
 * Integrates SessionCard, RunList, and SessionControls components, handles loading
 * and error states, and provides the overall layout for run tracking functionality.
 */
export function RunTracker() {
  const {
    activeSession,
    loading,
    error,
    errorType,
    retryCount,
    loadAllSessions,
    loadSessionRuns,
    refreshActiveRun,
    handleSessionStarted,
    handleSessionEnded,
    handleRunStarted,
    handleRunEnded,
    handleRunPaused,
    handleRunResumed,
    setError,
    clearError,
    retryLastAction,
    loadRunItems,
  } = useRunTrackerStore();

  // Navigation state
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Load initial data on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: Zustand actions are stable
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Load all sessions (including archived) for the sessions list
        await loadAllSessions();

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
  }, [activeSession?.id]); // Only re-run when active session changes

  // Set up IPC event listeners for real-time updates
  // biome-ignore lint/correctness/useExhaustiveDependencies: Event listeners should only be set up once
  useEffect(() => {
    const handleSessionStartedEvent = (
      _event: Electron.IpcRendererEvent,
      payload: { session: Session },
    ) => {
      handleSessionStarted(payload.session);
    };

    const handleSessionEndedEvent = (
      _event: Electron.IpcRendererEvent,
      _payload: { session: Session },
    ) => {
      handleSessionEnded();
    };

    const handleRunStartedEvent = (
      _event: Electron.IpcRendererEvent,
      payload: { run: Run; session: Session; manual: boolean },
    ) => {
      handleRunStarted(payload.run, payload.session);
    };

    const handleRunEndedEvent = (
      _event: Electron.IpcRendererEvent,
      payload: { run: Run; session: Session; manual: boolean },
    ) => {
      handleRunEnded(payload.run, payload.session);
    };

    const handleRunPausedEvent = (
      _event: Electron.IpcRendererEvent,
      payload: { run: Run; session: Session },
    ) => {
      handleRunPaused(payload.session);
    };

    const handleRunResumedEvent = (
      _event: Electron.IpcRendererEvent,
      payload: { run: Run; session: Session },
    ) => {
      handleRunResumed(payload.session);
    };

    const handleRunItemAddedEvent = (
      _event: Electron.IpcRendererEvent,
      payload: { runId: string; name?: string },
    ) => {
      // Refresh items for the affected run so UI reflects newly found items
      loadRunItems(payload.runId).catch((error) => {
        console.error('[RunTracker] Error loading items for run from event:', error);
      });
    };

    // Register IPC event listeners
    window.ipcRenderer?.on('run-tracker:session-started', handleSessionStartedEvent);
    window.ipcRenderer?.on('run-tracker:session-ended', handleSessionEndedEvent);
    window.ipcRenderer?.on('run-tracker:run-started', handleRunStartedEvent);
    window.ipcRenderer?.on('run-tracker:run-ended', handleRunEndedEvent);
    window.ipcRenderer?.on('run-tracker:run-paused', handleRunPausedEvent);
    window.ipcRenderer?.on('run-tracker:run-resumed', handleRunResumedEvent);
    window.ipcRenderer?.on('run-tracker:run-item-added', handleRunItemAddedEvent);

    console.log('[RunTracker] IPC event listeners registered');

    // Cleanup function to remove listeners
    return () => {
      window.ipcRenderer?.off('run-tracker:session-started', handleSessionStartedEvent);
      window.ipcRenderer?.off('run-tracker:session-ended', handleSessionEndedEvent);
      window.ipcRenderer?.off('run-tracker:run-started', handleRunStartedEvent);
      window.ipcRenderer?.off('run-tracker:run-ended', handleRunEndedEvent);
      window.ipcRenderer?.off('run-tracker:run-paused', handleRunPausedEvent);
      window.ipcRenderer?.off('run-tracker:run-resumed', handleRunResumedEvent);
      window.ipcRenderer?.off('run-tracker:run-item-added', handleRunItemAddedEvent);
      console.log('[RunTracker] IPC event listeners cleaned up');
    };
  }, []); // Only set up once on mount

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
                  loadAllSessions();
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

  // Navigation handlers
  const handleSessionSelect = (sessionId: string) => {
    setSelectedSessionId(sessionId);
  };

  const handleBackToMain = () => {
    setSelectedSessionId(null);
  };

  // Main layout with conditional rendering
  return (
    <div className="max-h-[94vh] space-y-6 overflow-y-auto p-6">
      {/* Error Display */}
      <ErrorDisplay
        error={error}
        errorType={errorType}
        retryCount={retryCount}
        loading={loading}
        onRetry={retryLastAction}
        onDismiss={clearError}
      />

      {selectedSessionId ? (
        // Detail view for selected session
        <SessionDetailView sessionId={selectedSessionId} onBack={handleBackToMain} />
      ) : (
        // Main view with active session and sessions list
        <>
          <SessionCard session={activeSession} />
          <SessionControls />
          <SessionsList onSessionSelect={handleSessionSelect} />
        </>
      )}
    </div>
  );
}
