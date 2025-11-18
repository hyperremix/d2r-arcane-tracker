import { useEffect } from 'react';
import { useGrailStore } from '@/stores/grailStore';

/**
 * Custom hook to manage and apply the application theme.
 * Handles light, dark, and system theme preferences by updating the document class.
 * For system theme, listens to OS preference changes via media query.
 */
export function useTheme() {
  const { settings } = useGrailStore();

  useEffect(() => {
    const root = document.documentElement;
    const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = (theme: 'light' | 'dark') => {
      if (theme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }

      // Update Windows titlebar overlay colors to match theme
      if (window.electronAPI?.platform === 'win32') {
        window.electronAPI.updateTitleBarOverlay({
          backgroundColor: theme === 'dark' ? '#09090b' : '#ffffff',
          symbolColor: theme === 'dark' ? '#ffffff' : '#000000',
        });
      }
    };

    const handleSystemThemeChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (settings.theme === 'system') {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    };

    // Apply initial theme
    if (settings.theme === 'system') {
      applyTheme(systemThemeQuery.matches ? 'dark' : 'light');
    } else {
      applyTheme(settings.theme);
    }

    // Listen for system theme changes
    if (settings.theme === 'system') {
      systemThemeQuery.addEventListener('change', handleSystemThemeChange);
    }

    // Cleanup
    return () => {
      systemThemeQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [settings.theme]);
}
