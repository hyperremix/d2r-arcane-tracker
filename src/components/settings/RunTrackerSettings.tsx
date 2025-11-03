import { AlertCircle, Keyboard, Timer } from 'lucide-react';
import { useCallback, useId } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useGrailStore } from '@/stores/grailStore';

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

  const toggleAutoMode = useCallback(
    async (checked: boolean) => {
      await setSettings({ runTrackerMemoryReading: checked });
    },
    [setSettings],
  );

  const updatePollingInterval = useCallback(
    async (values: number[]) => {
      const interval = Math.max(100, Math.min(5000, values[0])); // Clamp between 100ms and 5s
      await setSettings({ runTrackerMemoryPollingInterval: interval });
    },
    [setSettings],
  );

  const updateShortcut = useCallback(
    async (key: keyof typeof runTrackerShortcuts, value: string) => {
      await setSettings({
        runTrackerShortcuts: {
          ...runTrackerShortcuts,
          [key]: value,
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
          {/* Auto Mode Toggle (Windows only) */}
          {isWindows && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="flex items-center gap-2 font-medium text-sm">
                    <Timer className="h-4 w-4" />
                    Auto Mode (Memory Reading)
                  </h4>
                  <p className="text-muted-foreground text-xs">
                    Automatically detect game start/end by reading D2R process memory. Requires D2R
                    to be running.
                  </p>
                </div>
                <Switch checked={autoModeEnabled} onCheckedChange={toggleAutoMode} />
              </div>

              {autoModeEnabled && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Auto mode is enabled. Runs will start/end automatically when you enter/exit
                    games in D2R. If D2R is not running or offsets are invalid, auto detection will
                    not work.
                  </AlertDescription>
                </Alert>
              )}

              {autoModeEnabled && (
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
              )}
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
            <div className="space-y-2">
              <Label htmlFor={startRunShortcutId} className="text-muted-foreground text-xs">
                Start Run:
              </Label>
              <Input
                id={startRunShortcutId}
                value={runTrackerShortcuts.startRun}
                onChange={(e) => updateShortcut('startRun', e.target.value)}
                className="h-8 text-xs"
                placeholder="Ctrl+R"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={pauseRunShortcutId} className="text-muted-foreground text-xs">
                Pause/Resume Run:
              </Label>
              <Input
                id={pauseRunShortcutId}
                value={runTrackerShortcuts.pauseRun}
                onChange={(e) => updateShortcut('pauseRun', e.target.value)}
                className="h-8 text-xs"
                placeholder="Ctrl+Space"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={endRunShortcutId} className="text-muted-foreground text-xs">
                End Run:
              </Label>
              <Input
                id={endRunShortcutId}
                value={runTrackerShortcuts.endRun}
                onChange={(e) => updateShortcut('endRun', e.target.value)}
                className="h-8 text-xs"
                placeholder="Ctrl+E"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={endSessionShortcutId} className="text-muted-foreground text-xs">
                End Session:
              </Label>
              <Input
                id={endSessionShortcutId}
                value={runTrackerShortcuts.endSession}
                onChange={(e) => updateShortcut('endSession', e.target.value)}
                className="h-8 text-xs"
                placeholder="Ctrl+Shift+E"
              />
            </div>
          </div>
        </div>

        {/* Information Box */}
        <div className="rounded-md border border-dashed p-3">
          <p className="text-muted-foreground text-xs">
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
