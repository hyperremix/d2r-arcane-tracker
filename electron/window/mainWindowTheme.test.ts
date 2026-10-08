import { describe, expect, it } from 'vitest';
import { getMainWindowThemeColors, MAIN_WINDOW_THEME_COLORS } from './mainWindowTheme';

describe('When getMainWindowThemeColors is called', () => {
  describe('If the stored theme is dark', () => {
    it('Then should use the dark colors even if the OS prefers light', () => {
      // Arrange
      const osPrefersDark = false;

      // Act
      const colors = getMainWindowThemeColors('dark', osPrefersDark);

      // Assert
      expect(colors).toEqual(MAIN_WINDOW_THEME_COLORS.dark);
    });
  });

  describe('If the stored theme is light', () => {
    it('Then should use the light colors even if the OS prefers dark', () => {
      // Arrange
      const osPrefersDark = true;

      // Act
      const colors = getMainWindowThemeColors('light', osPrefersDark);

      // Assert
      expect(colors).toEqual(MAIN_WINDOW_THEME_COLORS.light);
    });
  });

  describe('If the stored theme is system', () => {
    it('Then should follow the OS preference', () => {
      // Arrange
      const storedTheme = 'system';

      // Act
      const prefersDark = getMainWindowThemeColors(storedTheme, true);
      const prefersLight = getMainWindowThemeColors(storedTheme, false);

      // Assert
      expect(prefersDark).toEqual(MAIN_WINDOW_THEME_COLORS.dark);
      expect(prefersLight).toEqual(MAIN_WINDOW_THEME_COLORS.light);
    });
  });

  describe('If the stored theme could not be read', () => {
    it('Then should fall back to the OS preference', () => {
      // Arrange
      const storedTheme = undefined;

      // Act
      const colors = getMainWindowThemeColors(storedTheme, true);

      // Assert
      expect(colors).toEqual(MAIN_WINDOW_THEME_COLORS.dark);
    });
  });
});
