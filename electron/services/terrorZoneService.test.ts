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
    // Create a file with numeric zone IDs (legacy format)
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
});
