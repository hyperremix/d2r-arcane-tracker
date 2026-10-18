#!/usr/bin/env bun

/**
 * generate-item-roll-ranges.ts
 *
 * Generates `electron/items/itemRollRanges.ts`: the stat ranges of unique and set items that the
 * app uses to rate how well an item rolled.
 *
 * The source is blizzhackers/d2data (MIT License, https://github.com/blizzhackers/d2data), which
 * converts the game's `uniqueitems.txt`, `setitems.txt`, `properties.txt` and `skills.txt` to
 * JSON. The commit is pinned so the output is reproducible.
 *
 * Usage:
 *   bun scripts/generate-item-roll-ranges.ts [--data-dir <dir>]
 *   bunx biome format --write electron/items/itemRollRanges.ts
 *
 * Options:
 *   --data-dir <dir>  Read uniqueitems.json, setitems.json, properties.json and skills.json from
 *                     this folder instead of downloading them from the pinned d2data commit
 */

import { writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const D2DATA_REPOSITORY = 'blizzhackers/d2data';
const D2DATA_COMMIT = 'fc469993502d0498809b9fc1af140ee2a9eb8902';
const OUTPUT_PATH = resolve(import.meta.dirname, '../electron/items/itemRollRanges.ts');

/** Unique items have up to 12 properties, set items up to 9 (their set bonuses are not rolled). */
const MAX_PROPERTIES = 12;

/** Property functions whose value is rolled between min and max and stored as is. */
const VALUE_FUNCTIONS = new Set([1, 2, 3, 5, 6, 7, 8, 13]);
/** Property functions whose rolled value is stored after a parameter (skill, class, tab). */
const PARAM_FUNCTIONS = new Set([10, 21, 22]);

/**
 * Stats of the property functions that set fixed stats instead of naming them in the table: 5 and
 * 6 add minimum and maximum damage, 7 is enhanced damage (stored as maximum and minimum percent).
 */
const FUNCTION_STATS: Record<number, string[]> = {
  5: ['mindamage', 'secondary_mindamage', 'item_throw_mindamage'],
  6: ['maxdamage', 'secondary_maxdamage', 'item_throw_maxdamage'],
  7: ['item_maxdamage_percent'],
};

type JsonRow = Record<string, unknown>;
type RollPropertyKind = 'value' | 'param' | 'other';

interface PropertyDefinition {
  code: string;
  kind: RollPropertyKind;
  stats: string[];
  /** Fixed parameter of the property (for example the class of `ama`). */
  fixedParam?: number;
  firstFunction?: number;
}

function readArgument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function loadJson(fileName: string, dataDir: string | undefined): Promise<JsonRow[]> {
  const text = dataDir
    ? await readFile(join(dataDir, fileName), 'utf8')
    : await (async () => {
        const url = `https://raw.githubusercontent.com/${D2DATA_REPOSITORY}/${D2DATA_COMMIT}/json/${fileName}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to download ${url}: ${response.status}`);
        }
        return response.text();
      })();
  return Object.values(JSON.parse(text) as Record<string, JsonRow>);
}

function toNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function toText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** The functions of a properties.txt row and the stats they set, without duplicates. */
function readPropertyFunctions(row: JsonRow): { functions: number[]; stats: string[] } {
  const functions: number[] = [];
  const stats = new Set<string>();
  for (let slot = 1; slot <= 7; slot += 1) {
    const func = toNumber(row[`func${slot}`]);
    if (func === undefined) {
      continue;
    }
    functions.push(func);
    const stat = toText(row[`stat${slot}`]);
    for (const name of stat ? [stat] : (FUNCTION_STATS[func] ?? [])) {
      stats.add(name);
    }
  }
  return { functions, stats: [...stats] };
}

function buildPropertyDefinitions(rows: JsonRow[]): Map<string, PropertyDefinition> {
  const definitions = new Map<string, PropertyDefinition>();
  for (const row of rows) {
    const code = toText(row.code);
    if (!code) {
      continue;
    }

    const { functions, stats } = readPropertyFunctions(row);
    const firstFunction = functions[0];
    const isValue = functions.length > 0 && functions.every((func) => VALUE_FUNCTIONS.has(func));
    const isParam =
      functions.length === 1 && firstFunction !== undefined && PARAM_FUNCTIONS.has(firstFunction);
    const kind: RollPropertyKind = isValue ? 'value' : isParam ? 'param' : 'other';
    definitions.set(code.toLowerCase(), {
      code,
      kind,
      stats,
      fixedParam: firstFunction === 21 ? toNumber(row.val1) : undefined,
      firstFunction,
    });
  }
  return definitions;
}

function buildSkillIds(rows: JsonRow[]): Map<string, number> {
  const skillIds = new Map<string, number>();
  for (const row of rows) {
    const name = toText(row.skill);
    const id = toNumber(row['*Id']);
    if (name && id !== undefined) {
      skillIds.set(name.toLowerCase(), id);
    }
  }
  return skillIds;
}

/** Parameter the stored stat carries: the skill of `skill`/`oskill`/`aura`, the class of `ama`. */
function resolveParam(
  definition: PropertyDefinition,
  rawParam: unknown,
  skillIds: Map<string, number>,
): number | undefined {
  if (definition.kind !== 'param') {
    return undefined;
  }
  if (definition.firstFunction === 21) {
    return definition.fixedParam;
  }
  if (definition.firstFunction === 22) {
    const name = toText(rawParam);
    return toNumber(rawParam) ?? (name ? skillIds.get(name.toLowerCase()) : undefined);
  }
  // Skill tabs (function 10) are stored as tab and class; they are matched by stat only
  return undefined;
}

