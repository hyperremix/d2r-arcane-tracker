import type { Settings } from 'electron/types/grail';
import type { MainWindowThemeColors } from 'electron/window/mainWindowTheme';
import { MAIN_WINDOW_THEME_COLORS } from 'electron/window/mainWindowTheme';

/**
 * A theme preference that has been resolved to a concrete appearance.
 */
export type ResolvedTheme = 'light' | 'dark';

/**
 * Media query matching an OS-level dark color scheme preference.
 */
export const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * localStorage key holding the last theme preference, used to apply the theme before settings load.
 * The preference (not the resolved theme) is cached so `system` can be re-resolved on each startup.
 */
export const THEME_PREFERENCE_STORAGE_KEY = 'd2r-arcane-tracker:theme-preference';

/**
 * Window chrome colors (Windows title bar overlay) per resolved theme.
 * Shared with the main process so the window background and the title bar overlay can't drift.
 */
export const THEME_CHROME_COLORS: Record<ResolvedTheme, MainWindowThemeColors> =
  MAIN_WINDOW_THEME_COLORS;

/**
 * Resolves a theme preference to a concrete light/dark appearance.
 * @param {Settings['theme']} theme - The user's theme preference
 * @param {boolean} systemPrefersDark - Whether the OS currently prefers a dark color scheme
 * @returns {ResolvedTheme} The concrete theme to apply
 */
export function resolveTheme(theme: Settings['theme'], systemPrefersDark: boolean): ResolvedTheme {
  if (theme === 'system') {
    return systemPrefersDark ? 'dark' : 'light';
  }
  return theme;
}

/**
 * Resolves a possibly missing cached preference against the current OS preference, so `system`
 * follows OS changes made while the app was closed. Defaults to `system` when nothing is cached.
 * @param {Settings['theme'] | undefined} cachedPreference - The preference cached by a previous session
 * @param {boolean} systemPrefersDark - Whether the OS currently prefers a dark color scheme
 * @returns {ResolvedTheme} The best-guess theme before settings have loaded
 */
export function resolveCachedTheme(
  cachedPreference: Settings['theme'] | undefined,
  systemPrefersDark: boolean,
): ResolvedTheme {
  return resolveTheme(cachedPreference ?? 'system', systemPrefersDark);
}

/**
 * Reports whether the OS currently prefers a dark color scheme.
 * @returns {boolean} True when `prefers-color-scheme: dark` matches; false if matchMedia is unavailable
 */
export function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(SYSTEM_DARK_QUERY).matches;
}

/**
 * Reads the theme preference cached by a previous session.
 * @param {Pick<Storage, 'getItem'>} [storage] - Storage to read from (defaults to localStorage)
 * @returns {Settings['theme'] | undefined} The cached preference, or undefined if missing, invalid or unreadable
 */
export function readCachedThemePreference(
  storage: Pick<Storage, 'getItem'> | undefined = getLocalStorage(),
): Settings['theme'] | undefined {
  try {
    const value = storage?.getItem(THEME_PREFERENCE_STORAGE_KEY);
    return value === 'light' || value === 'dark' || value === 'system' ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Caches the theme preference so the next startup can apply it before settings load.
 * @param {Settings['theme']} theme - The theme preference to cache
 * @param {Pick<Storage, 'setItem'>} [storage] - Storage to write to (defaults to localStorage)
 */
export function cacheThemePreference(
  theme: Settings['theme'],
  storage: Pick<Storage, 'setItem'> | undefined = getLocalStorage(),
): void {
  try {
    storage?.setItem(THEME_PREFERENCE_STORAGE_KEY, theme);
  } catch {
    // Storage may be unavailable or full; the theme still applies, only the startup cache is lost
  }
}

/**
 * Toggles the `dark` class on the given root element.
 * @param {ResolvedTheme} theme - The resolved theme to apply
 * @param {HTMLElement} [root] - Element to update (defaults to the document root)
 */
export function applyThemeClass(
  theme: ResolvedTheme,
  root: HTMLElement = document.documentElement,
): void {
  root.classList.toggle('dark', theme === 'dark');
}

/**
 * Applies the startup theme synchronously, before React mounts, to avoid a light flash. Uses the
 * cached preference resolved against the current OS preference.
 * @returns {ResolvedTheme} The theme that was applied
 */
export function applyInitialTheme(): ResolvedTheme {
  const theme = resolveCachedTheme(readCachedThemePreference(), getSystemPrefersDark());
  applyThemeClass(theme);
  return theme;
}

function getLocalStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
