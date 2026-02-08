import { AlertCircle, Keyboard, Timer } from 'lucide-react';
import { useCallback, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { translations } from '@/i18n/translations';
import { normalizeShortcut } from '@/lib/hotkeys';
import { useGrailStore } from '@/stores/grailStore';
import { ShortcutRecorder } from './ShortcutRecorder';

/**
 * RunTrackerSettings component that provides controls for configuring run tracking behavior.
 * Allows users to enable/disable auto mode (memory reading) and configure keyboard shortcuts.
 * @returns {JSX.Element} A settings card with run tracker configuration controls
 */
export function RunTrackerSettings() {
  const { t } = useTranslation();
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
          {t(translations.settings.runTracker.title)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {/* Warning when memory reading is unavailable */}
          {isWindows && memoryStatus && !memoryStatus.available && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>{t(translations.settings.runTracker.autoModeUnavailable)}</strong>{' '}
                {t(translations.settings.runTracker.autoModeUnavailableDescription)}
              </AlertDescription>
            </Alert>
          )}

          {/* Memory Polling Interval - visible when auto mode is enabled */}
          {isWindows && autoModeEnabled && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4" />
                <h4 className="font-medium text-sm">
                  {t(translations.settings.runTracker.autoModeSettings)}
                </h4>
              </div>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {t(translations.settings.runTracker.autoModeEnabled)}
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={pollingIntervalId} className="font-medium text-sm">
                    {t(translations.settings.runTracker.memoryPollingInterval)}
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
                  {t(translations.settings.runTracker.pollingIntervalDescription)}
                </p>
              </div>
            </div>
          )}

          {!isWindows && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {t(translations.settings.runTracker.autoModeWindowsOnly)}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Keyboard Shortcuts Settings */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4" />
            <h4 className="font-medium text-sm">
              {t(translations.settings.runTracker.keyboardShortcuts)}
            </h4>
          </div>
          <p className="text-muted-foreground text-xs">
            {t(translations.settings.runTracker.keyboardShortcutsDescription)}
          </p>

          <div className="grid grid-cols-2 gap-4">
            <ShortcutRecorder
              id={startRunShortcutId}
              label={t(translations.settings.runTracker.startRunLabel)}
              value={runTrackerShortcuts.startRun}
              placeholder="Ctrl+R"
              description={t(translations.settings.runTracker.startRunDescription)}
              onChange={(shortcut) => updateShortcut('startRun', shortcut)}
            />
            <ShortcutRecorder
              id={pauseRunShortcutId}
              label={t(translations.settings.runTracker.pauseResumeLabel)}
              value={runTrackerShortcuts.pauseRun}
              placeholder="Ctrl+Space"
              description={t(translations.settings.runTracker.pauseRunDescription)}
              onChange={(shortcut) => updateShortcut('pauseRun', shortcut)}
            />
            <ShortcutRecorder
              id={endRunShortcutId}
              label={t(translations.settings.runTracker.endRunLabel)}
              value={runTrackerShortcuts.endRun}
              placeholder="Ctrl+E"
              description={t(translations.settings.runTracker.endRunDescription)}
              onChange={(shortcut) => updateShortcut('endRun', shortcut)}
            />
            <ShortcutRecorder
              id={endSessionShortcutId}
              label={t(translations.settings.runTracker.endSessionLabel)}
              value={runTrackerShortcuts.endSession}
              placeholder="Ctrl+Shift+E"
              description={t(translations.settings.runTracker.endSessionDescription)}
              onChange={(shortcut) => updateShortcut('endSession', shortcut)}
            />
          </div>
        </div>

        {/* Information Box */}
        <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950">
          <p className="text-blue-800 text-xs dark:text-blue-200">
            <strong>{t(translations.settings.runTracker.runTracking)}</strong>
            <br />• {t(translations.settings.runTracker.infoAutoMode)}
            <br />• {t(translations.settings.runTracker.infoRequires)}
            <br />• {t(translations.settings.runTracker.infoFallback)}
            <br />• {t(translations.settings.runTracker.infoManual)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
