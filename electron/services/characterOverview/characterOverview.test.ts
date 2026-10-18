import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import * as d2s from '@dschu012/d2s';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CharacterOverview } from '../../types/grail';
import { ensureD2sConstants } from '../d2s/constants';
import { buildCharacterOverview, readCharacterOverview } from './characterOverview';

const FIXTURES_DIRECTORY = resolve(process.cwd(), 'electron/services/fixtures');
/** A real level 90 Warlock that finished Hell, from D2SSharp (see the license next to it). */
const CHAOS_SC_SAVE = 'ChaosSCV105.d2s';
/** A real level 1 Warlock with its starting items, from halbu (see the license next to it). */
const WARLOCK_SAVE = 'WarlockV105.d2s';
/** A new v99 Barbarian. */
const CLASSIC_SAVE = 'ClassicCharacterV99.d2s';

/** Byte offset of the first quest word in a v105 save (after "Woo!", version and size). */
const V105_QUEST_WORDS_OFFSET = 413;

function readFixture(fileName: string): Buffer {
  return readFileSync(join(FIXTURES_DIRECTORY, fileName));
}

async function overviewOf(fileName: string): Promise<CharacterOverview> {
  const content = readFixture(fileName);
  return buildCharacterOverview(content, await d2s.read(content));
}

