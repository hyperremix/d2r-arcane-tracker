import { describe, expect, it } from 'vitest';
import {
  baseItemRow,
  createFarmingTables,
  setItemRow,
  treasureClassRow,
  uniqueItemRow,
} from '../../test/helpers/farmingTables';
import {
  adjustNoDrop,
  type DropConditionContext,
  evaluateDropCondition,
  getNoDropPlayerCount,
  getSetChance,
  getUniqueChance,
  type ItemRollContext,
  ReachabilityIndex,
  setRollChance,
  TargetDropWalker,
  uniqueRollChance,
  upgradeTreasureClass,
} from './dropCalculator';
import { buildDropDataset, type DropDataset, type QualityFactors } from './dropData';
import type { FarmingGameTables } from './gameTables';

const HELL: DropConditionContext = { difficulty: 2, desecrated: false };
const NO_QUALITY: QualityFactors = { unique: 0, set: 0, rare: 0, magic: 0 };

const dataset = (tables: Partial<FarmingGameTables>): DropDataset =>
  buildDropDataset(createFarmingTables(tables), new Map());

/** Expected drops of a base item code per kill, summed over quality ratios. */
function expectedDrops(data: DropDataset, tc: string, code: string, playerCount = 1): number {
  const walker = new TargetDropWalker(data, HELL, playerCount, {
    code,
    isForcedTarget: () => false,
  });
  return walker.drop(tc).baseItem.reduce((sum, drops) => sum + drops.expected, 0);
}

const roll = (overrides: Partial<ItemRollContext> = {}): ItemRollContext => ({
  ...HELL,
  itemLevel: 90,
  magicFind: 0,
  hellBovine: false,
  ...overrides,
});

describe('When the NoDrop of a treasure class is adjusted for /players', () => {
  it.each([
    [1, 1],
    [2, 1],
    [3, 2],
    [4, 2],
    [5, 3],
    [6, 3],
    [7, 4],
    [8, 4],
  ])('If /players is %i, Then the NoDrop player count is %i', (players, expected) => {
    // Arrange & Act
    const playerCount = getNoDropPlayerCount(players);

    // Assert
    expect(playerCount).toBe(expected);
  });

  it.each([
    [1, 100],
    [2, 38],
    [3, 19],
    [4, 10],
  ])('If NoDrop is 100 against 60 for a player count of %i, Then the NoDrop is %i', (playerCount, expected) => {
    // Arrange
    const noDrop = 100;
    const total = 60;

    // Act
    const adjusted = adjustNoDrop(noDrop, total, playerCount);

    // Assert
    expect(adjusted).toBe(expected);
  });
});

describe('When a drop condition is evaluated', () => {
  it.each([
    ["cond('Difficulty', hell)", HELL, true],
    ["cond('Difficulty', hell)", { difficulty: 1, desecrated: false }, false],
    ["cond('Desecrated')", HELL, false],
    ["cond('Desecrated')==0", HELL, true],
    ["cond('Difficulty', hell)*cond('Desecrated')", { difficulty: 2, desecrated: true }, true],
    ["(stat('heraldtier'.accr) >4) ", { difficulty: 2, desecrated: true }, false],
  ] as const)('If it is %s in %j, Then it is %s', (expression, context, expected) => {
    // Arrange & Act
    const met = evaluateDropCondition(expression, context);

    // Assert
    expect(met).toBe(expected);
  });
});

describe('When a treasure class is upgraded by monster level', () => {
  const data = dataset({
    treasureclassex: [
      treasureClassRow('Equip A', [['rin', 1]], { group: 1, level: 10 }),
      treasureClassRow('Equip B', [['rin', 1]], { group: 1, level: 20 }),
      treasureClassRow('Equip C', [['rin', 1]], { group: 1, level: 30 }),
      treasureClassRow('Other', [['rin', 1]], { group: 2, level: 25 }),
      treasureClassRow('Plain', [['rin', 1]]),
    ],
  });

  it.each([
    ['Equip A', 5, 'Equip A'],
    ['Equip A', 25, 'Equip B'],
    ['Equip A', 99, 'Equip C'],
    ['Equip B', 15, 'Equip B'],
    ['Plain', 99, 'Plain'],
  ])('If %s drops at level %i, Then %s is used', (name, level, expected) => {
    // Arrange & Act
    const upgraded = upgradeTreasureClass(data, name, level);

    // Assert
    expect(upgraded).toBe(expected);
  });

  it('If the treasure class does not exist, Then there is none', () => {
    // Arrange & Act
    const upgraded = upgradeTreasureClass(data, 'Missing', 50);

    // Assert
    expect(upgraded).toBeUndefined();
  });
});

