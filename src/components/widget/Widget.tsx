import type {
  GrailProgress,
  GrailStatistics,
  Item,
  Run,
  RunItem,
  Session,
  SessionStats,
  Settings,
} from 'electron/types/grail';
import { GripHorizontal } from 'lucide-react';
import type { ComponentProps, CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProgressGauge } from '@/components/grail/ProgressGauge';
import { Input } from '@/components/ui/input';
import { translations } from '@/i18n/translations';
import { formatDuration } from '@/lib/utils';
import { clampWidgetOpacity, resolveWidgetDisplayMode } from '@/lib/widget';
import { useGrailStore } from '@/stores/grailStore';
import { useRunTrackerStore, useSessionStats } from '@/stores/runTrackerStore';

/**
 * Props for the Widget component.
 */
interface WidgetProps {
  statistics: GrailStatistics | null;
  settings: Partial<Settings>;
  onDragStart: () => void;
  onDragEnd: () => void;
}

/**
 * Inline styles of the widget root. WebkitAppRegion is an Electron-specific CSS property that
 * marks the area the window can be dragged by.
 */
type WidgetRootStyle = CSSProperties & { WebkitAppRegion: 'drag' | 'no-drag' };

/**
 * Marks an interactive area inside the drag region so clicks reach it instead of dragging the window.
 */
const NO_DRAG_STYLE: WidgetRootStyle = { WebkitAppRegion: 'no-drag' };

/**
 * Props for the RunOnlyDisplay component.
 */
interface RunOnlyDisplayProps {
  activeSession: Session | null;
  runDuration: number;
  sessionStats: SessionStats | null;
  runItemsByRun: RunItemsByRun[];
  showItemList: boolean;
  onAddManualItem?: (name: string) => Promise<void>;
  hasRuns: boolean;
}

/**
 * Shape used by the run-only item list to represent items per run.
 */
interface RunItemsByRun {
  runNumber: number;
  runId: string;
  items: string[];
}

/**
 * Helper to build a lookup map for item names by grail progress id.
 */
function buildRunItemNameLookup(
  runs: Map<string, Run[]>,
  runItems: Map<string, RunItem[]>,
  items: Item[],
  progress: GrailProgress[],
  sessionId: string,
): RunItemsByRun[] {
  const sessionRuns = runs.get(sessionId);
  if (!sessionRuns || sessionRuns.length === 0) {
    return [];
  }

  const itemsById = new Map<string, Item>();
  for (const item of items) {
    itemsById.set(item.id, item);
  }

  const progressById = new Map<string, GrailProgress>();
  for (const entry of progress) {
    progressById.set(entry.id, entry);
  }

  // Deduplicate runs by ID to prevent duplicate entries in the widget
  // This is a safety measure in case duplicate runs exist in the store
  const seenRunIds = new Set<string>();
  const uniqueRuns = sessionRuns.filter((run) => {
    if (seenRunIds.has(run.id)) {
      return false;
    }
    seenRunIds.add(run.id);
    return true;
  });

  const sortedRuns = [...uniqueRuns].sort((a, b) => b.runNumber - a.runNumber);

  return sortedRuns.map((run) => {
    const runItemEntries = runItems.get(run.id) ?? [];

    const names: string[] = [];
    for (const runItem of runItemEntries) {
      // If this is a manual entry with a name, use it directly
      if (runItem.name) {
        names.push(runItem.name);
        continue;
      }

      // Otherwise, try to find the item through grail progress
      if (!runItem.grailProgressId) {
        continue;
      }

      const progressEntry = progressById.get(runItem.grailProgressId);
      if (!progressEntry) continue;

      const item = itemsById.get(progressEntry.itemId);
      if (!item) {
        // This should be rare once the grail store is hydrated for the widget
        // but we log it to help diagnose any future data mismatches.
        console.warn(
          '[Widget] Missing item for grail progress entry in run list',
          runItem.grailProgressId,
          '-> itemId:',
          progressEntry.itemId,
        );
        continue;
      }

      names.push(item.name);
    }

    return {
      runNumber: run.runNumber,
      runId: run.id,
      items: names,
    };
  });
}

