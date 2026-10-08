import type { Settings } from '../types/grail';

/**
 * Window colors matching the renderer's `--background` token per resolved theme.
 * Also imported by the renderer (`THEME_CHROME_COLORS`) for the title bar overlay colors applied
 * by its `useTheme` hook, so both processes use one table.
 */
export const MAIN_WINDOW_THEME_COLORS = {
  dark: { backgroundColor: '#09090b', symbolColor: '#ffffff' },
  light: { backgroundColor: '#ffffff', symbolColor: '#000000' },
} as const;

/**
 * Concrete colors for the main window chrome.
 */
export interface MainWindowThemeColors {
  backgroundColor: string;
  symbolColor: string;
}

/**
 * Picks the main window's background and title bar symbol colors for the stored theme, so the
 * window doesn't paint in the wrong theme before the renderer has loaded.
 * @param {Settings['theme'] | undefined} theme - The stored theme preference (undefined if unavailable)
 * @param {boolean} shouldUseDarkColors - Whether the OS prefers dark colors (`nativeTheme.shouldUseDarkColors`)
 * @returns {MainWindowThemeColors} The colors to apply to the main window
 */
export function getMainWindowThemeColors(
  theme: Settings['theme'] | undefined,
  shouldUseDarkColors: boolean,
): MainWindowThemeColors {
  const isDark = theme === 'dark' || (theme !== 'light' && shouldUseDarkColors);
  return isDark ? MAIN_WINDOW_THEME_COLORS.dark : MAIN_WINDOW_THEME_COLORS.light;
}