type ItemRollProperty = [code: string, min: number, max: number, param?: number];

function isRolled(definition: PropertyDefinition, min: number, max: number): boolean {
  return definition.kind !== 'other' && min !== max;
}

/**
 * The properties of a unique or set item row that set a stat (codes properties.txt doesn't know
 * are skipped), and whether one of them is rolled.
 */
function readItemRow(
  row: JsonRow,
  definitions: Map<string, PropertyDefinition>,
  skillIds: Map<string, number>,
): { properties: ItemRollProperty[]; hasRolledProperty: boolean } {
  const properties: ItemRollProperty[] = [];
  let hasRolledProperty = false;
  for (let slot = 1; slot <= MAX_PROPERTIES; slot += 1) {
    const definition = definitions.get(toText(row[`prop${slot}`])?.toLowerCase() ?? '');
    if (!definition || definition.stats.length === 0) {
      continue;
    }
    const min = toNumber(row[`min${slot}`]) ?? 0;
    const max = toNumber(row[`max${slot}`]) ?? min;
    const param = resolveParam(definition, row[`par${slot}`], skillIds);
    properties.push(
      param === undefined ? [definition.code, min, max] : [definition.code, min, max, param],
    );
    hasRolledProperty ||= isRolled(definition, min, max);
  }
  return { properties, hasRolledProperty };
}

function buildItemProperties(
  rows: JsonRow[],
  definitions: Map<string, PropertyDefinition>,
  skillIds: Map<string, number>,
  usedCodes: Set<string>,
): Map<number, ItemRollProperty[]> {
  const items = new Map<number, ItemRollProperty[]>();
  for (const row of rows) {
    const id = toNumber(row['*ID']);
    if (id === undefined) {
      continue;
    }

    const { properties, hasRolledProperty } = readItemRow(row, definitions, skillIds);
    if (hasRolledProperty) {
      items.set(id, properties);
      for (const [code] of properties) {
        usedCodes.add(code.toLowerCase());
      }
    }
  }
  return new Map([...items.entries()].sort(([a], [b]) => a - b));
}

function renderItems(items: Map<number, ItemRollProperty[]>): string {
  return [...items.entries()]
    .map(([id, properties]) => `  ${id}: ${JSON.stringify(properties)},`)
    .join('\n');
}

function renderDefinitions(
  definitions: Map<string, PropertyDefinition>,
  usedCodes: Set<string>,
): string {
  return [...usedCodes]
    .sort()
    .map((key) => {
      const definition = definitions.get(key);
      if (!definition) {
        throw new Error(`Missing property definition ${key}`);
      }
      return `  ${JSON.stringify(definition.code)}: { kind: '${definition.kind}', stats: ${JSON.stringify(definition.stats)} },`;
    })
    .join('\n');
}

async function main(): Promise<void> {
  const dataDir = readArgument('--data-dir');
  const [uniqueRows, setRows, propertyRows, skillRows] = await Promise.all([
    loadJson('uniqueitems.json', dataDir),
    loadJson('setitems.json', dataDir),
    loadJson('properties.json', dataDir),
    loadJson('skills.json', dataDir),
  ]);

  const definitions = buildPropertyDefinitions(propertyRows);
  const skillIds = buildSkillIds(skillRows);
  const usedCodes = new Set<string>();
  const uniqueItems = buildItemProperties(uniqueRows, definitions, skillIds, usedCodes);
  const setItems = buildItemProperties(setRows, definitions, skillIds, usedCodes);

  const output = `/**
 * Stat ranges of the unique and set items that have at least one rolled stat, used to rate how
 * well an item rolled.
 *
 * Generated by \`scripts/generate-item-roll-ranges.ts\` from ${D2DATA_REPOSITORY} (MIT License),
 * a JSON conversion of the game's uniqueitems.txt, setitems.txt, properties.txt and skills.txt,
 * at commit ${D2DATA_COMMIT}.
 * Do not edit by hand: run the script again instead.
 */

/**
 * How a property stores its rolled value: \`value\` as the stat value, \`param\` as the stat value
 * after a parameter (skill, class or skill tab), \`other\` for properties whose min and max are not
 * a range of one value (damage ranges, chance to cast, charges, per-level stats, ...).
 */
export type RollPropertyKind = 'value' | 'param' | 'other';

export interface RollPropertyDefinition {
  kind: RollPropertyKind;
  /** Stats (itemstatcost.txt names) the property sets, in the order they are looked up. */
  stats: readonly string[];
}

/** A property of an item: property code, min, max and the stat parameter, if it has one. */
export type ItemRollProperty = readonly [code: string, min: number, max: number, param?: number];

/** The properties the item tables below use, by property code. */
export const ROLL_PROPERTY_DEFINITIONS: Readonly<Record<string, RollPropertyDefinition>> = {
${renderDefinitions(definitions, usedCodes)}
};

/** Properties of unique items, by the unique id stored in the save file. */
export const UNIQUE_ITEM_ROLL_PROPERTIES: Readonly<Record<number, readonly ItemRollProperty[]>> = {
${renderItems(uniqueItems)}
};

/** Properties of set items, by the set item id stored in the save file. */
export const SET_ITEM_ROLL_PROPERTIES: Readonly<Record<number, readonly ItemRollProperty[]>> = {
${renderItems(setItems)}
};
`;

  writeFileSync(OUTPUT_PATH, output);
  console.log(`Wrote ${uniqueItems.size} unique and ${setItems.size} set items to ${OUTPUT_PATH}`);
}

await main();
