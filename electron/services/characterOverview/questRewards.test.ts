import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { QuestRewardId, QuestRewardState } from '../../types/grail';
import { readQuestRewards, readQuestWords } from './questRewards';

const QUEST_SECTION_HEADER = [0x57, 0x6f, 0x6f, 0x21, 0x06, 0x00, 0x00, 0x00, 0x2a, 0x01];

/** Quest word slots of the tracked quests within a difficulty. */
const SLOT = {
  denOfEvil: 1,
  toolsOfTheTrade: 3,
  radamentsLair: 9,
  lamEsensTome: 17,
  theGoldenBird: 20,
  theFallenAngel: 25,
  siegeOnHarrogath: 35,
  prisonOfIce: 37,
  akaraRespec: 41,
};

function readFixture(fileName: string): Buffer {
  return readFileSync(resolve(process.cwd(), 'electron/services/fixtures', fileName));
}

/** 48 quest words of one difficulty, zero except the given slots. */
function questWords(values: Record<number, number> = {}): number[] {
  return Array.from({ length: 48 }, (_, slot) => values[slot] ?? 0);
}

function rewardState(
  words: number[],
  reward: QuestRewardId,
  expansion = true,
): QuestRewardState | undefined {
  return readQuestRewards(words, expansion).find((status) => status.reward === reward)?.state;
}

describe('When readQuestWords reads the quest section of a character save', () => {
  it('Then it reads the 48 quest words of each difficulty of a real v105 save', () => {
    // Arrange
    const content = readFixture('ChaosSCV105.d2s');

    // Act
    const words = readQuestWords(content);

    // Assert
    expect(words).toHaveLength(3);
    expect(words?.every((difficulty) => difficulty.length === 48)).toBe(true);
    expect(words?.[0][SLOT.denOfEvil]).toBe(0x0001);
    expect(words?.[0][SLOT.prisonOfIce]).toBe(0x0081);
    expect(words?.[0][SLOT.akaraRespec]).toBe(0x8001);
  });

  it('Then it reads the quest words of a v99 save, whose quest section sits at another offset', () => {
    // Arrange
    const content = readFixture('ClassicCharacterV99.d2s');

    // Act
    const words = readQuestWords(content);

    // Assert
    expect(words).toHaveLength(3);
    expect(words?.flat().every((word) => word === 0)).toBe(true);
  });

  it('If the content has no quest section, then nothing is read', () => {
    // Arrange
    const content = new Uint8Array(1024);

    // Act
    const words = readQuestWords(content);

    // Assert
    expect(words).toBeUndefined();
  });

  it('If the quest section is cut off, then nothing is read', () => {
    // Arrange
    const content = Uint8Array.from([...QUEST_SECTION_HEADER, ...new Array(100).fill(0)]);

    // Act
    const words = readQuestWords(content);

    // Assert
    expect(words).toBeUndefined();
  });
});