describe('When the expected drops of a treasure class are calculated', () => {
  it('If a pick can be NoDrop, Then each entry drops with its share of the total', () => {
    // Arrange
    const data = dataset({
      treasureclassex: [
        treasureClassRow(
          'Root',
          [
            ['rin', 1],
            ['r01', 1],
          ],
          { noDrop: 2 },
        ),
      ],
    });

    // Act
    const solo = expectedDrops(data, 'Root', 'rin', 1);
    const party = expectedDrops(data, 'Root', 'rin', 2);

    // Assert
    expect(solo).toBeCloseTo(0.25);
    // NoDrop 2 against 2 for two players: trunc(2 / 0.75 × 0.25) = 0
    expect(party).toBeCloseTo(0.5);
  });

  it('If a treasure class has several picks, Then the drops of every pick add up', () => {
    // Arrange
    const data = dataset({
      treasureclassex: [
        treasureClassRow(
          'Root',
          [
            ['rin', 1],
            ['r01', 3],
          ],
          { picks: 3 },
        ),
      ],
    });

    // Act
    const rings = expectedDrops(data, 'Root', 'rin');

    // Assert
    expect(rings).toBeCloseTo(0.75);
  });

  it('If picks are negative, Then the entries drop in order and stop when they run out', () => {
    // Arrange
    const data = dataset({
      treasureclassex: [
        treasureClassRow(
          'Root',
          [
            ['rin', 2],
            ['r01', 1],
          ],
          { picks: -2 },
        ),
        treasureClassRow(
          'Short',
          [
            ['rin', 1],
            ['r01', 1],
          ],
          { picks: -5 },
        ),
      ],
    });

    // Act
    const result = {
      rootRings: expectedDrops(data, 'Root', 'rin'),
      rootRunes: expectedDrops(data, 'Root', 'r01'),
      shortRings: expectedDrops(data, 'Short', 'rin'),
      shortRunes: expectedDrops(data, 'Short', 'r01'),
    };

    // Assert
    expect(result).toEqual({ rootRings: 2, rootRunes: 0, shortRings: 1, shortRunes: 1 });
  });

  it('If earlier drops reach six items, Then the later entries no longer drop', () => {
    // Arrange: the item treasure class drops before the rune one, like the Countess
    const data = dataset({
      treasureclassex: [
        treasureClassRow('Five Items', [['rin', 1]], { picks: 5 }),
        treasureClassRow('Six Items', [['rin', 1]], { picks: 6 }),
        treasureClassRow('Runes', [['r01', 1]], { picks: 3 }),
        treasureClassRow(
          'After Five',
          [
            ['Five Items', 1],
            ['Runes', 1],
          ],
          { picks: -2 },
        ),
        treasureClassRow(
          'After Six',
          [
            ['Six Items', 1],
            ['Runes', 1],
          ],
          { picks: -2 },
        ),
      ],
    });

    // Act
    const afterFive = expectedDrops(data, 'After Five', 'r01');
    const afterSix = expectedDrops(data, 'After Six', 'r01');

    // Assert
    expect(afterFive).toBeCloseTo(1);
    expect(afterSix).toBe(0);
  });

  it('If treasure classes are nested, Then the higher quality ratio of each quality is used', () => {
    // Arrange
    const data = dataset({
      treasureclassex: [
        treasureClassRow('Inner', [['rin', 1]], { unique: 300, set: 800 }),
        treasureClassRow('Outer', [['Inner', 1]], { unique: 500, set: 100 }),
      ],
    });
    const walker = new TargetDropWalker(data, HELL, 1, {
      code: 'rin',
      isForcedTarget: () => false,
    });

    // Act
    const drops = walker.drop('Outer');

    // Assert
    expect(drops.baseItem).toEqual([
      { quality: { unique: 500, set: 800, rare: 0, magic: 0 }, expected: 1 },
    ]);
  });

  it('If a treasure class condition is not met, Then its entry is removed from its parent', () => {
    // Arrange
    const data = dataset({
      treasureclassex: [
        treasureClassRow('Terror Only', [['r01', 1]], { condition: "cond('Desecrated')" }),
        treasureClassRow('Root', [
          ['rin', 1],
          ['Terror Only', 1],
        ]),
      ],
    });

    // Act
    const rings = expectedDrops(data, 'Root', 'rin');
    const reachable = new ReachabilityIndex(data, HELL).get('Root');

    // Assert
    expect(rings).toBe(1);
    expect([...reachable.codes]).toEqual(['rin']);
  });
});

