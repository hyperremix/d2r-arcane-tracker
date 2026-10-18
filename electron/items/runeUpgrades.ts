/** A Horadric Cube recipe that turns several runes of one kind, and maybe a gem, into the next rune. */
export interface RuneUpgradeRecipe {
  /** Catalog id of the rune that goes into the cube (see `runes.ts`) */
  runeId: string;
  /** How many of that rune the recipe takes */
  runeCount: number;
  /** Code of the gem the recipe also takes (see `gems.ts`), if any */
  gemCode?: string;
  /** Catalog id of the rune the recipe makes */
  resultRuneId: string;
}

/**
 * The rune upgrade recipes of cubemain.txt, from El to Zod, each making one rune.
 *
 * Taken from `json/cubemain.json` of blizzhackers/d2data (MIT) at commit
 * fc469993502d0498809b9fc1af140ee2a9eb8902: every enabled row whose output is a rune.
 */
export const runeUpgradeRecipes: readonly RuneUpgradeRecipe[] = [
  { runeId: 'el', runeCount: 3, resultRuneId: 'eld' },
  { runeId: 'eld', runeCount: 3, resultRuneId: 'tir' },
  { runeId: 'tir', runeCount: 3, resultRuneId: 'nef' },
  { runeId: 'nef', runeCount: 3, resultRuneId: 'eth' },
  { runeId: 'eth', runeCount: 3, resultRuneId: 'ith' },
  { runeId: 'ith', runeCount: 3, resultRuneId: 'tal' },
  { runeId: 'tal', runeCount: 3, resultRuneId: 'ral' },
  { runeId: 'ral', runeCount: 3, resultRuneId: 'ort' },
  { runeId: 'ort', runeCount: 3, resultRuneId: 'thul' },
  { runeId: 'thul', runeCount: 3, gemCode: 'gcy', resultRuneId: 'amn' },
  { runeId: 'amn', runeCount: 3, gemCode: 'gcv', resultRuneId: 'sol' },
  { runeId: 'sol', runeCount: 3, gemCode: 'gcb', resultRuneId: 'shael' },
  { runeId: 'shael', runeCount: 3, gemCode: 'gcr', resultRuneId: 'dol' },
  { runeId: 'dol', runeCount: 3, gemCode: 'gcg', resultRuneId: 'hel' },
  { runeId: 'hel', runeCount: 3, gemCode: 'gcw', resultRuneId: 'io' },
  { runeId: 'io', runeCount: 3, gemCode: 'gfy', resultRuneId: 'lum' },
  { runeId: 'lum', runeCount: 3, gemCode: 'gfv', resultRuneId: 'ko' },
  { runeId: 'ko', runeCount: 3, gemCode: 'gfb', resultRuneId: 'fal' },
  { runeId: 'fal', runeCount: 3, gemCode: 'gfr', resultRuneId: 'lem' },
  { runeId: 'lem', runeCount: 3, gemCode: 'gfg', resultRuneId: 'pul' },
  { runeId: 'pul', runeCount: 2, gemCode: 'gfw', resultRuneId: 'um' },
  { runeId: 'um', runeCount: 2, gemCode: 'gsy', resultRuneId: 'mal' },
  { runeId: 'mal', runeCount: 2, gemCode: 'gsv', resultRuneId: 'ist' },
  { runeId: 'ist', runeCount: 2, gemCode: 'gsb', resultRuneId: 'gul' },
  { runeId: 'gul', runeCount: 2, gemCode: 'gsr', resultRuneId: 'vex' },
  { runeId: 'vex', runeCount: 2, gemCode: 'gsg', resultRuneId: 'ohm' },
  { runeId: 'ohm', runeCount: 2, gemCode: 'gsw', resultRuneId: 'lo' },
  { runeId: 'lo', runeCount: 2, gemCode: 'gly', resultRuneId: 'sur' },
  { runeId: 'sur', runeCount: 2, gemCode: 'gzv', resultRuneId: 'ber' },
  { runeId: 'ber', runeCount: 2, gemCode: 'glb', resultRuneId: 'jah' },
  { runeId: 'jah', runeCount: 2, gemCode: 'glr', resultRuneId: 'cham' },
  { runeId: 'cham', runeCount: 2, gemCode: 'glg', resultRuneId: 'zod' },
];
