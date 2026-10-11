import { afterEach, describe, expect, it } from 'vitest';
import { getDefaultD2RPath } from './d2rInstallPath';

const originalElectronAPI = window.electronAPI;

function arrangePlatform(platform: string | undefined) {
  window.electronAPI = { platform } as unknown as typeof window.electronAPI;
}

describe('When getDefaultD2RPath is called', () => {
  afterEach(() => {
    window.electronAPI = originalElectronAPI;
  });

  it('If the platform is Windows, Then it returns the Battle.net default folder', () => {
    // Arrange
    arrangePlatform('win32');

    // Act
    const result = getDefaultD2RPath();

    // Assert
    expect(result).toBe('C:\\Program Files (x86)\\Diablo II Resurrected');
  });

  it('If the platform is macOS, Then it returns the application bundle', () => {
    // Arrange
    arrangePlatform('darwin');

    // Act
    const result = getDefaultD2RPath();

    // Assert
    expect(result).toBe('/Applications/Diablo II Resurrected.app');
  });

  it('If the Electron API is unavailable, Then it returns the macOS default', () => {
    // Arrange
    window.electronAPI = undefined as unknown as typeof window.electronAPI;

    // Act
    const result = getDefaultD2RPath();

    // Assert
    expect(result).toBe('/Applications/Diablo II Resurrected.app');
  });
});