describe('When the item type treasure classes are generated', () => {
  it('Then spawnable non-quest items are grouped in steps of three levels by their type', () => {
    // Arrange
    const data = dataset({
      armor: [
        baseItemRow('cap', 1, 'helm'),
        baseItemRow('skp', 3, 'helm'),
        baseItemRow('hlm', 4, 'helm'),
        baseItemRow('qst', 2, 'helm', { quest: true }),
        baseItemRow('nsp', 2, 'helm', { spawnable: false }),
      ],
    });

    // Act
    const armo3 = data.treasureClasses.get('armo3');
    const armo6 = data.treasureClasses.get('armo6');

    // Assert
    expect(armo3?.entries).toEqual([
      { name: 'cap', probability: 3 },
      { name: 'skp', probability: 3 },
    ]);
    expect(armo6?.entries).toEqual([{ name: 'hlm', probability: 3 }]);
  });
});

describe('When the quality roll chances are calculated', () => {
  const data = dataset({ misc: [baseItemRow('rin', 85, 'ring')] });
  const ratio = data.itemRatios[0];

  it.each([
    // (400 - 5) × 128 = 50560
    [0, 0, 128 / 50560],
    // Up to 10% magic find has no diminishing returns: 12800 × 395 / 105 = 48152
    [5, 0, 128 / 48152],
    // 300% magic find counts as 250 × 300 / 550 = 136%: 12800 × 395 / 236 = 21423
    [300, 0, 128 / 21423],
    // A quality ratio of 983 takes 983/1024 off: 50560 - 48535 = 2025
    [0, 983, 128 / 2025],
  ])('If the magic find is %i and the quality ratio %i, Then the unique roll succeeds with the expected chance', (magicFind, factor, expected) => {
    // Arrange
    const levelDifference = 5;

    // Act
    const chance = ratio ? uniqueRollChance(ratio, levelDifference, magicFind, factor) : 0;

    // Assert
    expect(chance).toBeCloseTo(expected, 12);
  });

  it.each([
    // (160 - 2) × 128 = 20224
    [0, 128 / 20224],
    // 300% magic find counts as 500 × 300 / 800 = 187%: 12800 × 158 / 287 = 7046
    [300, 128 / 7046],
  ])('If the magic find is %i, Then the set roll succeeds with the expected chance', (magicFind, expected) => {
    // Arrange
    const levelDifference = 5;

    // Act
    const chance = ratio ? setRollChance(ratio, levelDifference, magicFind, 0) : 0;

    // Assert
    expect(chance).toBeCloseTo(expected, 12);
  });

  it('If the chance would be better than the minimum allows, Then the minimum is used', () => {
    // Arrange: a level difference of 390 leaves (400 - 390) × 128 = 1280, below the minimum 6400
    const levelDifference = 390;

    // Act
    const chance = ratio ? uniqueRollChance(ratio, levelDifference, 0, 0) : 0;

    // Assert
    expect(chance).toBeCloseTo(128 / 6400, 12);
  });
});

