import { Layers, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useId } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useGrailStore } from '@/stores/grailStore';

/**
 * WidgetSettings component that provides controls for configuring the overlay widget.
 * Allows users to enable/disable the widget, adjust size, opacity, and reset position.
 * @returns {JSX.Element} A settings card with widget configuration controls
 */
export function WidgetSettings() {
  const { settings, setSettings } = useGrailStore();
  const opacitySliderId = useId();

  const toggleWidget = useCallback(
    async (checked: boolean) => {
      await setSettings({ widgetEnabled: checked });
      // Toggle widget visibility via IPC
      await window.electronAPI?.widget.toggle(checked, settings);
    },
    [settings, setSettings],
  );

  const updateDisplay = useCallback(
    async (display: 'overall' | 'split' | 'all' | 'run-only') => {
      await setSettings({ widgetDisplay: display });
      // Update widget display mode via IPC
      await window.electronAPI?.widget.updateDisplay(display, settings);
    },
    [setSettings, settings],
  );

  const updateOpacity = useCallback(
    async (values: number[]) => {
      const opacity = values[0];
      await setSettings({ widgetOpacity: opacity });
      // Update widget opacity via IPC
      await window.electronAPI?.widget.updateOpacity(opacity);
    },
    [setSettings],
  );

  const resetPosition = useCallback(async () => {
    const result = await window.electronAPI?.widget.resetPosition();
    if (result?.success && result.position) {
      await setSettings({ widgetPosition: result.position });
    }
  }, [setSettings]);

  const widgetDisplay = settings.widgetDisplay || 'overall';
  const widgetOpacity = settings.widgetOpacity ?? 0.9;
  const widgetEnabled = settings.widgetEnabled ?? false;
  const widgetRunOnlyShowItems = settings.widgetRunOnlyShowItems ?? true;

  const resetSize = useCallback(async () => {
    const result = await window.electronAPI?.widget.resetSize(widgetDisplay);
    if (result?.success && result.size) {
      // Clear the custom size for this display mode
      const sizeKey =
        `widgetSize${widgetDisplay.charAt(0).toUpperCase()}${widgetDisplay.slice(1)}` as
          | 'widgetSizeOverall'
          | 'widgetSizeSplit'
          | 'widgetSizeAll';
      await setSettings({ [sizeKey]: undefined });
    }
  }, [setSettings, widgetDisplay]);

  // Auto-switch to 'overall' mode if ethereal tracking is disabled and user is in split/all mode
  useEffect(() => {
    if (!settings.grailEthereal && (widgetDisplay === 'split' || widgetDisplay === 'all')) {
      updateDisplay('overall');
    }
  }, [settings.grailEthereal, widgetDisplay, updateDisplay]);

  const toggleRunOnlyItems = useCallback(
    async (checked: boolean) => {
      await setSettings({ widgetRunOnlyShowItems: checked });
    },
    [setSettings],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Layers className="h-5 w-5" />
          Widget Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
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
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={widgetDisplay === 'overall' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateDisplay('overall')}
                disabled={!widgetEnabled}
                className="flex-1"
              >
                Overall
              </Button>
              <Button
                variant={widgetDisplay === 'split' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateDisplay('split')}
                disabled={!widgetEnabled || !settings.grailEthereal}
                className="flex-1"
              >
                Split
              </Button>
              <Button
                variant={widgetDisplay === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateDisplay('all')}
                disabled={!widgetEnabled || !settings.grailEthereal}
                className="flex-1"
              >
                All
              </Button>
              <Button
                variant={widgetDisplay === 'run-only' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateDisplay('run-only')}
                disabled={!widgetEnabled}
                className="flex-1"
              >
                Run Only
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Overall: Total progress only | Split: Normal + Ethereal | All: All three gauges | Run
              Only: Current run counter
              {!settings.grailEthereal && (
                <span className="text-yellow-600"> (Split & All require Ethereal tracking)</span>
              )}
            </p>
          </div>

          {/* Run Only Item List Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-sm">Show Run Item List</h4>
              <p className="text-muted-foreground text-xs">
                In Run Only mode, show a compact text list of grail-relevant items found each run.
              </p>
            </div>
            <Switch
              checked={widgetRunOnlyShowItems}
              onCheckedChange={toggleRunOnlyItems}
              disabled={!widgetEnabled}
            />
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
              onValueChange={updateOpacity}
              disabled={!widgetEnabled}
              className="w-full"
            />
            <p className="text-muted-foreground text-xs">Adjust widget transparency (0% to 100%)</p>
          </div>

          {/* Reset Position Button */}
          <div className="space-y-2">
            <Label className="font-medium text-sm">Position & Size</Label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={resetPosition}
                disabled={!widgetEnabled}
                className="flex-1"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset Position
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={resetSize}
                disabled={!widgetEnabled}
                className="flex-1"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset Size
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              The widget can be dragged, resized, and snaps to screen edges and corners
            </p>
          </div>

          {/* Widget Preview Description */}
          <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950">
            <p className="text-blue-800 text-xs dark:text-blue-200">
              <strong>Widget Features:</strong>
              <br />• Always on top of other windows
              <br />• Transparent background
              <br />• Drag to reposition, resize by edges/corners
              <br />• Auto-snaps to screen edges and corners
              <br />• Size persists per display mode
              <br />• Updates in real-time with grail progress
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
