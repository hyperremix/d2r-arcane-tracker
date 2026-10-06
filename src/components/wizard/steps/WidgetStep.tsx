import { Layers } from 'lucide-react';
import { useCallback, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { translations } from '@/i18n/translations';
import { clampWidgetOpacity, MAX_WIDGET_OPACITY, MIN_WIDGET_OPACITY } from '@/lib/widget';
import { useGrailStore } from '@/stores/grailStore';

/**
 * WidgetStep component - Overlay widget section of the wizard Preferences step.
 * Allows users to enable/disable widget, adjust display mode and opacity.
 * @returns {JSX.Element} Widget configuration section content
 */
export function WidgetStep() {
  const { t } = useTranslation();
  const opacitySliderId = useId();
  const headingId = useId();
  const { settings, setSettings } = useGrailStore();

  const widgetEnabled = settings.widgetEnabled ?? false;
  const widgetDisplay = settings.widgetDisplay || 'overall';
  const widgetOpacity = clampWidgetOpacity(settings.widgetOpacity);
  const grailEthereal = settings.grailEthereal ?? false;
  const widgetRunOnlyShowItems = settings.widgetRunOnlyShowItems ?? true;

  const toggleWidget = useCallback(
    async (checked: boolean) => {
      await setSettings({ widgetEnabled: checked });
      // Toggle widget visibility via IPC
      await window.electronAPI?.widget.toggle(checked, settings);
    },
    [settings, setSettings],
  );

  const handleDisplayChange = useCallback(
    async (display: 'overall' | 'split' | 'all' | 'run-only') => {
      await setSettings({ widgetDisplay: display });
      // Update widget display mode via IPC
      await window.electronAPI?.widget.updateDisplay(display, settings);
    },
    [setSettings, settings],
  );

  const handleOpacityChange = useCallback(
    async (value: number | readonly number[]) => {
      const values = Array.isArray(value) ? value : [value];
      const opacity = clampWidgetOpacity(values[0]);
      await setSettings({ widgetOpacity: opacity });
      // Update widget opacity via IPC
      await window.electronAPI?.widget.updateOpacity(opacity);
    },
    [setSettings],
  );

  const handleRunOnlyItemsChange = useCallback(
    async (checked: boolean) => {
      await setSettings({ widgetRunOnlyShowItems: checked });
    },
    [setSettings],
  );

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Layers className="h-6 w-6" />
          <h3 id={headingId} className="font-semibold text-lg">
            {t(translations.settings.widget.title)}
          </h3>
        </div>
        <p className="text-muted-foreground text-sm">{t(translations.wizard.widget.description)}</p>
      </div>

      <div className="space-y-6">
        {/* Enable Widget Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-sm">{t(translations.settings.widget.enableWidget)}</h4>
            <p className="text-muted-foreground text-xs">
              {t(translations.settings.widget.enableDescription)}
            </p>
          </div>
          <Switch
            aria-label={t(translations.settings.widget.enableWidget)}
            checked={widgetEnabled}
            onCheckedChange={toggleWidget}
          />
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
              onClick={() => handleDisplayChange('overall')}
              disabled={!widgetEnabled}
              className="flex-1"
            >
              {t(translations.settings.widget.overall)}
            </Button>
            <Button
              variant={widgetDisplay === 'split' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleDisplayChange('split')}
              disabled={!widgetEnabled || !grailEthereal}
              className="flex-1"
            >
              {t(translations.settings.widget.split)}
            </Button>
            <Button
              variant={widgetDisplay === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleDisplayChange('all')}
              disabled={!widgetEnabled || !grailEthereal}
              className="flex-1"
            >
              {t(translations.settings.widget.all)}
            </Button>
            <Button
              variant={widgetDisplay === 'run-only' ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleDisplayChange('run-only')}
              disabled={!widgetEnabled}
              className="flex-1"
            >
              {t(translations.settings.widget.runOnly)}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            {t(translations.settings.widget.displayModeDescription)}
            {!grailEthereal && (
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
            aria-label={t(translations.settings.widget.showRunItemList)}
            checked={widgetRunOnlyShowItems}
            onCheckedChange={handleRunOnlyItemsChange}
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
            onValueChange={handleOpacityChange}
            disabled={!widgetEnabled}
            className="w-full"
          />
          <p className="text-muted-foreground text-xs">
            {t(translations.settings.widget.opacityDescription, {
              min: Math.round(MIN_WIDGET_OPACITY * 100),
            })}
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
            <br />• {t(translations.settings.widget.featureRealtime)}
            <br />
            <br />
            <strong>{t(translations.wizard.tip)}</strong> {t(translations.wizard.widget.tip)}
          </p>
        </div>
      </div>
    </section>
  );
}
