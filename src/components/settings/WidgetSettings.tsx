import { Layers, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { translations } from '@/i18n/translations';
import {
  clampWidgetOpacity,
  MAX_WIDGET_OPACITY,
  MIN_WIDGET_OPACITY,
  resolveWidgetDisplayMode,
} from '@/lib/widget';
import { useGrailStore } from '@/stores/grailStore';

/**
 * WidgetSettings component that provides controls for configuring the overlay widget.
 * Allows users to enable/disable the widget, adjust size, opacity, and reset position.
 * @returns {JSX.Element} A settings card with widget configuration controls
 */
export function WidgetSettings() {
  const { t } = useTranslation();
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
    async (value: number | readonly number[]) => {
      const values = Array.isArray(value) ? value : [value];
      const opacity = clampWidgetOpacity(values[0]);
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
  const widgetOpacity = clampWidgetOpacity(settings.widgetOpacity);
  const widgetEnabled = settings.widgetEnabled ?? false;
  const widgetRunOnlyShowItems = settings.widgetRunOnlyShowItems ?? true;

  // The window size follows the mode the widget actually renders (split/all need ethereal tracking)
  const effectiveDisplay = resolveWidgetDisplayMode(widgetDisplay, settings.grailEthereal);

  const resetSize = useCallback(async () => {
    const result = await window.electronAPI?.widget.resetSize(effectiveDisplay);
    if (result?.success && result.size) {
      // Clear the custom size for this display mode
      const sizeKey =
        `widgetSize${effectiveDisplay.charAt(0).toUpperCase()}${effectiveDisplay.slice(1)}` as
          | 'widgetSizeOverall'
          | 'widgetSizeSplit'
          | 'widgetSizeAll';
      await setSettings({ [sizeKey]: undefined });
    }
  }, [setSettings, effectiveDisplay]);

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
          {t(translations.settings.widget.title)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {/* Enable Widget Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-sm">
                {t(translations.settings.widget.enableWidget)}
              </h4>
              <p className="text-muted-foreground text-xs">
                {t(translations.settings.widget.enableDescription)}
              </p>
            </div>
            <Switch checked={widgetEnabled} onCheckedChange={toggleWidget} />
          </div>

          {/* Display Mode Selection */}
          <div className="space-y-2">
            <Label className="font-medium text-sm">
              {t(translations.settings.widget.displayMode)}
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={widgetDisplay === 'overall' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateDisplay('overall')}
                disabled={!widgetEnabled}
                className="flex-1"
              >
                {t(translations.settings.widget.overall)}
              </Button>
              <Button
                variant={widgetDisplay === 'split' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateDisplay('split')}
                disabled={!widgetEnabled || !settings.grailEthereal}
                className="flex-1"
              >
                {t(translations.settings.widget.split)}
              </Button>
              <Button
                variant={widgetDisplay === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateDisplay('all')}
                disabled={!widgetEnabled || !settings.grailEthereal}
                className="flex-1"
              >
                {t(translations.settings.widget.all)}
              </Button>
              <Button
                variant={widgetDisplay === 'run-only' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateDisplay('run-only')}
                disabled={!widgetEnabled}
                className="flex-1"
              >
                {t(translations.settings.widget.runOnly)}
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              {t(translations.settings.widget.displayModeDescription)}
              {!settings.grailEthereal && (
                <span className="text-warning">
                  {' '}
                  {t(translations.settings.widget.splitAllRequireEthereal)}
                </span>
              )}
            </p>
          </div>

          {/* Run Only Item List Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-sm">
                {t(translations.settings.widget.showRunItemList)}
              </h4>
              <p className="text-muted-foreground text-xs">
                {t(translations.settings.widget.showRunItemListDescription)}
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
                {t(translations.settings.widget.opacity)}
              </Label>
              <span className="text-muted-foreground text-sm">
                {Math.round(widgetOpacity * 100)}%
              </span>
            </div>
            <Slider
              id={opacitySliderId}
              min={MIN_WIDGET_OPACITY}
              max={MAX_WIDGET_OPACITY}
              step={0.05}
              value={[widgetOpacity]}
              onValueChange={updateOpacity}
              disabled={!widgetEnabled}
              className="w-full"
            />
            <p className="text-muted-foreground text-xs">
              {t(translations.settings.widget.opacityDescription, {
                min: Math.round(MIN_WIDGET_OPACITY * 100),
              })}
            </p>
          </div>

          {/* Reset Position Button */}
          <div className="space-y-2">
            <Label className="font-medium text-sm">
              {t(translations.settings.widget.positionAndSize)}
            </Label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={resetPosition}
                disabled={!widgetEnabled}
                className="flex-1"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                {t(translations.settings.widget.resetPosition)}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={resetSize}
                disabled={!widgetEnabled}
                className="flex-1"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                {t(translations.settings.widget.resetSize)}
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              {t(translations.settings.widget.positionDescription)}
            </p>
          </div>

          {/* Widget Preview Description */}
          <div className="rounded-lg bg-info/10 p-3">
            <p className="text-info text-xs">
              <strong>{t(translations.settings.widget.features)}</strong>
              <br />• {t(translations.settings.widget.featureAlwaysOnTop)}
              <br />• {t(translations.settings.widget.featureTransparent)}
              <br />• {t(translations.settings.widget.featureDrag)}
              <br />• {t(translations.settings.widget.featureSnap)}
              <br />• {t(translations.settings.widget.featureSizePersists)}
              <br />• {t(translations.settings.widget.featureRealtime)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
