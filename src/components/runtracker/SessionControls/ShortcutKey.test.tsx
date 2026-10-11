import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ShortcutKey, toAriaKeyShortcuts } from './ShortcutKey';

const originalElectronAPI = window.electronAPI;

function setPlatform(platform: string) {
  Object.defineProperty(window, 'electronAPI', {
    value: { platform },
    writable: true,
    configurable: true,
  });
}

describe('toAriaKeyShortcuts', () => {
  afterEach(() => {
    Object.defineProperty(window, 'electronAPI', {
      value: originalElectronAPI,
      writable: true,
      configurable: true,
    });
  });

  describe('When the app runs on Windows', () => {
    it.each([
      ['Ctrl+R', 'Control+R'],
      ['Ctrl+Shift+E', 'Control+Shift+E'],
      ['Alt+R', 'Alt+R'],
      ['Ctrl+Alt+Shift+K', 'Control+Shift+Alt+K'],
      ['F5', 'F5'],
      ['Ctrl+F12', 'Control+F12'],
      ['Ctrl+Space', 'Control+Space'],
      ['Ctrl+Esc', 'Control+Escape'],
      ['Ctrl+ArrowUp', 'Control+ArrowUp'],
      ['Ctrl+PageUp', 'Control+PageUp'],
      ['Ctrl+PageDown', 'Control+PageDown'],
      ['Ctrl+Home', 'Control+Home'],
    ])('Then %s is exposed as %s', (shortcut, expected) => {
      // Arrange
      setPlatform('win32');

      // Act
      const result = toAriaKeyShortcuts(shortcut);

      // Assert
      expect(result).toBe(expected);
    });

    it('If the shortcut uses the plus key, Then it is named Plus instead of being left as a separator', () => {
      // Arrange
      setPlatform('win32');

      // Act
      const result = toAriaKeyShortcuts('Ctrl++');

      // Assert
      expect(result).toBe('Control+Plus');
    });
  });

  describe('When the app runs on macOS', () => {
    it.each([
      ['Ctrl+R', 'Meta+R'],
      ['Ctrl+Shift+E', 'Meta+Shift+E'],
      ['Ctrl+Alt+R', 'Meta+Alt+R'],
      ['Alt+Space', 'Alt+Space'],
      ['Ctrl++', 'Meta+Plus'],
    ])('Then %s is exposed as %s', (shortcut, expected) => {
      // Arrange
      setPlatform('darwin');

      // Act
      const result = toAriaKeyShortcuts(shortcut);

      // Assert
      expect(result).toBe(expected);
    });
  });

  describe('If the shortcut has no key', () => {
    it('Then no value is exposed', () => {
      // Arrange
      setPlatform('win32');

      // Act
      const result = toAriaKeyShortcuts('Ctrl+Shift');

      // Assert
      expect(result).toBeUndefined();
    });
  });
});

describe('ShortcutKey', () => {
  it('When rendered, Then the chip shows the shortcut and is hidden from assistive technology', () => {
    // Arrange & Act
    render(<ShortcutKey shortcut="Ctrl+R" id="chip" />);

    // Assert
    const chip = screen.getByText('Ctrl+R');
    expect(chip.tagName).toBe('KBD');
    expect(chip.closest('[aria-hidden="true"]')).toHaveAttribute('id', 'chip');
  });
});
