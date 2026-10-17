import { describe, expect, it } from 'vitest';
import {
  getTerrorZoneWindows,
  parseTerrorZoneScheduleConfigs,
  RETAIL_TERROR_ZONE_CONFIG,
  type TerrorZoneScheduleConfig,
} from './terrorZoneSchedule';

/**
 * Zones d2emu.com publishes for the retail config (https://d2emu.com/data/tz-2023-localized.json,
 * 30-minute slots), every 137th slot. The same rotation matched all 5,761 published slots and the
 * zone shown in an offline game.
 */
const RETAIL_SLOTS: [utc: string, zoneId: string][] = [
  ['2026-07-15T00:00:00Z', 'Act1-ColdPlains'],
  ['2026-07-17T20:30:00Z', 'Act2-Sewers'],
  ['2026-07-20T17:00:00Z', 'Act3-DuranceOfHate'],
  ['2026-07-23T13:30:00Z', 'Act3-GreatMarsh'],
  ['2026-07-26T10:00:00Z', 'Act4-ChaosSanctuary'],
  ['2026-07-29T06:30:00Z', 'Act5-Halls'],
  ['2026-08-01T03:00:00Z', 'Act2-Sewers'],
  ['2026-08-03T23:30:00Z', 'Act4-ChaosSanctuary'],
  ['2026-08-06T20:00:00Z', 'Act1-MooMooFarm'],
  ['2026-08-09T16:30:00Z', 'Act5-WorldstoneKeep'],
  ['2026-08-12T13:00:00Z', 'Act3-FlayerJungle'],
  ['2026-08-15T09:30:00Z', 'Act5-WorldstoneKeep'],
  ['2026-08-18T06:00:00Z', 'Act2-FarOasis'],
  ['2026-08-21T02:30:00Z', 'Act5-GlacialTrail'],
  ['2026-08-23T23:00:00Z', 'Act5-WorldstoneKeep'],
  ['2026-08-26T19:30:00Z', 'Act1-DarkWood'],
  ['2026-08-29T16:00:00Z', 'Act3-DuranceOfHate'],
  ['2026-09-01T12:30:00Z', 'Act3-FlayerJungle'],
  ['2026-09-04T09:00:00Z', 'Act1-Catacombs'],
  ['2026-09-07T05:30:00Z', 'Act1-MooMooFarm'],
  ['2026-09-10T02:00:00Z', 'Act1-BloodMoor'],
  ['2026-09-12T22:30:00Z', 'Act3-Travincal'],
  ['2026-09-15T19:00:00Z', 'Act1-ColdPlains'],
  ['2026-09-18T15:30:00Z', 'Act2-LostCity'],
  ['2026-09-21T12:00:00Z', 'Act3-Kurast'],
  ['2026-09-24T08:30:00Z', 'Act1-BurialGrounds'],
  ['2026-09-27T05:00:00Z', 'Act3-DuranceOfHate'],
  ['2026-09-30T01:30:00Z', 'Act5-BloodyFoothils'],
  ['2026-10-02T22:00:00Z', 'Act3-Travincal'],
  ['2026-10-05T18:30:00Z', 'Act1-MooMooFarm'],
  ['2026-10-08T15:00:00Z', 'Act1-BloodMoor'],
  ['2026-10-11T11:30:00Z', 'Act2-ArcaneSanctuary'],
  ['2026-10-14T08:00:00Z', 'Act1-Catacombs'],
  ['2026-10-17T04:30:00Z', 'Act3-FlayerJungle'],
  ['2026-10-20T01:00:00Z', 'Act3-Travincal'],
  ['2026-10-22T21:30:00Z', 'Act2-FarOasis'],
  ['2026-10-25T18:00:00Z', 'Act5-FrozenTundra'],
  ['2026-10-28T14:30:00Z', 'Act2-RockyWaste'],
  ['2026-10-31T11:00:00Z', 'Act1-BloodMoor'],
  ['2026-11-03T07:30:00Z', 'Act3-GreatMarsh'],
  ['2026-11-06T04:00:00Z', 'Act3-DuranceOfHate'],
  ['2026-11-09T00:30:00Z', 'Act1-BurialGrounds'],
  ['2026-11-11T21:00:00Z', 'Act1-Monastery'],
];

