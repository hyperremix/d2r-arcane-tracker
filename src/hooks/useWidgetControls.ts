import type { Settings } from 'electron/types/grail';
import { useCallback, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { clampWidgetOpacity, getDefaultWidgetSize, resolveWidgetDisplayMode } from '@/lib/widget';
import { useGrailStore } from '@/stores/grailStore';
import type { SettingsSaveResult } from '@/stores/settingsStore';

/**
 * Persists a settings update and reports whether it was saved.
 */
export type SaveWidgetSettings = (update: Partial<Settings>) => Promise<SettingsSaveResult>;

/**
 * Shared widget controls for the settings page and the setup wizard: the opacity slider
 * (previewed while dragging, saved once committed) and the run-only item list toggle.
 * The widget window is only updated once the setting was saved.
 * @param {SaveWidgetSettings} [save] - How settings are saved; defaults to the store's
 *   `setSettings` (error toast with Retry). The setup wizard passes its own inline-error save.
 * @returns The derived widget values and the handlers to wire to the controls
 */
export function useWidgetControls(save?: SaveWidgetSettings) {
  const { settings, setSettings } = useGrailStore(
    useShallow((state) => ({ settings: state.settings, setSettings: state.setSettings })),
  );
  const saveSettings: SaveWidgetSettings = save ?? setSettings;
  // Opacity shown while the slider is dragged; it is only saved once the drag is committed
  const [draftOpacity, setDraftOpacity] = useState<number | undefined>(undefined);

  const widgetEnabled = settings.widgetEnabled ?? false;
  const widgetOpacity = draftOpacity ?? clampWidgetOpacity(settings.widgetOpacity);
  const widgetRunOnlyShowItems = settings.widgetRunOnlyShowItems ?? true;
  // The window size follows the mode the widget actually renders (split/all need ethereal tracking)
  const effectiveDisplay = resolveWidgetDisplayMode(settings.widgetDisplay, settings.grailEthereal);

  const previewOpacity = useCallback((value: number | readonly number[]) => {
    const values = Array.isArray(value) ? value : [value];
    setDraftOpacity(clampWidgetOpacity(values[0]));
  }, []);

  const commitOpacity = useCallback(
    async (value: number | readonly number[]) => {
      const values = Array.isArray(value) ? value : [value];
      const opacity = clampWidgetOpacity(values[0]);
      try {
        const result = await saveSettings({ widgetOpacity: opacity });
        if (!result.success) {
          return;
        }
        // Update widget opacity via IPC
        await window.electronAPI?.widget.updateOpacity(opacity);
      } finally {
        setDraftOpacity(undefined);
      }
    },
    [saveSettings],
  );

  const toggleRunOnlyItems = useCallback(
    async (checked: boolean) => {
      // The item list changes how tall the run-only widget needs to be, so switch to its default size
      const result = await saveSettings({
        widgetRunOnlyShowItems: checked,
        widgetSizeRunOnly: getDefaultWidgetSize('run-only', checked),
      });
      if (!result.success) {
        return;
      }
      if (widgetEnabled && effectiveDisplay === 'run-only') {
        await window.electronAPI?.widget.updateDisplay('run-only', settings);
      }
    },
    [effectiveDisplay, saveSettings, settings, widgetEnabled],
  );

  return {
    settings,
    setSettings,
    widgetEnabled,
    widgetOpacity,
    widgetRunOnlyShowItems,
    effectiveDisplay,
    previewOpacity,
    commitOpacity,
    toggleRunOnlyItems,
  };
}
