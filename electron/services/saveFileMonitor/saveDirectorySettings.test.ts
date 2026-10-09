import { describe, expect, it, vi } from 'vitest';
import type { Settings } from '../../types/grail';
import { GameMode } from '../../types/grail';
import {
  readConfiguredSaveDirectory,
  resolveDebounceDelay,
  resolveEffectiveSaveDirectory,
  resolveTickReaderInterval,
  resolveWatcherIntervals,
  validateInterval,
} from './saveDirectorySettings';

function createSettings(overrides: Partial<Settings> = {}): Settings {
  return { gameMode: GameMode.Softcore, ...overrides } as Settings;
}

function createSettingsReader(settings: Settings) {
  return { getAll: vi.fn(() => settings) };
}

describe('When configurable intervals are used', () => {
  describe('If the tick reader interval is not configured', () => {
    it('Then should use default intervals when settings not provided', () => {
      // Arrange
      const settingsReader = createSettingsReader(createSettings());

      // Act
      const tickInterval = resolveTickReaderInterval(settingsReader);

      // Assert
      expect(tickInterval).toBe(500); // DEFAULT_TICK_INTERVAL
    });
  });

  describe('If the tick reader interval is configured within its range', () => {
    it('Then should use custom tick reader interval from settings', () => {
      // Arrange
      const settingsReader = createSettingsReader(createSettings({ tickReaderIntervalMs: 1000 }));

      // Act
      const tickInterval = resolveTickReaderInterval(settingsReader);

      // Assert
      expect(tickInterval).toBe(1000);
    });

    it('Then should validate interval and allow valid custom value', () => {
      // Arrange
      const settingsReader = createSettingsReader(createSettings({ tickReaderIntervalMs: 250 }));

      // Act
      const tickInterval = resolveTickReaderInterval(settingsReader);

      // Assert
      expect(tickInterval).toBe(250);
    });
  });

  describe('If the tick reader interval is configured outside its range', () => {
    it('Then should validate and reject invalid tick reader interval', () => {
      // Arrange
      const settingsReader = createSettingsReader(createSettings({ tickReaderIntervalMs: 50 })); // min is 100

      // Act
      const tickInterval = resolveTickReaderInterval(settingsReader);

      // Assert - should fall back to default
      expect(tickInterval).toBe(500);
    });

    it('Then should validate interval with max constraint', () => {
      // Arrange
      const settingsReader = createSettingsReader(createSettings({ tickReaderIntervalMs: 10000 })); // max is 5000

      // Act
      const tickInterval = resolveTickReaderInterval(settingsReader);

      // Assert - should fall back to default
      expect(tickInterval).toBe(500);
    });
  });

  describe('If a value inside the allowed range is validated', () => {
    it('Then should validate debounce delay from settings', () => {
      // Arrange
      const value = 3000;

      // Act
      const validated = validateInterval(value, 500, 10000, 2000);

      // Assert
      expect(validated).toBe(3000);
    });
  });

  describe('If the debounce delay is configured', () => {
    it('Then values inside 500-10000 ms are used and others fall back to 500 ms', () => {
      // Arrange
      const configuredSettings = createSettings({ fileChangeDebounceMs: 3000 });
      const tooShortSettings = createSettings({ fileChangeDebounceMs: 100 });
      const missingSettings = createSettings();

      // Act
      const configured = resolveDebounceDelay(configuredSettings);
      const tooShort = resolveDebounceDelay(tooShortSettings);
      const missing = resolveDebounceDelay(missingSettings);

      // Assert
      expect([configured, tooShort, missing]).toEqual([3000, 500, 500]);
    });
  });

  describe('If the file watcher intervals are configured', () => {
    it('Then valid values are used and invalid or missing ones fall back to their defaults', () => {
      // Arrange
      const configuredSettings = createSettings({
        chokidarPollingIntervalMs: 2000,
        fileStabilityThresholdMs: 1000,
      });
      const invalidSettings = createSettings({
        chokidarPollingIntervalMs: 100,
        fileStabilityThresholdMs: 5000,
      });

      // Act
      const configured = resolveWatcherIntervals(configuredSettings);
      const invalid = resolveWatcherIntervals(invalidSettings);
      const withoutSettings = resolveWatcherIntervals(createSettings());

      // Assert
      expect(configured).toEqual({ pollingInterval: 2000, stabilityThreshold: 1000 });
      expect(invalid).toEqual({ pollingInterval: 1000, stabilityThreshold: 300 });
      expect(withoutSettings).toEqual({ pollingInterval: 1000, stabilityThreshold: 300 });
    });
  });
});

describe('When the configured save directory is read', () => {
  describe('If a save directory is configured', () => {
    it('Then it is returned without surrounding whitespace', () => {
      // Arrange
      const settingsReader = createSettingsReader(createSettings({ saveDir: '  /saves/d2r  ' }));

      // Act
      const directory = readConfiguredSaveDirectory(settingsReader);

      // Assert
      expect(directory).toBe('/saves/d2r');
    });
  });

  describe('If the configured save directory is blank', () => {
    it('Then no directory is returned', () => {
      // Arrange
      const settingsReader = createSettingsReader(createSettings({ saveDir: '   ' }));

      // Act
      const directory = readConfiguredSaveDirectory(settingsReader);

      // Assert
      expect(directory).toBeUndefined();
    });
  });

  describe('If the settings cannot be read', () => {
    it('Then no directory is returned', () => {
      // Arrange
      const failingSettings = {
        getAll: vi.fn((): Settings => {
          throw new Error('database is locked');
        }),
      };

      // Act
      const directory = readConfiguredSaveDirectory(failingSettings);

      // Assert
      expect(directory).toBeUndefined();
    });
  });
});

describe('When the effective save directory is resolved', () => {
  it('If a save directory is configured, Then it wins over the default without surrounding whitespace', () => {
    // Arrange
    const configured = '  /saves/custom  ';

    // Act
    const directory = resolveEffectiveSaveDirectory(configured, '/saves/default');

    // Assert
    expect(directory).toBe('/saves/custom');
  });

  it.each([
    ['undefined', undefined],
    ['blank', '   '],
  ])('If the configured save directory is %s, Then the default is used', (_label, configured) => {
    // Arrange
    const defaultDirectory = '/saves/default';

    // Act
    const directory = resolveEffectiveSaveDirectory(configured, defaultDirectory);

    // Assert
    expect(directory).toBe(defaultDirectory);
  });

  it('If neither is known, Then no directory is returned', () => {
    // Arrange & Act
    const directory = resolveEffectiveSaveDirectory('', '');

    // Assert
    expect(directory).toBeUndefined();
  });
});
