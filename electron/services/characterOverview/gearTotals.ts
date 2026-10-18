import type * as d2s from '@dschu012/d2s';
import type {
  CharacterClass,
  Difficulty,
  GearTotals,
  ResistanceKind,
  ResistanceTotal,
} from '../../types/grail';
import { findBreakpoint } from './breakpoints';

/** `location_id` of equipped items and of items stored in a grid. */
const LOCATION_STORED = 0;
const LOCATION_EQUIPPED = 1;
/** `alt_position_id` of a stored item that lies in the inventory grid. */
const STORED_IN_INVENTORY = 1;
/** Weapon slots (`equipped_id`) of weapon set I and II. */
const WEAPON_SET_SLOTS: Record<0 | 1, readonly number[]> = { 0: [4, 5], 1: [11, 12] };

const BASE_RESISTANCE_CAP = 75;
const MAX_RESISTANCE_CAP = 95;

/**
 * Resistance penalty of each difficulty, as listed for D2R's `difficultylevels.txt` (expansion and
 * classic characters have separate values).
 */
const RESISTANCE_PENALTY: Record<'expansion' | 'classic', Record<Difficulty, number>> = {
  expansion: { normal: 0, nightmare: -40, hell: -100 },
  classic: { normal: 0, nightmare: -20, hell: -50 },
};
const DIFFICULTIES: readonly Difficulty[] = ['normal', 'nightmare', 'hell'];
/** All resistances bonus of one Scroll of Resistance, assumed to apply in every difficulty. */
const ANYA_SCROLL_RESISTANCE = 10;

const RESISTANCE_STATS: Record<ResistanceKind, { value: string; max: string }> = {
  fire: { value: 'fireresist', max: 'maxfireresist' },
  cold: { value: 'coldresist', max: 'maxcoldresist' },
  lightning: { value: 'lightresist', max: 'maxlightresist' },
  poison: { value: 'poisonresist', max: 'maxpoisonresist' },
};

/** Inputs of the gear totals. */
export interface GearTotalsInput {
  items: d2s.types.IItem[];
  level: number;
  /** Active weapon set: 0 for set I, 1 for set II. */
  activeWeaponSet: 0 | 1;
  characterClass?: CharacterClass;
  expansion: boolean;
  /** Number of difficulties in which the Scroll of Resistance was read. */
  anyaScrollsRead: number;
}

/**
 * Items whose stats count: everything equipped except the inactive weapon set, and the charms in
 * the inventory grid. Charms in the stash or the cube give nothing.
 */
export function selectCountedItems(
  items: d2s.types.IItem[],
  activeWeaponSet: 0 | 1,
): d2s.types.IItem[] {
  const inactiveWeaponSlots = WEAPON_SET_SLOTS[activeWeaponSet === 0 ? 1 : 0];
  return items.filter((item) => {
    if (item.location_id === LOCATION_EQUIPPED) {
      return !inactiveWeaponSlots.includes(item.equipped_id);
    }
    return (
      item.location_id === LOCATION_STORED &&
      item.alt_position_id === STORED_IN_INVENTORY &&
      (item.categories ?? []).includes('Charm')
    );
  });
}

/**
 * Sums one stat over the items. The stats come from the item, its runeword and its socketed items
 * (the d2s library combines them); set bonuses are not part of them. The amount is the last value
 * of a stat, the earlier ones are its parameters.
 */
function sumStat(items: d2s.types.IItem[], stat: string): number {
  let total = 0;
  for (const item of items) {
    for (const attribute of item.combined_magic_attributes ?? []) {
      if (attribute.name === stat) {
        total += attribute.values[attribute.values.length - 1] ?? 0;
      }
    }
  }
  return total;
}

/** A "per character level" stat counts value * level / 8, rounded down. */
function perLevel(value: number, level: number): number {
  return Math.floor((value * level) / 8);
}

/** Totals of the counted items, with resistances per difficulty and speed breakpoints. */
export function computeGearTotals({
  items,
  level,
  activeWeaponSet,
  characterClass,
  expansion,
  anyaScrollsRead,
}: GearTotalsInput): GearTotals {
  const counted = selectCountedItems(items, activeWeaponSet);
  const anyaScrollBonus = anyaScrollsRead * ANYA_SCROLL_RESISTANCE;
  const penalty = RESISTANCE_PENALTY[expansion ? 'expansion' : 'classic'];

  const resistances = (Object.keys(RESISTANCE_STATS) as ResistanceKind[]).map(
    (kind): ResistanceTotal => {
      const fromItems = sumStat(counted, RESISTANCE_STATS[kind].value);
      const maxBonus = sumStat(counted, RESISTANCE_STATS[kind].max);
      const cap = Math.min(BASE_RESISTANCE_CAP + maxBonus, MAX_RESISTANCE_CAP);
      return {
        kind,
        fromItems,
        maxBonus,
        byDifficulty: DIFFICULTIES.map((difficulty) => ({
          difficulty,
          total: fromItems + anyaScrollBonus + penalty[difficulty],
          cap,
        })),
      };
    },
  );

  const speedStat = (
    stat: 'fasterCastRate' | 'fasterHitRecovery' | 'fasterBlockRate',
    name: string,
  ) => {
    const total = sumStat(counted, name);
    const breakpoints = findBreakpoint(characterClass, stat, total);
    return breakpoints ? { total, breakpoints } : { total };
  };

  return {
    magicFind:
      sumStat(counted, 'item_magicbonus') +
      perLevel(sumStat(counted, 'item_find_magic_perlevel'), level),
    goldFind:
      sumStat(counted, 'item_goldbonus') +
      perLevel(sumStat(counted, 'item_find_gold_perlevel'), level),
    resistances,
    anyaScrollBonus,
    fasterCastRate: speedStat('fasterCastRate', 'item_fastercastrate'),
    fasterHitRecovery: speedStat('fasterHitRecovery', 'item_fastergethitrate'),
    fasterBlockRate: speedStat('fasterBlockRate', 'item_fasterblockrate'),
    increasedAttackSpeed: sumStat(counted, 'item_fasterattackrate'),
  };
}
