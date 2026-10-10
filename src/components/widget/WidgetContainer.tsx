import type { Settings } from 'electron/types/grail';
import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { WidgetDisplayMode } from '@/lib/widget';
import { resolveWidgetDisplayMode } from '@/lib/widget';
import { useGrailStatistics, useGrailStore } from '@/stores/grailStore';
import { initRunTrackerSync, useRunTrackerStore } from '@/stores/runTrackerStore';
import { Widget } from './Widget';

const NO_SETTINGS: Partial<Settings> = {};

/**
 * Container component for the widget that handles data loading and state management.
 * Computes the shared grail statistics from the grail data (loaded and kept in sync, together with
 * the settings, by the window root via `useWindowBootstrap`) and listens for run tracker updates
 * from the main process.
 */
export function WidgetContainer() {
  const storedSettings = useGrailStore((state) => state.settings);
  const settingsLoaded = useGrailStore((state) => state.settingsHydrated);
  const grailStatistics = useGrailStatistics();
  // Until the stored settings are loaded the widget renders without settings or statistics,
  // instead of briefly showing the defaults
  const settings = settingsLoaded ? storedSettings : NO_SETTINGS;
  const statistics = settingsLoaded ? grailStatistics : null;

  const { refreshActiveRun, loadSessionRuns, activeSession } = useRunTrackerStore(
    useShallow((state) => ({
      refreshActiveRun: state.refreshActiveRun,
      loadSessionRuns: state.loadSessionRuns,
      activeSession: state.activeSession,
    })),
  );

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

  // Keep the run tracker store in sync with the run tracker events of the main process
  useEffect(() => initRunTrackerSync(), []);

  // The window is dragged by its WebkitAppRegion drag region, so no drag handlers are needed
  return <Widget statistics={statistics} settings={settings} />;
}
