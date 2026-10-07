import type { Settings } from '../types/grail';

/**
 * Display modes supported by the overlay widget.
 */
export type WidgetDisplayMode = NonNullable<Settings['widgetDisplay']>;

/**
 * Every supported display mode, used to validate values received over IPC.
 */
const WIDGET_DISPLAY_MODES = ['overall', 'split', 'all', 'run-only'] as const;

// Compile-time check that the list above covers the whole WidgetDisplayMode union
type MissingDisplayModes = Exclude<WidgetDisplayMode, (typeof WIDGET_DISPLAY_MODES)[number]>;
const displayModesAreExhaustive: MissingDisplayModes extends never ? true : never = true;
void displayModesAreExhaustive;

/**
 * Type guard for values received over IPC, which can be anything at runtime.
 * @param {unknown} value - The value to check
 * @returns {boolean} True when the value is a supported widget display mode
 */
export function isWidgetDisplayMode(value: unknown): value is WidgetDisplayMode {
  return typeof value === 'string' && (WIDGET_DISPLAY_MODES as readonly string[]).includes(value);
}

/**
 * Resolves the display mode the widget can actually render.
 * The split and all modes depend on ethereal tracking; without it they fall back to overall.
 * Shared by the renderer (what is drawn) and the main process (native window size).
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

/**
 * Width and height of the widget window in pixels.
 */
export interface WidgetSize {
  width: number;
  height: number;
}

/**
 * Settings keys that store a custom widget window size, one per display mode.
 */
export type WidgetSizeSettingKey =
  | 'widgetSizeOverall'
  | 'widgetSizeSplit'
  | 'widgetSizeAll'
  | 'widgetSizeRunOnly';

const WIDGET_SIZE_SETTING_KEYS: Record<WidgetDisplayMode, WidgetSizeSettingKey> = {
  overall: 'widgetSizeOverall',
  split: 'widgetSizeSplit',
  all: 'widgetSizeAll',
  'run-only': 'widgetSizeRunOnly',
};

/**
 * Default window sizes used when no custom size has been saved for a display mode.
 */
const DEFAULT_WIDGET_SIZES: Record<Exclude<WidgetDisplayMode, 'run-only'>, WidgetSize> = {
  overall: { width: 250, height: 250 }, // Single large gauge
  split: { width: 350, height: 250 }, // Two gauges side by side
  all: { width: 300, height: 350 }, // Overall on top, normal+ethereal below
};

/**
 * Default run-only sizes. The item list (shown by default) needs room for the manual entry field
 * and a few runs, so it gets a taller window than the stats-only layout.
 */
const DEFAULT_RUN_ONLY_SIZES: Record<'withItems' | 'statsOnly', WidgetSize> = {
  withItems: { width: 270, height: 320 },
  statsOnly: { width: 270, height: 190 },
};

/**
 * Maps a display mode to the settings key its custom window size is saved under.
 * @param {WidgetDisplayMode} displayMode - The display mode
 * @returns {WidgetSizeSettingKey} The settings key for that mode's size
 */
export function getWidgetSizeSettingKey(displayMode: WidgetDisplayMode): WidgetSizeSettingKey {
  return WIDGET_SIZE_SETTING_KEYS[displayMode];
}

/**
 * Returns the default window size for a display mode. The run-only default depends on whether
 * its item list is shown.
 * @param {WidgetDisplayMode} displayMode - The display mode
 * @param {boolean | undefined} runOnlyShowItems - Whether the run-only item list is shown (defaults to true)
 * @returns {WidgetSize} A copy of the default size
 */
export function getDefaultWidgetSize(
  displayMode: WidgetDisplayMode,
  runOnlyShowItems: boolean | undefined,
): WidgetSize {
  if (displayMode === 'run-only') {
    const size =
      runOnlyShowItems === false
        ? DEFAULT_RUN_ONLY_SIZES.statsOnly
        : DEFAULT_RUN_ONLY_SIZES.withItems;
    return { ...size };
  }
  return { ...DEFAULT_WIDGET_SIZES[displayMode] };
}
