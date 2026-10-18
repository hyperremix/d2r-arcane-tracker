import { readFile } from 'node:fs/promises';
import * as d2s from '@dschu012/d2s';
import type {
  CharacterClass,
  CharacterOverview,
  Difficulty,
  DifficultyProgress,
  WaypointId,
  WaypointLocation,
} from '../../types/grail';
import { createServiceLogger } from '../../utils/serviceLogger';
import { ensureD2sConstants } from '../d2s/constants';
import { computeGearTotals } from './gearTotals';
import { type DifficultyQuestWords, readQuestRewards, readQuestWords } from './questRewards';

const log = createServiceLogger('CharacterOverview');

const PLAYABLE_CLASSES: readonly CharacterClass[] = [
  'amazon',
  'assassin',
  'barbarian',
  'druid',
  'necromancer',
  'paladin',
  'sorceress',
  'warlock',
];

const DIFFICULTIES: readonly Difficulty[] = ['normal', 'nightmare', 'hell'];
/** Activated waypoints of one difficulty as the d2s library reads them: act key, then waypoint key. */
type D2sWaypoints = Record<string, Record<string, boolean | undefined> | undefined>;

/** Keys of the difficulties in the waypoint data of the d2s library. */
const WAYPOINT_DIFFICULTY_KEYS: Record<Difficulty, string> = {
  normal: 'normal',
  nightmare: 'nm',
  hell: 'hell',
};

/** The waypoints of each act, as [overview id, key in the d2s library's waypoint data]. */
const WAYPOINTS_BY_ACT: ReadonlyArray<{
  act: number;
  key: string;
  waypoints: ReadonlyArray<readonly [WaypointId, string]>;
}> = [
  {
    act: 1,
    key: 'act_i',
    waypoints: [
      ['rogueEncampment', 'rogue_encampement'],
      ['coldPlains', 'cold_plains'],
      ['stonyField', 'stony_field'],
      ['darkWood', 'dark_woods'],
      ['blackMarsh', 'black_marsh'],
      ['outerCloister', 'outer_cloister'],
      ['jail', 'jail_lvl_1'],
      ['innerCloister', 'inner_cloister'],
      ['catacombs', 'catacombs_lvl_2'],
    ],
  },
  {
    act: 2,
    key: 'act_ii',
    waypoints: [
      ['lutGholein', 'lut_gholein'],
      ['sewers', 'sewers_lvl_2'],
      ['dryHills', 'dry_hills'],
      ['hallsOfTheDead', 'halls_of_the_dead_lvl_2'],
      ['farOasis', 'far_oasis'],
      ['lostCity', 'lost_city'],
      ['palaceCellar', 'palace_cellar_lvl_1'],
      ['arcaneSanctuary', 'arcane_sanctuary'],
      ['canyonOfTheMagi', 'canyon_of_the_magi'],
    ],
  },
  {
    act: 3,
    key: 'act_iii',
    waypoints: [
      ['kurastDocks', 'kurast_docks'],
      ['spiderForest', 'spider_forest'],
      ['greatMarsh', 'great_marsh'],
      ['flayerJungle', 'flayer_jungle'],
      ['lowerKurast', 'lower_kurast'],
      ['kurastBazaar', 'kurast_bazaar'],
      ['upperKurast', 'upper_kurast'],
      ['travincal', 'travincal'],
      ['duranceOfHate', 'durance_of_hate_lvl_2'],
    ],
  },
  {
    act: 4,
    key: 'act_iv',
    waypoints: [
      ['pandemoniumFortress', 'the_pandemonium_fortress'],
      ['cityOfTheDamned', 'city_of_the_damned'],
      ['riverOfFlame', 'river_of_flame'],
    ],
  },
  {
    act: 5,
    key: 'act_v',
    waypoints: [
      ['harrogath', 'harrogath'],
      ['frigidHighlands', 'frigid_highlands'],
      ['arreatPlateau', 'arreat_plateau'],
      ['crystallinePassage', 'crystalline_passage'],
      ['hallsOfPain', 'halls_of_pain'],
      ['glacialTrail', 'glacial_trail'],
      ['frozenTundra', 'frozen_tundra'],
      ['ancientsWay', 'the_ancients_way'],
      ['worldstoneKeep', 'worldstone_keep_lvl_2'],
    ],
  },
];

/**
 * Progression value at which each difficulty is completed (the thresholds of the character
 * titles): classic characters advance by 4 per difficulty, expansion characters by 5.
 */
