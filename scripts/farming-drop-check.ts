/**
 * Compares the farming advisor's treasure class math with the precalculated treasure class drops
 * of blizzhackers/d2data (MIT, https://github.com/blizzhackers/d2data, `json/precalctc`), an
 * independent drop calculator for the same game data.
 *
 * Usage: bun scripts/farming-drop-check.ts <excel-dir> <d2data-precalctc-dir> [tc names...]
 *
 * `<excel-dir>` holds the game data tables the advisor reads (treasureclassex.txt, weapons.txt,
 * ...), for example `<D2R>/Data/global/excel` after extracting the game files. Without treasure
 * class names, every treasure class d2data has a file for is compared, for each difficulty, inside
 * and outside terror zones, and for the NoDrop player counts 1 and 3. The script prints the
 * treasure classes whose expected drops differ by more than 0.1% for any item, and the Hell
 * Countess rune rates for comparison with a published table.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  type DropConditionContext,
  getActiveEntries,
  ReachabilityIndex,
  TargetDropWalker,
} from '../electron/services/farming/dropCalculator';
import { buildDropDataset, type DifficultyIndex } from '../electron/services/farming/dropData';
import {
  FARMING_GAME_TABLES,
  type FarmingGameTables,
  parseGameTable,
} from '../electron/services/farming/gameTables';

type PrecalcEntry = [
  name: string,
  expected: number,
  magic: number,
  rare: number,
  set: number,
  unique: number,
];
type Precalc = PrecalcEntry[][][][];

const [excelDir, precalcDir, ...names] = process.argv.slice(2);
if (!excelDir || !precalcDir) {
  console.error(
    'Usage: bun scripts/farming-drop-check.ts <excel-dir> <d2data-precalctc-dir> [tc names...]',
  );
  process.exit(1);
}

const tables = {} as FarmingGameTables;
for (const table of FARMING_GAME_TABLES) {
  tables[table] = parseGameTable(readFileSync(path.join(excelDir, `${table}.txt`), 'utf-8'));
}
const dataset = buildDropDataset(tables, new Map());

const index: Record<string, string> = JSON.parse(
  readFileSync(path.join(precalcDir, '_index.json'), 'utf-8'),
);
const tcNames = names.length > 0 ? names : Object.keys(index);

let compared = 0;
let differing = 0;
for (const tcName of tcNames) {
  const file = index[tcName] ? path.join(precalcDir, index[tcName]) : undefined;
  if (!file || !existsSync(file) || !dataset.treasureClasses.has(tcName)) continue;
  const precalc: Precalc = JSON.parse(readFileSync(file, 'utf-8'));
  for (const difficulty of [2, 1, 0] as DifficultyIndex[]) {
    for (const desecrated of [false, true]) {
      for (const playerCount of [1, 3]) {
        const expected = precalc[difficulty]?.[desecrated ? 1 : 0]?.[playerCount - 1];
        if (!expected) continue;
        const context: DropConditionContext = { difficulty, desecrated };
        const theirs = new Map<string, number>();
        for (const [name, value, magic, rare, set, unique] of expected) {
          const code = name.replace(/"/g, '').split(',')[0] ?? '';
          const key = `${code}|${unique},${set},${rare},${magic}`;
          theirs.set(key, (theirs.get(key) ?? 0) + value);
        }
        const codes = new Set([...theirs.keys()].map((key) => key.split('|')[0] ?? ''));
        for (const code of new ReachabilityIndex(dataset, context).get(tcName).codes)
          codes.add(code);
        const ours = new Map<string, number>();
        for (const code of codes) {
          const walker = new TargetDropWalker(dataset, context, playerCount, {
            code,
            isForcedTarget: () => false,
          });
          for (const drops of walker.drop(tcName).baseItem) {
            const { unique, set, rare, magic } = drops.quality;
            ours.set(`${code}|${unique},${set},${rare},${magic}`, drops.expected);
          }
        }
        compared++;
        const keys = new Set([...theirs.keys(), ...ours.keys()]);
        const differences = [...keys].filter((key) => {
          const a = theirs.get(key) ?? 0;
          const b = ours.get(key) ?? 0;
          return Math.abs(a - b) > Math.max(1e-9, 1e-3 * Math.max(a, b));
        });
        if (differences.length > 0) {
          differing++;
          const sample = differences
            .slice(0, 3)
            .map((key) => `${key} d2data=${theirs.get(key) ?? 0} ours=${ours.get(key) ?? 0}`);
          const tc = dataset.treasureClasses.get(tcName);
          const active = tc ? getActiveEntries(dataset, tc, context).length : 0;
          console.log(
            `${tcName} [difficulty ${difficulty}, desecrated ${desecrated}, players ${playerCount}, picks ${tc?.picks}, entries ${active}]: ${differences.length} differ, e.g. ${sample.join('; ')}`,
          );
        }
      }
    }
  }
}
console.log(`Compared ${compared} treasure class drops, ${differing} differ.`);

// Published reference: d2runewizard's Countess table lists Um 1:195, Mal 1:191, Ist 1:287 and
// Vex 1:32,150 for Hell (https://d2runewizard.com/articles/mechanics/countess)
if (dataset.treasureClasses.has('Countess (H)')) {
  const hell: DropConditionContext = { difficulty: 2, desecrated: false };
  const rates = ['r22', 'r23', 'r24', 'r26'].map((code) => {
    const walker = new TargetDropWalker(dataset, hell, 1, { code, isForcedTarget: () => false });
    const drops = walker.drop('Countess (H)').baseItem.reduce((sum, d) => sum + d.expected, 0);
    return `${code} 1:${Math.round(1 / drops)}`;
  });
  console.log(`Countess (H) runes at /players 1: ${rates.join(', ')}`);
}
