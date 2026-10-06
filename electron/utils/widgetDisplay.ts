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