const MINUTE_SECONDS = 60;
const toSeconds = (utc: string): number => Date.parse(utc) / 1000;

const retailFileJson = JSON.stringify(
  {
    desecrated_zones: [
      {
        start_time_utc: '2025-12-05 00:00:00',
        end_time_utc: '',
        seed: 0,
        zone_duration_minutes: 30,
        break_duration_minutes: 0,
        zones: RETAIL_TERROR_ZONE_CONFIG.zoneIds.map((id) => ({ id, levels: [] })),
      },
    ],
  },
  null,
  4,
).replace('"seed": 0', '"seed": 16665365343970128666');

/** A config of 5 zones, one hour each with a 10 minute break, like a player-edited file. */
const editedConfig: TerrorZoneScheduleConfig = {
  startSeconds: toSeconds('2026-01-01T00:00:00Z'),
  endSeconds: Number.POSITIVE_INFINITY,
  zoneDurationMinutes: 60,
  breakDurationMinutes: 10,
  seed: 12345678901234567890n,
  zoneIds: ['Act1-ColdPlains', 'Act2-Sewers', 'Act3-Travincal', 'Act4-RiverOfFlame', 'Act5-Halls'],
};

describe('When the terror zone windows are calculated', () => {
  describe('When the retail config is scheduled', () => {
    it.each(RETAIL_SLOTS)('Then %s is %s, like the game and d2emu', (utc, zoneId) => {
      // Arrange
      const at = toSeconds(utc);

      // Act
      const [window] = getTerrorZoneWindows([RETAIL_TERROR_ZONE_CONFIG], at, 1);

      // Assert
      expect(window).toEqual({ startSeconds: at, endSeconds: at + 30 * MINUTE_SECONDS, zoneId });
    });

    it('Then a time inside a slot gives the window the slot started', () => {
      // Arrange
      const at = toSeconds('2026-07-15T00:17:42Z');

      // Act
      const [window] = getTerrorZoneWindows([RETAIL_TERROR_ZONE_CONFIG], at, 1);

      // Assert
      expect(window).toEqual({
        startSeconds: toSeconds('2026-07-15T00:00:00Z'),
        endSeconds: toSeconds('2026-07-15T00:30:00Z'),
        zoneId: 'Act1-ColdPlains',
      });
    });

    it('Then the upcoming windows follow each other without a repeat', () => {
      // Arrange
      const at = toSeconds('2026-10-17T14:30:00Z');

      // Act
      const windows = getTerrorZoneWindows([RETAIL_TERROR_ZONE_CONFIG], at, 48);

      // Assert
      expect(windows).toHaveLength(48);
      windows.forEach((window, index) => {
        expect(window.startSeconds).toBe(at + index * 30 * MINUTE_SECONDS);
        if (index > 0) {
          expect(window.zoneId).not.toBe(windows[index - 1].zoneId);
        }
      });
    });

    it('Then asking for more windows keeps the ones already shown', () => {
      // Arrange
      const at = toSeconds('2026-10-17T14:30:00Z');

      // Act
      const few = getTerrorZoneWindows([RETAIL_TERROR_ZONE_CONFIG], at, 3);
      const many = getTerrorZoneWindows([RETAIL_TERROR_ZONE_CONFIG], at, 30);

      // Assert
      expect(many.slice(0, 3)).toEqual(few);
    });
  });

  describe('When the player edited the config', () => {
    it('Then only the zones of the file are scheduled', () => {
      // Arrange
      const at = toSeconds('2026-03-01T00:00:00Z');

      // Act
      const windows = getTerrorZoneWindows([editedConfig], at, 200);

      // Assert
      expect(new Set(windows.map((window) => window.zoneId))).toEqual(
        new Set(editedConfig.zoneIds),
      );
    });

    it('Then the zones follow the rotation for the shorter list', () => {
      // Arrange: expected zones come from this port, the game was not run with an edited file
      const at = toSeconds('2026-03-01T00:00:00Z');

      // Act
      const zones = getTerrorZoneWindows([editedConfig], at, 6).map((window) => window.zoneId);

      // Assert
      expect(zones).toEqual([
        'Act5-Halls',
        'Act2-Sewers',
        'Act3-Travincal',
        'Act5-Halls',
        'Act1-ColdPlains',
        'Act2-Sewers',
      ]);
    });

    it('Then each window lasts the zone duration and a break follows it', () => {
      // Arrange
      const at = toSeconds('2026-03-01T00:00:00Z');

      // Act
      const [first, second] = getTerrorZoneWindows([editedConfig], at, 2);

      // Assert
      expect(first.endSeconds - first.startSeconds).toBe(60 * MINUTE_SECONDS);
      expect(second.startSeconds - first.startSeconds).toBe(70 * MINUTE_SECONDS);
      expect(second.zoneId).not.toBe(first.zoneId);
    });

    it('Then a time inside a break starts with the next window', () => {
      // Arrange: 5 minutes into the break of the first slot
      const at = editedConfig.startSeconds + 65 * MINUTE_SECONDS;

      // Act
      const [window] = getTerrorZoneWindows([editedConfig], at, 1);

      // Assert
      expect(window.startSeconds).toBe(editedConfig.startSeconds + 70 * MINUTE_SECONDS);
    });

    it('Then a different seed gives a different schedule', () => {
      // Arrange
      const at = toSeconds('2026-03-01T00:00:00Z');
      const otherSeed = { ...editedConfig, seed: editedConfig.seed + 1n };
      const zones = (config: TerrorZoneScheduleConfig) =>
        getTerrorZoneWindows([config], at, 20).map((window) => window.zoneId);

      // Act & Assert
      expect(zones(otherSeed)).not.toEqual(zones(editedConfig));
    });
  });

  describe('If the config has one zone', () => {
    it('Then that zone is scheduled in every window', () => {
      // Arrange
      const config = { ...editedConfig, zoneIds: ['Act1-ColdPlains'] };

      // Act
      const windows = getTerrorZoneWindows([config], toSeconds('2026-05-05T00:00:00Z'), 5);

      // Assert
      expect(windows.map((window) => window.zoneId)).toEqual(Array(5).fill('Act1-ColdPlains'));
    });
  });

  describe('If the config has no zones, or no zone duration', () => {
    it.each([
      ['no zones', { ...editedConfig, zoneIds: [] }],
      ['no zone duration', { ...editedConfig, zoneDurationMinutes: 0 }],
    ])('Then nothing is scheduled for %s', (_name, config) => {
      // Act
      const windows = getTerrorZoneWindows([config], toSeconds('2026-05-05T00:00:00Z'), 5);

      // Assert
      expect(windows).toEqual([]);
    });
  });

  describe('If no config covers the time', () => {
    it('Then the windows start when the next config starts', () => {
      // Act
      const windows = getTerrorZoneWindows(
        [RETAIL_TERROR_ZONE_CONFIG],
        toSeconds('2025-12-04T23:59:59Z'),
        2,
      );

      // Assert
      expect(windows.map((window) => window.startSeconds)).toEqual([
        RETAIL_TERROR_ZONE_CONFIG.startSeconds,
        RETAIL_TERROR_ZONE_CONFIG.startSeconds + 30 * MINUTE_SECONDS,
      ]);
    });

    it('Then nothing is scheduled once the last config has ended', () => {
      // Arrange
      const ended = { ...editedConfig, endSeconds: toSeconds('2026-01-02T00:00:00Z') };

      // Act
      const windows = getTerrorZoneWindows([ended], toSeconds('2026-01-02T00:00:00Z'), 5);

      // Assert
      expect(windows).toEqual([]);
    });
  });

  describe('If several configs follow each other', () => {
    const first: TerrorZoneScheduleConfig = {
      ...editedConfig,
      breakDurationMinutes: 0,
      endSeconds: toSeconds('2026-01-01T02:30:00Z'),
    };
    const second: TerrorZoneScheduleConfig = {
      ...editedConfig,
      startSeconds: toSeconds('2026-01-01T02:30:00Z'),
      seed: 42n,
      zoneIds: ['Act1-ColdPlains', 'Act5-Halls'],
    };

    it('Then the last window of a config ends with it and the next config takes over', () => {
      // Act
      const windows = getTerrorZoneWindows([first, second], toSeconds('2026-01-01T01:30:00Z'), 3);

      // Assert
      expect(windows.map((window) => [window.startSeconds, window.endSeconds])).toEqual([
        [toSeconds('2026-01-01T01:00:00Z'), toSeconds('2026-01-01T02:00:00Z')],
        [toSeconds('2026-01-01T02:00:00Z'), toSeconds('2026-01-01T02:30:00Z')],
        [toSeconds('2026-01-01T02:30:00Z'), toSeconds('2026-01-01T03:30:00Z')],
      ]);
    });

    it('Then the second config rotates from its own start time', () => {
      // Act
      const [window] = getTerrorZoneWindows([first, second], second.startSeconds, 1);
      const [alone] = getTerrorZoneWindows([second], second.startSeconds, 1);

      // Assert
      expect(window).toEqual(alone);
    });
  });
});

