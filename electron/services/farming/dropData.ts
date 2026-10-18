import type { FarmingGameTables, GameStrings, GameTableRow } from './gameTables';

/**
 * Drop data read from the game data tables, reduced to what the drop calculation needs.
 * The rules follow the game's own item drop code as reimplemented by D2MOO (see
 * docs/FARMING_ADVISOR.md); differences of Reign of the Warlock that can't be read from the
 * tables are documented there as assumptions.
 */

/** Difficulty index: 0 Normal, 1 Nightmare, 2 Hell. */
export type DifficultyIndex = 0 | 1 | 2;

export const DIFFICULTY_INDEXES: readonly DifficultyIndex[] = [0, 1, 2];

/** Column suffix of each difficulty in the game tables. */
const DIFFICULTY_SUFFIXES = ['', '(N)', '(H)'] as const;

/**
 * Quality ratios of a treasure class: how much it improves the unique, set, rare and magic rolls
 * of the items it drops (out of 1024).
 */
export interface QualityFactors {
  unique: number;
  set: number;
  rare: number;
  magic: number;
}

/** One entry of a treasure class: an item code, another treasure class, or a unique or set name. */
export interface TreasureClassEntry {
  name: string;
  probability: number;
}

export interface TreasureClass {
  name: string;
  /**
   * Position in load order: the generated item type classes first, then treasureclassex.txt.
   * The level upgrade walks to the following positions.
   */
  position: number;
  /** Treasure classes of one group are upgraded to the highest level the monster level allows. */
  group: number;
  level: number;
  /** Positive: random picks, each of which can be NoDrop. Negative: that many drops in order. */
  picks: number;
  quality: QualityFactors;
  noDrop: number;
  entries: TreasureClassEntry[];
  /** The ConditionCalc expression that enables the treasure class, if any */
  condition?: string;
}

export interface BaseItem {
  code: string;
  /** Quality level of the base item */
  level: number;
  /** The item type codes (`type` and `type2`) */
  types: string[];
  normCode: string;
  spawnable: boolean;
  quest: boolean;
}

export interface ItemType {
  code: string;
  /** The type itself and every type it counts as through Equiv1/Equiv2 */
  equivalentTypes: Set<string>;
  rarity: number;
  /** Whether the game generates `<code><level>` treasure classes for the type (e.g. `weap87`) */
  treasureClass: boolean;
  /** Items of the type always have normal quality (e.g. runes) */
  alwaysNormal: boolean;
  classSpecific: boolean;
}

export interface UniqueItem {
  index: string;
  /** The `*ID` column: the unique's id in save files and the Chronicle */
  gameId: number;
  code: string;
  level: number;
  rarity: number;
  spawnable: boolean;
  condition?: string;
}

export interface SetItem {
  index: string;
  /** The `*ID` column: the set item's id in save files and the Chronicle */
  gameId: number;
  setName: string;
  code: string;
  level: number;
  rarity: number;
  spawnable: boolean;
  condition?: string;
}

/** Ratio, divisor and minimum of one quality in itemratio.txt. */
export interface QualityRatio {
  ratio: number;
  divisor: number;
  min: number;
}

export interface ItemRatio {
  version: number;
  uber: boolean;
  classSpecific: boolean;
  unique: QualityRatio;
  set: QualityRatio;
}

/** Monster kinds that have their own treasure class columns in monstats.txt. */
export type MonsterTreasureClassKind = 'regular' | 'champion' | 'unique';

export interface Monster {
  id: string;
  nameKey: string;
  /** Monster level per difficulty (monstats Level, Level(N), Level(H)) */
  levels: [number, number, number];
  boss: boolean;
  noRatio: boolean;
  enabled: boolean;
  killable: boolean;
  treasureClasses: Record<MonsterTreasureClassKind, Array<string | undefined>>;
  /** Treasure classes in a terror zone; empty columns fall back to the regular ones */
  desecratedTreasureClasses: Record<MonsterTreasureClassKind, Array<string | undefined>>;
}

export interface Area {
  id: number;
  name: string;
  /** Area level per difficulty (MonLvlEx) */
  levels: [number, number, number];
  /** Monsters in Normal (mon1-mon25) */
  normalMonsters: string[];
  /** Champions and uniques in Normal (umon1-umon25) */
  normalEliteMonsters: string[];
  /** Monsters, champions and uniques in Nightmare and Hell (nmon1-nmon25) */
  nightmareHellMonsters: string[];
  /** Whether champion and unique packs spawn, per difficulty (MonUMin/MonUMax) */
  hasElites: [boolean, boolean, boolean];
}

