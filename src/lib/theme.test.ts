import { MAIN_WINDOW_THEME_COLORS } from 'electron/window/mainWindowTheme';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyInitialTheme,
  applyThemeClass,
  cacheThemePreference,
  getSystemPrefersDark,
  readCachedThemePreference,
  resolveCachedTheme,
  resolveTheme,
  THEME_CHROME_COLORS,
  THEME_PREFERENCE_STORAGE_KEY,
} from './theme';

describe('When resolveTheme is called', () => {
  describe('If the preference is light or dark', () => {
    it('Then should return it regardless of the OS preference', () => {
      // Arrange
      const systemPrefersDarkForLight = true;
      const systemPrefersDarkForDark = false;

      // Act
      const light = resolveTheme('light', systemPrefersDarkForLight);
      const dark = resolveTheme('dark', systemPrefersDarkForDark);

      // Assert
      expect(light).toBe('light');
      expect(dark).toBe('dark');
    });
  });

  describe('If the preference is system', () => {
    it('Then should follow the OS preference', () => {
      // Arrange
      const systemPreferences = { dark: true, light: false };

      // Act
      const prefersDark = resolveTheme('system', systemPreferences.dark);
      const prefersLight = resolveTheme('system', systemPreferences.light);

      // Assert
      expect(prefersDark).toBe('dark');
      expect(prefersLight).toBe('light');
    });
  });
});

describe('When resolveCachedTheme is called', () => {
  describe('If an explicit preference was cached', () => {
    it('Then should return it regardless of the OS preference', () => {
      // Arrange
      const cachedDark = 'dark';
      const cachedLight = 'light';

      // Act
      const dark = resolveCachedTheme(cachedDark, false);
      const light = resolveCachedTheme(cachedLight, true);

      // Assert
      expect(dark).toBe('dark');
      expect(light).toBe('light');
    });
  });

  describe('If system was cached', () => {
    it('Then should re-resolve it against the current OS preference', () => {
      // Arrange
      const cached = 'system';

      // Act
      const prefersDark = resolveCachedTheme(cached, true);
      const prefersLight = resolveCachedTheme(cached, false);

      // Assert
      expect(prefersDark).toBe('dark');
      expect(prefersLight).toBe('light');
    });
  });

  describe('If nothing was cached', () => {
    it('Then should follow the OS preference', () => {
      // Arrange
      const cached = undefined;

      // Act
      const prefersDark = resolveCachedTheme(cached, true);
      const prefersLight = resolveCachedTheme(cached, false);

      // Assert
      expect(prefersDark).toBe('dark');
      expect(prefersLight).toBe('light');
    });
  });
});

describe('When the window chrome colors are read', () => {
  describe('If the renderer and main process tables are compared', () => {
    it('Then should be the single table shared with the main window', () => {
      // Arrange
      const rendererColors = THEME_CHROME_COLORS;

      // Act
      const mainColors = MAIN_WINDOW_THEME_COLORS;

      // Assert
      expect(rendererColors).toEqual(mainColors);
    });
  });
});

describe('When the theme preference cache is used', () => {
  beforeEach(() => {
    localStorage.removeItem(THEME_PREFERENCE_STORAGE_KEY);
  });

  afterEach(() => {
    localStorage.removeItem(THEME_PREFERENCE_STORAGE_KEY);
  });

  describe('If a preference was cached', () => {
    it.each(['light', 'dark', 'system'] as const)('Then should read %s back', (preference) => {
      // Arrange
      cacheThemePreference(preference);

      // Act
      const cached = readCachedThemePreference();

      // Assert
      expect(localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)).toBe(preference);
      expect(cached).toBe(preference);
    });
  });

  describe('If nothing was cached', () => {
    it('Then should return undefined', () => {
      // Arrange
      const storage = localStorage;

      // Act
      const cached = readCachedThemePreference(storage);

      // Assert
      expect(cached).toBeUndefined();
    });
  });

  describe('If the cached value is invalid', () => {
    it('Then should return undefined', () => {
      // Arrange
      localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, 'purple');

      // Act
      const cached = readCachedThemePreference();

      // Assert
      expect(cached).toBeUndefined();
    });
  });

  describe('If storage throws', () => {
    it('Then should not throw when reading or writing', () => {
      // Arrange
      const failingStorage = {
        getItem: vi.fn(() => {
          throw new Error('denied');
        }),
        setItem: vi.fn(() => {
          throw new Error('quota');
        }),
      };

      // Act / Assert
      expect(readCachedThemePreference(failingStorage)).toBeUndefined();
      expect(() => cacheThemePreference('dark', failingStorage)).not.toThrow();
    });
  });
});

