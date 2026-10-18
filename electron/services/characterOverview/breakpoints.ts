import type { BreakpointPosition, CharacterClass } from '../../types/grail';

interface ClassBreakpoints {
  fasterCastRate: readonly number[];
  fasterHitRecovery: readonly number[];
  fasterBlockRate: readonly number[];
}

type PlayableClass = Exclude<CharacterClass, 'shared_stash'>;

/**
 * Faster cast rate, faster hit recovery and faster block rate breakpoints per class, in percent.
 *
 * The rows are the michaelangel007 D2 cheat sheet rows that bengous/d2-lab
 * (tools/d2r-data/check-breakpoints.py, MIT) rebuilds from the `animdata.d2` of D2R 3.3.93847.
 * Each class has its standard row: the Druid and Necromancer in human form, the Druid's hit
 * recovery for weapons other than one-handed swinging ones, the Paladin's hit recovery for
 * weapons other than spears and staves, and the Amazon's block for weapons other than one-handed
 * swinging ones. Skill-specific rows (Lightning and Chain Lightning, Holy Shield) and shapeshifted
 * forms (werewolf, werebear, vampire) are not included.
 */
const CLASS_BREAKPOINTS: Record<PlayableClass, ClassBreakpoints> = {
  amazon: {
    fasterCastRate: [0, 7, 14, 22, 32, 48, 68, 99, 152],
    fasterHitRecovery: [0, 6, 13, 20, 32, 52, 86, 174, 600],
    fasterBlockRate: [0, 13, 32, 86, 600],
  },
  assassin: {
    fasterCastRate: [0, 8, 16, 27, 42, 65, 102, 174],
    fasterHitRecovery: [0, 7, 15, 27, 48, 86, 200],
    fasterBlockRate: [0, 13, 32, 86, 600],
  },
  barbarian: {
    fasterCastRate: [0, 9, 20, 37, 63, 105, 200],
    fasterHitRecovery: [0, 7, 15, 27, 48, 86, 200],
    fasterBlockRate: [0, 9, 20, 42, 86, 280],
  },
  druid: {
    fasterCastRate: [0, 4, 10, 19, 30, 46, 68, 99, 163],
    fasterHitRecovery: [0, 5, 10, 16, 26, 39, 56, 86, 152, 377],
    fasterBlockRate: [0, 6, 13, 20, 32, 52, 86, 174, 600],
  },
  necromancer: {
    fasterCastRate: [0, 9, 18, 30, 48, 75, 125],
    fasterHitRecovery: [0, 5, 10, 16, 26, 39, 56, 86, 152, 377],
    fasterBlockRate: [0, 6, 13, 20, 32, 52, 86, 174, 600],
  },
  paladin: {
    fasterCastRate: [0, 9, 18, 30, 48, 75, 125],
    fasterHitRecovery: [0, 7, 15, 27, 48, 86, 200],
    fasterBlockRate: [0, 13, 32, 86, 600],
  },
  sorceress: {
    fasterCastRate: [0, 9, 20, 37, 63, 105, 200],
    fasterHitRecovery: [0, 5, 9, 14, 20, 30, 42, 60, 86, 142, 280],
    fasterBlockRate: [0, 7, 15, 27, 48, 86, 200],
  },
  warlock: {
    fasterCastRate: [0, 9, 18, 30, 48, 75, 125],
    fasterHitRecovery: [0, 5, 10, 16, 26, 39, 56, 86, 152, 377],
    fasterBlockRate: [0, 6, 13, 20, 32, 52, 86],
  },
};

/** Speed stats that have breakpoint tables. */
export type BreakpointStat = keyof ClassBreakpoints;

/**
 * Finds the breakpoint a speed stat reaches and the next one.
 * @param characterClass - Class of the character; without a table no position is returned.
 * @param stat - The speed stat.
 * @param total - The character's total of the stat, in percent.
 */
export function findBreakpoint(
  characterClass: CharacterClass | undefined,
  stat: BreakpointStat,
  total: number,
): BreakpointPosition | undefined {
  if (!characterClass || characterClass === 'shared_stash') {
    return undefined;
  }

  const table = CLASS_BREAKPOINTS[characterClass][stat];
  const reachedBreakpoints = table.filter((breakpoint) => breakpoint <= total);
  const reached = reachedBreakpoints[reachedBreakpoints.length - 1] ?? 0;
  const next = table.find((breakpoint) => breakpoint > total);
  return next === undefined ? { reached } : { reached, next };
}
