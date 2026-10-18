import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { items as catalogItems } from '../../items';
import type { Item } from '../../types/catalog';
import type {
  FarmingDataUnavailable,
  FarmingItemSources,
  FarmingItemSourcesRequest,
  FarmingOverview,
  FarmingOverviewRequest,
} from '../../types/farming';
import { createServiceLogger } from '../../utils/serviceLogger';
import { buildDropDataset, type DropDataset } from './dropData';
import {
  buildLocations,
  buildTerrorZoneLocations,
  createTargetResolver,
  DIFFICULTIES,
  type FarmingTarget,
  findDroppableTargets,
  findItemSources,
  type LocationModel,
} from './farmingAdvisor';
import {
  findMissingGameTables,
  getGameTablesFingerprint,
  readGameStrings,
  readGameTables,
} from './gameTables';
import { parseTerrorZoneData, type TerrorZoneData } from './terrorZoneLevels';

const log = createServiceLogger('FarmingService');

/** Everything read from one installation's game files. */
interface LoadedGameData {
  fingerprint: string;
  dataset: DropDataset;
  locations: LocationModel[];
  resolveTarget: (item: Item) => FarmingTarget | undefined;
}

type LoadResult = { status: 'ready'; data: LoadedGameData } | FarmingDataUnavailable;

/**
 * Answers the farming advisor's questions from the game data tables of the user's extracted D2R
 * files. The tables are read once and kept until they change on disk.
 */
export class FarmingService {
  private cache: { installPath: string; data: LoadedGameData } | undefined;
  private readonly catalogById = new Map(catalogItems.map((item) => [item.id, item]));

  /**
   * Which of the given grail items can drop where, outside and inside terror zones.
   * @param d2rInstallPath - Path to the D2R installation, if configured
   * @param request - The items and the character level for terror zones
   */
  getOverview(
    d2rInstallPath: string | undefined,
    request: FarmingOverviewRequest,
  ): FarmingOverview {
    const loaded = this.load(d2rInstallPath);
    if (loaded.status !== 'ready') return loaded;
    const { dataset, locations, resolveTarget } = loaded.data;
    // Read on every request: the terror zone configuration page may have changed the file
    const terrorZones = this.readTerrorZones(d2rInstallPath ?? '');

    const targets = request.itemIds.map((id) => {
      const item = this.catalogById.get(id);
      return item ? resolveTarget(item) : undefined;
    });
    const terrorZoneLocations = terrorZones
      ? buildTerrorZoneLocations(dataset, terrorZones, request.characterLevel)
      : [];

    const locationDrops = findDroppableTargets(dataset, targets, locations);
    const terrorZoneDrops = findDroppableTargets(dataset, targets, terrorZoneLocations);

    const zones = new Map<string, { levels: number[]; indexes: Set<number> }>();
    for (const { location, monsterLevel, targetIndexes } of terrorZoneDrops) {
      const key = `${location.terrorZoneId}|${location.difficulty}`;
      const zone = zones.get(key) ?? { levels: [], indexes: new Set<number>() };
      zone.levels.push(monsterLevel.min, monsterLevel.max);
      for (const index of targetIndexes) zone.indexes.add(index);
      zones.set(key, zone);
    }

    return {
      status: 'ready',
      locations: locationDrops.map(({ location, monsterLevel, targetIndexes }) => ({
        id: location.id,
        kind: location.kind,
        difficulty: DIFFICULTIES[location.difficulty] ?? 'normal',
        name: location.name,
        areaName: location.areaName,
        monsterLevel,
        itemIndexes: targetIndexes,
      })),
      terrorZones: [...zones].map(([key, zone]) => {
        const [zoneId = '', difficulty = '0'] = key.split('|');
        return {
          zoneId,
          difficulty: DIFFICULTIES[Number(difficulty)] ?? 'normal',
          monsterLevel: { min: Math.min(...zone.levels), max: Math.max(...zone.levels) },
          itemIndexes: [...zone.indexes].sort((a, b) => a - b),
        };
      }),
      unknownItemIndexes: targets.flatMap((target, index) => (target ? [] : [index])),
    };
  }

  /**
   * Where one grail item drops and how many drops to expect per kill.
   * @param d2rInstallPath - Path to the D2R installation, if configured
   * @param request - The item, /players, magic find and the character level for terror zones
   */
  getItemSources(
    d2rInstallPath: string | undefined,
    request: FarmingItemSourcesRequest,
  ): FarmingItemSources {
    const loaded = this.load(d2rInstallPath);
    if (loaded.status !== 'ready') return loaded;
    const { dataset, locations, resolveTarget } = loaded.data;

    const item = this.catalogById.get(request.itemId);
    const target = item ? resolveTarget(item) : undefined;
    if (!target) return { status: 'ready', known: false, sources: [] };

    const terrorZones = this.readTerrorZones(d2rInstallPath ?? '');
    const allLocations = terrorZones
      ? [...locations, ...buildTerrorZoneLocations(dataset, terrorZones, request.characterLevel)]
      : locations;
    return {
      status: 'ready',
      known: true,
      sources: findItemSources(dataset, target, allLocations, request),
    };
  }

  private load(d2rInstallPath: string | undefined): LoadResult {
    if (!d2rInstallPath || d2rInstallPath.trim() === '') {
      return { status: 'unavailable', errorCode: 'pathNotConfigured' };
    }
    try {
      const missingFiles = findMissingGameTables(d2rInstallPath);
      if (missingFiles.length > 0) {
        return { status: 'unavailable', errorCode: 'gameFilesMissing', missingFiles };
      }
      const fingerprint = getGameTablesFingerprint(d2rInstallPath);
      if (
        this.cache?.installPath === d2rInstallPath &&
        this.cache.data.fingerprint === fingerprint
      ) {
        return { status: 'ready', data: this.cache.data };
      }
      const dataset = buildDropDataset(
        readGameTables(d2rInstallPath),
        readGameStrings(d2rInstallPath),
      );
      const data: LoadedGameData = {
        fingerprint,
        dataset,
        locations: buildLocations(dataset),
        resolveTarget: createTargetResolver(dataset),
      };
      this.cache = { installPath: d2rInstallPath, data };
      return { status: 'ready', data };
    } catch (error) {
      log.error('load', error);
      return { status: 'unavailable', errorCode: 'readFailed' };
    }
  }

  /** Reads the terror zones of the game file; without a usable file there are none. */
  private readTerrorZones(d2rInstallPath: string): TerrorZoneData | undefined {
    const filePath = path.join(
      d2rInstallPath,
      'Data',
      'hd',
      'global',
      'excel',
      'desecratedzones.json',
    );
    if (!existsSync(filePath)) return undefined;
    try {
      return parseTerrorZoneData(readFileSync(filePath, 'utf-8'));
    } catch (error) {
      log.error('readTerrorZones', error);
      return undefined;
    }
  }
}