describe('When readQuestRewards reads the rewards of one difficulty', () => {
  it('If no quest was started, then every reward of an expansion character is not earned', () => {
    // Arrange
    const words = questWords();

    // Act
    const rewards = readQuestRewards(words, true);

    // Assert
    expect(rewards.map((status) => status.reward)).toEqual([
      'denOfEvil',
      'charsiImbue',
      'akaraRespec',
      'radament',
      'lamEsen',
      'goldenBird',
      'izual',
      'larzukSocket',
      'anyaScroll',
    ]);
    expect(rewards.every((status) => status.state === 'notEarned')).toBe(true);
  });

  it('If the character is a classic character, then the Act V rewards are left out', () => {
    // Arrange
    const words = questWords();

    // Act
    const rewards = readQuestRewards(words, false).map((status) => status.reward);

    // Assert
    expect(rewards).not.toContain('larzukSocket');
    expect(rewards).not.toContain('anyaScroll');
  });

  it.each([
    ['denOfEvil', SLOT.denOfEvil],
    ['charsiImbue', SLOT.toolsOfTheTrade],
    ['radament', SLOT.radamentsLair],
    ['lamEsen', SLOT.lamEsensTome],
    ['izual', SLOT.theFallenAngel],
    ['larzukSocket', SLOT.siegeOnHarrogath],
  ] as const)('If the %s quest only met its requirements (bit 1), then its reward is unclaimed', (reward, slot) => {
    // Arrange
    const words = questWords({ [slot]: 0x0002 });

    // Act
    const state = rewardState(words, reward);

    // Assert
    expect(state).toBe('unclaimed');
  });

  it.each([
    ['denOfEvil', SLOT.denOfEvil],
    ['charsiImbue', SLOT.toolsOfTheTrade],
    ['radament', SLOT.radamentsLair],
    ['lamEsen', SLOT.lamEsensTome],
    ['izual', SLOT.theFallenAngel],
    ['larzukSocket', SLOT.siegeOnHarrogath],
  ] as const)('If the %s quest granted its reward (bit 0), then its reward is claimed', (reward, slot) => {
    // Arrange
    const words = questWords({ [slot]: 0x1001 });

    // Act
    const state = rewardState(words, reward);

    // Assert
    expect(state).toBe('claimed');
  });

  it('If the Potion of Life is still held after The Golden Bird, then the reward is unclaimed', () => {
    // Arrange
    const words = questWords({ [SLOT.theGoldenBird]: 0x1021 });

    // Act
    const state = rewardState(words, 'goldenBird');

    // Assert
    expect(state).toBe('unclaimed');
  });

  it('If The Golden Bird is done and the potion is gone, then the reward is claimed', () => {
    // Arrange
    const words = questWords({ [SLOT.theGoldenBird]: 0x1001 });

    // Act
    const state = rewardState(words, 'goldenBird');

    // Assert
    expect(state).toBe('claimed');
  });

  it('If Prison of Ice is done but the scroll was not read, then the reward is unclaimed', () => {
    // Arrange
    const words = questWords({ [SLOT.prisonOfIce]: 0x1001 });

    // Act
    const state = rewardState(words, 'anyaScroll');

    // Assert
    expect(state).toBe('unclaimed');
  });

  it.each([
    ['the quest is done', 0x1789],
    ['the quest reward still reads as waiting', 0x818a],
  ])('If the Scroll of Resistance was read and %s, then the reward is claimed', (_, word) => {
    // Arrange
    const words = questWords({ [SLOT.prisonOfIce]: word });

    // Act
    const state = rewardState(words, 'anyaScroll');

    // Assert
    expect(state).toBe('claimed');
  });

  it('If the Den of Evil is done and the respec is unused, then the respec is unclaimed', () => {
    // Arrange
    const words = questWords({ [SLOT.denOfEvil]: 0x1001 });

    // Act
    const state = rewardState(words, 'akaraRespec');

    // Assert
    expect(state).toBe('unclaimed');
  });

  it('If the respec slot has bit 1 set, then the respec is unclaimed', () => {
    // Arrange
    const words = questWords({ [SLOT.denOfEvil]: 0x1001, [SLOT.akaraRespec]: 0x8002 });

    // Act
    const state = rewardState(words, 'akaraRespec');

    // Assert
    expect(state).toBe('unclaimed');
  });

  it('If the respec slot has bit 0 set, then the respec is claimed', () => {
    // Arrange
    const words = questWords({ [SLOT.denOfEvil]: 0x1001, [SLOT.akaraRespec]: 0x8001 });

    // Act
    const state = rewardState(words, 'akaraRespec');

    // Assert
    expect(state).toBe('claimed');
  });

  it('If the Den of Evil is not done, then the respec is not earned', () => {
    // Arrange
    const words = questWords({ [SLOT.denOfEvil]: 0x0002 });

    // Act
    const state = rewardState(words, 'akaraRespec');

    // Assert
    expect(state).toBe('notEarned');
  });
});
