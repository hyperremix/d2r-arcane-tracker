import type { Settings } from 'electron/types/grail';
import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { combineUnsubscribers, onMainEvent } from '@/lib/ipcEvents';
import type { WidgetDisplayMode } from '@/lib/widget';
import { resolveWidgetDisplayMode } from '@/lib/widget';
import {
  affectsGrailFilter,
  initGrailData,
  useGrailStatistics,
  useGrailStore,
} from '@/stores/grailStore';
import { useRunTrackerStore } from '@/stores/runTrackerStore';
import { Widget } from './Widget';

const NO_SETTINGS: Partial<Settings> = {};

/**
 * Container component for the widget that handles data loading and state management.
 * Loads the grail data into the store, computes the shared grail statistics from it and listens
 * for updates from the main process.
 */
export function WidgetContainer() {
  const storedSettings = useGrailStore((state) => state.settings);
  const settingsLoaded = useGrailStore((state) => state.settingsHydrated);
  const grailStatistics = useGrailStatistics();
  // Until the stored settings are loaded the widget renders without settings or statistics,
  // instead of briefly showing the defaults
  const settings = settingsLoaded ? storedSettings : NO_SETTINGS;
  const statistics = settingsLoaded ? grailStatistics : null;

  // Get run tracker store actions to handle IPC events
  const {
    handleSessionStarted: storeHandleSessionStarted,
    handleSessionEnded: storeHandleSessionEnded,
    handleRunStarted: storeHandleRunStarted,
    handleRunEnded: storeHandleRunEnded,
    refreshActiveRun,
    loadSessionRuns,
    activeSession,
    loadRunItems,
  } = useRunTrackerStore(
    useShallow((state) => ({
      handleSessionStarted: state.handleSessionStarted,
      handleSessionEnded: state.handleSessionEnded,
      handleRunStarted: state.handleRunStarted,
      handleRunEnded: state.handleRunEnded,
      refreshActiveRun: state.refreshActiveRun,
      loadSessionRuns: state.loadSessionRuns,
      activeSession: state.activeSession,
      loadRunItems: state.loadRunItems,
    })),
  );

  // Load the grail data (settings, items, progress) and keep the progress in sync. The run-only
  // mode also uses it to resolve run item names.
  useEffect(() => initGrailData(), []);

  // Load run tracker data on mount
  // biome-ignore lint/correctness/useExhaustiveDependencies: Zustand actions are stable
  useEffect(() => {
    const loadRunTrackerData = async () => {
      try {
        // Refresh active run state to sync with backend
        await refreshActiveRun();

        // Get the fresh activeSession from the store after refresh
        const freshActiveSession = useRunTrackerStore.getState().activeSession;

        // Load runs for active session if it exists
        if (freshActiveSession?.id) {
          await loadSessionRuns(freshActiveSession.id);
          console.log('[WidgetContainer] Loaded runs for active session:', freshActiveSession.id);
        }
      } catch (error) {
        console.error('[WidgetContainer] Error loading run tracker data:', error);
      }
    };

    loadRunTrackerData();
  }, [activeSession?.id]); // Re-run when active session changes

  // Resize the native window whenever the mode the widget actually renders changes. That covers
  // display mode changes and ethereal tracking toggles (which switch split/all to overall)
  const effectiveDisplay = resolveWidgetDisplayMode(settings.widgetDisplay, settings.grailEthereal);
  const appliedDisplayRef = useRef<WidgetDisplayMode | undefined>(undefined);
  useEffect(() => {
    if (!settingsLoaded) {
      return;
    }
    const previousDisplay = appliedDisplayRef.current;
    appliedDisplayRef.current = effectiveDisplay;
    // The window was already created with the size for the initially loaded mode
    if (previousDisplay === undefined || previousDisplay === effectiveDisplay) {
      return;
    }
    window.electronAPI?.widget.updateDisplay(effectiveDisplay, settings).catch((error: unknown) => {
      console.error('Failed to update widget window size:', error);
    });
  }, [effectiveDisplay, settings, settingsLoaded]);

  // Apply settings saved in the main window; a change of the tracked item types also changes
  // which items count, so the grail data is reloaded
  useEffect(() => {
    return onMainEvent('settings-updated', (updatedSettings) => {
      // Opacity is applied by the widget's CSS from these settings; the settings UI already notifies
      // the main process, so no IPC is sent from here
      const { hydrateSettings, reloadData } = useGrailStore.getState();
      hydrateSettings(updatedSettings);
      if (affectsGrailFilter(updatedSettings)) {
        void reloadData();
      }
    });
  }, []);

  // Listen for run tracker events for real-time updates
  useEffect(() => {
    // Listen for run tracker events (note: events are prefixed with 'run-tracker:')
    return combineUnsubscribers([
      onMainEvent('run-tracker:run-started', (payload) => {
        console.log('[WidgetContainer] Run started:', payload.run.id);
        storeHandleRunStarted(payload.run, payload.session);
      }),
      onMainEvent('run-tracker:run-ended', (payload) => {
        console.log('[WidgetContainer] Run ended');
        storeHandleRunEnded(payload.run, payload.session);
      }),
      onMainEvent('run-tracker:session-started', (payload) => {
        console.log('[WidgetContainer] Session started:', payload.session.id);
        storeHandleSessionStarted(payload.session);
      }),
      onMainEvent('run-tracker:session-ended', () => {
        console.log('[WidgetContainer] Session ended');
        storeHandleSessionEnded();
      }),
      onMainEvent('run-tracker:run-item-added', (payload) => {
        console.log('[WidgetContainer] Run item added for run:', payload.runId);
        loadRunItems(payload.runId).catch((error) => {
          console.error('[WidgetContainer] Error loading run items for run from event:', error);
        });
      }),
    ]);
  }, [
    storeHandleRunStarted,
    storeHandleRunEnded,
    storeHandleSessionStarted,
    storeHandleSessionEnded,
    loadRunItems,
  ]);

  const handleDragStart = () => {
    // Empty function - drag is handled by Electron
  };

  const handleDragEnd = () => {
    // Empty function - drag is handled by Electron
  };

  return (
    <Widget
      statistics={statistics}
      settings={settings}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    />
  );
}
