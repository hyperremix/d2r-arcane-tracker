import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TERROR_ZONE_NAMES } from '../data/terrorZoneNames';
import { setErrorForwarder } from '../utils/serviceLogger';
import { getTerrorZoneWindows, RETAIL_TERROR_ZONE_CONFIG } from './terrorZoneSchedule';
import { TerrorZoneService } from './terrorZoneService';

vi.mock('./terrorZoneSchedule', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./terrorZoneSchedule')>();
  return { ...actual, getTerrorZoneWindows: vi.fn(actual.getTerrorZoneWindows) };
});

let mockUserDataPath = '';
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => mockUserDataPath),
  },
}));

const createZonesJson = (ids: (string | number)[]): string =>
  JSON.stringify(
    {
      desecrated_zones: [
        {
          zones: ids.map((id) => ({
            type: 'DesecratedZone',
            name: `zone_${id}`,
            id,
            levels: [],
          })),
        },
      ],
    },
    null,
    2,
  );

describe('When the terror zone service manages the game file', () => {
  let service: TerrorZoneService;
  let tempDir: string;
  let gameFilePath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'tz-service-'));
    mockUserDataPath = path.join(tempDir, 'user-data');
    mkdirSync(mockUserDataPath, { recursive: true });

    gameFilePath = path.join(tempDir, 'desecratedzones.json');
    writeFileSync(
      gameFilePath,
      createZonesJson(['Act1-BurialGrounds', 'Act1-Catacombs', 'Act1-ColdPlains']),
      'utf-8',
    );

    service = new TerrorZoneService();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('prefers the backup file when reading zones', async () => {
    await service.readZonesFromFile(gameFilePath, { preferBackup: true });

    writeFileSync(gameFilePath, createZonesJson(['Act1-BurialGrounds', 'Act1-Catacombs']), 'utf-8');

    const zones = await service.readZonesFromFile(gameFilePath, { preferBackup: true });

    expect(zones.map((zone) => zone.id)).toEqual([
      'Act1-BurialGrounds',
      'Act1-Catacombs',
      'Act1-ColdPlains',
    ]);
  });

  it('re-adds previously disabled zones when config enables them again', async () => {
    const zones = await service.readZonesFromFile(gameFilePath, { preferBackup: true });
    const enabledSet = new Set<string>(['Act1-BurialGrounds', 'Act1-Catacombs']);
    await service.writeZonesToFile(gameFilePath, zones, enabledSet);

    const restoredZones = await service.readZonesFromFile(gameFilePath, { preferBackup: true });
    const reEnableSet = new Set<string>([
      'Act1-BurialGrounds',
      'Act1-Catacombs',
      'Act1-ColdPlains',
    ]);
    await service.writeZonesToFile(gameFilePath, restoredZones, reEnableSet);

    const file = JSON.parse(readFileSync(gameFilePath, 'utf-8'));
    const zoneIds = file.desecrated_zones[0].zones.map((zone: { id: string }) => zone.id);

    expect(zoneIds).toEqual(['Act1-BurialGrounds', 'Act1-Catacombs', 'Act1-ColdPlains']);
  });

  it('converts numeric zone IDs to string IDs and assigns proper names', async () => {
    // Create a file with numeric zone IDs (1-based indexing from legacy config)
    writeFileSync(gameFilePath, createZonesJson([1, 2, 3]), 'utf-8');

    const zones = await service.readZonesFromFile(gameFilePath, { preferBackup: true });

    // Verify IDs are converted to strings
    expect(zones.map((zone) => zone.id)).toEqual([
      'Act1-BurialGrounds',
      'Act1-Catacombs',
      'Act1-ColdPlains',
    ]);

    // Verify proper names are assigned
    expect(zones[0].name).toBe('Burial Grounds, Crypt, and Mausoleum');
    expect(zones[1].name).toBe('Cathedral and Catacombs');
    expect(zones[2].name).toBe('Cold Plains and Cave');
  });

  it('handles unknown numeric zone IDs gracefully', async () => {
    // Create a file with an unknown numeric zone ID
    writeFileSync(gameFilePath, createZonesJson([999]), 'utf-8');

    const zones = await service.readZonesFromFile(gameFilePath, { preferBackup: true });

    // Verify fallback behavior for unknown ID
    expect(zones[0].id).toBe('999');
    expect(zones[0].name).toBe('Zone 999');
  });

  describe('When validating the game file', () => {
    it('If the install path is empty, Then returns the pathNotConfigured error code', async () => {
      // Arrange & Act
      const result = await service.validateGameFile('');

      // Assert
      expect(result).toMatchObject({ valid: false, errorCode: 'pathNotConfigured' });
    });

    it('If the install directory does not exist, Then returns the directoryNotFound error code', async () => {
      // Arrange
      const missingDir = path.join(tempDir, 'does-not-exist');

      // Act
      const result = await service.validateGameFile(missingDir);

      // Assert
      expect(result).toMatchObject({ valid: false, errorCode: 'directoryNotFound' });
    });

    it('If the game file is missing, Then returns the gameFileNotFound error code', async () => {
      // Arrange
      const installDir = path.join(tempDir, 'empty-install');
      mkdirSync(installDir, { recursive: true });

      // Act
      const result = await service.validateGameFile(installDir);

      // Assert
      expect(result).toMatchObject({ valid: false, errorCode: 'gameFileNotFound' });
    });

    it('If the game file has no desecrated_zones array, Then returns the invalidStructure error code', async () => {
      // Arrange
      const installDir = path.join(tempDir, 'bad-structure-install');
      const installedGameFile = path.join(
        installDir,
        'Data',
        'hd',
        'global',
        'excel',
        'desecratedzones.json',
      );
      mkdirSync(path.dirname(installedGameFile), { recursive: true });
      writeFileSync(installedGameFile, JSON.stringify({ something_else: [] }), 'utf-8');

      // Act
      const result = await service.validateGameFile(installDir);

      // Assert
      expect(result).toMatchObject({ valid: false, errorCode: 'invalidStructure' });
    });

    it('If the game file is not parseable JSON, Then returns the corruptedFile error code', async () => {
      // Arrange
      const installDir = path.join(tempDir, 'corrupt-install');
      const installedGameFile = path.join(
        installDir,
        'Data',
        'hd',
        'global',
        'excel',
        'desecratedzones.json',
      );
      mkdirSync(path.dirname(installedGameFile), { recursive: true });
      writeFileSync(installedGameFile, '{ "desecrated_zones": [ not json', 'utf-8');

      // Act
      const result = await service.validateGameFile(installDir);

      // Assert
      expect(result).toMatchObject({ valid: false, errorCode: 'corruptedFile' });
    });
  });

  describe('When writing zones fails', () => {
    it('If the game file does not exist, Then surfaces a terrorZoneWriteFailed error to the UI', async () => {
      // Arrange
      const forwarder = vi.fn();
      setErrorForwarder(forwarder);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        // Silence expected error logs
      });
      const missingFile = path.join(tempDir, 'missing', 'desecratedzones.json');

      // Act
      const write = service.writeZonesToFile(missingFile, [], new Set());

      // Assert
      await expect(write).rejects.toThrow('Game file does not exist');
      expect(forwarder).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'TerrorZoneService',
          operation: 'writeZonesToFile',
          severity: 'error',
          code: 'terrorZoneWriteFailed',
          detail: 'Game file does not exist',
        }),
      );
      setErrorForwarder(() => {
        // Reset forwarder
      });
      consoleSpy.mockRestore();
    });
  });

  describe('When the offline terror zone schedule is requested', () => {
    const RETAIL_SEED = '16665365343970128666';
    const retailZoneIds = RETAIL_TERROR_ZONE_CONFIG.zoneIds;
    // 2026-07-15 00:00 UTC is a slot d2emu.com publishes: Cold Plains
    const firstSlotMs = Date.parse('2026-07-15T00:00:00Z');
    let installPath: string;
    let installedGameFile: string;

    const writeGameFile = (zoneIds: string[], seed: string = RETAIL_SEED) => {
      const json = JSON.stringify({
        desecrated_zones: [
          {
            start_time_utc: '2025-12-05 00:00:00',
            end_time_utc: '',
            seed: 0,
            zone_duration_minutes: 30,
            break_duration_minutes: 0,
            zones: zoneIds.map((id) => ({ id, levels: [] })),
          },
        ],
      }).replace('"seed":0', `"seed":${seed}`);
      writeFileSync(installedGameFile, json, 'utf-8');
    };

    beforeEach(() => {
      installPath = path.join(tempDir, 'd2r');
      installedGameFile = service.getGameDataPath(installPath);
      mkdirSync(path.dirname(installedGameFile), { recursive: true });
    });

    it('If no D2R installation is configured, Then it uses the retail configuration', () => {
      // Act
      const schedule = service.getSchedule(undefined, firstSlotMs, 2);

      // Assert
      expect(schedule.source).toBe('retailDefault');
      expect(schedule.slots).toHaveLength(2);
      expect(schedule.slots[0]).toEqual({
        startsAt: firstSlotMs,
        endsAt: firstSlotMs + 30 * 60 * 1000,
        zoneId: 'Act1-ColdPlains',
        zoneName: TERROR_ZONE_NAMES['Act1-ColdPlains'],
      });
      expect(schedule.slots[1].startsAt).toBe(firstSlotMs + 30 * 60 * 1000);
    });

    it('If the game file is not extracted, Then it uses the retail configuration', () => {
      // Act
      const schedule = service.getSchedule(installPath, firstSlotMs, 1);

      // Assert
      expect(schedule.source).toBe('retailDefault');
      expect(schedule.slots[0].zoneId).toBe('Act1-ColdPlains');
    });

    it('When the game file is the retail file, Then it schedules the same zones as the retail configuration', () => {
      // Arrange
      writeGameFile(retailZoneIds);

      // Act
      const schedule = service.getSchedule(installPath, firstSlotMs, 20);

      // Assert
      expect(schedule.source).toBe('gameFile');
      expect(schedule.slots).toEqual(service.getSchedule(undefined, firstSlotMs, 20).slots);
    });

    it('When the zone list was changed on the configuration page, Then the schedule is recalculated from the saved file', async () => {
      // Arrange
      writeGameFile(retailZoneIds);
      const zones = await service.readZonesFromFile(installedGameFile, { preferBackup: true });
      const enabledZoneIds = new Set(['Act1-ColdPlains', 'Act2-Sewers', 'Act5-Halls']);
      const before = service.getSchedule(installPath, firstSlotMs, 12);

      // Act
      await service.writeZonesToFile(installedGameFile, zones, enabledZoneIds);
      const after = service.getSchedule(installPath, firstSlotMs, 12);

      // Assert
      expect(after.source).toBe('gameFile');
      expect(new Set(after.slots.map((slot) => slot.zoneId))).toEqual(enabledZoneIds);
      expect(after.slots.map((slot) => slot.zoneId)).not.toEqual(
        before.slots.map((slot) => slot.zoneId),
      );
    });

    it('When zones are saved, Then the 64-bit seed of the file is kept and the schedule is unchanged', async () => {
      // Arrange
      writeGameFile(retailZoneIds);
      const zones = await service.readZonesFromFile(installedGameFile, { preferBackup: true });
      const before = service.getSchedule(installPath, firstSlotMs, 20);

      // Act
      await service.writeZonesToFile(installedGameFile, zones, new Set(retailZoneIds));

      // Assert
      expect(readFileSync(installedGameFile, 'utf-8')).toContain(`"seed": ${RETAIL_SEED},`);
      expect(service.getSchedule(installPath, firstSlotMs, 20)).toEqual(before);
    });

    it('If the game file is from before patch 3.x, Then it is reported unusable and the retail configuration is used', () => {
      // Arrange: the old format names the duration `terror_duration_min` and numbers the zones
      writeFileSync(
        installedGameFile,
        `{ "desecrated_zones": [ {
          "start_time_utc": "2023-01-27 00:00:00",
          "terror_duration_min": 60, "terror_break_min": 0, "seed": 16664395743969097666,
          "zones": [ { "id": 1 }, { "id": 2 } ] } ] }`,
        'utf-8',
      );

      // Act
      const schedule = service.getSchedule(installPath, firstSlotMs, 1);

      // Assert
      expect(schedule.source).toBe('unusableGameFile');
      expect(schedule.slots[0].zoneId).toBe('Act1-ColdPlains');
    });

    it('If the game file has a zone duration below one minute, Then it is reported unusable and the retail configuration is used', () => {
      // Arrange
      writeFileSync(
        installedGameFile,
        `{ "desecrated_zones": [ {
          "start_time_utc": "2025-12-05 00:00:00", "end_time_utc": "",
          "zone_duration_minutes": 0.01, "break_duration_minutes": 0, "seed": 1,
          "zones": [ { "id": "Act1-ColdPlains" }, { "id": "Act2-Sewers" } ] } ] }`,
        'utf-8',
      );

      // Act
      const schedule = service.getSchedule(installPath, firstSlotMs, 1);

      // Assert
      expect(schedule.source).toBe('unusableGameFile');
      expect(schedule.slots[0].zoneId).toBe('Act1-ColdPlains');
    });

    it('If the game file has a fractional zone duration, Then the game file is read with the whole minutes', () => {
      // Arrange
      writeFileSync(
        installedGameFile,
        `{ "desecrated_zones": [ {
          "start_time_utc": "2025-12-05 00:00:00", "end_time_utc": "",
          "zone_duration_minutes": 30.9, "break_duration_minutes": 0, "seed": 1,
          "zones": [ { "id": "Act1-ColdPlains" }, { "id": "Act2-Sewers" } ] } ] }`,
        'utf-8',
      );

      // Act
      const schedule = service.getSchedule(installPath, firstSlotMs, 2);

      // Assert
      expect(schedule.source).toBe('gameFile');
      expect(schedule.slots[0].endsAt - schedule.slots[0].startsAt).toBe(30 * 60 * 1000);
    });

    it('If the game file has a zone duration of 1e308, Then it is reported unusable and the retail configuration is used', () => {
      // Arrange
      writeFileSync(
        installedGameFile,
        `{ "desecrated_zones": [ {
          "start_time_utc": "2025-12-05 00:00:00", "end_time_utc": "",
          "zone_duration_minutes": 1e308, "break_duration_minutes": 0, "seed": 1,
          "zones": [ { "id": "Act1-ColdPlains" }, { "id": "Act2-Sewers" } ] } ] }`,
        'utf-8',
      );

      // Act
      const schedule = service.getSchedule(installPath, firstSlotMs, 1);

      // Assert
      expect(schedule.source).toBe('unusableGameFile');
      expect(schedule.slots[0].zoneId).toBe('Act1-ColdPlains');
    });

    it('If the game file has a break duration of 1e308, Then the zones follow each other without a break', () => {
      // Arrange
      writeFileSync(
        installedGameFile,
        `{ "desecrated_zones": [ {
          "start_time_utc": "2025-12-05 00:00:00", "end_time_utc": "",
          "zone_duration_minutes": 30, "break_duration_minutes": 1e308, "seed": 1,
          "zones": [ { "id": "Act1-ColdPlains" }, { "id": "Act2-Sewers" } ] } ] }`,
        'utf-8',
      );

      // Act
      const schedule = service.getSchedule(installPath, firstSlotMs, 2);

      // Assert
      expect(schedule.source).toBe('gameFile');
      expect(schedule.slots).toHaveLength(2);
      expect(schedule.slots[1].startsAt).toBe(schedule.slots[0].endsAt);
    });

    it('If the game file has a negative break duration, Then the zones follow each other without a break', () => {
      // Arrange
      writeFileSync(
        installedGameFile,
        `{ "desecrated_zones": [ {
          "start_time_utc": "2025-12-05 00:00:00", "end_time_utc": "",
          "zone_duration_minutes": 30, "break_duration_minutes": -5, "seed": 1,
          "zones": [ { "id": "Act1-ColdPlains" }, { "id": "Act2-Sewers" } ] } ] }`,
        'utf-8',
      );

      // Act
      const schedule = service.getSchedule(installPath, firstSlotMs, 2);

      // Assert
      expect(schedule.source).toBe('gameFile');
      expect(schedule.slots).toHaveLength(2);
      expect(schedule.slots[1].startsAt).toBe(schedule.slots[0].endsAt);
    });

    it('If the schedule of the game file cannot be calculated, Then the error is logged and the retail configuration is used', () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        // Silence expected error logs
      });
      writeGameFile(['Act1-ColdPlains', 'Act2-Sewers']);
      vi.mocked(getTerrorZoneWindows).mockImplementationOnce(() => {
        throw new RangeError('Not an integer');
      });

      // Act
      const schedule = service.getSchedule(installPath, firstSlotMs, 1);

      // Assert
      expect(schedule.source).toBe('retailDefault');
      expect(schedule.slots[0].zoneId).toBe('Act1-ColdPlains');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('If the game file has no zones, Then nothing is scheduled', () => {
      // Arrange
      writeGameFile([]);

      // Act
      const schedule = service.getSchedule(installPath, firstSlotMs, 5);

      // Assert
      expect(schedule).toEqual({ source: 'gameFile', slots: [] });
    });

    it('If the game file is corrupted, Then it uses the retail configuration', () => {
      // Arrange
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        // Silence expected error logs
      });
      writeFileSync(installedGameFile, '{ not json', 'utf-8');

      // Act
      const schedule = service.getSchedule(installPath, firstSlotMs, 1);

      // Assert
      expect(schedule.source).toBe('retailDefault');
      expect(schedule.slots[0].zoneId).toBe('Act1-ColdPlains');
      consoleSpy.mockRestore();
    });

    it('If a zone has no known name, Then the zone id is used in its name', () => {
      // Arrange
      writeGameFile(['Mod-OnlyZone']);

      // Act
      const schedule = service.getSchedule(installPath, firstSlotMs, 1);

      // Assert
      expect(schedule.slots[0]).toMatchObject({
        zoneId: 'Mod-OnlyZone',
        zoneName: 'Zone Mod-OnlyZone',
      });
    });
  });
});
