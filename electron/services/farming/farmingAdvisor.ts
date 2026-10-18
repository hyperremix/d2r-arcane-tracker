import { BOSS_AREA_IDS, SUPER_UNIQUE_AREA_IDS } from '../../data/farmingLocations';
import { TERROR_ZONE_NAMES } from '../../data/terrorZoneNames';
import { itemsByNameSimple } from '../../items/indexes';
import type { Difficulty, Item } from '../../types/catalog';
import type {
  FarmingItemSource,
  FarmingLocationKind,
  FarmingMonsterKind,
  FarmingRange,
} from '../../types/farming';
import { simplifyItemName } from '../../utils/objects';
import { resolveChronicleGrailItemId } from '../chronicle';
import {
  type DropConditionContext,
  type DropTargetMatcher,
  getNoDropPlayerCount,
  getSetChance,
  getUniqueChance,
  HELL_BOVINE_MONSTER_ID,
  type ItemRollContext,
  ReachabilityIndex,
  type ReachableLeaves,
  TargetDropWalker,
  upgradeTreasureClass,
} from './dropCalculator';
import {
  type Area,
  DIFFICULTY_INDEXES,
  type DifficultyIndex,
  type DropDataset,
  getMonsterName,
  type Monster,
  type MonsterTreasureClassKind,
  type QualityFactors,
  type SetItem,
  type SuperUnique,
  type UniqueItem,
} from './dropData';
import {
  getTerrorizedLevel,
  type TerrorZoneData,
  type TerrorZoneLevelRule,
} from './terrorZoneLevels';

export const DIFFICULTIES: readonly Difficulty[] = ['normal', 'nightmare', 'hell'];

/** A grail item as the drop calculation sees it. */
export type FarmingTarget =
  | { kind: 'rune'; code: string }
  | { kind: 'unique'; code: string; unique: UniqueItem }
  | { kind: 'set'; code: string; set: SetItem };

/** One kind of monster at a location, with what it drops from. */
export interface MonsterSpawn {
  monsterId: string;
  kind: FarmingMonsterKind;
  level: number;
  /** The treasure class after the level upgrade */
  treasureClass: string;
}

/** A farming location with the monsters that can be killed there. */
export interface LocationModel {
  id: string;
  kind: FarmingLocationKind;
  difficulty: DifficultyIndex;
  name: string;
  areaName?: string;
  /** Set for the terrorized version of a location */
  terrorZoneId?: string;
  spawns: MonsterSpawn[];
}

/** Level bonus of each monster kind over the area level. */
const KIND_LEVEL_BONUS: Record<MonsterTreasureClassKind, number> = {
  regular: 0,
  champion: 2,
  unique: 3,
};

const SUPER_UNIQUE_LEVEL_BONUS = 3;

/** How monsters are terrorized, when building the terror zone version of a location. */
interface TerrorZoneSettings {
  rule: TerrorZoneLevelRule;
  characterLevel: number;
}

/**
 * Whether a monster's treasure class is upgraded by its level: only in Nightmare and Hell, and
 * not for bosses or monsters flagged noRatio.
 */
const upgradesTreasureClass = (monster: Monster, difficulty: DifficultyIndex): boolean =>
  difficulty !== 0 && !monster.boss && !monster.noRatio;

function resolveSpawnTreasureClass(
  dataset: DropDataset,
  monster: Monster,
  difficulty: DifficultyIndex,
  name: string | undefined,
  level: number,
): string | undefined {
  if (!name) return undefined;
  return upgradesTreasureClass(monster, difficulty)
    ? upgradeTreasureClass(dataset, name, level)
    : dataset.treasureClasses.get(name)?.name;
}

/** The level of a monster outside a terror zone: monstats in Normal and for bosses, else the area. */
const getBaseLevel = (monster: Monster, area: Area, difficulty: DifficultyIndex): number =>
  difficulty === 0 || monster.boss ? monster.levels[difficulty] : area.levels[difficulty];

