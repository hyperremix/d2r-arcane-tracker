import type { FarmingGameTables, GameTableRow } from '../../services/farming/gameTables';

/**
 * Small, made-up game data tables for farming advisor tests. The values only follow the column
 * layout of the real tables; they are not game data.
 */

/** Options of a treasureclassex.txt row. */
export interface TreasureClassRowOptions {
  group?: number;
  level?: number;
  picks?: number;
  unique?: number;
  set?: number;
  noDrop?: number;
  condition?: string;
}

/** A treasureclassex.txt row with up to ten `[entry, probability]` items. */
export function treasureClassRow(
  name: string,
  entries: [string, number][],
  options: TreasureClassRowOptions = {},
): GameTableRow {
  const row: GameTableRow = {
    'Treasure Class': name,
    group: String(options.group ?? ''),
    level: String(options.level ?? ''),
    Picks: String(options.picks ?? 1),
    Unique: String(options.unique ?? ''),
    Set: String(options.set ?? ''),
    Rare: '',
    Magic: '',
    NoDrop: String(options.noDrop ?? ''),
    ConditionCalc: options.condition ?? '',
  };
  entries.forEach(([entry, probability], index) => {
    row[`Item${index + 1}`] = entry;
    row[`Prob${index + 1}`] = String(probability);
  });
  return row;
}

/** A weapons/armor/misc.txt row. */
export function baseItemRow(
  code: string,
  level: number,
  type: string,
  options: { spawnable?: boolean; quest?: boolean; normCode?: string } = {},
): GameTableRow {
  return {
    name: code,
    code,
    level: String(level),
    type,
    type2: '',
    normcode: options.normCode ?? code,
    spawnable: options.spawnable === false ? '0' : '1',
    quest: options.quest ? '1' : '',
  };
}

/** A uniqueitems.txt row. */
export function uniqueItemRow(
  index: string,
  code: string,
  level: number,
  options: { id?: number; rarity?: number; spawnable?: boolean; condition?: string } = {},
): GameTableRow {
  return {
    index,
    '*ID': String(options.id ?? 9000),
    code,
    lvl: String(level),
    rarity: String(options.rarity ?? 1),
    spawnable: options.spawnable === false ? '' : '1',
    disabled: '',
    DropConditionCalc: options.condition ?? '',
  };
}

/** A setitems.txt row. */
export function setItemRow(
  index: string,
  setName: string,
  code: string,
  level: number,
  options: { id?: number; rarity?: number } = {},
): GameTableRow {
  return {
    index,
    '*ID': String(options.id ?? 9000),
    set: setName,
    item: code,
    lvl: String(level),
    rarity: String(options.rarity ?? 1),
    spawnable: '1',
    disabled: '',
  };
}

/** A monstats.txt row; treasure classes are given per column name, e.g. `TreasureClass(H)`. */
export function monsterRow(
  id: string,
  levels: [number, number, number],
  treasureClasses: Record<string, string>,
  options: { boss?: boolean } = {},
): GameTableRow {
  return {
    Id: id,
    NameStr: id,
    Level: String(levels[0]),
    'Level(N)': String(levels[1]),
    'Level(H)': String(levels[2]),
    boss: options.boss ? '1' : '0',
    noRatio: '',
    enabled: '1',
    killable: '1',
    ...treasureClasses,
  };
}

/** A levels.txt row with the same monster in every difficulty. */
export function areaRow(
  id: number,
  name: string,
  levels: [number, number, number],
  monsters: string[],
  options: { elites?: boolean } = {},
): GameTableRow {
  const row: GameTableRow = {
    Id: String(id),
    Name: name,
    LevelName: name,
    MonLvlEx: String(levels[0]),
    'MonLvlEx(N)': String(levels[1]),
    'MonLvlEx(H)': String(levels[2]),
  };
  for (const suffix of ['', '(N)', '(H)']) {
    row[`MonUMin${suffix}`] = options.elites ? '1' : '';
    row[`MonUMax${suffix}`] = options.elites ? '2' : '';
  }
  monsters.forEach((monster, index) => {
    row[`mon${index + 1}`] = monster;
    row[`umon${index + 1}`] = monster;
    row[`nmon${index + 1}`] = monster;
  });
  return row;
}

/** The Lord of Destruction rows of itemratio.txt for regular items: only Unique and Set matter. */
export const ITEM_RATIO_ROWS: GameTableRow[] = [
  {
    Version: '1',
    Uber: '0',
    'Class Specific': '0',
    Unique: '400',
    UniqueDivisor: '1',
    UniqueMin: '6400',
    Set: '160',
    SetDivisor: '2',
    SetMin: '5600',
  },
];

/** Item types: rings and helms (whose `armo` type gets item type treasure classes) and runes. */
export const ITEM_TYPE_ROWS: GameTableRow[] = [
  { Code: 'armo', Equiv1: '', Equiv2: '', TreasureClass: '1', Rarity: '0', Normal: '', Class: '' },
  {
    Code: 'helm',
    Equiv1: 'armo',
    Equiv2: '',
    TreasureClass: '',
    Rarity: '3',
    Normal: '',
    Class: '',
  },
  { Code: 'ring', Equiv1: '', Equiv2: '', TreasureClass: '', Rarity: '1', Normal: '', Class: '' },
  { Code: 'rune', Equiv1: '', Equiv2: '', TreasureClass: '', Rarity: '1', Normal: '1', Class: '' },
];

/**
 * Game data tables with the given rows; item ratios and item types default to the rows above.
 */
export function createFarmingTables(tables: Partial<FarmingGameTables> = {}): FarmingGameTables {
  return {
    treasureclassex: [],
    levels: [],
    monstats: [],
    superuniques: [],
    itemratio: ITEM_RATIO_ROWS,
    itemtypes: ITEM_TYPE_ROWS,
    uniqueitems: [],
    setitems: [],
    weapons: [],
    armor: [],
    misc: [baseItemRow('rin', 1, 'ring'), baseItemRow('r01', 1, 'rune')],
    ...tables,
  };
}