describe('When the chance of a specific unique or set item is calculated', () => {
  const data = dataset({
    misc: [baseItemRow('rin', 1, 'ring'), baseItemRow('r01', 1, 'rune')],
    uniqueitems: [
      uniqueItemRow('Low Ring', 'rin', 10, { rarity: 1 }),
      uniqueItemRow('High Ring', 'rin', 50, { rarity: 3 }),
      uniqueItemRow('Hell Ring', 'rin', 10, { condition: "cond('Difficulty', hell)" }),
      uniqueItemRow('Unspawnable Ring', 'rin', 1, { spawnable: false }),
    ],
    setitems: [
      setItemRow("Cow King's Ring", "Cow King's Leathers", 'rin', 1),
      setItemRow('Plain Ring', 'Plain Set', 'rin', 1),
    ],
  });
  const unique = (index: string) => data.uniquesByIndex.get(index);
  const set = (index: string) => data.setsByIndex.get(index);
  const uniqueRoll = (itemLevel: number) =>
    data.itemRatios[0] ? uniqueRollChance(data.itemRatios[0], itemLevel - 1, 0, 0) : 0;

  it('If several uniques fit the item level, Then they are picked by rarity', () => {
    // Arrange
    const lowRing = unique('Low Ring');
    const highRing = unique('High Ring');

    // Act
    const low = lowRing ? getUniqueChance(data, lowRing, NO_QUALITY, roll({ itemLevel: 60 })) : 0;
    const high = highRing
      ? getUniqueChance(data, highRing, NO_QUALITY, roll({ itemLevel: 60 }))
      : 0;

    // Assert: Low, High and Hell Ring can drop with weights 1, 3 and 1
    expect(low).toBeCloseTo((uniqueRoll(60) * 1) / 5, 12);
    expect(high).toBeCloseTo((uniqueRoll(60) * 3) / 5, 12);
  });

  it('If a unique needs a higher item level or another difficulty, Then it cannot drop', () => {
    // Arrange
    const highRing = unique('High Ring');
    const hellRing = unique('Hell Ring');
    const unspawnable = unique('Unspawnable Ring');

    // Act
    const chances = [
      highRing ? getUniqueChance(data, highRing, NO_QUALITY, roll({ itemLevel: 20 })) : -1,
      hellRing
        ? getUniqueChance(data, hellRing, NO_QUALITY, roll({ itemLevel: 60, difficulty: 1 }))
        : -1,
      unspawnable ? getUniqueChance(data, unspawnable, NO_QUALITY, roll()) : -1,
    ];

    // Assert
    expect(chances).toEqual([0, 0, 0]);
  });

  it("If the item is a set item, Then it needs the unique roll to fail and the Cow King's set a Hell Bovine", () => {
    // Arrange
    const plainRing = set('Plain Ring');
    const cowRing = set("Cow King's Ring");
    const context = roll({ itemLevel: 60 });
    const ratio = data.itemRatios[0];
    const setRoll = ratio ? setRollChance(ratio, 59, 0, 0) : 0;

    // Act
    const plain = plainRing ? getSetChance(data, plainRing, NO_QUALITY, context) : 0;
    const cowElsewhere = cowRing ? getSetChance(data, cowRing, NO_QUALITY, context) : -1;
    const cowFromBovine = cowRing
      ? getSetChance(data, cowRing, NO_QUALITY, { ...context, hellBovine: true })
      : 0;

    // Assert
    expect(plain).toBeCloseTo((1 - uniqueRoll(60)) * setRoll, 12);
    expect(cowElsewhere).toBe(0);
    expect(cowFromBovine).toBeCloseTo(((1 - uniqueRoll(60)) * setRoll) / 2, 12);
  });

  it('If the base item always has normal quality, Then it is never unique', () => {
    // Arrange
    const runeData = dataset({
      misc: [baseItemRow('r01', 1, 'rune')],
      uniqueitems: [uniqueItemRow('Rune Unique', 'r01', 1)],
    });
    const runeUnique = runeData.uniquesByIndex.get('Rune Unique');

    // Act
    const chance = runeUnique ? getUniqueChance(runeData, runeUnique, NO_QUALITY, roll()) : -1;

    // Assert
    expect(chance).toBe(0);
  });
});