function createAreaSpawn(
  dataset: DropDataset,
  monsterId: string,
  kind: MonsterTreasureClassKind,
  area: Area,
  difficulty: DifficultyIndex,
  terrorZone: TerrorZoneSettings | undefined,
): MonsterSpawn | undefined {
  const monster = dataset.monsters.get(monsterId);
  if (!monster?.enabled || !monster.killable) return undefined;
  const bonus = KIND_LEVEL_BONUS[kind];
  const originalLevel = getBaseLevel(monster, area, difficulty) + bonus;
  if (originalLevel <= bonus) return undefined;
  const level = terrorZone
    ? getTerrorizedLevel(originalLevel, bonus, terrorZone.characterLevel, terrorZone.rule)
    : originalLevel;
  const regular = monster.treasureClasses[kind][difficulty];
  const name = terrorZone
    ? (monster.desecratedTreasureClasses[kind][difficulty] ?? regular)
    : regular;
  const treasureClass = resolveSpawnTreasureClass(dataset, monster, difficulty, name, level);
  return treasureClass ? { monsterId, kind, level, treasureClass } : undefined;
}

function getAreaSpawns(
  dataset: DropDataset,
  area: Area,
  difficulty: DifficultyIndex,
  terrorZone?: TerrorZoneSettings,
): MonsterSpawn[] {
  const regulars = difficulty === 0 ? area.normalMonsters : area.nightmareHellMonsters;
  const elites = difficulty === 0 ? area.normalEliteMonsters : area.nightmareHellMonsters;
  const candidates: [string, MonsterTreasureClassKind][] = regulars.map((id) => [id, 'regular']);
  if (area.hasElites[difficulty]) {
    for (const id of elites) candidates.push([id, 'champion'], [id, 'unique']);
  }
  return candidates.flatMap(([id, kind]) => {
    const spawn = createAreaSpawn(dataset, id, kind, area, difficulty, terrorZone);
    return spawn ? [spawn] : [];
  });
}

function getSuperUniqueSpawn(
  dataset: DropDataset,
  superUnique: SuperUnique,
  area: Area,
  difficulty: DifficultyIndex,
  terrorZone?: TerrorZoneSettings,
): MonsterSpawn | undefined {
  const monster = dataset.monsters.get(superUnique.monsterId);
  if (!monster) return undefined;
  const baseLevel = getBaseLevel(monster, area, difficulty);
  let level = baseLevel + SUPER_UNIQUE_LEVEL_BONUS;
  if (terrorZone) {
    const { characterLevel, rule } = terrorZone;
    // Super uniques with a fixed level (Griswold, Radament, Nihlathak) add 3 after terrorizing
    level = monster.boss
      ? getTerrorizedLevel(baseLevel, SUPER_UNIQUE_LEVEL_BONUS, characterLevel, rule) +
        SUPER_UNIQUE_LEVEL_BONUS
      : getTerrorizedLevel(level, SUPER_UNIQUE_LEVEL_BONUS, characterLevel, rule);
  }
  const regular = superUnique.treasureClasses[difficulty];
  const name = terrorZone
    ? (superUnique.desecratedTreasureClasses[difficulty] ?? regular)
    : regular;
  const treasureClass = resolveSpawnTreasureClass(dataset, monster, difficulty, name, level);
  return treasureClass
    ? { monsterId: monster.id, kind: 'superUnique', level, treasureClass }
    : undefined;
}

function getBossSpawn(
  dataset: DropDataset,
  monster: Monster,
  difficulty: DifficultyIndex,
  terrorZone?: TerrorZoneSettings,
): MonsterSpawn | undefined {
  const originalLevel = monster.levels[difficulty];
  const level = terrorZone
    ? getTerrorizedLevel(
        originalLevel,
        SUPER_UNIQUE_LEVEL_BONUS,
        terrorZone.characterLevel,
        terrorZone.rule,
      )
    : originalLevel;
  const regular = monster.treasureClasses.regular[difficulty];
  const name = terrorZone
    ? (monster.desecratedTreasureClasses.regular[difficulty] ?? regular)
    : regular;
  const treasureClass = resolveSpawnTreasureClass(dataset, monster, difficulty, name, level);
  return treasureClass ? { monsterId: monster.id, kind: 'boss', level, treasureClass } : undefined;
}

