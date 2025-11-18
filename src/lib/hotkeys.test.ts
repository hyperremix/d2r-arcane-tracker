import { describe, expect, it } from 'vitest';
import { matchesShortcut, normalizeShortcut, shortcutFromEvent } from './hotkeys';

describe('hotkeys helpers', () => {
  describe('normalizeShortcut', () => {
    it('orders modifiers and formats key casing consistently', () => {
      // Arrange
      const input = 'shift + ctrl + e';

      // Act
      const result = normalizeShortcut(input);

      // Assert
      expect(result).toBe('Ctrl+Shift+E');
    });

    it('returns empty string when no non-modifier key is provided', () => {
      // Arrange
      const input = 'Ctrl+Shift';

      // Act
      const result = normalizeShortcut(input);

      // Assert
      expect(result).toBe('');
    });
  });

  describe('shortcutFromEvent', () => {
    it('captures Ctrl+Alt combinations on Windows', () => {
      // Arrange
      const event = new KeyboardEvent('keydown', {
        key: 'n',
        ctrlKey: true,
        altKey: true,
      });

      // Act
      const result = shortcutFromEvent(event, { isMac: false });

      // Assert
      expect(result).toBe('Ctrl+Alt+N');
    });

    it('returns empty string for modifier-only input', () => {
      // Arrange
      const event = new KeyboardEvent('keydown', {
        key: 'Control',
        ctrlKey: true,
      });

      // Act
      const result = shortcutFromEvent(event);

      // Assert
      expect(result).toBe('');
    });
  });

  describe('matchesShortcut', () => {
    it('treats Meta as Ctrl on macOS platforms', () => {
      // Arrange
      const event = new KeyboardEvent('keydown', {
        key: 'r',
        metaKey: true,
      });

      // Act
      const result = matchesShortcut(event, 'Ctrl+R', { isMac: true });

      // Assert
      expect(result).toBe(true);
    });

    it('requires matching modifier set', () => {
      // Arrange
      const event = new KeyboardEvent('keydown', {
        key: 'e',
        ctrlKey: true,
      });

      // Act
      const result = matchesShortcut(event, 'Ctrl+Shift+E', { isMac: false });

      // Assert
      expect(result).toBe(false);
    });
  });
});