describe('When the terror zone configs are read from desecratedzones.json', () => {
  describe('When the file is the retail desecratedzones.json', () => {
    it('Then the seed keeps all 64 bits and the schedule matches the game', () => {
      // Act
      const configs = parseTerrorZoneScheduleConfigs(retailFileJson);

      // Assert
      expect(configs).toEqual([RETAIL_TERROR_ZONE_CONFIG]);
      const [utc, zoneId] = RETAIL_SLOTS[10];
      expect(getTerrorZoneWindows(configs, toSeconds(utc), 1)[0].zoneId).toBe(zoneId);
    });
  });

  describe('If the seed was rounded by a JSON round trip', () => {
    it('Then the schedule differs from retail, because the game uses the seed in the file', () => {
      // Arrange
      const rounded = retailFileJson.replace('16665365343970128666', '16665365343970128000');
      const zones = (config: TerrorZoneScheduleConfig) =>
        getTerrorZoneWindows([config], toSeconds('2026-07-15T00:00:00Z'), 20).map(
          (window) => window.zoneId,
        );

      // Act
      const [config] = parseTerrorZoneScheduleConfigs(rounded);

      // Assert
      expect(config.seed).toBe(16665365343970128000n);
      expect(zones(config)).not.toEqual(zones(RETAIL_TERROR_ZONE_CONFIG));
    });
  });

  describe('When the file has comments, an end time and several configs', () => {
    it('Then every config with a start time is read in file order', () => {
      // Arrange
      const content = `{
        // comment
        "desecrated_zones": [
          { "start_time_utc": "2024-01-02 03:04:05", "end_time_utc": "2024-02-03 04:05:06",
            "seed": 7, "zone_duration_minutes": 60, "break_duration_minutes": 5,
            "zones": [{ "id": "Act1-Catacombs" }, { "id": "Act2-Sewers" }] },
          { "name": "no start time" },
          { "start_time_utc": "2024-02-03 04:05:06", "end_time_utc": "", "seed": 9,
            "zone_duration_minutes": 30, "zones": [] }
        ]
      }`;

      // Act
      const configs = parseTerrorZoneScheduleConfigs(content);

      // Assert
      expect(configs).toEqual([
        {
          startSeconds: Date.UTC(2024, 0, 2, 3, 4, 5) / 1000,
          endSeconds: Date.UTC(2024, 1, 3, 4, 5, 6) / 1000,
          zoneDurationMinutes: 60,
          breakDurationMinutes: 5,
          seed: 7n,
          zoneIds: ['Act1-Catacombs', 'Act2-Sewers'],
        },
        {
          startSeconds: Date.UTC(2024, 1, 3, 4, 5, 6) / 1000,
          endSeconds: Number.POSITIVE_INFINITY,
          zoneDurationMinutes: 30,
          breakDurationMinutes: 0,
          seed: 9n,
          zoneIds: [],
        },
      ]);
    });
  });

  describe('If a duration in the file is not a whole number of minutes', () => {
    it('Then it is read as a whole number like the game does, and the schedule can be calculated', () => {
      // Arrange
      const content = `{ "desecrated_zones": [ { "start_time_utc": "2024-01-02 03:04:05",
        "seed": 7, "zone_duration_minutes": 30.9, "break_duration_minutes": 0.5,
        "zones": [{ "id": "Act1-Catacombs" }, { "id": "Act2-Sewers" }] } ] }`;

      // Act
      const [config] = parseTerrorZoneScheduleConfigs(content);

      // Assert
      expect(config.zoneDurationMinutes).toBe(30);
      expect(config.breakDurationMinutes).toBe(0);
      expect(() => getTerrorZoneWindows([config], config.startSeconds, 3)).not.toThrow();
    });

    it('Then a zone duration below one minute leaves the config without a zone duration', () => {
      // Arrange
      const content = `{ "desecrated_zones": [ { "start_time_utc": "2024-01-02 03:04:05",
        "zone_duration_minutes": 0.01, "zones": [{ "id": "Act1-Catacombs" }] } ] }`;

      // Act
      const [config] = parseTerrorZoneScheduleConfigs(content);

      // Assert
      expect(config.zoneDurationMinutes).toBe(0);
      expect(getTerrorZoneWindows([config], config.startSeconds, 3)).toEqual([]);
    });
  });

  describe('If a duration in the file is outside the 32-bit integer range', () => {
    const readConfig = (zoneDuration: string, breakDuration: string) =>
      parseTerrorZoneScheduleConfigs(`{ "desecrated_zones": [ { "start_time_utc": "2024-01-02 03:04:05",
        "seed": 7, "zone_duration_minutes": ${zoneDuration}, "break_duration_minutes": ${breakDuration},
        "zones": [{ "id": "Act1-Catacombs" }, { "id": "Act2-Sewers" }] } ] }`)[0];

    it('Then a zone duration of 1e308 is read as 0 and the schedule can be calculated', () => {
      // Act
      const config = readConfig('1e308', '0');

      // Assert
      expect(config.zoneDurationMinutes).toBe(0);
      expect(() => getTerrorZoneWindows([config], config.startSeconds, 3)).not.toThrow();
    });

    it('Then a break duration of 1e308 is read as 0 and the schedule can be calculated', () => {
      // Act
      const config = readConfig('30', '1e308');

      // Assert
      expect(config.breakDurationMinutes).toBe(0);
      expect(() => getTerrorZoneWindows([config], config.startSeconds, 3)).not.toThrow();
    });

    it('Then a negative break duration is read as 0, so the zones follow each other', () => {
      // Act
      const config = readConfig('30', '-5');

      // Assert
      expect(config.breakDurationMinutes).toBe(0);
      const windows = getTerrorZoneWindows([config], config.startSeconds, 2);
      expect(windows).toHaveLength(2);
      expect(windows[1].startSeconds).toBe(windows[0].endSeconds);
    });

    it('Then a negative zone duration, or one above the largest 32-bit integer, is read as 0', () => {
      // Act & Assert
      expect(readConfig('-30', '0').zoneDurationMinutes).toBe(0);
      expect(readConfig('2147483648', '0').zoneDurationMinutes).toBe(0);
    });

    it('Then the largest 32-bit integer is kept and the schedule can be calculated', () => {
      // Act
      const config = readConfig('2147483647', '2147483647');

      // Assert
      expect(config.zoneDurationMinutes).toBe(2147483647);
      expect(config.breakDurationMinutes).toBe(2147483647);
      expect(() => getTerrorZoneWindows([config], config.startSeconds, 3)).not.toThrow();
    });
  });

  describe('If the file has no desecrated_zones list', () => {
    it('Then it throws', () => {
      // Act & Assert
      expect(() => parseTerrorZoneScheduleConfigs('{"something_else": []}')).toThrow(
        'Invalid desecratedzones.json structure',
      );
    });
  });
});