/** The locations of the placed super uniques and bosses that stand in one of the given areas. */
function getMonsterLocations(
  dataset: DropDataset,
  areaIds: Set<number>,
  difficulty: DifficultyIndex,
  idPrefix: string,
  terrorZone?: TerrorZoneSettings,
): LocationModel[] {
  const locations: LocationModel[] = [];
  for (const [key, areaId] of Object.entries(SUPER_UNIQUE_AREA_IDS)) {
    const superUnique = dataset.superUniques.get(key);
    const area = dataset.areas.get(areaId);
    if (!superUnique || !area || !areaIds.has(areaId)) continue;
    const spawn = getSuperUniqueSpawn(dataset, superUnique, area, difficulty, terrorZone);
    if (!spawn) continue;
    locations.push({
      id: `${idPrefix}superUnique:${key}:${DIFFICULTIES[difficulty]}`,
      kind: 'superUnique',
      difficulty,
      name: superUnique.name,
      areaName: area.name,
      spawns: [spawn],
    });
  }
  for (const [monsterId, areaId] of Object.entries(BOSS_AREA_IDS)) {
    const monster = dataset.monsters.get(monsterId);
    const area = dataset.areas.get(areaId);
    if (!monster || !area || !areaIds.has(areaId)) continue;
    const spawn = getBossSpawn(dataset, monster, difficulty, terrorZone);
    if (!spawn) continue;
    locations.push({
      id: `${idPrefix}boss:${monsterId}:${DIFFICULTIES[difficulty]}`,
      kind: 'boss',
      difficulty,
      name: getMonsterName(dataset, monster),
      areaName: area.name,
      spawns: [spawn],
    });
  }
  return locations;
}

/**
 * The farming locations of the game outside terror zones: every area with monsters, and every
 * placed super unique and boss, per difficulty.
 */
export function buildLocations(dataset: DropDataset): LocationModel[] {
  const allAreaIds = new Set(dataset.areas.keys());
  return DIFFICULTY_INDEXES.flatMap((difficulty) => {
    const areas: LocationModel[] = [...dataset.areas.values()].flatMap((area) => {
      const spawns = getAreaSpawns(dataset, area, difficulty);
      if (spawns.length === 0) return [];
      return [
        {
          id: `area:${area.id}:${DIFFICULTIES[difficulty]}`,
          kind: 'area' as const,
          difficulty,
          name: area.name,
          spawns,
        },
      ];
    });
    return [...areas, ...getMonsterLocations(dataset, allAreaIds, difficulty, '')];
  });
}

/**
 * The terrorized locations of every terror zone and difficulty: the monsters of all the zone's
 * areas as one location, plus the zone's super uniques and bosses.
 * @param dataset - The drop data
 * @param terrorZones - The zones and level rules of desecratedzones.json
 * @param characterLevel - The character level the terrorized monster levels follow
 */
export function buildTerrorZoneLocations(
  dataset: DropDataset,
  terrorZones: TerrorZoneData,
  characterLevel: number,
): LocationModel[] {
  return terrorZones.zones.flatMap((zone) =>
    DIFFICULTY_INDEXES.flatMap((difficulty) => {
      const terrorZone = { rule: terrorZones.rules[difficulty], characterLevel };
      const idPrefix = `terrorZone:${zone.id}:`;
      const areas = zone.areaIds.flatMap((id) => {
        const area = dataset.areas.get(id);
        return area ? [area] : [];
      });
      const spawns = areas.flatMap((area) => getAreaSpawns(dataset, area, difficulty, terrorZone));
      const locations: LocationModel[] = getMonsterLocations(
        dataset,
        new Set(zone.areaIds),
        difficulty,
        idPrefix,
        terrorZone,
      );
      if (spawns.length > 0) {
        locations.unshift({
          id: `${idPrefix}area:${DIFFICULTIES[difficulty]}`,
          kind: 'area',
          difficulty,
          name: TERROR_ZONE_NAMES[zone.id] ?? zone.id,
          spawns,
        });
      }
      return locations.map((location) => ({ ...location, terrorZoneId: zone.id }));
    }),
  );
}

const NO_QUALITY: QualityFactors = { unique: 0, set: 0, rare: 0, magic: 0 };

const contextKey = (context: DropConditionContext): string =>
  `${context.difficulty}|${context.desecrated}`;

