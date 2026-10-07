import { useEffect, useState } from 'react';
import type { ResolvedTheme } from '@/lib/theme';
import {
  applyThemeClass,
  cacheResolvedTheme,
  getSystemPrefersDark,
  readCachedResolvedTheme,
  resolveTheme,
  SYSTEM_DARK_QUERY,
  THEME_CHROME_COLORS,
} from '@/lib/theme';
import { useGrailStore } from '@/stores/grailStore';

/**
 * Resolves the app's theme preference to a concrete light/dark appearance.
 * Before settings have loaded it returns the theme cached by the previous session (falling back
 * to the OS preference), so the UI doesn't switch away from the theme applied at startup.
 * For the "system" preference it follows OS changes via the `prefers-color-scheme` media query.
 * @returns {ResolvedTheme} The theme currently in effect
 */
export function useResolvedTheme(): ResolvedTheme {
  const theme = useGrailStore((state) => state.settings.theme);
  const settingsHydrated = useGrailStore((state) => state.settingsHydrated);
  const [systemPrefersDark, setSystemPrefersDark] = useState(getSystemPrefersDark);
  const [cachedTheme] = useState(readCachedResolvedTheme);

  useEffect(() => {
    if (theme !== 'system' || typeof window.matchMedia !== 'function') {
      return;
    }

    const systemThemeQuery = window.matchMedia(SYSTEM_DARK_QUERY);
    setSystemPrefersDark(systemThemeQuery.matches);

    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };

    systemThemeQuery.addEventListener('change', handleSystemThemeChange);
    return () => {
      systemThemeQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [theme]);

  if (!settingsHydrated) {
    return cachedTheme ?? resolveTheme('system', systemPrefersDark);
  }
  return resolveTheme(theme, systemPrefersDark);
}

/**
 * Custom hook to manage and apply the application theme.
 * Toggles the `dark` class on the document root, caches the resolved theme for the next startup
 * once settings have loaded, and keeps the Windows title bar overlay colors in sync.
 */
export function useTheme(): void {
  const settingsHydrated = useGrailStore((state) => state.settingsHydrated);
  const resolvedTheme = useResolvedTheme();

  useEffect(() => {
    applyThemeClass(resolvedTheme);

    // Only cache real settings, not the defaults that are in place before settings load
    if (settingsHydrated) {
      cacheResolvedTheme(resolvedTheme);
    }

    // Update Windows titlebar overlay colors to match theme
    if (window.electronAPI?.platform === 'win32') {
      window.electronAPI.updateTitleBarOverlay(THEME_CHROME_COLORS[resolvedTheme]);
    }
  }, [resolvedTheme, settingsHydrated]);
}
