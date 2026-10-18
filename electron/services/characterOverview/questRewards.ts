import type { QuestRewardId, QuestRewardState, QuestRewardStatus } from '../../types/grail';

/**
 * Quest flags of a character save.
 *
 * The quest section starts with "Woo!", a version (6) and its size (298), followed by 48 16-bit
 * quest words per difficulty (Normal, Nightmare, Hell). The meaning of the bits comes from the
 * public save format docs: Trevin's "Diablo II v1.09 save file format" (bit 0: quest done and
 * reward granted, bit 1: requirements met and the reward waits, Golden Bird bit 5 and Prison of
 * Ice bit 7), D2SSharp's `QuestFlags` and `ActVQuests` (slot 41 holds Akara's respec, bit 0 when
 * used, bit 1 when available) and D2CE's `ActsInfo` (same slot, reads a set low byte as "Akara has
 * reset stat/skill points").
 */

/** "Woo!", version 6 and size 298, the header in front of the quest words. */
const QUEST_SECTION_HEADER = [0x57, 0x6f, 0x6f, 0x21, 0x06, 0x00, 0x00, 0x00, 0x2a, 0x01];
/** The quest section is part of the fixed-size header, which ends before byte 1024 in every version. */
const QUEST_SECTION_SEARCH_LIMIT = 1024;
const QUEST_WORDS_PER_DIFFICULTY = 48;
const DIFFICULTY_COUNT = 3;

/** Quest word of each tracked quest within a difficulty. */
const QUEST_SLOT = {
  denOfEvil: 1,
  toolsOfTheTrade: 3,
  radamentsLair: 9,
  lamEsensTome: 17,
  theGoldenBird: 20,
  theFallenAngel: 25,
  siegeOnHarrogath: 35,
  prisonOfIce: 37,
  akaraRespec: 41,
} as const;

const REWARD_GRANTED = 1 << 0;
const REWARD_PENDING = 1 << 1;
/** The Golden Bird: set while the character holds the Potion of Life, cleared when it is drunk. */
const POTION_OF_LIFE_HELD = 1 << 5;
/** Prison of Ice: set when the Scroll of Resistance was read. */
const SCROLL_OF_RESISTANCE_READ = 1 << 7;

/** The 48 quest words of one difficulty. */
export type DifficultyQuestWords = readonly number[];

function findQuestSection(content: Uint8Array): number | undefined {
  const limit = Math.min(content.length, QUEST_SECTION_SEARCH_LIMIT) - QUEST_SECTION_HEADER.length;
  for (let offset = 0; offset <= limit; offset++) {
    if (QUEST_SECTION_HEADER.every((byte, index) => content[offset + index] === byte)) {
      return offset + QUEST_SECTION_HEADER.length;
    }
  }
  return undefined;
}

/**
 * Reads the quest words of a character save.
 * @param content - The whole save file.
 * @returns The quest words of Normal, Nightmare and Hell, or undefined when the save has no
 * complete quest section.
 */
export function readQuestWords(content: Uint8Array): DifficultyQuestWords[] | undefined {
  const start = findQuestSection(content);
  const byteLength = DIFFICULTY_COUNT * QUEST_WORDS_PER_DIFFICULTY * 2;
  if (start === undefined || start + byteLength > content.length) {
    return undefined;
  }

  const view = new DataView(content.buffer, content.byteOffset + start, byteLength);
  return Array.from({ length: DIFFICULTY_COUNT }, (_, difficulty) =>
    Array.from({ length: QUEST_WORDS_PER_DIFFICULTY }, (_, slot) =>
      view.getUint16((difficulty * QUEST_WORDS_PER_DIFFICULTY + slot) * 2, true),
    ),
  );
}

/** Reward state from the flags every quest shares: granted (bit 0) or waiting (bit 1). */
function generalRewardState(word: number): QuestRewardState {
  if (word & REWARD_GRANTED) {
    return 'claimed';
  }
  return word & REWARD_PENDING ? 'unclaimed' : 'notEarned';
}

function goldenBirdState(word: number): QuestRewardState {
  return word & POTION_OF_LIFE_HELD ? 'unclaimed' : generalRewardState(word);
}

/**
 * The scroll is the reward, so reading it counts even when the quest's own reward flags still
 * read as waiting (real saves have the scroll flag together with bit 1 and without bit 0).
 */
function anyaScrollState(word: number): QuestRewardState {
  if (word & SCROLL_OF_RESISTANCE_READ) {
    return 'claimed';
  }
  return word & (REWARD_GRANTED | REWARD_PENDING) ? 'unclaimed' : 'notEarned';
}

/**
 * Akara offers one respec per difficulty once the Den of Evil is done: bit 0 of the respec slot is
 * set when it was used, bit 1 while it is available.
 */
function akaraRespecState(respecWord: number, denOfEvilWord: number): QuestRewardState {
  if (respecWord & REWARD_GRANTED) {
    return 'claimed';
  }
  return respecWord & REWARD_PENDING || denOfEvilWord & REWARD_GRANTED ? 'unclaimed' : 'notEarned';
}

/**
 * Reward states of one difficulty. Larzuk's socket and Anya's scroll are Act V rewards, so
 * classic characters have neither.
 * @param words - The quest words of the difficulty.
 * @param expansion - Whether the character has Act V.
 */
export function readQuestRewards(
  words: DifficultyQuestWords,
  expansion: boolean,
): QuestRewardStatus[] {
  const word = (slot: number) => words[slot] ?? 0;
  const states: [QuestRewardId, QuestRewardState][] = [
    ['denOfEvil', generalRewardState(word(QUEST_SLOT.denOfEvil))],
    ['charsiImbue', generalRewardState(word(QUEST_SLOT.toolsOfTheTrade))],
    ['akaraRespec', akaraRespecState(word(QUEST_SLOT.akaraRespec), word(QUEST_SLOT.denOfEvil))],
    ['radament', generalRewardState(word(QUEST_SLOT.radamentsLair))],
    ['lamEsen', generalRewardState(word(QUEST_SLOT.lamEsensTome))],
    ['goldenBird', goldenBirdState(word(QUEST_SLOT.theGoldenBird))],
    ['izual', generalRewardState(word(QUEST_SLOT.theFallenAngel))],
  ];
  if (expansion) {
    states.push(
      ['larzukSocket', generalRewardState(word(QUEST_SLOT.siegeOnHarrogath))],
      ['anyaScroll', anyaScrollState(word(QUEST_SLOT.prisonOfIce))],
    );
  }
  return states.map(([reward, state]) => ({ reward, state }));
}
