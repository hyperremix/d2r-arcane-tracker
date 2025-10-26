import { Play, Timer } from 'lucide-react';
import { useCallback, useId } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useGrailStore } from '@/stores/grailStore';

/**
 * RunTrackerSettings component that provides controls for configuring run tracking behavior.
 * Allows users to enable/disable auto-start and adjust the run end threshold.
 * @returns {JSX.Element} A settings card with run tracker configuration controls
 */
export function RunTrackerSettings() {
  const { settings, setSettings } = useGrailStore();
  const thresholdSliderId = useId();

  const toggleAutoStart = useCallback(
    async (checked: boolean) => {
      await setSettings({ runTrackerAutoStart: checked });
    },
    [setSettings],
  );

  const updateThreshold = useCallback(
    async (values: number[]) => {
      const threshold = Math.max(5, Math.min(60, values[0])); // Clamp between 5-60 seconds
      await setSettings({ runTrackerEndThreshold: threshold });
    },
    [setSettings],
  );

  const runTrackerAutoStart = settings.runTrackerAutoStart ?? true;
  const runTrackerEndThreshold = settings.runTrackerEndThreshold ?? 10;

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
          {/* Auto-Start Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="flex items-center gap-2 font-medium text-sm">
                <Play className="h-4 w-4" />
                Auto-Start Runs
              </h4>
              <p className="text-muted-foreground text-xs">
                Automatically start runs when save files are modified
              </p>
            </div>
            <Switch checked={runTrackerAutoStart} onCheckedChange={toggleAutoStart} />
          </div>

          {/* Threshold Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={thresholdSliderId} className="font-medium text-sm">
                Run End Threshold
              </Label>
              <span className="text-muted-foreground text-sm">{runTrackerEndThreshold}s</span>
            </div>
            <Slider
              id={thresholdSliderId}
              min={5}
              max={60}
              step={1}
              value={[runTrackerEndThreshold]}
              onValueChange={updateThreshold}
              className="w-full"
            />
            <p className="text-muted-foreground text-xs">
              Time in seconds before ending a run when no save file activity is detected (5-60
              seconds)
            </p>
          </div>
        </div>

        {/* Information Box */}
        <div className="rounded-md border border-dashed p-3">
          <p className="text-muted-foreground text-xs">
            <strong>Run Tracking:</strong>
            <br />• Auto-start detects when you enter a game by monitoring save file changes
            <br />• Runs automatically end after the threshold period with no save activity
            <br />• Manual controls are always available regardless of auto-start setting
            <br />• Threshold helps distinguish between active gameplay and idle time
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
