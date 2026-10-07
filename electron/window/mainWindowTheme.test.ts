import { describe, expect, it } from 'vitest';
import { getMainWindowThemeColors, MAIN_WINDOW_THEME_COLORS } from './mainWindowTheme';

describe('When getMainWindowThemeColors is called', () => {
  describe('If the stored theme is dark', () => {
    it('Then should use the dark colors even if the OS prefers light', () => {
      // Arrange / Act
      const colors = getMainWindowThemeColors('dark', false);

      // Assert
      expect(colors).toEqual(MAIN_WINDOW_THEME_COLORS.dark);
    });
  });

  describe('If the stored theme is light', () => {
    it('Then should use the light colors even if the OS prefers dark', () => {
      // Arrange / Act
      const colors = getMainWindowThemeColors('light', true);

      // Assert
      expect(colors).toEqual(MAIN_WINDOW_THEME_COLORS.light);
    });
  });

  describe('If the stored theme is system', () => {
    it('Then should follow the OS preference', () => {
      // Arrange / Act
      const prefersDark = getMainWindowThemeColors('system', true);
      const prefersLight = getMainWindowThemeColors('system', false);

      // Assert
      expect(prefersDark.backgroundColor).toBe('#09090b');
      expect(prefersLight.backgroundColor).toBe('#ffffff');
    });
  });

  describe('If the stored theme could not be read', () => {
    it('Then should fall back to the OS preference', () => {
      // Arrange / Act
      const colors = getMainWindowThemeColors(undefined, true);

      // Assert
      expect(colors).toEqual(MAIN_WINDOW_THEME_COLORS.dark);
    });
  });
});
