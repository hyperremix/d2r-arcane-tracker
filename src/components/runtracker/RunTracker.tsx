import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { translations } from '@/i18n/translations';
import { initRunTrackerSync, useRunTrackerStore } from '@/stores/runTrackerStore';
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
    canRetry,
    loadInitialData,
    clearError,
    retryLastAction,
  } = useRunTrackerStore(
    useShallow((state) => ({
      activeSession: state.activeSession,
      initialLoadStatus: state.initialLoadStatus,
      initialLoadError: state.initialLoadError,
      pendingActions: state.pendingActions,
      error: state.error,
      errorType: state.errorType,
      canRetry: state.lastFailedAction !== undefined,
      loadInitialData: state.loadInitialData,
      clearError: state.clearError,
      retryLastAction: state.retryLastAction,
    })),
  );

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

  // Keep the store in sync with the run tracker events of the main process
  useEffect(() => initRunTrackerSync(), []);

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
        canRetry={canRetry}
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
