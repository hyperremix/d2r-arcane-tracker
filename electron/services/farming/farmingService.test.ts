import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  areaRow,
  baseItemRow,
  createFarmingTables,
  monsterRow,
  treasureClassRow,
} from '../../test/helpers/farmingTables';
import { buildTerrorZoneLocations, findItemSources } from './farmingAdvisor';
import { FarmingService } from './farmingService';
import { FARMING_GAME_TABLES, type GameTableRow } from './gameTables';

/** Writes rows as a tab-separated table with the union of their columns as headers. */
function toTable(rows: GameTableRow[]): string {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [headers, ...rows.map((row) => headers.map((header) => row[header] ?? ''))]
    .map((cells) => cells.join('\t'))
    .join('\n');
}

vi.mock('./farmingAdvisor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./farmingAdvisor')>();
  return {
    ...actual,
    buildTerrorZoneLocations: vi.fn(actual.buildTerrorZoneLocations),
    findItemSources: vi.fn(actual.findItemSources),
  };
});

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
    vi.mocked(buildTerrorZoneLocations).mockClear();
    vi.mocked(findItemSources).mockClear();
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

  describe('and the same questions come again', () => {
    const zonePath = () => path.join(installPath, 'Data', 'hd', 'global', 'excel');
    const sourcesRequest = { itemId: 'ber', players: 1, magicFind: 0, characterLevel: 80 };

    beforeEach(() => {
      mkdirSync(zonePath(), { recursive: true });
      writeFileSync(path.join(zonePath(), 'desecratedzones.json'), terrorZoneFile);
    });

    it('If the overview is asked for twice, Then the terror zones are built once and the answers are equal', () => {
      // Arrange
      const service = new FarmingService();
      const request = { itemIds: ['ber'], characterLevel: 80 };

      // Act
      const first = service.getOverview(installPath, request);
      const second = service.getOverview(installPath, request);

      // Assert
      expect(second).toEqual(first);
      expect(buildTerrorZoneLocations).toHaveBeenCalledTimes(1);
    });

    it('If the item sources of several items are asked for at one level, Then the terror zones are built once', () => {
      // Arrange
      const service = new FarmingService();

      // Act
      service.getItemSources(installPath, sourcesRequest);
      service.getItemSources(installPath, { ...sourcesRequest, itemId: 'harlequincrest' });
      service.getItemSources(installPath, { ...sourcesRequest, players: 3, magicFind: 200 });
      service.getOverview(installPath, { itemIds: ['ber'], characterLevel: 80 });

      // Assert
      expect(buildTerrorZoneLocations).toHaveBeenCalledTimes(1);
    });

    it('If the same item sources are asked for twice, Then they are calculated once', () => {
      // Arrange
      const service = new FarmingService();

      // Act
      const first = service.getItemSources(installPath, sourcesRequest);
      const second = service.getItemSources(installPath, sourcesRequest);

      // Assert
      expect(second).toEqual(first);
      expect(findItemSources).toHaveBeenCalledTimes(1);
    });

    it('If players or magic find change, Then the item sources are calculated again', () => {
      // Arrange
      const service = new FarmingService();
      service.getItemSources(installPath, sourcesRequest);

      // Act
      service.getItemSources(installPath, { ...sourcesRequest, players: 2 });
      service.getItemSources(installPath, { ...sourcesRequest, magicFind: 100 });

      // Assert
      expect(findItemSources).toHaveBeenCalledTimes(3);
    });

    it('If the character level changes, Then the terror zones are built for the new level', () => {
      // Arrange
      const service = new FarmingService();
      service.getOverview(installPath, { itemIds: ['ber'], characterLevel: 80 });

      // Act
      const overview = service.getOverview(installPath, { itemIds: ['ber'], characterLevel: 90 });

      // Assert
      expect(buildTerrorZoneLocations).toHaveBeenCalledTimes(2);
      expect(overview.status === 'ready' && overview.terrorZones[0]?.monsterLevel).toEqual({
        min: 92,
        max: 92,
      });
    });

    it('If the items asked for change, Then the overview is not taken from the earlier items', () => {
      // Arrange
      const service = new FarmingService();
      const withBer = service.getOverview(installPath, { itemIds: ['ber'], characterLevel: 80 });

      // Act
      const withoutBer = service.getOverview(installPath, {
        itemIds: ['harlequincrest'],
        characterLevel: 80,
      });

      // Assert
      expect(withBer.status === 'ready' && withBer.locations).toHaveLength(1);
      expect(withBer.status === 'ready' && withBer.locations[0]?.itemIndexes).toEqual([0]);
      expect(withoutBer.status === 'ready' && withoutBer.locations[0]?.itemIndexes).toEqual([]);
      expect(withoutBer.status === 'ready' && withoutBer.unknownItemIndexes).toEqual([0]);
    });

    it('If the terror zone file changes, Then the terror zones are read again', () => {
      // Arrange
      const service = new FarmingService();
      service.getOverview(installPath, { itemIds: ['ber'], characterLevel: 80 });
      writeFileSync(
        path.join(zonePath(), 'desecratedzones.json'),
        terrorZoneFile.split('"boost_level":2').join('"boost_level":12'),
      );

      // Act
      const overview = service.getOverview(installPath, { itemIds: ['ber'], characterLevel: 80 });

      // Assert
      expect(overview.status === 'ready' && overview.terrorZones[0]?.monsterLevel).toEqual({
        min: 92,
        max: 92,
      });
    });

    it('If the terror zone file is removed, Then the terror zones are gone', () => {
      // Arrange
      const service = new FarmingService();
      service.getOverview(installPath, { itemIds: ['ber'], characterLevel: 80 });
      unlinkSync(path.join(zonePath(), 'desecratedzones.json'));

      // Act
      const overview = service.getOverview(installPath, { itemIds: ['ber'], characterLevel: 80 });
      const sources = service.getItemSources(installPath, sourcesRequest);

      // Assert
      expect(overview.status === 'ready' && overview.terrorZones).toEqual([]);
      expect(sources.status === 'ready' && sources.sources).toHaveLength(1);
    });

    it('If a game table changes, Then the earlier answers are not reused', () => {
      // Arrange
      const service = new FarmingService();
      const before = service.getItemSources(installPath, sourcesRequest);
      writeFileSync(
        path.join(excelPath, 'treasureclassex.txt'),
        toTable([treasureClassRow('Act 1 (H) H2H A', [['r30', 1]], { noDrop: 1 })]),
      );

      // Act
      const after = service.getItemSources(installPath, sourcesRequest);

      // Assert
      expect(before.status === 'ready' && before.sources[0]?.dropsPerKill).toEqual({
        min: 1,
        max: 1,
      });
      expect(after.status === 'ready' && after.sources[0]?.dropsPerKill).toEqual({
        min: 0.5,
        max: 0.5,
      });
    });

    it('If a caller changes an answer, Then the next answer is not affected', () => {
      // Arrange
      const service = new FarmingService();
      const request = { itemIds: ['ber'], characterLevel: 80 };
      const first = service.getOverview(installPath, request);
      if (first.status === 'ready') {
        first.locations.length = 0;
        first.terrorZones.length = 0;
      }
      const sources = service.getItemSources(installPath, sourcesRequest);
      if (sources.status === 'ready') sources.sources.length = 0;

      // Act
      const second = service.getOverview(installPath, request);
      const secondSources = service.getItemSources(installPath, sourcesRequest);

      // Assert
      expect(second.status === 'ready' && second.locations).toHaveLength(1);
      expect(second.status === 'ready' && second.terrorZones).toHaveLength(1);
      expect(secondSources.status === 'ready' && secondSources.sources).toHaveLength(2);
    });

    it('If many different questions come, Then only the latest answers are kept', () => {
      // Arrange
      const service = new FarmingService();
      for (let level = 1; level <= 6; level++) {
        service.getOverview(installPath, { itemIds: ['ber'], characterLevel: level });
      }
      vi.mocked(buildTerrorZoneLocations).mockClear();

      // Act
      service.getOverview(installPath, { itemIds: ['ber'], characterLevel: 6 });
      service.getOverview(installPath, { itemIds: ['ber'], characterLevel: 1 });

      // Assert
      expect(buildTerrorZoneLocations).toHaveBeenCalledTimes(1);
    });
  });
});
