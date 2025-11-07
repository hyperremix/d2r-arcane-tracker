import type {
  GrailProgress,
  GrailStatistics,
  Item,
  Run,
  Session,
  Settings,
} from 'electron/types/grail';
import { useEffect, useState } from 'react';
import { canItemBeEthereal, canItemBeNormal } from '@/lib/ethereal';
import { useRunTrackerStore } from '@/stores/runTrackerStore';
import { Widget } from './Widget';

/**
 * Container component for the widget that handles data loading and state management.
 * Loads grail data from the Electron API and listens for updates.
 */
export function WidgetContainer() {
  const [statistics, setStatistics] = useState<GrailStatistics | null>(null);
  const [settings, setSettings] = useState<Partial<Settings>>({});

  // Get run tracker store actions to handle IPC events
  const {
    handleSessionStarted: storeHandleSessionStarted,
    handleSessionEnded: storeHandleSessionEnded,
    handleRunStarted: storeHandleRunStarted,
    handleRunEnded: storeHandleRunEnded,
  } = useRunTrackerStore();

  // Load initial data and calculate statistics
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load settings
        const settingsData = await window.electronAPI?.grail.getSettings();
        if (settingsData) {
          setSettings(settingsData);
        }

        // Load items and progress to calculate statistics
        const items = await window.electronAPI?.grail.getItems();
        const progress = await window.electronAPI?.grail.getProgress();

        if (items && progress && settingsData) {
          const stats = computeStatistics(items, progress, settingsData);
          setStatistics(stats);
        }
      } catch (error) {
        console.error('Failed to load widget data:', error);
      }
    };

    loadData();
  }, []);

  // Listen for grail progress updates
  useEffect(() => {
    const handleProgressUpdate = async () => {
      try {
        const [items, progress, settingsData] = await Promise.all([
          window.electronAPI?.grail.getItems(),
          window.electronAPI?.grail.getProgress(),
          window.electronAPI?.grail.getSettings(),
        ]);

        if (items && progress && settingsData) {
          const stats = computeStatistics(items, progress, settingsData);
          setStatistics(stats);
        }
      } catch (error) {
        console.error('Failed to update widget statistics:', error);
      }
    };

    // Listen for progress updates from the main process
    window.ipcRenderer?.on('grail-progress-updated', handleProgressUpdate);

    return () => {
      window.ipcRenderer?.off('grail-progress-updated', handleProgressUpdate);
    };
  }, []);

  // Listen for settings updates
  useEffect(() => {
    const handleSettingsUpdate = async (_event: unknown, updatedSettings: Partial<Settings>) => {
      setSettings((prev) => {
        const newSettings = { ...prev, ...updatedSettings };

        // Update widget appearance based on new settings (use async IIFE to handle promises)
        (async () => {
          if (updatedSettings.widgetDisplay) {
            await window.electronAPI?.widget.updateDisplay(
              updatedSettings.widgetDisplay,
              newSettings,
            );
          }
          if (updatedSettings.widgetOpacity !== undefined) {
            await window.electronAPI?.widget.updateOpacity(updatedSettings.widgetOpacity);
          }
        })();

        return newSettings;
      });

      // Recalculate statistics if grail settings changed
      if (
        updatedSettings.grailNormal !== undefined ||
        updatedSettings.grailEthereal !== undefined ||
        updatedSettings.grailRunes !== undefined ||
        updatedSettings.grailRunewords !== undefined
      ) {
        const items = await window.electronAPI?.grail.getItems();
        const progress = await window.electronAPI?.grail.getProgress();
        if (items && progress) {
          const stats = computeStatistics(items, progress, {
            ...settings,
            ...updatedSettings,
          });
          setStatistics(stats);
        }
      }
    };

    window.ipcRenderer?.on('settings-updated', handleSettingsUpdate);

    return () => {
      window.ipcRenderer?.off('settings-updated', handleSettingsUpdate);
    };
  }, [settings]);

  // Listen for run tracker events for real-time updates
  useEffect(() => {
    const handleRunStarted = (
      _event: Electron.IpcRendererEvent,
      payload: { run: Run; session: Session; manual: boolean },
    ) => {
      console.log('[WidgetContainer] Run started:', payload.run.id);
      storeHandleRunStarted(payload.run, payload.session);
    };

    const handleRunEnded = (
      _event: Electron.IpcRendererEvent,
      payload: { run: Run; session: Session; manual: boolean },
    ) => {
      console.log('[WidgetContainer] Run ended');
      storeHandleRunEnded(payload.run, payload.session);
    };

    const handleSessionStarted = (_event: Electron.IpcRendererEvent, session: Session) => {
      console.log('[WidgetContainer] Session started:', session.id);
      storeHandleSessionStarted(session);
    };

    const handleSessionEnded = () => {
      console.log('[WidgetContainer] Session ended');
      storeHandleSessionEnded();
    };

    // Listen for run tracker events (note: events are prefixed with 'run-tracker:')
    window.ipcRenderer?.on('run-tracker:run-started', handleRunStarted);
    window.ipcRenderer?.on('run-tracker:run-ended', handleRunEnded);
    window.ipcRenderer?.on('run-tracker:session-started', handleSessionStarted);
    window.ipcRenderer?.on('run-tracker:session-ended', handleSessionEnded);

    return () => {
      window.ipcRenderer?.off('run-tracker:run-started', handleRunStarted);
      window.ipcRenderer?.off('run-tracker:run-ended', handleRunEnded);
      window.ipcRenderer?.off('run-tracker:session-started', handleSessionStarted);
      window.ipcRenderer?.off('run-tracker:session-ended', handleSessionEnded);
    };
  }, [
    storeHandleRunStarted,
    storeHandleRunEnded,
    storeHandleSessionStarted,
    storeHandleSessionEnded,
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

/**
 * Checks if a progress entry is a recent find (within last 7 days).
 */
function isRecentFind(progress: GrailProgress, sevenDaysAgo: Date): boolean {
  if (!progress.foundDate) {
    return false;
  }
  // Exclude items from initial scan from recent finds statistics
  if (progress.fromInitialScan) {
    return false;
  }
  const foundDate = new Date(progress.foundDate);
  return foundDate >= sevenDaysAgo;
}

/**
 * Processes an item in separate tracking mode (grailEthereal enabled).
 */
function processSeparateTracking(
  item: Item,
  progressMap: Map<string, GrailProgress>,
  sevenDaysAgo: Date,
  stats: {
    totalItems: number;
    foundItems: number;
    normalTotal: number;
    normalFound: number;
    etherealTotal: number;
    etherealFound: number;
    recentFinds: number;
  },
): void {
  if (canItemBeNormal(item)) {
    stats.normalTotal++;
    stats.totalItems++;
    const normalProgress = progressMap.get(`${item.id}-false`);
    if (normalProgress) {
      stats.normalFound++;
      stats.foundItems++;
      if (isRecentFind(normalProgress, sevenDaysAgo)) {
        stats.recentFinds++;
      }
    }
  }

  if (canItemBeEthereal(item)) {
    stats.etherealTotal++;
    stats.totalItems++;
    const etherealProgress = progressMap.get(`${item.id}-true`);
    if (etherealProgress) {
      stats.etherealFound++;
      stats.foundItems++;
      if (isRecentFind(etherealProgress, sevenDaysAgo)) {
        stats.recentFinds++;
      }
    }
  }
}

/**
 * Processes an item in combined tracking mode (grailEthereal disabled).
 */
function processCombinedTracking(
  item: Item,
  progressMap: Map<string, GrailProgress>,
  sevenDaysAgo: Date,
  stats: {
    totalItems: number;
    foundItems: number;
    recentFinds: number;
  },
): void {
  stats.totalItems++;
  const normalProgress = progressMap.get(`${item.id}-false`);
  const etherealProgress = progressMap.get(`${item.id}-true`);

  if (normalProgress || etherealProgress) {
    stats.foundItems++;
    const latestProgress = normalProgress || etherealProgress;
    if (latestProgress && isRecentFind(latestProgress, sevenDaysAgo)) {
      stats.recentFinds++;
    }
  }
}

/**
 * Computes grail statistics from items and progress data.
 */
function computeStatistics(
  items: Item[],
  progress: GrailProgress[],
  settings: Partial<Settings>,
): GrailStatistics {
  const foundProgress = progress.filter((p) => p.foundDate !== undefined);
  const progressMap = new Map(foundProgress.map((p) => [`${p.itemId}-${p.isEthereal}`, p]));

  const stats = {
    totalItems: 0,
    foundItems: 0,
    normalTotal: 0,
    normalFound: 0,
    etherealTotal: 0,
    etherealFound: 0,
    recentFinds: 0,
  };

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  for (const item of items) {
    if (settings.grailEthereal) {
      processSeparateTracking(item, progressMap, sevenDaysAgo, stats);
    } else {
      processCombinedTracking(item, progressMap, sevenDaysAgo, stats);
    }
  }

  const completionPercentage =
    stats.totalItems > 0 ? (stats.foundItems / stats.totalItems) * 100 : 0;

  return {
    totalItems: stats.totalItems,
    foundItems: stats.foundItems,
    completionPercentage,
    normalItems: {
      total: stats.normalTotal,
      found: stats.normalFound,
    },
    etherealItems: {
      total: stats.etherealTotal,
      found: stats.etherealFound,
    },
    recentFinds: stats.recentFinds,
    currentStreak: 0, // Not calculated in widget
    maxStreak: 0, // Not calculated in widget
  };
}