/**
 * Subtle grip icon hinting that the widget can be dragged.
 * It is purely decorative and ignores pointer events so the native drag region keeps working.
 * It stays faint by default because Electron drag regions do not reliably report hover.
 */
function WidgetDragGrip() {
  return (
    <GripHorizontal
      aria-hidden="true"
      data-testid="widget-drag-grip"
      className="pointer-events-none absolute top-1 left-1/2 h-4 w-4 -translate-x-1/2 text-white opacity-30 transition-opacity duration-200 group-hover:opacity-80"
    />
  );
}

/**
 * Progress gauge styled for the widget: labelled, with light text that stays legible on the
 * widget's always-dark background.
 */
function WidgetGauge(props: Omit<ComponentProps<typeof ProgressGauge>, 'showLabel' | 'tone'>) {
  return <ProgressGauge {...props} showLabel tone="overlay" />;
}

/**
 * RunOnlyDisplay component that shows run tracking statistics.
 * Displays current run info and session-wide statistics.
 */
function RunOnlyDisplay({
  activeSession,
  runDuration,
  sessionStats,
  runItemsByRun,
  showItemList,
  onAddManualItem,
  hasRuns,
}: RunOnlyDisplayProps) {
  const { t } = useTranslation();
  const [manualItemName, setManualItemName] = useState('');
  const [addingItem, setAddingItem] = useState(false);

  const handleAddItem = useCallback(async () => {
    if (!manualItemName.trim() || !onAddManualItem || addingItem) {
      return;
    }

    setAddingItem(true);
    try {
      await onAddManualItem(manualItemName.trim());
      setManualItemName('');
    } catch (error) {
      console.error('[Widget] Failed to add manual item:', error);
    } finally {
      setAddingItem(false);
    }
  }, [manualItemName, onAddManualItem, addingItem]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter' && !addingItem && manualItemName.trim()) {
        handleAddItem();
      }
    },
    [addingItem, manualItemName, handleAddItem],
  );

  if (!activeSession) {
    return (
      <div className="text-center">
        <p className="text-sm text-white">
          {t(translations.runTracker.sessionCard.noActiveSession)}
        </p>
        <p className="text-white/80 text-xs">{t(translations.widget.startSessionPrompt)}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-3 overflow-hidden px-4">
      {/* Top Row: Run # and Current Duration */}
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center">
          <p className="text-white/85 text-xs">{t(translations.widget.run)}</p>
          <p className="font-bold text-white text-xl">#{activeSession?.runCount ?? 0}</p>
        </div>
        <div className="text-center">
          <p className="text-white/85 text-xs">{t(translations.widget.current)}</p>
          <p className="font-mono text-lg text-white">{formatDuration(runDuration)}</p>
        </div>
      </div>

      {/* Bottom Row: Session Stats */}
      <div className="grid grid-cols-2 gap-4 pt-3">
        <div className="text-center">
          <p className="text-white/85 text-xs">{t(translations.widget.fastest)}</p>
          <p className="font-mono text-sm text-white">{formatDuration(sessionStats?.fastestRun)}</p>
        </div>
        <div className="text-center">
          <p className="text-white/85 text-xs">{t(translations.widget.average)}</p>
          <p className="font-mono text-sm text-white">
            {formatDuration(sessionStats?.averageRunDuration)}
          </p>
        </div>
      </div>

      {/* Per-run item list */}
      {showItemList && (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          <p className="font-bold text-md text-white/85">{t(translations.widget.runItems)}</p>

          {/* Manual Item Entry */}
          {onAddManualItem && (
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-1.5">
                <Input
                  type="text"
                  placeholder={
                    hasRuns
                      ? t(translations.widget.addItemPlaceholder)
                      : t(translations.runTracker.controls.startRunFirst)
                  }
                  aria-label={t(translations.runTracker.controls.addItemManually)}
                  value={manualItemName}
                  onChange={(e) => setManualItemName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={addingItem || !hasRuns}
                  className="h-7 flex-1 border-white/30 bg-black/40 text-white text-xs placeholder:text-white/60"
                  style={NO_DRAG_STYLE}
                />
              </div>
            </div>
          )}

          {runItemsByRun.length > 0 && (
            <div
              className="mt-2 flex min-h-0 flex-col gap-1 overflow-y-auto text-white/95 text-xs"
              style={NO_DRAG_STYLE}
            >
              {runItemsByRun.map((run) => {
                if (run.items.length === 0) {
                  return null;
                }

                return (
                  <div key={run.runId} className="grid grid-cols-[auto_1fr] gap-1">
                    <span>#{run.runNumber} -</span>
                    <span className="flex-1 truncate">{run.items.join(', ')}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Widget component that displays grail progress statistics in a compact overlay format.
 * Supports multiple size configurations and dynamic opacity.
 */
export function Widget({ statistics, settings, onDragStart, onDragEnd }: WidgetProps) {
  const { t } = useTranslation();
  const widgetLabel = t(translations.widget.ariaLabel);
  // Split/all modes need ethereal tracking; fall back to overall here so the widget never renders empty
  const displayMode = resolveWidgetDisplayMode(settings.widgetDisplay, settings.grailEthereal);
  const opacity = clampWidgetOpacity(settings.widgetOpacity);
  // A locked widget is click-through, so it must not be a drag region (Windows would still catch
  // clicks on it) and must not advertise dragging with the cursor or grip
  const locked = settings.widgetLocked === true;
  const rootStyle = useMemo<WidgetRootStyle>(
    () => ({
      backgroundColor: `rgba(0, 0, 0, ${opacity})`,
      backdropFilter: 'blur(10px)',
      cursor: locked ? 'default' : 'move',
      height: '100vh',
      width: '100vw',
      WebkitAppRegion: locked ? 'no-drag' : 'drag',
    }),
    [locked, opacity],
  );

  // Run tracker state for run-only mode
  const {
    activeRun,
    activeSession,
    runs,
    runItems,
    loadSessionRuns,
    loadRunItems,
    addManualRunItem,
  } = useRunTrackerStore();
  const [runDuration, setRunDuration] = useState<number>(0);

  // Grail data for resolving item names in run-only mode
  const { items, progress } = useGrailStore();

  // Real-time timer for run duration updates
  useEffect(() => {
    if (!activeRun || displayMode !== 'run-only') {
      setRunDuration(0);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const elapsed = now - activeRun.startTime.getTime();
      setRunDuration(elapsed);
    };

    // Update immediately
    updateTimer();

    // Set up interval for updates
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [activeRun, displayMode]);

  // Ensure runs and run items are loaded for the active session in run-only mode
  useEffect(() => {
    if (!activeSession || displayMode !== 'run-only') {
      return;
    }

    const sessionId = activeSession.id;
    const sessionRuns = runs.get(sessionId);

    // If we have no runs for this session, trigger a load of runs (and items via store logic)
    if (!sessionRuns || sessionRuns.length === 0) {
      void loadSessionRuns(sessionId);
      return;
    }

    // If runs exist but some are missing items, load items for those runs
    const runsMissingItems = sessionRuns.filter((run) => !runItems.has(run.id));
    if (runsMissingItems.length > 0) {
      for (const run of runsMissingItems) {
        void loadRunItems(run.id);
      }
    }
  }, [activeSession, displayMode, loadRunItems, loadSessionRuns, runItems, runs]);

  // Session statistics for run-only mode
  const activeSessionStats = useSessionStats(activeSession);
  const sessionStats = displayMode === 'run-only' ? activeSessionStats : null;

  // Build per-run item list for run-only mode
  const runItemsByRun = useMemo(() => {
    if (!activeSession || displayMode !== 'run-only') {
      return [];
    }

    return buildRunItemNameLookup(runs, runItems, items, progress, activeSession.id);
  }, [activeSession, displayMode, items, progress, runItems, runs]);

  // Check if there are any runs in the session (active run or finished runs)
  const hasRuns = useMemo(() => {
    if (!activeSession || displayMode !== 'run-only') {
      return false;
    }
    // Check if there's an active run
    if (activeRun) {
      return true;
    }
    // Check if there are any runs in the session
    const sessionRuns = runs.get(activeSession.id);
    return sessionRuns !== undefined && sessionRuns.length > 0;
  }, [activeSession, activeRun, displayMode, runs]);

  // Calculate container styles based on display mode
  const containerClasses = useMemo(() => {
    // Text shadow keeps the overlay legible over bright game scenes
    const baseClasses =
      'group relative flex flex-col items-center overflow-hidden p-2 text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.9),0_0_1px_rgb(0_0_0/0.9)]';
    const gapClasses = {
      overall: 'gap-4',
      split: 'gap-4',
      all: 'gap-6',
      'run-only': 'gap-2',
    };
    return `${baseClasses} ${gapClasses[displayMode]}`;
  }, [displayMode]);

  // Handle run-only mode separately (doesn't need statistics)
  if (displayMode === 'run-only') {
    return (
      <section
        aria-label={widgetLabel}
        className={containerClasses}
        style={rootStyle}
        onMouseDown={onDragStart}
        onMouseUp={onDragEnd}
      >
        {!locked && <WidgetDragGrip />}
        <RunOnlyDisplay
          activeSession={activeSession}
          runDuration={runDuration}
          sessionStats={sessionStats}
          runItemsByRun={runItemsByRun}
          showItemList={settings.widgetRunOnlyShowItems ?? true}
          // The manual entry field can't be clicked while the widget is click-through
          onAddManualItem={locked ? undefined : addManualRunItem}
          hasRuns={hasRuns}
        />
      </section>
    );
  }

  if (!statistics) {
    return (
      <section
        aria-label={widgetLabel}
        className={containerClasses}
        style={rootStyle}
        onMouseDown={onDragStart}
        onMouseUp={onDragEnd}
      >
        {!locked && <WidgetDragGrip />}
        <p className="text-sm text-white">{t(translations.common.loading)}</p>
      </section>
    );
  }

  return (
    <section
      aria-label={widgetLabel}
      className={containerClasses}
      style={rootStyle}
      onMouseDown={onDragStart}
      onMouseUp={onDragEnd}
    >
      {!locked && <WidgetDragGrip />}
      {/* Display mode: overall - Just overall progress */}
      {displayMode === 'overall' && (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <WidgetGauge
            label={t(translations.settings.widget.overall)}
            current={statistics.foundItems}
            total={statistics.totalItems}
            color="purple"
            size="xl"
          />
        </div>
      )}

      {/* Display mode: split - Normal and Ethereal side by side */}
      {displayMode === 'split' && (
        <div className="flex min-h-0 flex-1 items-center justify-center gap-6">
          <WidgetGauge
            label={t(translations.grail.itemCard.normal)}
            current={statistics.normalItems.found}
            total={statistics.normalItems.total}
            color="orange"
            size="lg"
          />
          <WidgetGauge
            label={t(translations.widget.ethereal)}
            current={statistics.etherealItems.found}
            total={statistics.etherealItems.total}
            color="blue"
            size="lg"
          />
        </div>
      )}

      {/* Display mode: all - Overall on top, Normal and Ethereal below */}
      {displayMode === 'all' && (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4">
          <WidgetGauge
            label={t(translations.settings.widget.overall)}
            current={statistics.foundItems}
            total={statistics.totalItems}
            color="purple"
            size="lg"
          />

          {settings.grailEthereal && (
            <div className="flex justify-center gap-6">
              <WidgetGauge
                label={t(translations.grail.itemCard.normal)}
                current={statistics.normalItems.found}
                total={statistics.normalItems.total}
                color="orange"
                size="md"
              />
              <WidgetGauge
                label={t(translations.widget.ethereal)}
                current={statistics.etherealItems.found}
                total={statistics.etherealItems.total}
                color="blue"
                size="md"
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
