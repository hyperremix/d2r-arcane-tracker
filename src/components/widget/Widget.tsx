import type { GrailStatistics, Settings } from 'electron/types/grail';
import { useEffect, useMemo, useState } from 'react';
import { ProgressGauge } from '@/components/grail/ProgressGauge';
import { formatDuration } from '@/lib/utils';
import { useRunTrackerStore } from '@/stores/runTrackerStore';

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
 * Widget component that displays grail progress statistics in a compact overlay format.
 * Supports multiple size configurations and dynamic opacity.
 */
export function Widget({ statistics, settings, onDragStart, onDragEnd }: WidgetProps) {
  const displayMode = settings.widgetDisplay || 'overall';
  const opacity = settings.widgetOpacity ?? 0.9;
  const backgroundColor = `rgba(0, 0, 0, ${opacity})`;

  // Run tracker state for run-only mode
  const { activeRun } = useRunTrackerStore();
  const [runDuration, setRunDuration] = useState<number>(0);

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

  // Calculate container styles based on display mode
  const containerClasses = useMemo(() => {
    const baseClasses = 'flex flex-col items-center justify-center p-2';
    const gapClasses = {
      overall: 'gap-4',
      split: 'gap-4',
      all: 'gap-6',
      'run-only': 'gap-2',
    };
    return `${baseClasses} ${gapClasses[displayMode]}`;
  }, [displayMode]);

  // Calculate gauge scale based on display mode
  const gaugeScale = useMemo(() => {
    return {
      overall: 1.8, // Single gauge, can be larger
      split: 1.4, // Two gauges side by side
      all: 1.4, // Multiple gauges, standard size
      'run-only': 1.0, // No gauge scaling for run-only mode
    }[displayMode];
  }, [displayMode]);

  // Handle run-only mode separately (doesn't need statistics)
  if (displayMode === 'run-only') {
    return (
      // biome-ignore lint/a11y/useSemanticElements: Widget is a draggable container, not a traditional button
      <div
        role="button"
        tabIndex={0}
        className={containerClasses}
        style={{
          backgroundColor,
          backdropFilter: 'blur(10px)',
          cursor: 'move',
          height: '100vh',
          width: '100vw',
          // @ts-expect-error - WebkitAppRegion is an Electron-specific CSS property
          WebkitAppRegion: 'drag',
        }}
        onMouseDown={onDragStart}
        onMouseUp={onDragEnd}
        // biome-ignore lint/suspicious/noEmptyBlockStatements: No keyboard interaction needed for drag-only widget
        onKeyDown={() => {}}
      >
        {activeRun ? (
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="text-center">
              <p className="text-gray-200 text-xs">Run</p>
              <p className="font-bold text-2xl text-white">#{activeRun.runNumber}</p>
            </div>
            <div className="text-center">
              <p className="text-gray-200 text-xs">Duration</p>
              <p className="font-mono text-lg text-white">{formatDuration(runDuration)}</p>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-gray-200 text-sm">No Active Run</p>
            <p className="text-gray-400 text-xs">Start a session to track runs</p>
          </div>
        )}
      </div>
    );
  }

  if (!statistics) {
    return (
      // biome-ignore lint/a11y/useSemanticElements: Widget is a draggable container, not a traditional button
      <div
        role="button"
        tabIndex={0}
        className={containerClasses}
        style={{
          backgroundColor,
          backdropFilter: 'blur(10px)',
          cursor: 'move',
          height: '100vh',
          width: '100vw',
          // @ts-expect-error - WebkitAppRegion is an Electron-specific CSS property
          WebkitAppRegion: 'drag',
        }}
        onMouseDown={onDragStart}
        onMouseUp={onDragEnd}
        // biome-ignore lint/suspicious/noEmptyBlockStatements: No keyboard interaction needed for drag-only widget
        onKeyDown={() => {}}
      >
        <p className="text-gray-200 text-sm">Loading...</p>
      </div>
    );
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: Widget is a draggable container, not a traditional button
    <div
      role="button"
      tabIndex={0}
      className={containerClasses}
      style={{
        backgroundColor,
        backdropFilter: 'blur(10px)',
        cursor: 'move',
        height: '100vh',
        width: '100vw',
        // @ts-expect-error - WebkitAppRegion is an Electron-specific CSS property
        WebkitAppRegion: 'drag',
      }}
      onMouseDown={onDragStart}
      onMouseUp={onDragEnd}
      // biome-ignore lint/suspicious/noEmptyBlockStatements: No keyboard interaction needed for drag-only widget
      onKeyDown={() => {}}
    >
      {/* Display mode: overall - Just overall progress */}
      {displayMode === 'overall' && (
        <div style={{ transform: `scale(${gaugeScale})` }}>
          <ProgressGauge
            label="Overall"
            current={statistics.foundItems}
            total={statistics.totalItems}
            showLabel
            color="purple"
          />
        </div>
      )}

      {/* Display mode: split - Normal and Ethereal side by side */}
      {displayMode === 'split' && settings.grailEthereal && (
        <div className="flex justify-center gap-12">
          <div style={{ transform: `scale(${gaugeScale})` }}>
            <ProgressGauge
              label="Normal"
              current={statistics.normalItems.found}
              total={statistics.normalItems.total}
              showLabel
              color="orange"
            />
          </div>
          <div style={{ transform: `scale(${gaugeScale})` }}>
            <ProgressGauge
              label="Ethereal"
              current={statistics.etherealItems.found}
              total={statistics.etherealItems.total}
              showLabel
              color="blue"
            />
          </div>
        </div>
      )}

      {/* Display mode: all - Overall on top, Normal and Ethereal below */}
      {displayMode === 'all' && (
        <>
          <div style={{ transform: `scale(${gaugeScale})` }} className="mb-6">
            <ProgressGauge
              label="Overall"
              current={statistics.foundItems}
              total={statistics.totalItems}
              showLabel
              color="purple"
            />
          </div>

          {settings.grailEthereal && (
            <div className="flex justify-center gap-6">
              <div style={{ transform: `scale(${gaugeScale * 0.85})` }}>
                <ProgressGauge
                  label="Normal"
                  current={statistics.normalItems.found}
                  total={statistics.normalItems.total}
                  showLabel
                  color="orange"
                />
              </div>
              <div style={{ transform: `scale(${gaugeScale * 0.85})` }}>
                <ProgressGauge
                  label="Ethereal"
                  current={statistics.etherealItems.found}
                  total={statistics.etherealItems.total}
                  showLabel
                  color="blue"
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