export interface SuperUnique {
  key: string;
  name: string;
  monsterId: string;
  treasureClasses: Array<string | undefined>;
  desecratedTreasureClasses: Array<string | undefined>;
}

export interface DropDataset {
  treasureClasses: Map<string, TreasureClass>;
  /** Treasure classes in row order, used for the level upgrade within a group */
  treasureClassRows: TreasureClass[];
  items: Map<string, BaseItem>;
  itemTypes: Map<string, ItemType>;
  uniques: UniqueItem[];
  uniquesByCode: Map<string, UniqueItem[]>;
  uniquesByIndex: Map<string, UniqueItem>;
  sets: SetItem[];
  setsByCode: Map<string, SetItem[]>;
  setsByIndex: Map<string, SetItem>;
  itemRatios: ItemRatio[];
  monsters: Map<string, Monster>;
  areas: Map<number, Area>;
  superUniques: Map<string, SuperUnique>;
  /** English names from the string files, by key */
  strings: GameStrings;
}

/** The levels the game generates item type treasure classes for: 3, 6, ... 96. */
const ITEM_TYPE_TC_LEVEL_STEP = 3;
const ITEM_TYPE_TC_MAX_LEVEL = 96;
/** Throwing potions only appear in their own item type treasure classes. */
const THROWING_POTION_TYPE = 'tpot';

const toInt = (value: string | undefined): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const isSet = (value: string | undefined): boolean => toInt(value) !== 0;

/** Tables of older game versions have no `spawnable` column for uniques and sets: all can drop. */
const isSpawnable = (row: GameTableRow): boolean =>
  row.spawnable === undefined ? true : isSet(row.spawnable);

const optional = (value: string | undefined): string | undefined =>
  value === undefined || value === '' ? undefined : value;