const locationContext = (location: LocationModel): DropConditionContext => ({
  difficulty: location.difficulty,
  desecrated: location.terrorZoneId !== undefined,
});

const rollContext = (
  location: LocationModel,
  spawn: MonsterSpawn,
  magicFind: number,
): ItemRollContext => ({
  ...locationContext(location),
  itemLevel: spawn.level,
  magicFind,
  hellBovine: spawn.monsterId === HELL_BOVINE_MONSTER_ID,
});

/** Whether a monster that drops from a treasure class tree can drop the target at all. */
function canDropTarget(
  dataset: DropDataset,
  target: FarmingTarget,
  leaves: ReachableLeaves,
  context: ItemRollContext,
): boolean {
  if (target.kind === 'rune') return leaves.codes.has(target.code);
  if (target.kind === 'unique') {
    return (
      leaves.uniques.has(target.unique) ||
      (leaves.codes.has(target.code) &&
        getUniqueChance(dataset, target.unique, NO_QUALITY, context) > 0)
    );
  }
  return (
    leaves.sets.has(target.set) ||
    (leaves.codes.has(target.code) && getSetChance(dataset, target.set, NO_QUALITY, context) > 0)
  );
}

/** Lowest and highest of some values; undefined for none. */
function getRange(values: number[]): FarmingRange | undefined {
  if (values.length === 0) return undefined;
  return { min: Math.min(...values), max: Math.max(...values) };
}

export interface LocationDrops {
  location: LocationModel;
  monsterLevel: FarmingRange;
  /** Positions in the targets of the items that can drop */
  targetIndexes: number[];
}

/**
 * Finds which targets can drop at each location.
 * @param dataset - The drop data
 * @param targets - The items to look for; undefined entries are skipped
 * @param locations - The locations to check
 * @returns For each location with monsters, the targets that can drop there
 */
export function findDroppableTargets(
  dataset: DropDataset,
  targets: Array<FarmingTarget | undefined>,
  locations: LocationModel[],
): LocationDrops[] {
  const indexes = new Map<string, ReachabilityIndex>();
  const getIndex = (context: DropConditionContext): ReachabilityIndex => {
    const key = contextKey(context);
    let index = indexes.get(key);
    if (!index) {
      index = new ReachabilityIndex(dataset, context);
      indexes.set(key, index);
    }
    return index;
  };

  return locations.map((location) => {
    const index = getIndex(locationContext(location));
    // Spawns that drop the same way only need one check
    const distinct = new Map<string, MonsterSpawn>();
    for (const spawn of location.spawns) {
      distinct.set(
        `${spawn.treasureClass}|${spawn.level}|${spawn.monsterId === HELL_BOVINE_MONSTER_ID}`,
        spawn,
      );
    }
    const checks = [...distinct.values()].map((spawn) => ({
      leaves: index.get(spawn.treasureClass),
      context: rollContext(location, spawn, 0),
    }));
    const targetIndexes: number[] = [];
    targets.forEach((target, targetIndex) => {
      if (
        target &&
        checks.some(({ leaves, context }) => canDropTarget(dataset, target, leaves, context))
      ) {
        targetIndexes.push(targetIndex);
      }
    });
    return {
      location,
      monsterLevel: getRange(location.spawns.map((spawn) => spawn.level)) ?? { min: 0, max: 0 },
      targetIndexes,
    };
  });
}

/** Options of a drop chance calculation. */
export interface DropChanceOptions {
  players: number;
  magicFind: number;
}

/**
 * Calculates where a target drops and how many drops of it to expect per kill.
 * @param dataset - The drop data
 * @param target - The item
 * @param locations - The locations to check
 * @param options - /players and magic find
 * @returns One source per location and monster kind that can drop the item, most drops first
 */
