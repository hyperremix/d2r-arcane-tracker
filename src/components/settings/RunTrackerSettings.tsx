import { AlertCircle, Keyboard, Timer } from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { normalizeShortcut } from '@/lib/hotkeys';
import { useGrailStore } from '@/stores/grailStore';
import { ShortcutRecorder } from './ShortcutRecorder';

/**
 * RunTrackerSettings component that provides controls for configuring run tracking behavior.
 * Allows users to enable/disable auto mode (memory reading) and configure keyboard shortcuts.
 * @returns {JSX.Element} A settings card with run tracker configuration controls
 */
export function RunTrackerSettings() {
  const { settings, setSettings } = useGrailStore();
  const startRunShortcutId = useId();
  const pauseRunShortcutId = useId();
  const endRunShortcutId = useId();
  const endSessionShortcutId = useId();
  const pollingIntervalId = useId();

  const autoModeEnabled = settings.runTrackerMemoryReading ?? false;
  const runTrackerMemoryPollingInterval = settings.runTrackerMemoryPollingInterval ?? 500;
  const runTrackerShortcuts = settings.runTrackerShortcuts ?? {
    startRun: 'Ctrl+R',
    pauseRun: 'Ctrl+Space',
    endRun: 'Ctrl+E',
    endSession: 'Ctrl+Shift+E',
  };

  const isWindows = window.electronAPI?.platform === 'win32';
  const [memoryStatus, setMemoryStatus] = useState<{
    available: boolean;
    reason: string | null;
  } | null>(null);

  useEffect(() => {
    if (isWindows) {
      window.electronAPI?.runTracker?.getMemoryStatus?.().then(setMemoryStatus);
    }
  }, [isWindows]);

  const updatePollingInterval = useCallback(
    async (value: number | readonly number[]) => {
      const values = Array.isArray(value) ? value : [value];
      const interval = Math.max(100, Math.min(5000, values[0])); // Clamp between 100ms and 5s
      await setSettings({ runTrackerMemoryPollingInterval: interval });
    },
    [setSettings],
  );

  const updateShortcut = useCallback(
    async (key: keyof typeof runTrackerShortcuts, value: string) => {
      const normalized = normalizeShortcut(value);
      if (!normalized) {
        return;
      }
      await setSettings({
        runTrackerShortcuts: {
          ...runTrackerShortcuts,
          [key]: normalized,
        },
      });
    },
    [setSettings, runTrackerShortcuts],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Timer className="h-5 w-5" />
          Run Tracker Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {/* Warning when memory reading is unavailable */}
          {isWindows && memoryStatus && !memoryStatus.available && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Auto mode temporarily unavailable.</strong> D2R 2.9 changed memory patterns
                that are required for automatic game detection. Manual run tracking using keyboard
                shortcuts still works.
              </AlertDescription>
            </Alert>
          )}

          {/* Memory Polling Interval - visible when auto mode is enabled */}
          {isWindows && autoModeEnabled && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4" />
                <h4 className="font-medium text-sm">Auto Mode Settings</h4>
              </div>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Auto mode is enabled. Runs will start/end automatically when you enter/exit games
                  in D2R. If D2R is not running or offsets are invalid, auto detection will not
                  work.
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={pollingIntervalId} className="font-medium text-sm">
                    Memory Polling Interval
                  </Label>
                  <span className="text-muted-foreground text-sm">
                    {runTrackerMemoryPollingInterval}ms
                  </span>
                </div>
                <Slider
                  min={100}
                  max={5000}
                  step={100}
                  value={[runTrackerMemoryPollingInterval]}
                  onValueChange={updatePollingInterval}
                  className="w-full"
                />
                <p className="text-muted-foreground text-xs">
                  How often to check memory for game state changes (100-5000ms). Lower values
                  provide faster detection but use more CPU.
                </p>
              </div>
            </div>
          )}

          {!isWindows && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Auto mode (memory reading) is only available on Windows. Manual run tracking is
                always available.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Keyboard Shortcuts Settings */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4" />
            <h4 className="font-medium text-sm">Keyboard Shortcuts</h4>
          </div>
          <p className="text-muted-foreground text-xs">
            Configure keyboard shortcuts for run tracking actions
          </p>

          <div className="grid grid-cols-2 gap-4">
            <ShortcutRecorder
              id={startRunShortcutId}
              label="Start Run:"
              value={runTrackerShortcuts.startRun}
              placeholder="Ctrl+R"
              description="Start a new manual run."
              onChange={(shortcut) => updateShortcut('startRun', shortcut)}
            />
            <ShortcutRecorder
              id={pauseRunShortcutId}
              label="Pause/Resume Run:"
              value={runTrackerShortcuts.pauseRun}
              placeholder="Ctrl+Space"
              description="Toggle pause state for the current run."
              onChange={(shortcut) => updateShortcut('pauseRun', shortcut)}
            />
            <ShortcutRecorder
              id={endRunShortcutId}
              label="End Run:"
              value={runTrackerShortcuts.endRun}
              placeholder="Ctrl+E"
              description="End the current run immediately."
              onChange={(shortcut) => updateShortcut('endRun', shortcut)}
            />
            <ShortcutRecorder
              id={endSessionShortcutId}
              label="End Session:"
              value={runTrackerShortcuts.endSession}
              placeholder="Ctrl+Shift+E"
              description="Finish the active session."
              onChange={(shortcut) => updateShortcut('endSession', shortcut)}
            />
          </div>
        </div>

        {/* Information Box */}
        <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950">
          <p className="text-blue-800 text-xs dark:text-blue-200">
            <strong>Run Tracking:</strong>
            <br />• Auto mode uses memory reading to detect game start/end instantly (Windows only)
            <br />• Requires D2R.exe to be running and valid memory offsets configured
            <br />• If auto mode cannot work, you can always use manual run controls (keyboard
            shortcuts)
            <br />• Manual controls are available at any time via the keyboard shortcuts above
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
