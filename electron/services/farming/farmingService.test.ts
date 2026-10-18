import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  areaRow,
  baseItemRow,
  createFarmingTables,
  monsterRow,
  treasureClassRow,
} from '../../test/helpers/farmingTables';
import { FarmingService } from './farmingService';
import { FARMING_GAME_TABLES, type GameTableRow } from './gameTables';

/** Writes rows as a tab-separated table with the union of their columns as headers. */
function toTable(rows: GameTableRow[]): string {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ''))]
    .map((cells) => cells.join('\t'))
    .join('\n');
}

const tables = createFarmingTables({
  treasureclassex: [treasureClassRow('Act 1 (H) H2H A', [['r30', 1]])],
  monstats: [monsterRow('zombie1', [1, 36, 67], { 'TreasureClass(H)': 'Act 1 (H) H2H A' })],
  levels: [areaRow(2, 'Blood Moor', [1, 36, 67], ['zombie1'])],
  misc: [baseItemRow('r30', 1, 'rune')],
});

const terrorZoneFile = JSON.stringify({
  desecrated_zones: [
    {
      game_difficulties: {
        rotw: Object.fromEntries(
          ['normal', 'nightmare', 'hell'].map((key) => [
            key,
            { defaults: { bound_incl_min: 3, bound_incl_max: 96, boost_level: 2 } },
          ]),
        ),
      },
      zones: [{ id: 'Act1-BloodMoor', levels: [{ level_id: 2 }] }],
    },
  ],
});

describe('When the farming service answers from a D2R installation', () => {
  let installPath: string;
  let excelPath: string;

  beforeEach(() => {
    installPath = mkdtempSync(path.join(tmpdir(), 'farming-service-'));
    excelPath = path.join(installPath, 'Data', 'global', 'excel');
    mkdirSync(excelPath, { recursive: true });
    for (const table of FARMING_GAME_TABLES) {
      writeFileSync(path.join(excelPath, `${table}.txt`), toTable(tables[table]));
    }
  });

  afterEach(() => {
    rmSync(installPath, { recursive: true, force: true });
  });

  it('If no installation is set, Then it says so', () => {
    // Arrange
    const service = new FarmingService();

    // Act
    const overview = service.getOverview(undefined, { itemIds: ['ber'], characterLevel: 90 });

    // Assert
    expect(overview).toEqual({ status: 'unavailable', errorCode: 'pathNotConfigured' });
  });

  it('If game data tables are missing, Then it lists them', () => {
    // Arrange
    const service = new FarmingService();
    unlinkSync(path.join(excelPath, 'treasureclassex.txt'));

    // Act
    const overview = service.getOverview(installPath, { itemIds: ['ber'], characterLevel: 90 });

    // Assert
    expect(overview).toEqual({
      status: 'unavailable',
      errorCode: 'gameFilesMissing',
      missingFiles: ['treasureclassex.txt'],
    });
  });

  it('If the tables are there, Then it reports where the items drop and which it does not know', () => {
    // Arrange
    const service = new FarmingService();

    // Act
    const overview = service.getOverview(installPath, {
      itemIds: ['ber', 'harlequincrest'],
      characterLevel: 90,
    });

    // Assert
    expect(overview).toEqual({
      status: 'ready',
      locations: [
        {
          id: 'area:2:hell',
          kind: 'area',
          difficulty: 'hell',
          name: 'Blood Moor',
          areaName: undefined,
          monsterLevel: { min: 67, max: 67 },
          itemIndexes: [0],
        },
      ],
      terrorZones: [],
      unknownItemIndexes: [1],
    });
  });

  it('If the terror zone file is there, Then the zones are terrorized at the character level', () => {
    // Arrange
    const service = new FarmingService();
    const zonePath = path.join(installPath, 'Data', 'hd', 'global', 'excel');
    mkdirSync(zonePath, { recursive: true });
    writeFileSync(path.join(zonePath, 'desecratedzones.json'), terrorZoneFile);

    // Act
    const overview = service.getOverview(installPath, { itemIds: ['ber'], characterLevel: 80 });
    const sources = service.getItemSources(installPath, {
      itemId: 'ber',
      players: 1,
      magicFind: 0,
      characterLevel: 80,
    });

    // Assert
    expect(overview.status === 'ready' && overview.terrorZones).toEqual([
      {
        zoneId: 'Act1-BloodMoor',
        difficulty: 'hell',
        monsterLevel: { min: 82, max: 82 },
        itemIndexes: [0],
      },
    ]);
    expect(sources).toEqual({
      status: 'ready',
      known: true,
      sources: [
        expect.objectContaining({ locationId: 'area:2:hell', dropsPerKill: { min: 1, max: 1 } }),
        expect.objectContaining({
          name: 'Blood Moor and Den of Evil',
          terrorZoneId: 'Act1-BloodMoor',
          monsterLevel: { min: 82, max: 82 },
        }),
      ],
    });
  });

  it('If a table changes on disk, Then it is read again', () => {
    // Arrange
    const service = new FarmingService();
    service.getOverview(installPath, { itemIds: ['ber'], characterLevel: 90 });
    writeFileSync(
      path.join(excelPath, 'treasureclassex.txt'),
      toTable([treasureClassRow('Act 1 (H) H2H A', [['r30', 1]], { noDrop: 1 })]),
    );

    // Act
    const sources = service.getItemSources(installPath, {
      itemId: 'ber',
      players: 1,
      magicFind: 0,
      characterLevel: 90,
    });

    // Assert
    expect(sources.status === 'ready' && sources.sources[0]?.dropsPerKill).toEqual({
      min: 0.5,
      max: 0.5,
    });
  });
});
