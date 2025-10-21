import { Layers } from 'lucide-react';
import { useCallback, useId } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useGrailStore } from '@/stores/grailStore';

/**
 * WidgetStep component - Step for configuring the overlay widget.
 * Allows users to enable/disable widget, adjust display mode and opacity.
 * @returns {JSX.Element} Widget configuration step content
 */
export function WidgetStep() {
  const opacitySliderId = useId();
  const { settings, setSettings } = useGrailStore();

  const widgetEnabled = settings.widgetEnabled ?? false;
  const widgetDisplay = settings.widgetDisplay || 'overall';
  const widgetOpacity = settings.widgetOpacity ?? 0.9;
  const grailEthereal = settings.grailEthereal ?? false;

  const toggleWidget = useCallback(
    async (checked: boolean) => {
      await setSettings({ widgetEnabled: checked });
      // Toggle widget visibility via IPC
      await window.electronAPI?.widget.toggle(checked, settings);
    },
    [settings, setSettings],
  );

  const handleDisplayChange = useCallback(
    async (display: 'overall' | 'split' | 'all') => {
      await setSettings({ widgetDisplay: display });
      // Update widget display mode via IPC
      await window.electronAPI?.widget.updateDisplay(display);
    },
    [setSettings],
  );

  const handleOpacityChange = useCallback(
    async (values: number[]) => {
      const opacity = values[0];
      await setSettings({ widgetOpacity: opacity });
      // Update widget opacity via IPC
      await window.electronAPI?.widget.updateOpacity(opacity);
    },
    [setSettings],
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Layers className="h-6 w-6" />
          <h2 className="font-bold text-2xl">Widget Settings</h2>
        </div>
        <p className="text-muted-foreground">
          Configure the optional overlay widget that displays your grail progress.
        </p>
      </div>

      <div className="space-y-6">
        {/* Enable Widget Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-sm">Enable Widget</h4>
            <p className="text-muted-foreground text-xs">
              Show an overlay widget with grail progress
            </p>
          </div>
          <Switch checked={widgetEnabled} onCheckedChange={toggleWidget} />
        </div>

        {/* Display Mode Selection */}
        <div className="space-y-2">
          <Label className="font-medium text-sm">Display Mode</Label>
          <div className="flex gap-2">
            <Button
              variant={widgetDisplay === 'overall' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleDisplayChange('overall')}
              disabled={!widgetEnabled}
              className="flex-1"
            >
              Overall
            </Button>
            <Button
              variant={widgetDisplay === 'split' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleDisplayChange('split')}
              disabled={!widgetEnabled || !grailEthereal}
              className="flex-1"
            >
              Split
            </Button>
            <Button
              variant={widgetDisplay === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleDisplayChange('all')}
              disabled={!widgetEnabled || !grailEthereal}
              className="flex-1"
            >
              All
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Overall: Total progress only | Split: Normal + Ethereal | All: All three gauges
            {!grailEthereal && (
              <span className="text-yellow-600"> (Split & All require Ethereal tracking)</span>
            )}
          </p>
        </div>

        {/* Opacity Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor={opacitySliderId} className="font-medium text-sm">
              Opacity
            </Label>
            <span className="text-muted-foreground text-sm">
              {Math.round(widgetOpacity * 100)}%
            </span>
          </div>
          <Slider
            id={opacitySliderId}
            min={0}
            max={1.0}
            step={0.05}
            value={[widgetOpacity]}
            onValueChange={handleOpacityChange}
            disabled={!widgetEnabled}
            className="w-full"
          />
          <p className="text-muted-foreground text-xs">Adjust widget transparency (0% to 100%)</p>
        </div>

        {/* Widget Preview Description */}
        <div className="rounded-md border border-dashed p-4">
          <p className="text-muted-foreground text-xs">
            <strong>Widget Features:</strong>
            <br />• Always on top of other windows
            <br />• Transparent background
            <br />• Drag to reposition
            <br />• Auto-snaps to screen edges and corners
            <br />• Updates in real-time with grail progress
          </p>
        </div>

        <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950">
          <p className="text-blue-800 text-sm dark:text-blue-200">
            <strong>Tip:</strong> The widget is great for monitoring progress while playing in
            fullscreen mode. You can always enable it later from settings!
          </p>
        </div>
      </div>
    </div>
  );
}
