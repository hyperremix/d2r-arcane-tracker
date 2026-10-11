import { afterEach, describe, expect, it } from 'vitest';
import {
  formatShortcutForDisplay,
  matchesShortcut,
  normalizeShortcut,
  parseShortcut,
  shortcutFromEvent,
} from './hotkeys';

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

    it.each([
      ['Ctrl++', 'Ctrl++'],
      ['shift + ctrl + +', 'Ctrl+Shift++'],
    ])('If the shortcut %j uses the plus key, Then it normalizes to %j', (input, expected) => {
      // Arrange & Act
      const result = normalizeShortcut(input);

      // Assert
      expect(result).toBe(expected);
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

  describe('parseShortcut', () => {
    it.each([
      ['Ctrl++', { ctrl: true, shift: false, alt: false, key: '+' }],
      ['Ctrl+Shift++', { ctrl: true, shift: true, alt: false, key: '+' }],
      ['ctrl + +', { ctrl: true, shift: false, alt: false, key: '+' }],
      ['+', { ctrl: false, shift: false, alt: false, key: '+' }],
    ])('If the shortcut %j ends in the plus key, Then the plus key is parsed', (input, expected) => {
      // Arrange & Act
      const result = parseShortcut(input);

      // Assert
      expect(result).toEqual(expected);
    });

    it.each([
      ['Ctrl+', { ctrl: true, shift: false, alt: false, key: '' }],
      ['Ctrl+R', { ctrl: true, shift: false, alt: false, key: 'r' }],
    ])('If the shortcut %j has no trailing plus key, Then behaviour is unchanged', (input, expected) => {
      // Arrange & Act
      const result = parseShortcut(input);

      // Assert
      expect(result).toEqual(expected);
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

    it('If the shortcut uses the plus key, Then a matching plus key press matches it', () => {
      // Arrange
      const event = new KeyboardEvent('keydown', { key: '+', ctrlKey: true });

      // Act
      const result = matchesShortcut(event, 'Ctrl++', { isMac: false });

      // Assert
      expect(result).toBe(true);
    });

    it('If the recorder captured a plus key press, Then the recorded shortcut survives normalization and matches the same press', () => {
      // Arrange
      const event = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, shiftKey: true });
      const recorded = shortcutFromEvent(event, { isMac: false });

      // Act
      const stored = normalizeShortcut(recorded);
      const result = matchesShortcut(event, stored, { isMac: false });

      // Assert
      expect(stored).toBe('Ctrl+Shift++');
      expect(result).toBe(true);
    });
  });

  describe('formatShortcutForDisplay', () => {
    const originalElectronAPI = window.electronAPI;

    afterEach(() => {
      window.electronAPI = originalElectronAPI;
    });

    it.each([
      ['Ctrl+R', '\u2318R'],
      ['Ctrl+Space', '\u2318Space'],
      ['Ctrl+E', '\u2318E'],
      ['Ctrl+Shift+E', '\u21E7\u2318E'],
      ['Ctrl+Alt+N', '\u2325\u2318N'],
      ['Ctrl+Shift+Alt+F5', '\u2325\u21E7\u2318F5'],
    ])('When %s is shown on macOS, Then it reads %s with the Command symbol', (stored, expected) => {
      // Arrange & Act
      const result = formatShortcutForDisplay(stored, { isMac: true });

      // Assert
      expect(result).toBe(expected);
    });

    it.each([
      ['Ctrl+R', 'Ctrl+R'],
      ['ctrl + shift + e', 'Ctrl+Shift+E'],
      ['Ctrl+Space', 'Ctrl+Space'],
    ])('When %s is shown on Windows or Linux, Then it reads %s', (stored, expected) => {
      // Arrange & Act
      const result = formatShortcutForDisplay(stored, { isMac: false });

      // Assert
      expect(result).toBe(expected);
    });

    it('If the shortcut has no usable key, Then it is shown unchanged', () => {
      // Arrange & Act
      const result = formatShortcutForDisplay('Ctrl+Shift', { isMac: true });

      // Assert
      expect(result).toBe('Ctrl+Shift');
    });

    it('If the main process reports macOS, Then the label uses the Command symbol without an override', () => {
      // Arrange
      window.electronAPI = { platform: 'darwin' } as unknown as typeof window.electronAPI;

      // Act
      const result = formatShortcutForDisplay('Ctrl+Shift+E');

      // Assert
      expect(result).toBe('\u21E7\u2318E');
    });

    it('If the main process reports Windows, Then the label keeps Ctrl', () => {
      // Arrange
      window.electronAPI = { platform: 'win32' } as unknown as typeof window.electronAPI;

      // Act
      const result = formatShortcutForDisplay('Ctrl+Shift+E');

      // Assert
      expect(result).toBe('Ctrl+Shift+E');
    });
  });
});
