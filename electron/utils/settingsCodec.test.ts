import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameMode, GameVersion } from '../types/grail';
import { DEFAULT_RUN_TRACKER_SHORTCUTS } from './runTrackerShortcuts';
import {
  createDefaultSettings,
  getSeededSettings,
  parseSettings,
  serializeSetting,
} from './settingsCodec';

describe('When the settings table is seeded', () => {
  it('Then the seeded values are the defaults the database always seeded', () => {
    // Arrange
    const expected = {
      saveDir: '',
      lang: 'en',
      gameMode: 'both',
      grailNormal: 'true',
      grailEthereal: 'false',
      grailRunes: 'false',
      grailRunewords: 'false',
      enableSounds: 'true',
      notificationVolume: '0.5',
      inAppNotifications: 'true',
      nativeNotifications: 'true',
      needsSeeding: 'true',
      theme: 'system',
      showItemIcons: 'false',
      wizardCompleted: 'false',
      wizardSkipped: 'false',
      runTrackerAutoStart: 'true',
      runTrackerEndThreshold: '10',
      runTrackerMemoryReading: 'false',
      runTrackerMemoryPollingInterval: '500',
    };

    // Act
    const seeded = Object.fromEntries(getSeededSettings().map(({ key, value }) => [key, value]));

    // Assert
    expect(seeded).toEqual(expected);
  });
});

describe('When stored settings are parsed', () => {
  let consoleWarn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleWarn.mockRestore();
  });

  it('If nothing is stored, Then every setting has its default', () => {
    // Act
    const settings = parseSettings({});

    // Assert
    expect(settings).toEqual(createDefaultSettings());
    expect(settings).toMatchObject({
      gameMode: GameMode.Both,
      gameVersion: GameVersion.Resurrected,
      grailNormal: true,
      widgetRunOnlyShowItems: true,
      runTrackerMemoryPollingInterval: 500,
      runTrackerShortcuts: {
        startRun: 'Ctrl+R',
        pauseRun: 'Ctrl+Space',
        endRun: 'Ctrl+E',
        endSession: 'Ctrl+Shift+E',
      },
    });
    expect(settings.d2rInstallPath).toBeUndefined();
  });

  it('If values are stored, Then they are converted to their types', () => {
    // Act
    const settings = parseSettings({
      grailNormal: 'false',
      widgetEnabled: 'true',
      widgetOpacity: '0.4',
      runTrackerEndThreshold: '25',
      widgetPosition: '{"x":10,"y":20}',
      theme: 'dark',
    });

    // Assert
    expect(settings).toMatchObject({
      grailNormal: false,
      widgetEnabled: true,
      widgetOpacity: 0.4,
      runTrackerEndThreshold: 25,
      widgetPosition: { x: 10, y: 20 },
      theme: 'dark',
    });
  });

  it.each([
    ['corrupted JSON', '[object Object]'],
    ['malformed JSON', '{"x":'],
  ])('If a JSON setting holds %s, Then it falls back to its default', (_label, stored) => {
    // Act
    const settings = parseSettings({ widgetPosition: stored, runTrackerShortcuts: stored });

    // Assert
    expect(settings.widgetPosition).toBeUndefined();
    expect(settings.runTrackerShortcuts).toEqual(createDefaultSettings().runTrackerShortcuts);
  });

  it('If a number cannot be parsed, Then the default is used', () => {
    // Act
    const settings = parseSettings({ runTrackerEndThreshold: 'soon', tickReaderIntervalMs: 'x' });

    // Assert
    expect(settings.runTrackerEndThreshold).toBe(10);
    expect(settings.tickReaderIntervalMs).toBeUndefined();
  });

  it('If the notification volume is stored as 0, Then the default volume is used as before', () => {
    // Act
    const settings = parseSettings({ notificationVolume: '0' });

    // Assert
    expect(settings.notificationVolume).toBe(0.5);
  });

  it('If the terror zone configuration uses numeric zone IDs, Then they are migrated to string IDs', () => {
    // Act
    const settings = parseSettings({ terrorZoneConfig: '{"1":true,"Act1-Pit":false}' });

    // Assert
    expect(settings.terrorZoneConfig).toMatchObject({ 'Act1-Pit': false });
    expect(Object.keys(settings.terrorZoneConfig ?? {})).not.toContain('1');
  });
});