const COMPLETED_PROGRESSION: Record<'expansion' | 'classic', Record<Difficulty, number>> = {
  expansion: { normal: 5, nightmare: 10, hell: 15 },
  classic: { normal: 4, nightmare: 8, hell: 12 },
};

/** File offset of the weapon set flag (bit 0: weapon set II is active) in every save version. */
const WEAPON_SET_OFFSET = 0x10;

function toCharacterClass(className: string | undefined): CharacterClass | undefined {
  const normalized = className?.toLowerCase();
  return PLAYABLE_CLASSES.find((characterClass) => characterClass === normalized);
}

function readActiveWeaponSet(content: Uint8Array): 0 | 1 {
  return (content[WEAPON_SET_OFFSET] ?? 0) & 1 ? 1 : 0;
}

function readWaypoints(
  waypoints: D2sWaypoints | undefined,
  expansion: boolean,
): { missing: WaypointLocation[]; activated: number; total: number } {
  const missing: WaypointLocation[] = [];
  let total = 0;
  for (const act of WAYPOINTS_BY_ACT) {
    if (act.act === 5 && !expansion) {
      continue;
    }
    const activatedByKey = waypoints?.[act.key] ?? {};
    for (const [waypoint, key] of act.waypoints) {
      total++;
      if (activatedByKey[key] !== true) {
        missing.push({ act: act.act, waypoint });
      }
    }
  }
  return { missing, activated: total - missing.length, total };
}

/**
 * Builds the overview of a character save that the d2s library has read.
 * @param content - The whole save file; the quest words and the weapon set are read from it.
 * @param character - The save as read by `d2s.read`.
 */
export function buildCharacterOverview(
  content: Uint8Array,
  character: d2s.types.ID2S,
): CharacterOverview {
  const { header } = character;
  const attributes = character.attributes ?? {};
  const expansion = d2s.hasExpansionSections(header);
  const characterClass = toCharacterClass(header.class);
  const level = header.level;
  const questWords = readQuestWords(content);
  const completedAt = COMPLETED_PROGRESSION[expansion ? 'expansion' : 'classic'];

  const difficulties = DIFFICULTIES.map((difficulty, index): DifficultyProgress => {
    const previous = DIFFICULTIES[index - 1];
    const reached = previous === undefined || header.progression >= completedAt[previous];
    const words: DifficultyQuestWords | undefined = questWords?.[index];
    const waypoints = readWaypoints(
      header.waypoints?.[WAYPOINT_DIFFICULTY_KEYS[difficulty]],
      expansion,
    );
    return {
      difficulty,
      reached,
      completed: header.progression >= completedAt[difficulty],
      rewards: words ? readQuestRewards(words, expansion) : [],
      missingWaypoints: waypoints.missing,
      activatedWaypointCount: waypoints.activated,
      totalWaypointCount: waypoints.total,
    };
  });

  const anyaScrollsRead = difficulties.filter((progress) =>
    progress.rewards.some((reward) => reward.reward === 'anyaScroll' && reward.state === 'claimed'),
  ).length;

  return {
    name: header.name,
    characterClass,
    level,
    experience: attributes.experience ?? 0,
    hardcore: header.status.hardcore,
    expansion,
    saveVersion: header.version,
    gold: {
      inventory: attributes.gold ?? 0,
      stash: attributes.stashed_gold ?? 0,
    },
    attributes: {
      strength: attributes.strength ?? 0,
      dexterity: attributes.dexterity ?? 0,
      vitality: attributes.vitality ?? 0,
      energy: attributes.energy ?? 0,
      unusedStatPoints: attributes.unused_stats ?? 0,
      unusedSkillPoints: attributes.unused_skill_points ?? 0,
    },
    questDataAvailable: questWords !== undefined,
    difficulties,
    gear: computeGearTotals({
      items: character.items ?? [],
      level,
      activeWeaponSet: readActiveWeaponSet(content),
      characterClass,
      expansion,
      anyaScrollsRead,
    }),
  };
}

/**
 * Reads a character save and builds its overview. The file is only read, never written.
 * @param filePath - Path of the .d2s file.
 * @returns The overview, or undefined when the file cannot be read or parsed.
 */
export async function readCharacterOverview(
  filePath: string,
): Promise<CharacterOverview | undefined> {
  try {
    ensureD2sConstants();
    const content = await readFile(filePath);
    return buildCharacterOverview(content, await d2s.read(content));
  } catch (error) {
    log.warn('readCharacterOverview', `Failed to read ${filePath}: ${error}`);
    return undefined;
  }
}
