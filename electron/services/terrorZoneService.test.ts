import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TerrorZoneService } from './terrorZoneService';

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

describe('TerrorZoneService', () => {
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
});