describe('When a setting row is missing or empty', () => {
  // The previous parsers read a missing or empty row of these settings as false (or undefined for
  // the shortcuts, `!== 'false'` for the icons). The codec uses the declared default instead.
  // Every stored row keeps its value, and the rows of these settings are seeded when the database
  // is created or restored, so an existing database is not affected: this only covers rows that
  // were deleted or cleared.
  const defaultsOfMissingRows = {
    grailNormal: true,
    enableSounds: true,
    inAppNotifications: true,
    nativeNotifications: true,
    needsSeeding: true,
    runTrackerAutoStart: true,
    showItemIcons: false,
  } as const;

  it.each(
    Object.entries(defaultsOfMissingRows),
  )('If the row of %s is missing or empty, Then its declared default %s is used', (key, expected) => {
    // Act
    const missing = parseSettings({});
    const empty = parseSettings({ [key]: '' });

    // Assert
    expect(missing[key as keyof typeof defaultsOfMissingRows]).toBe(expected);
    expect(empty[key as keyof typeof defaultsOfMissingRows]).toBe(expected);
  });

  it.each(
    Object.keys(defaultsOfMissingRows),
  )('If the row of %s is stored, Then the stored value wins over the default', (key) => {
    // Act
    const enabled = parseSettings({ [key]: 'true' });
    const disabled = parseSettings({ [key]: 'false' });

    // Assert
    expect(enabled[key as keyof typeof defaultsOfMissingRows]).toBe(true);
    expect(disabled[key as keyof typeof defaultsOfMissingRows]).toBe(false);
  });

  it('If the shortcuts row is missing, Then the default shortcuts are returned', () => {
    // Act
    const settings = parseSettings({});

    // Assert
    expect(settings.runTrackerShortcuts).toEqual(DEFAULT_RUN_TRACKER_SHORTCUTS);
  });

  it('If a stored number is not numeric, Then the default is used instead of NaN', () => {
    // Act
    const settings = parseSettings({ runTrackerMemoryPollingInterval: 'fast', widgetOpacity: '?' });

    // Assert
    expect(settings.runTrackerMemoryPollingInterval).toBe(500);
    expect(settings.widgetOpacity).toBe(0.9);
  });
});

describe('When settings are serialized for storage', () => {
  it('Then objects are stored as JSON and primitives as text', () => {
    // Act
    const position = serializeSetting('widgetPosition', { x: 1, y: 2 });
    const locked = serializeSetting('widgetLocked', true);
    const volume = serializeSetting('notificationVolume', 0.25);

    // Assert
    expect(position).toBe('{"x":1,"y":2}');
    expect(locked).toBe('true');
    expect(volume).toBe('0.25');
  });

  it('If the value is null, Then the stored value is cleared as well', () => {
    // Act
    const stored = serializeSetting('widgetPosition', null as never);

    // Assert
    expect(stored).toBe('');
  });

  it('If the value is undefined, Then the stored value is cleared', () => {
    // Act
    const stored = serializeSetting('terrorZoneConfig', undefined);

    // Assert
    expect(stored).toBe('');
    expect(parseSettings({ terrorZoneConfig: stored }).terrorZoneConfig).toBeUndefined();
  });
});

describe('When default settings are created', () => {
  it('Then every call returns independent objects', () => {
    // Arrange
    const first = createDefaultSettings();

    // Act
    if (first.runTrackerShortcuts) {
      first.runTrackerShortcuts.startRun = 'Ctrl+9';
    }
    const second = createDefaultSettings();

    // Assert
    expect(second.runTrackerShortcuts?.startRun).toBe('Ctrl+R');
  });
});
