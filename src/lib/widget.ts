// Shared with the main process so the native window size matches what the renderer draws
export type { WidgetDisplayMode } from 'electron/utils/widgetDisplay';
export {
  getDefaultWidgetSize,
  getWidgetSizeSettingKey,
  resolveWidgetDisplayMode,
} from 'electron/utils/widgetDisplay';

/**
 * Minimum widget background opacity. Lower values make the widget text unreadable
 * over bright game scenes, so the UI and the widget never go below this value.
 */
export const MIN_WIDGET_OPACITY = 0.3;

/**
 * Maximum widget background opacity.
 */
export const MAX_WIDGET_OPACITY = 1;

/**
 * Default widget background opacity used when no value has been stored.
 */
export const DEFAULT_WIDGET_OPACITY = 0.9;

/**
 * Clamps a (possibly missing or invalid) widget opacity value into the supported range.
 * @param {number | undefined} opacity - The stored or requested opacity value
 * @returns {number} An opacity between MIN_WIDGET_OPACITY and MAX_WIDGET_OPACITY
 */
export function clampWidgetOpacity(opacity: number | undefined): number {
  if (opacity === undefined || !Number.isFinite(opacity)) {
    return DEFAULT_WIDGET_OPACITY;
  }
  return Math.min(MAX_WIDGET_OPACITY, Math.max(MIN_WIDGET_OPACITY, opacity));
}
