import type { Settings } from 'electron/types/grail';

/**
 * Display modes supported by the overlay widget.
 */
export type WidgetDisplayMode = NonNullable<Settings['widgetDisplay']>;

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

/**
 * Resolves the display mode the widget can actually render.
 * The split and all modes depend on ethereal tracking; without it they fall back to overall.
 * @param {WidgetDisplayMode | undefined} displayMode - The stored display mode
 * @param {boolean | undefined} grailEthereal - Whether ethereal tracking is enabled
 * @returns {WidgetDisplayMode} The display mode to render
 */
export function resolveWidgetDisplayMode(
  displayMode: WidgetDisplayMode | undefined,
  grailEthereal: boolean | undefined,
): WidgetDisplayMode {
  const mode = displayMode ?? 'overall';
  if (!grailEthereal && (mode === 'split' || mode === 'all')) {
    return 'overall';
  }
  return mode;
}