describe('When buildCharacterOverview reads a character save', () => {
  beforeEach(() => {
    ensureD2sConstants();
  });

  describe('If the save is a level 90 Reign of the Warlock character that finished Hell', () => {
    it('Then the basics come from the header and the attributes', async () => {
      // Arrange
      const fileName = CHAOS_SC_SAVE;

      // Act
      const overview = await overviewOf(fileName);

      // Assert
      expect(overview).toMatchObject({
        name: 'ChaosSC',
        characterClass: 'warlock',
        level: 90,
        hardcore: false,
        expansion: true,
        saveVersion: 105,
        gold: { inventory: 222, stash: 2381049 },
        attributes: { strength: 35, dexterity: 20, vitality: 465, energy: 20 },
        questDataAvailable: true,
      });
    });

    it('Then every difficulty is completed with every reward claimed and every waypoint', async () => {
      // Arrange
      const fileName = CHAOS_SC_SAVE;

      // Act
      const overview = await overviewOf(fileName);

      // Assert
      expect(overview.difficulties.map((progress) => progress.difficulty)).toEqual([
        'normal',
        'nightmare',
        'hell',
      ]);
      for (const progress of overview.difficulties) {
        expect(progress).toMatchObject({ reached: true, completed: true, missingWaypoints: [] });
        expect(progress.activatedWaypointCount).toBe(39);
        expect(progress.rewards).toHaveLength(9);
        expect(progress.rewards.every((reward) => reward.state === 'claimed')).toBe(true);
      }
    });

    it('Then the gear totals count weapon set I and the inventory charms only', async () => {
      // Arrange
      const fileName = CHAOS_SC_SAVE;

      // Act
      const { gear } = await overviewOf(fileName);

      // Assert
      // Enigma's 1 magic find per level; the Ist rune of the Call to Arms on weapon set II is left out
      expect(gear.magicFind).toBe(90);
      // Arachnid Mesh 20, Magefist 20 and the Spirit shield of weapon set I 35
      expect(gear.fasterCastRate).toEqual({ total: 75, breakpoints: { reached: 75, next: 125 } });
      // Sandstorm Trek 20 and Spirit 55
      expect(gear.fasterHitRecovery.total).toBe(75);
      expect(gear.fasterBlockRate.total).toBe(15);
      expect(gear.increasedAttackSpeed).toBe(40);
      expect(gear.anyaScrollBonus).toBe(30);
    });
  });

  describe('If the save is a new Reign of the Warlock character', () => {
    it('Then only Normal is reached and no reward is earned', async () => {
      // Arrange
      const fileName = WARLOCK_SAVE;

      // Act
      const overview = await overviewOf(fileName);

      // Assert
      expect(overview.characterClass).toBe('warlock');
      expect(overview.difficulties.map((progress) => progress.reached)).toEqual([
        true,
        false,
        false,
      ]);
      expect(overview.difficulties[0].rewards.every((reward) => reward.state === 'notEarned')).toBe(
        true,
      );
    });

    it('Then every waypoint but the Rogue Encampment is missing', async () => {
      // Arrange
      const fileName = WARLOCK_SAVE;

      // Act
      const [normal] = (await overviewOf(fileName)).difficulties;

      // Assert
      expect(normal.activatedWaypointCount).toBe(1);
      expect(normal.totalWaypointCount).toBe(39);
      expect(normal.missingWaypoints[0]).toEqual({ act: 1, waypoint: 'coldPlains' });
      expect(normal.missingWaypoints[normal.missingWaypoints.length - 1]).toEqual({
        act: 5,
        waypoint: 'worldstoneKeep',
      });
    });
  });

  describe('If the save is a new v99 character', () => {
    it('Then the class and the quest data are read', async () => {
      // Arrange
      const fileName = CLASSIC_SAVE;

      // Act
      const overview = await overviewOf(fileName);

      // Assert
      expect(overview).toMatchObject({
        characterClass: 'barbarian',
        level: 1,
        saveVersion: 99,
        questDataAvailable: true,
      });
    });
  });

  describe('If quests of a real save are done but their rewards are still waiting', () => {
    it('Then those rewards are unclaimed', async () => {
      // Arrange
      const content = readFixture(CHAOS_SC_SAVE);
      const character = await d2s.read(content);
      const edited = Buffer.from(content);
      edited.writeUInt16LE(0x0002, V105_QUEST_WORDS_OFFSET + 1 * 2); // Den of Evil, Normal
      edited.writeUInt16LE(0x1021, V105_QUEST_WORDS_OFFSET + 20 * 2); // Potion of Life held

      // Act
      const overview = buildCharacterOverview(edited, character);

      // Assert
      const stateOf = (reward: string) =>
        overview.difficulties[0].rewards.find((status) => status.reward === reward)?.state;
      expect(stateOf('denOfEvil')).toBe('unclaimed');
      expect(stateOf('goldenBird')).toBe('unclaimed');
      expect(stateOf('radament')).toBe('claimed');
    });
  });

  describe('If the quest section of the save cannot be found', () => {
    it('Then no rewards are listed and the quest data is marked as unavailable', async () => {
      // Arrange
      const content = readFixture(CHAOS_SC_SAVE);
      const character = await d2s.read(content);
      const edited = Buffer.from(content);
      edited.write('Xoo!', V105_QUEST_WORDS_OFFSET - 10, 'latin1');

      // Act
      const overview = buildCharacterOverview(edited, character);

      // Assert
      expect(overview.questDataAvailable).toBe(false);
      expect(overview.difficulties.every((progress) => progress.rewards.length === 0)).toBe(true);
    });
  });
});

describe('When readCharacterOverview reads a save file from disk', () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'character-overview-'));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('Then it returns the overview of a readable save', async () => {
    // Arrange
    const filePath = join(directory, 'Warlock.d2s');
    writeFileSync(filePath, readFixture(WARLOCK_SAVE));

    // Act
    const overview = await readCharacterOverview(filePath);

    // Assert
    expect(overview?.name).toBe('Warlock');
  });

  it('If the file does not exist, then it returns undefined', async () => {
    // Arrange
    const filePath = join(directory, 'Missing.d2s');

    // Act
    const overview = await readCharacterOverview(filePath);

    // Assert
    expect(overview).toBeUndefined();
  });

  it('If the file is not a character save, then it returns undefined', async () => {
    // Arrange
    const filePath = join(directory, 'Broken.d2s');
    writeFileSync(filePath, Buffer.from('not a save file'));

    // Act
    const overview = await readCharacterOverview(filePath);

    // Assert
    expect(overview).toBeUndefined();
  });
});