/** Removes the quotes the game tolerates around a treasure class entry. */
const unquote = (value: string): string => value.replace(/"/g, '').trim();

const byDifficulty = (row: GameTableRow, column: string): Array<string | undefined> =>
  DIFFICULTY_SUFFIXES.map((suffix) => optional(row[`${column}${suffix}`]));

function groupBy<T>(values: T[], key: (value: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const value of values) {
    const group = groups.get(key(value)) ?? [];
    group.push(value);
    groups.set(key(value), group);
  }
  return groups;
}

/** Keeps the first value for each key. */
function indexBy<T>(values: T[], key: (value: T) => string): Map<string, T> {
  const index = new Map<string, T>();
  for (const value of values) {
    if (!index.has(key(value))) index.set(key(value), value);
  }
  return index;
}

function buildItemTypes(rows: GameTableRow[]): Map<string, ItemType> {
  const equivalents = new Map<string, string[]>();
  for (const row of rows) {
    if (row.Code) equivalents.set(row.Code, [row.Equiv1, row.Equiv2].filter(Boolean));
  }
  const collect = (code: string, found: Set<string>): Set<string> => {
    if (found.has(code)) return found;
    found.add(code);
    for (const parent of equivalents.get(code) ?? []) collect(parent, found);
    return found;
  };

  const itemTypes = new Map<string, ItemType>();
  for (const row of rows) {
    if (!row.Code) continue;
    itemTypes.set(row.Code, {
      code: row.Code,
      equivalentTypes: collect(row.Code, new Set()),
      rarity: toInt(row.Rarity),
      treasureClass: isSet(row.TreasureClass),
      alwaysNormal: isSet(row.Normal),
      classSpecific: Boolean(row.Class),
    });
  }
  return itemTypes;
}

function buildBaseItems(tables: FarmingGameTables): BaseItem[] {
  return [...tables.weapons, ...tables.armor, ...tables.misc]
    .filter((row) => row.code)
    .map((row) => ({
      code: row.code,
      level: toInt(row.level),
      types: [row.type, row.type2].filter(Boolean),
      normCode: row.normcode ?? '',
      spawnable: isSet(row.spawnable),
      quest: isSet(row.quest),
    }));
}

/**
 * Whether an item counts as an item type, directly or through the type's equivalents.
 */
export function isItemOfType(
  item: BaseItem,
  typeCode: string,
  itemTypes: Map<string, ItemType>,
): boolean {
  return item.types.some((type) => itemTypes.get(type)?.equivalentTypes.has(typeCode));
}

/**
 * Generates the item type treasure classes (`armo3`, `weap87`, ...) the way the game does when it
 * loads its tables: one per item type flagged TreasureClass and level step, holding the spawnable
 * non-quest items of that type whose quality level is in the step, weighted by their type's rarity.
 */
function buildItemTypeTreasureClasses(
  items: BaseItem[],
  itemTypes: Map<string, ItemType>,
): TreasureClass[] {
  const generated: TreasureClass[] = [];
  for (const itemType of itemTypes.values()) {
    if (!itemType.treasureClass) continue;
    for (let level = ITEM_TYPE_TC_LEVEL_STEP; level <= ITEM_TYPE_TC_MAX_LEVEL; ) {
      const entries = items
        .filter(
          (item) =>
            !item.quest &&
            item.spawnable &&
            item.level > level - ITEM_TYPE_TC_LEVEL_STEP &&
            item.level <= level &&
            isItemOfType(item, itemType.code, itemTypes) &&
            (itemType.code === THROWING_POTION_TYPE ||
              !isItemOfType(item, THROWING_POTION_TYPE, itemTypes)),
        )
        .map((item) => ({
          name: item.code,
          probability: Math.max(1, itemTypes.get(item.types[0] ?? '')?.rarity ?? 0),
        }));
      generated.push({
        name: `${itemType.code}${level}`,
        position: 0,
        group: 0,
        level: level - ITEM_TYPE_TC_LEVEL_STEP,
        picks: 1,
        quality: { unique: 0, set: 0, rare: 0, magic: 0 },
        noDrop: 0,
        entries,
      });
      level += ITEM_TYPE_TC_LEVEL_STEP;
    }
  }
  return generated;
}

function buildTreasureClasses(rows: GameTableRow[]): TreasureClass[] {
  const treasureClasses: TreasureClass[] = [];
  for (const row of rows) {
    const name = unquote(row['Treasure Class'] ?? '');
    // The game stops loading treasure classes at the first row without a name
    if (!name) break;
    const entries: TreasureClassEntry[] = [];
    for (let item = 1; item <= 10; item++) {
      // Entries such as `gld,mul=1280` carry arguments after the name
      const entryName =
        unquote(row[`Item${item}`] ?? '')
          .split(',')[0]
          ?.trim() ?? '';
      const probability = toInt(row[`Prob${item}`]);
      if (entryName && probability > 0) entries.push({ name: entryName, probability });
    }
    treasureClasses.push({
      name,
      position: 0,
      group: toInt(row.group),
      level: toInt(row.level),
      picks: toInt(row.Picks) || 1,
      quality: {
        unique: toInt(row.Unique),
        set: toInt(row.Set),
        rare: toInt(row.Rare),
        magic: toInt(row.Magic),
      },
      noDrop: toInt(row.NoDrop),
      entries,
      condition: optional(unquote(row.ConditionCalc ?? '')),
    });
  }
  return treasureClasses;
}

function buildUniques(rows: GameTableRow[]): UniqueItem[] {
  return rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.index && row.code)
    .map(({ row, index }) => ({
      index: row.index,
      gameId: row['*ID'] ? toInt(row['*ID']) : index,
      code: row.code,
      level: toInt(row.lvl),
      rarity: toInt(row.rarity),
      spawnable: isSpawnable(row) && !isSet(row.disabled),
      condition: optional(unquote(row.DropConditionCalc ?? '')),
    }));
}

function buildSets(rows: GameTableRow[]): SetItem[] {
  return rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.index && row.item && !isSet(row.disabled))
    .map(({ row, index }) => ({
      index: row.index,
      gameId: row['*ID'] ? toInt(row['*ID']) : index,
      setName: row.set ?? '',
      code: row.item,
      level: toInt(row.lvl),
      rarity: toInt(row.rarity),
      spawnable: isSpawnable(row),
      condition: optional(unquote(row.DropConditionCalc ?? '')),
    }));
}

function buildItemRatios(rows: GameTableRow[]): ItemRatio[] {
  const ratio = (row: GameTableRow, quality: 'Unique' | 'Set'): QualityRatio => ({
    ratio: toInt(row[quality]),
    divisor: toInt(row[`${quality}Divisor`]) || 1,
    min: toInt(row[`${quality}Min`]),
  });
  return rows
    .filter((row) => row.Unique !== undefined && row.Unique !== '')
    .map((row) => ({
      version: toInt(row.Version),
      uber: isSet(row.Uber),
      classSpecific: isSet(row['Class Specific']),
      unique: ratio(row, 'Unique'),
      set: ratio(row, 'Set'),
    }));
}

