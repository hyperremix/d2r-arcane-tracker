import { existsSync, readFileSync, statSync } from 'node:fs';
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

/** A map that forgets its oldest entry once it holds `capacity` entries. */
class BoundedCache<Value> {
  private readonly entries = new Map<string, Value>();

  constructor(private readonly capacity: number) {}

  get(key: string): Value | undefined {
    return this.entries.get(key);
  }

  set(key: string, value: Value): void {
    if (this.entries.size >= this.capacity && !this.entries.has(key)) {
      const oldest = this.entries.keys().next();
      if (!oldest.done) this.entries.delete(oldest.value);
    }
    this.entries.set(key, value);
  }
}

/** Results computed from one installation's game files; dropped with them when they change. */
interface ComputedResults {
  terrorZoneLocations: BoundedCache<LocationModel[]>;
  overviews: BoundedCache<FarmingOverview>;
  itemSources: BoundedCache<FarmingItemSources>;
}

/** Everything read from one installation's game files. */
interface LoadedGameData {
  fingerprint: string;
  dataset: DropDataset;
  locations: LocationModel[];
  resolveTarget: (item: Item) => FarmingTarget | undefined;
  computed: ComputedResults;
}

const MAX_CACHED_TERROR_ZONE_LEVELS = 4;
const MAX_CACHED_OVERVIEWS = 4;
const MAX_CACHED_ITEM_SOURCES = 50;

function getTerrorZoneFilePath(d2rInstallPath: string): string {
  return path.join(d2rInstallPath, 'Data', 'hd', 'global', 'excel', 'desecratedzones.json');
}

/** Changes when the terror zone file is added, removed or replaced. */
function getTerrorZoneFingerprint(d2rInstallPath: string): string {
  try {
    const stats = statSync(getTerrorZoneFilePath(d2rInstallPath), { throwIfNoEntry: false });
    return stats ? `${stats.size}:${stats.mtimeMs}` : 'missing';
  } catch {
    return 'unreadable';
  }
}

type LoadResult = { status: 'ready'; data: LoadedGameData } | FarmingDataUnavailable;

/**
 * Answers the farming advisor's questions from the game data tables of the user's extracted D2R
 * files. The tables are read once and kept until they change on disk. Terror zone locations and
 * answers are kept for the latest requests; they are looked up by the size and modification time
 * of the tables and of the terror zone file, so a change to either file brings fresh results.
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
    const { data } = loaded;
    // The terror zone file is checked on every request: the terror zone configuration page may
    // have changed it
    const terrorZoneFingerprint = getTerrorZoneFingerprint(d2rInstallPath ?? '');
    const key = JSON.stringify([terrorZoneFingerprint, request.characterLevel, request.itemIds]);
    let overview = data.computed.overviews.get(key);
    if (!overview) {
      overview = this.computeOverview(data, d2rInstallPath ?? '', terrorZoneFingerprint, request);
      data.computed.overviews.set(key, overview);
    }
    // A copy, so callers can't change what is kept for the next request
    return structuredClone(overview);
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
    const { data } = loaded;
    const terrorZoneFingerprint = getTerrorZoneFingerprint(d2rInstallPath ?? '');
    const key = JSON.stringify([
      terrorZoneFingerprint,
      request.characterLevel,
      request.itemId,
      request.players,
      request.magicFind,
    ]);
    let sources = data.computed.itemSources.get(key);
    if (!sources) {
      sources = this.computeItemSources(data, d2rInstallPath ?? '', terrorZoneFingerprint, request);
      data.computed.itemSources.set(key, sources);
    }
    return structuredClone(sources);
  }

  private computeOverview(
    { dataset, locations, resolveTarget, computed }: LoadedGameData,
    d2rInstallPath: string,
    terrorZoneFingerprint: string,
    request: FarmingOverviewRequest,
  ): FarmingOverview {
    const targets = request.itemIds.map((id) => {
      const item = this.catalogById.get(id);
      return item ? resolveTarget(item) : undefined;
    });
    const terrorZoneLocations = this.getTerrorZoneLocations(
      dataset,
      computed,
      d2rInstallPath,
      terrorZoneFingerprint,
      request.characterLevel,
    );

    const locationDrops = findDroppableTargets(dataset, targets, locations);
    const terrorZoneDrops = findDroppableTargets(dataset, targets, terrorZoneLocations);

    const zones = new Map<
      string,
      { zoneId: string; difficulty: number; levels: number[]; indexes: Set<number> }
    >();
    for (const { location, monsterLevel, targetIndexes } of terrorZoneDrops) {
      const zoneId = location.terrorZoneId ?? '';
      const key = `${zoneId}|${location.difficulty}`;
      const zone = zones.get(key) ?? {
        zoneId,
        difficulty: location.difficulty,
        levels: [],
        indexes: new Set<number>(),
      };
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
      terrorZones: [...zones.values()].map((zone) => ({
        zoneId: zone.zoneId,
        difficulty: DIFFICULTIES[zone.difficulty] ?? 'normal',
        monsterLevel: { min: Math.min(...zone.levels), max: Math.max(...zone.levels) },
        itemIndexes: [...zone.indexes].sort((a, b) => a - b),
      })),
      unknownItemIndexes: targets.flatMap((target, index) => (target ? [] : [index])),
    };
  }

  private computeItemSources(
    { dataset, locations, resolveTarget, computed }: LoadedGameData,
    d2rInstallPath: string,
    terrorZoneFingerprint: string,
    request: FarmingItemSourcesRequest,
  ): FarmingItemSources {
    const item = this.catalogById.get(request.itemId);
    const target = item ? resolveTarget(item) : undefined;
    if (!target) return { status: 'ready', known: false, sources: [] };

    const terrorZoneLocations = this.getTerrorZoneLocations(
      dataset,
      computed,
      d2rInstallPath,
      terrorZoneFingerprint,
      request.characterLevel,
    );
    return {
      status: 'ready',
      known: true,
      sources: findItemSources(dataset, target, [...locations, ...terrorZoneLocations], request),
    };
  }

  /** The terrorized locations at a character level, built once for the current terror zone file. */
  private getTerrorZoneLocations(
    dataset: DropDataset,
    computed: ComputedResults,
    d2rInstallPath: string,
    terrorZoneFingerprint: string,
    characterLevel: number,
  ): LocationModel[] {
    const key = `${terrorZoneFingerprint}|${characterLevel}`;
    let locations = computed.terrorZoneLocations.get(key);
    if (!locations) {
      const terrorZones = this.readTerrorZones(d2rInstallPath);
      locations = terrorZones ? buildTerrorZoneLocations(dataset, terrorZones, characterLevel) : [];
      computed.terrorZoneLocations.set(key, locations);
    }
    return locations;
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
        computed: {
          terrorZoneLocations: new BoundedCache(MAX_CACHED_TERROR_ZONE_LEVELS),
          overviews: new BoundedCache(MAX_CACHED_OVERVIEWS),
          itemSources: new BoundedCache(MAX_CACHED_ITEM_SOURCES),
        },
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
    const filePath = getTerrorZoneFilePath(d2rInstallPath);
    if (!existsSync(filePath)) return undefined;
    try {
      return parseTerrorZoneData(readFileSync(filePath, 'utf-8'));
    } catch (error) {
      log.error('readTerrorZones', error);
      return undefined;
    }
  }
}
