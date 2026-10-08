import type { Settings } from 'electron/types/grail';
import { Layers, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useWidgetControls } from '@/hooks/useWidgetControls';
import { translations } from '@/i18n/translations';
import { cn } from '@/lib/utils';
import { getWidgetSizeSettingKey, MAX_WIDGET_OPACITY, MIN_WIDGET_OPACITY } from '@/lib/widget';
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
  const {
    settings,
    setSettings,
    widgetEnabled,
    widgetOpacity,
    widgetRunOnlyShowItems,
    effectiveDisplay,
    previewOpacity,
    commitOpacity,
    toggleRunOnlyItems,
  } = useWidgetControls();
  const enableWidgetLabelId = useId();
  const enableWidgetDescriptionId = useId();
  const displayModeName = useId();
  const displayModeDescriptionId = useId();
  const runItemsLabelId = useId();
  const runItemsDescriptionId = useId();
  const lockLabelId = useId();
  const lockDescriptionId = useId();
  const opacityLabelId = useId();

  const toggleWidget = useCallback(
    async (checked: boolean) => {
      // The widget window is only created or closed through IPC, so this follow-up must also run
      // when the error toast's Retry re-applies the change (hence `onSaved`, not code after the
      // await). Display mode and opacity have no such hook for Retry: the widget window applies
      // them itself when it receives `settings-updated` (their handlers still call the IPC after
      // a successful save).
      await setSettings(
        { widgetEnabled: checked },
        {
          onSaved: async () => {
            await window.electronAPI?.widget.toggle(checked, useGrailStore.getState().settings);
          },
        },
      );
    },
    [setSettings],
  );

  // Display mode whose auto-switch to 'overall' failed to save. A failed save is reverted, which
  // changes `settings` (and so `updateDisplay`) and would otherwise re-run the auto-switch effect
  // forever. It is cleared by any successful display change or when ethereal tracking is enabled.
  const failedAutoSwitchRef = useRef<WidgetDisplayMode | undefined>(undefined);

  const updateDisplay = useCallback(
    async (display: WidgetDisplayMode) => {
      const result = await setSettings({ widgetDisplay: display });
      if (!result.success) {
        return;
      }
      failedAutoSwitchRef.current = undefined;
      // Update widget display mode via IPC
      await window.electronAPI?.widget.updateDisplay(display, settings);
    },
    [setSettings, settings],
  );

  const toggleLock = useCallback(
    async (checked: boolean) => {
      try {
        // Apply click-through to the widget window first so the saved state never claims a lock
        // the window doesn't have
        const result = await window.electronAPI?.widget.setLocked(checked);
        if (result && !result.success) {
          throw new Error(result.error ?? 'Failed to update widget lock state');
        }
        const saveResult = await setSettings(
          { widgetLocked: checked },
          {
            // Re-applies the lock when the error toast's Retry saves the setting later
            onSaved: async () => {
              await window.electronAPI?.widget.setLocked(checked);
            },
          },
        );
        if (!saveResult.success) {
          // The store already shows the save error; undo the window change so both agree
          await window.electronAPI?.widget.setLocked(!checked);
        }
      } catch (error) {
        console.error('Failed to update widget lock state:', error);
        toast.error(t(translations.settings.widget.lockWidgetFailed));
      }
    },
    [setSettings, t],
  );

  const resetPosition = useCallback(async () => {
    const result = await window.electronAPI?.widget.resetPosition();
    if (result?.success && result.position) {
      await setSettings({ widgetPosition: result.position });
    }
  }, [setSettings]);

  const widgetDisplay = settings.widgetDisplay || 'overall';
  const widgetLocked = settings.widgetLocked ?? false;

  const resetSize = useCallback(async () => {
    const result = await window.electronAPI?.widget.resetSize(effectiveDisplay);
    if (result?.success && result.size) {
      // Store the default size the window was reset to for this display mode
      await setSettings({ [getWidgetSizeSettingKey(effectiveDisplay)]: result.size });
    }
  }, [setSettings, effectiveDisplay]);

  // Auto-switch to 'overall' mode if ethereal tracking is disabled and user is in split/all mode
  useEffect(() => {
    if (settings.grailEthereal) {
      failedAutoSwitchRef.current = undefined;
      return;
    }
    if (widgetDisplay !== 'split' && widgetDisplay !== 'all') {
      return;
    }
    if (failedAutoSwitchRef.current === widgetDisplay) {
      return;
    }
    failedAutoSwitchRef.current = widgetDisplay;
    updateDisplay('overall').catch((error) => {
      console.error('Failed to switch the widget display mode:', error);
    });
  }, [settings.grailEthereal, widgetDisplay, updateDisplay]);

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