function buildMonsters(rows: GameTableRow[]): Map<string, Monster> {
  const monsters = new Map<string, Monster>();
  for (const row of rows) {
    if (!row.Id) continue;
    monsters.set(row.Id, {
      id: row.Id,
      nameKey: row.NameStr ?? '',
      levels: [toInt(row.Level), toInt(row['Level(N)']), toInt(row['Level(H)'])],
      boss: isSet(row.boss),
      noRatio: isSet(row.noRatio),
      enabled: isSet(row.enabled),
      killable: isSet(row.killable),
      treasureClasses: {
        regular: byDifficulty(row, 'TreasureClass'),
        champion: byDifficulty(row, 'TreasureClassChamp'),
        unique: byDifficulty(row, 'TreasureClassUnique'),
      },
      desecratedTreasureClasses: {
        regular: byDifficulty(row, 'TreasureClassDesecrated'),
        champion: byDifficulty(row, 'TreasureClassDesecratedChamp'),
        unique: byDifficulty(row, 'TreasureClassDesecratedUnique'),
      },
    });
  }
  return monsters;
}

const monsterList = (row: GameTableRow, prefix: string): string[] => {
  const ids: string[] = [];
  for (let index = 1; index <= 25; index++) {
    const id = row[`${prefix}${index}`];
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
};

function buildAreas(rows: GameTableRow[], strings: GameStrings): Map<number, Area> {
  const areas = new Map<number, Area>();
  for (const row of rows) {
    const id = toInt(row.Id);
    if (id <= 0) continue;
    const hasElites = DIFFICULTY_SUFFIXES.map(
      (suffix) => toInt(row[`MonUMin${suffix}`]) > 0 || toInt(row[`MonUMax${suffix}`]) > 0,
    );
    areas.set(id, {
      id,
      name:
        strings.get(row.LevelName ?? '') || row['*StringName'] || row.LevelName || row.Name || '',
      levels: [toInt(row.MonLvlEx), toInt(row['MonLvlEx(N)']), toInt(row['MonLvlEx(H)'])],
      normalMonsters: monsterList(row, 'mon'),
      normalEliteMonsters: monsterList(row, 'umon'),
      nightmareHellMonsters: monsterList(row, 'nmon'),
      hasElites: [hasElites[0] ?? false, hasElites[1] ?? false, hasElites[2] ?? false],
    });
  }
  return areas;
}

function buildSuperUniques(rows: GameTableRow[], strings: GameStrings): Map<string, SuperUnique> {
  const superUniques = new Map<string, SuperUnique>();
  for (const row of rows) {
    if (!row.Superunique || !row.Class) continue;
    superUniques.set(row.Superunique, {
      key: row.Superunique,
      name: strings.get(row.Name ?? '') || row.Name || row.Superunique,
      monsterId: row.Class,
      treasureClasses: byDifficulty(row, 'TC'),
      desecratedTreasureClasses: DIFFICULTY_SUFFIXES.map((suffix) =>
        optional(row[`TC${suffix} Desecrated`]),
      ),
    });
  }
  return superUniques;
}

/**
 * Builds the drop dataset from the parsed game data tables.
 * @param tables - The parsed game data tables
 * @param strings - English names by string key, for areas and monsters
 * @returns The dataset
 */
export function buildDropDataset(tables: FarmingGameTables, strings: GameStrings): DropDataset {
  const itemTypes = buildItemTypes(tables.itemtypes);
  const baseItems = buildBaseItems(tables);
  const treasureClassRows = [
    ...buildItemTypeTreasureClasses(baseItems, itemTypes),
    ...buildTreasureClasses(tables.treasureclassex),
  ];
  treasureClassRows.forEach((tc, position) => {
    tc.position = position;
  });
  const uniques = buildUniques(tables.uniqueitems);
  const sets = buildSets(tables.setitems);

  return {
    treasureClasses: indexBy(treasureClassRows, (tc) => tc.name),
    treasureClassRows,
    items: indexBy(baseItems, (item) => item.code),
    itemTypes,
    uniques,
    uniquesByCode: groupBy(uniques, (unique) => unique.code),
    uniquesByIndex: indexBy(uniques, (unique) => unique.index),
    sets,
    setsByCode: groupBy(sets, (set) => set.code),
    setsByIndex: indexBy(sets, (set) => set.index),
    itemRatios: buildItemRatios(tables.itemratio),
    monsters: buildMonsters(tables.monstats),
    areas: buildAreas(tables.levels, strings),
    superUniques: buildSuperUniques(tables.superuniques, strings),
    strings,
  };
}

/**
 * Display name of a monster, from the string files or its id.
 */
export function getMonsterName(dataset: DropDataset, monster: Monster): string {
  return dataset.strings.get(monster.nameKey) || monster.nameKey || monster.id;
}
