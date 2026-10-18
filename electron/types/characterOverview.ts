/**
 * The character overview of one character save (.d2s): basics, quest rewards and missing
 * waypoints per difficulty, and the totals of the equipped gear.
 *
 * Shared by the main process and the renderer; re-exported from `./grail`.
 */
import type { CharacterClass, Difficulty } from './catalog';

/** Quest rewards the overview tracks, in the order of the acts. */
export type QuestRewardId =
  | 'denOfEvil'
  | 'charsiImbue'
  | 'akaraRespec'
  | 'radament'
  | 'lamEsen'
  | 'goldenBird'
  | 'izual'
  | 'larzukSocket'
  | 'anyaScroll';

/**
 * State of a quest reward in one difficulty.
 * - `claimed`: the reward was taken (for Akara's respec: the respec was used).
 * - `unclaimed`: the quest is done but the reward is still waiting (for Akara's respec: the respec
 *   is available).
 * - `notEarned`: the quest is not done yet.
 */
export type QuestRewardState = 'claimed' | 'unclaimed' | 'notEarned';

/** One quest reward and its state. */
export interface QuestRewardStatus {
  reward: QuestRewardId;
  state: QuestRewardState;
}

/** Waypoints in the order of the waypoint menu, by act. */
export type WaypointId =
  | 'rogueEncampment'
  | 'coldPlains'
  | 'stonyField'
  | 'darkWood'
  | 'blackMarsh'
  | 'outerCloister'
  | 'jail'
  | 'innerCloister'
  | 'catacombs'
  | 'lutGholein'
  | 'sewers'
  | 'dryHills'
  | 'hallsOfTheDead'
  | 'farOasis'
  | 'lostCity'
  | 'palaceCellar'
  | 'arcaneSanctuary'
  | 'canyonOfTheMagi'
  | 'kurastDocks'
  | 'spiderForest'
  | 'greatMarsh'
  | 'flayerJungle'
  | 'lowerKurast'
  | 'kurastBazaar'
  | 'upperKurast'
  | 'travincal'
  | 'duranceOfHate'
  | 'pandemoniumFortress'
  | 'cityOfTheDamned'
  | 'riverOfFlame'
  | 'harrogath'
  | 'frigidHighlands'
  | 'arreatPlateau'
  | 'crystallinePassage'
  | 'hallsOfPain'
  | 'glacialTrail'
  | 'frozenTundra'
  | 'ancientsWay'
  | 'worldstoneKeep';

/** A waypoint and the act (1-5) it is in. */
export interface WaypointLocation {
  act: number;
  waypoint: WaypointId;
}

/** Quest and waypoint progress of one difficulty. */
export interface DifficultyProgress {
  difficulty: Difficulty;
  /** Whether the character can enter the difficulty (Normal always; the next after a completed one). */
  reached: boolean;
  /** Whether the final boss of the difficulty was killed, from the character's progression. */
  completed: boolean;
  /** Tracked quest rewards; empty when the save's quest data could not be read. */
  rewards: QuestRewardStatus[];
  /** Waypoints not activated yet. Classic characters have no Act V waypoints. */
  missingWaypoints: WaypointLocation[];
  activatedWaypointCount: number;
  totalWaypointCount: number;
}

/** Resistances shown in the overview. */
export type ResistanceKind = 'fire' | 'cold' | 'lightning' | 'poison';

/** One resistance in one difficulty, after the difficulty penalty. */
export interface DifficultyResistance {
  difficulty: Difficulty;
  /** Gear, charms and Anya's scrolls minus the difficulty penalty, before the cap. */
  total: number;
  /** Highest value that counts: 75 plus the maximum resistance bonus, at most 95. */
  cap: number;
}

/** A resistance from the counted items, with its value in each difficulty. */
export interface ResistanceTotal {
  kind: ResistanceKind;
  fromItems: number;
  /** Bonus to the maximum resistance from the counted items. */
  maxBonus: number;
  byDifficulty: DifficultyResistance[];
}

/** Breakpoint position of a speed stat: the breakpoint reached and the next one, if any. */
export interface BreakpointPosition {
  reached: number;
  next?: number;
}

/** A speed stat from the counted items; `breakpoints` is missing when the overview has no table. */
export interface SpeedStatTotal {
  total: number;
  breakpoints?: BreakpointPosition;
}

/** Totals of the equipped items of the active weapon set and of the charms in the inventory. */
export interface GearTotals {
  magicFind: number;
  goldFind: number;
  resistances: ResistanceTotal[];
  /** All resistances bonus of the Scrolls of Resistance read (10 per difficulty). */
  anyaScrollBonus: number;
  fasterCastRate: SpeedStatTotal;
  fasterHitRecovery: SpeedStatTotal;
  fasterBlockRate: SpeedStatTotal;
  /** Total only: attack speed breakpoints depend on the weapon and skill. */
  increasedAttackSpeed: number;
}

/** Base attributes as stored in the save, without item bonuses. */
export interface CharacterBaseAttributes {
  strength: number;
  dexterity: number;
  vitality: number;
  energy: number;
  unusedStatPoints: number;
  unusedSkillPoints: number;
}

/** Overview of one character save. */
export interface CharacterOverview {
  name: string;
  /** Class of the character; undefined when the save names a class the app does not know. */
  characterClass?: CharacterClass;
  level: number;
  experience: number;
  hardcore: boolean;
  expansion: boolean;
  saveVersion: number;
  gold: {
    inventory: number;
    stash: number;
  };
  attributes: CharacterBaseAttributes;
  /** Whether the quest section of the save was found; without it no rewards are listed. */
  questDataAvailable: boolean;
  /** Normal, Nightmare and Hell, in that order. */
  difficulties: DifficultyProgress[];
  gear: GearTotals;
}
