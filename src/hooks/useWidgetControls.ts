import { useCallback, useState } from 'react';
import { clampWidgetOpacity, getDefaultWidgetSize, resolveWidgetDisplayMode } from '@/lib/widget';
import { useGrailStore } from '@/stores/grailStore';

/**
 * Shared widget controls for the settings page and the setup wizard: the opacity slider
 * (previewed while dragging, saved once committed) and the run-only item list toggle.
 * @returns The derived widget values and the handlers to wire to the controls
 */
export function useWidgetControls() {
  const { settings, setSettings } = useGrailStore();
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
        await setSettings({ widgetOpacity: opacity });
        // Update widget opacity via IPC
        await window.electronAPI?.widget.updateOpacity(opacity);
      } finally {
        setDraftOpacity(undefined);
      }
    },
    [setSettings],
  );

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