describe('When the theme is applied before React mounts', () => {
  const originalMatchMedia = window.matchMedia;

  /**
   * Makes matchMedia report the given OS dark preference.
   */
  function mockSystemPrefersDark(matches: boolean): void {
    window.matchMedia = vi.fn().mockReturnValue({ matches }) as unknown as typeof window.matchMedia;
  }

  beforeEach(() => {
    document.documentElement.className = '';
    localStorage.removeItem(THEME_PREFERENCE_STORAGE_KEY);
  });

  afterEach(() => {
    document.documentElement.className = '';
    localStorage.removeItem(THEME_PREFERENCE_STORAGE_KEY);
    window.matchMedia = originalMatchMedia;
  });

  describe('If dark was cached and the OS prefers light', () => {
    it('Then should add the dark class from the cache', () => {
      // Arrange
      localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, 'dark');
      mockSystemPrefersDark(false);

      // Act
      const applied = applyInitialTheme();

      // Assert
      expect(applied).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('If system was cached and the OS now prefers light', () => {
    it('Then should re-resolve to light instead of reusing the previous dark result', () => {
      // Arrange
      localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, 'system');
      document.documentElement.classList.add('dark');
      mockSystemPrefersDark(false);

      // Act
      const applied = applyInitialTheme();

      // Assert
      expect(applied).toBe('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('If system was cached and the OS now prefers dark', () => {
    it('Then should re-resolve to dark', () => {
      // Arrange
      localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, 'system');
      mockSystemPrefersDark(true);

      // Act
      const applied = applyInitialTheme();

      // Assert
      expect(applied).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('If the cached value is invalid and the OS prefers dark', () => {
    it('Then should ignore it and follow the OS preference', () => {
      // Arrange
      localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, 'purple');
      mockSystemPrefersDark(true);

      // Act
      const applied = applyInitialTheme();

      // Assert
      expect(applied).toBe('dark');
    });
  });

  describe('If light was cached and the OS prefers dark', () => {
    it('Then should not add the dark class', () => {
      // Arrange
      localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, 'light');
      mockSystemPrefersDark(true);

      // Act
      const applied = applyInitialTheme();

      // Assert
      expect(applied).toBe('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('If nothing was cached', () => {
    it('Then should follow the OS preference', () => {
      // Arrange
      mockSystemPrefersDark(true);

      // Act
      const applied = applyInitialTheme();

      // Assert
      expect(applied).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('If nothing was cached and matchMedia is unavailable', () => {
    it('Then should fall back to light', () => {
      // Arrange
      window.matchMedia = undefined as unknown as typeof window.matchMedia;

      // Act
      const applied = applyInitialTheme();

      // Assert
      expect(getSystemPrefersDark()).toBe(false);
      expect(applied).toBe('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });
});

describe('When applyThemeClass is called', () => {
  describe('If switching from dark to light', () => {
    it('Then should remove the dark class and keep other classes', () => {
      // Arrange
      const root = document.createElement('div');
      root.classList.add('dark', 'other');

      // Act
      applyThemeClass('light', root);

      // Assert
      expect(root.classList.contains('dark')).toBe(false);
      expect(root.classList.contains('other')).toBe(true);
    });
  });
});
