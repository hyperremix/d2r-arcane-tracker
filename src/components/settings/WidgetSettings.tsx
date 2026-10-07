import type { Settings } from 'electron/types/grail';
import { Layers, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { translations } from '@/i18n/translations';
import { cn } from '@/lib/utils';
import {
  clampWidgetOpacity,
  getDefaultWidgetSize,
  getWidgetSizeSettingKey,
  MAX_WIDGET_OPACITY,
  MIN_WIDGET_OPACITY,
  resolveWidgetDisplayMode,
} from '@/lib/widget';
import { useGrailStore } from '@/stores/grailStore';

type WidgetDisplayMode = NonNullable<Settings['widgetDisplay']>;

interface DisplayModeOption {
  value: WidgetDisplayMode;
  label: string;
  disabled: boolean;
}

/**
 * WidgetSettings component that provides controls for configuring the overlay widget.
 * Allows users to enable/disable the widget, adjust size, opacity, and reset position.
 * @returns {JSX.Element} A settings card with widget configuration controls
 */
export function WidgetSettings() {
  const { t } = useTranslation();
  const { settings, setSettings } = useGrailStore();
  const enableWidgetLabelId = useId();
  const enableWidgetDescriptionId = useId();
  const displayModeName = useId();
  const displayModeDescriptionId = useId();
  const runItemsLabelId = useId();
  const runItemsDescriptionId = useId();
  const lockLabelId = useId();
  const lockDescriptionId = useId();
  const opacityLabelId = useId();
  // Opacity shown while the slider is dragged; it is only saved once the drag is committed
  const [draftOpacity, setDraftOpacity] = useState<number | undefined>(undefined);

  const toggleWidget = useCallback(
    async (checked: boolean) => {
      await setSettings({ widgetEnabled: checked });
      // Toggle widget visibility via IPC
      await window.electronAPI?.widget.toggle(checked, settings);
    },
    [settings, setSettings],
  );

  const updateDisplay = useCallback(
    async (display: WidgetDisplayMode) => {
      await setSettings({ widgetDisplay: display });
      // Update widget display mode via IPC
      await window.electronAPI?.widget.updateDisplay(display, settings);
    },
    [setSettings, settings],
  );

  const previewOpacity = useCallback((value: number | readonly number[]) => {
    const values = Array.isArray(value) ? value : [value];
    setDraftOpacity(clampWidgetOpacity(values[0]));
  }, []);

  const commitOpacity = useCallback(
    async (value: number | readonly number[]) => {
      const values = Array.isArray(value) ? value : [value];
      const opacity = clampWidgetOpacity(values[0]);
      try {
        await setSettings({ widgetOpacity: opacity });
        // Update widget opacity via IPC
        await window.electronAPI?.widget.updateOpacity(opacity);
      } finally {
        setDraftOpacity(undefined);
      }
    },
    [setSettings],
  );

  const toggleLock = useCallback(
    async (checked: boolean) => {
      await setSettings({ widgetLocked: checked });
      // Apply click-through to the widget window via IPC
      await window.electronAPI?.widget.setLocked(checked);
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
  const widgetOpacity = draftOpacity ?? clampWidgetOpacity(settings.widgetOpacity);
  const widgetEnabled = settings.widgetEnabled ?? false;
  const widgetRunOnlyShowItems = settings.widgetRunOnlyShowItems ?? true;
  const widgetLocked = settings.widgetLocked ?? false;

  // The window size follows the mode the widget actually renders (split/all need ethereal tracking)
  const effectiveDisplay = resolveWidgetDisplayMode(widgetDisplay, settings.grailEthereal);

  const resetSize = useCallback(async () => {
    const result = await window.electronAPI?.widget.resetSize(effectiveDisplay);
    if (result?.success && result.size) {
      // Store the default size the window was reset to for this display mode
      await setSettings({ [getWidgetSizeSettingKey(effectiveDisplay)]: result.size });
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
      // The item list changes how tall the run-only widget needs to be, so switch to its default size
      await setSettings({
        widgetRunOnlyShowItems: checked,
        widgetSizeRunOnly: getDefaultWidgetSize('run-only', checked),
      });
      if (widgetEnabled && effectiveDisplay === 'run-only') {
        await window.electronAPI?.widget.updateDisplay('run-only', settings);
      }
    },
    [effectiveDisplay, setSettings, settings, widgetEnabled],
  );

  const displayModeOptions = useMemo<DisplayModeOption[]>(
    () => [
      {
        value: 'overall',
        label: t(translations.settings.widget.overall),
        disabled: !widgetEnabled,
      },
      {
        value: 'split',
        label: t(translations.settings.widget.split),
        disabled: !widgetEnabled || !settings.grailEthereal,
      },
      {
        value: 'all',
        label: t(translations.settings.widget.all),
        disabled: !widgetEnabled || !settings.grailEthereal,
      },
      {
        value: 'run-only',
        label: t(translations.settings.widget.runOnly),
        disabled: !widgetEnabled,
      },
    ],
    [settings.grailEthereal, t, widgetEnabled],
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
              <h4 id={enableWidgetLabelId} className="font-medium text-sm">
                {t(translations.settings.widget.enableWidget)}
              </h4>
              <p id={enableWidgetDescriptionId} className="text-muted-foreground text-xs">
                {t(translations.settings.widget.enableDescription)}
              </p>
            </div>
            <Switch
              checked={widgetEnabled}
              onCheckedChange={toggleWidget}
              aria-labelledby={enableWidgetLabelId}
              aria-describedby={enableWidgetDescriptionId}
            />
          </div>

          {/* Display Mode Selection: native radios give arrow-key and Tab support */}
          <fieldset className="space-y-2" aria-describedby={displayModeDescriptionId}>
            <legend className="mb-2 font-medium text-sm">
              {t(translations.settings.widget.displayMode)}
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {displayModeOptions.map((option) => {
                const isSelected = widgetDisplay === option.value;
                return (
                  <label
                    key={option.value}
                    className={cn(
                      buttonVariants({ variant: isSelected ? 'default' : 'outline', size: 'sm' }),
                      'relative flex-1 cursor-pointer has-disabled:pointer-events-none has-focus-visible:border-ring has-disabled:opacity-50 has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50',
                    )}
                  >
                    <input
                      type="radio"
                      name={displayModeName}
                      value={option.value}
                      checked={isSelected}
                      onChange={() => updateDisplay(option.value)}
                      disabled={option.disabled}
                      className="sr-only"
                    />
                    {option.label}
                  </label>
                );
              })}
            </div>
            <p id={displayModeDescriptionId} className="text-muted-foreground text-xs">
              {t(translations.settings.widget.displayModeDescription)}
              {!settings.grailEthereal && (
                <span className="text-warning">
                  {' '}
                  {t(translations.settings.widget.splitAllRequireEthereal)}
                </span>
              )}
            </p>
          </fieldset>

          {/* Run Only Item List Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <h4 id={runItemsLabelId} className="font-medium text-sm">
                {t(translations.settings.widget.showRunItemList)}
              </h4>
              <p id={runItemsDescriptionId} className="text-muted-foreground text-xs">
                {t(translations.settings.widget.showRunItemListDescription)}
              </p>
            </div>
            <Switch
              checked={widgetRunOnlyShowItems}
              onCheckedChange={toggleRunOnlyItems}
              disabled={!widgetEnabled}
              aria-labelledby={runItemsLabelId}
              aria-describedby={runItemsDescriptionId}
            />
          </div>

          {/* Lock (click-through) Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <h4 id={lockLabelId} className="font-medium text-sm">
                {t(translations.settings.widget.lockWidget)}
              </h4>
              <p id={lockDescriptionId} className="text-muted-foreground text-xs">
                {t(translations.settings.widget.lockWidgetDescription)}
              </p>
            </div>
            <Switch
              checked={widgetLocked}
              onCheckedChange={toggleLock}
              disabled={!widgetEnabled}
              aria-labelledby={lockLabelId}
              aria-describedby={lockDescriptionId}
            />
          </div>

          {/* Opacity Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label id={opacityLabelId} className="font-medium text-sm">
                {t(translations.settings.widget.opacity)}
              </Label>
              <span className="text-muted-foreground text-sm">
                {Math.round(widgetOpacity * 100)}%
              </span>
            </div>
            <Slider
              aria-labelledby={opacityLabelId}
              min={MIN_WIDGET_OPACITY}
              max={MAX_WIDGET_OPACITY}
              step={0.05}
              value={[widgetOpacity]}
              onValueChange={previewOpacity}
              onValueCommitted={commitOpacity}
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
              <br />
              <br />
              <strong>{t(translations.wizard.tip)}</strong>{' '}
              {t(translations.settings.widget.fullscreenTip)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
