import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { translations } from '@/i18n/translations';
import { combineUnsubscribers, onMainEvent } from '@/lib/ipcEvents';
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
  const { t } = useTranslation();
  const {
    activeSession,
    initialLoadStatus,
    initialLoadError,
    pendingActions,
    error,
    errorType,
    retryCount,
    loadInitialData,
    handleSessionStarted,
    handleSessionEnded,
    handleRunStarted,
    handleRunEnded,
    handleRunPaused,
    handleRunResumed,
    clearError,
    retryLastAction,
    loadRunItems,
  } = useRunTrackerStore();

  const pageHeader = (
    <PageHeader
      title={t(translations.runTracker.title)}
      description={t(translations.runTracker.description)}
    />
  );

  // Navigation state
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Load initial data on mount and refresh in the background when the active session changes.
  // Only the first load blocks the page; later refreshes keep the current content visible.
  // biome-ignore lint/correctness/useExhaustiveDependencies: Zustand actions are stable
  useEffect(() => {
    loadInitialData().catch((err) => {
      console.error('[RunTracker] Error loading initial data:', err);
    });
  }, [activeSession?.id]); // Only re-run when active session changes

  // Set up IPC event listeners for real-time updates
  // biome-ignore lint/correctness/useExhaustiveDependencies: Event listeners should only be set up once
  useEffect(() => {
    const unsubscribe = combineUnsubscribers([
      onMainEvent('run-tracker:session-started', (payload) => {
        handleSessionStarted(payload.session);
      }),
      onMainEvent('run-tracker:session-ended', () => {
        handleSessionEnded();
      }),
      onMainEvent('run-tracker:run-started', (payload) => {
        handleRunStarted(payload.run, payload.session);
      }),
      onMainEvent('run-tracker:run-ended', (payload) => {
        handleRunEnded(payload.run, payload.session);
      }),
      onMainEvent('run-tracker:run-paused', (payload) => {
        handleRunPaused(payload.session);
      }),
      onMainEvent('run-tracker:run-resumed', (payload) => {
        handleRunResumed(payload.session);
      }),
      onMainEvent('run-tracker:run-item-added', (payload) => {
        // Refresh items for the affected run so UI reflects newly found items
        loadRunItems(payload.runId).catch((error) => {
          console.error('[RunTracker] Error loading items for run from event:', error);
        });
      }),
    ]);

    console.log('[RunTracker] IPC event listeners registered');

    return () => {
      unsubscribe();
      console.log('[RunTracker] IPC event listeners cleaned up');
    };
  }, []); // Only set up once on mount

  // Full-page spinner only until the first data load has completed
  if (initialLoadStatus === 'idle' || initialLoadStatus === 'loading') {
    return (
      <PageShell>
        {pageHeader}
        <div className="flex items-center justify-center p-8">
          <Card className="w-full max-w-md">
            <CardContent className="flex flex-col items-center gap-4 p-6">
              <div className="h-8 w-8 animate-spin rounded-full border-primary border-b-2" />
              <p className="text-muted-foreground">{t(translations.runTracker.loadingData)}</p>
            </CardContent>
          </Card>
        </div>
      </PageShell>
    );
  }

  // Full-page error only when the first data load failed
  if (initialLoadStatus === 'error') {
    return (
      <PageShell>
        {pageHeader}
        <div className="flex items-center justify-center p-8">
          <Card className="w-full max-w-md">
            <CardContent className="flex flex-col items-center gap-4 p-6">
              <div className="text-center text-destructive">
                <h3 className="mb-2 font-semibold">{t(translations.runTracker.errorLoading)}</h3>
                <p className="mb-4 text-muted-foreground text-sm">{initialLoadError}</p>
                <Button
                  onClick={() => {
                    loadInitialData().catch((err) => {
                      console.error('[RunTracker] Error retrying initial data load:', err);
                    });
                  }}
                  variant="outline"
                >
                  {t(translations.common.retry)}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageShell>
    );
  }

  // Navigation handlers
  const handleSessionSelect = (sessionId: string) => {
    setSelectedSessionId(sessionId);
  };

  const handleBackToMain = () => {
    setSelectedSessionId(null);
  };

  const isAnyActionPending = Object.values(pendingActions).some(Boolean);

  // Main layout with conditional rendering
  return (
    <PageShell>
      {pageHeader}

      {/* Inline error for failed actions and background refreshes */}
      <ErrorDisplay
        error={error}
        errorType={errorType}
        retryCount={retryCount}
        loading={isAnyActionPending}
        onRetry={retryLastAction}
        onDismiss={clearError}
      />

      {selectedSessionId ? (
        // Detail view for selected session
        <SessionDetailView sessionId={selectedSessionId} onBack={handleBackToMain} />
      ) : (
        // Main view: live session first, then its summary and the sessions list
        <>
          <SessionControls />
          <SessionCard
            session={activeSession}
            onViewAllRuns={activeSession ? () => handleSessionSelect(activeSession.id) : undefined}
          />
          <SessionsList onSessionSelect={handleSessionSelect} />
        </>
      )}
    </PageShell>
  );
}