export function findItemSources(
  dataset: DropDataset,
  target: FarmingTarget,
  locations: LocationModel[],
  options: DropChanceOptions,
): FarmingItemSource[] {
  const playerCount = getNoDropPlayerCount(options.players);
  const walkers = new Map<string, TargetDropWalker>();
  const matcher: DropTargetMatcher = {
    code: target.code,
    isForcedTarget: (entry) =>
      (target.kind === 'unique' && entry.kind === 'unique' && entry.unique === target.unique) ||
      (target.kind === 'set' && entry.kind === 'set' && entry.set === target.set),
  };
  const getWalker = (context: DropConditionContext): TargetDropWalker => {
    const key = contextKey(context);
    let walker = walkers.get(key);
    if (!walker) {
      walker = new TargetDropWalker(dataset, context, playerCount, matcher);
      walkers.set(key, walker);
    }
    return walker;
  };

  const leafChance = (quality: QualityFactors, context: ItemRollContext): number => {
    if (target.kind === 'rune') return 1;
    if (target.kind === 'unique') return getUniqueChance(dataset, target.unique, quality, context);
    return getSetChance(dataset, target.set, quality, context);
  };

  const sources: FarmingItemSource[] = [];
  for (const location of locations) {
    const walker = getWalker(locationContext(location));
    const byKind = new Map<FarmingMonsterKind, { levels: number[]; drops: number[] }>();
    for (const spawn of location.spawns) {
      const drops = walker.drop(spawn.treasureClass);
      const context = rollContext(location, spawn, options.magicFind);
      const expected =
        drops.forced +
        drops.baseItem.reduce(
          (sum, base) => sum + base.expected * leafChance(base.quality, context),
          0,
        );
      if (expected <= 0) continue;
      const kind = byKind.get(spawn.kind) ?? { levels: [], drops: [] };
      kind.levels.push(spawn.level);
      kind.drops.push(expected);
      byKind.set(spawn.kind, kind);
    }
    for (const [monsterKind, { levels, drops }] of byKind) {
      sources.push({
        locationId: location.id,
        kind: location.kind,
        monsterKind,
        difficulty: DIFFICULTIES[location.difficulty] ?? 'normal',
        name: location.name,
        areaName: location.areaName,
        terrorZoneId: location.terrorZoneId,
        monsterLevel: getRange(levels) ?? { min: 0, max: 0 },
        dropsPerKill: getRange(drops) ?? { min: 0, max: 0 },
      });
    }
  }
  return sources.sort((a, b) => b.dropsPerKill.max - a.dropsPerKill.max);
}

/** Keeps the row that can drop when several game data rows are the same grail item. */
function addTargetRow<T extends { spawnable: boolean }>(
  rows: Map<string, T>,
  itemId: string,
  row: T,
) {
  const existing = rows.get(itemId);
  if (!existing || (!existing.spawnable && row.spawnable)) rows.set(itemId, row);
}

/**
 * Builds a lookup from grail catalog items to the uniques, set items and runes of the game data.
 * Unique and set rows are matched to grail items by name, and rows whose name in the game data is
 * spelled differently from the in-game name the way Chronicle entries are (by their id in the
 * parser data); runes by code. Runewords can't drop and resolve to nothing.
 * @param dataset - The drop data
 * @returns A function returning the target of a catalog item, or undefined when there is none
 */
export function createTargetResolver(
  dataset: DropDataset,
): (item: Item) => FarmingTarget | undefined {
  const uniques = new Map<string, UniqueItem>();
  for (const unique of dataset.uniques) {
    const itemId =
      itemsByNameSimple[simplifyItemName(unique.index)]?.id ??
      resolveChronicleGrailItemId({ category: 'unique', index: unique.gameId });
    if (itemId) addTargetRow(uniques, itemId, unique);
  }
  const sets = new Map<string, SetItem>();
  for (const set of dataset.sets) {
    const itemId =
      itemsByNameSimple[simplifyItemName(set.index)]?.id ??
      resolveChronicleGrailItemId({ category: 'set', index: set.gameId });
    if (itemId) addTargetRow(sets, itemId, set);
  }

  return (item) => {
    if (item.type === 'rune') {
      return item.code && dataset.items.has(item.code)
        ? { kind: 'rune', code: item.code }
        : undefined;
    }
    const unique = item.type === 'unique' ? uniques.get(item.id) : undefined;
    if (unique) return { kind: 'unique', code: unique.code, unique };
    const set = item.type === 'set' ? sets.get(item.id) : undefined;
    if (set) return { kind: 'set', code: set.code, set };
    return undefined;
  };
}
