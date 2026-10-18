import type * as d2s from '@dschu012/d2s';
import { describe, expect, it } from 'vitest';
import { computeGearTotals, type GearTotalsInput, selectCountedItems } from './gearTotals';

interface TestItemOptions {
  type?: string;
  locationId: number;
  equippedId?: number;
  altPositionId?: number;
  categories?: string[];
  stats?: Record<string, number[]>;
}

function item({
  type = 'xxx',
  locationId,
  equippedId = 0,
  altPositionId = 0,
  categories = [],
  stats = {},
}: TestItemOptions): d2s.types.IItem {
  return {
    type,
    location_id: locationId,
    equipped_id: equippedId,
    alt_position_id: altPositionId,
    categories,
    combined_magic_attributes: Object.entries(stats).map(([name, values], id) => ({
      id,
      name,
      values,
    })),
  } as unknown as d2s.types.IItem;
}

const equipped = (equippedId: number, stats: Record<string, number[]> = {}) =>
  item({ locationId: 1, equippedId, stats });
const inventoryCharm = (stats: Record<string, number[]>) =>
  item({ type: 'cm1', locationId: 0, altPositionId: 1, categories: ['Charm'], stats });

function totals(overrides: Partial<GearTotalsInput>) {
  return computeGearTotals({
    items: [],
    level: 1,
    activeWeaponSet: 0,
    characterClass: 'sorceress',
    expansion: true,
    anyaScrollsRead: 0,
    ...overrides,
  });
}

describe('When selectCountedItems picks the items whose stats count', () => {
  it('If weapon set I is active, then the weapon set II items are left out', () => {
    // Arrange
    const items = [equipped(1), equipped(4), equipped(5), equipped(11), equipped(12)];

    // Act
    const counted = selectCountedItems(items, 0);

    // Assert
    expect(counted.map((counted) => counted.equipped_id)).toEqual([1, 4, 5]);
  });

  it('If weapon set II is active, then the weapon set I items are left out', () => {
    // Arrange
    const items = [equipped(1), equipped(4), equipped(5), equipped(11), equipped(12)];

    // Act
    const counted = selectCountedItems(items, 1);

    // Assert
    expect(counted.map((counted) => counted.equipped_id)).toEqual([1, 11, 12]);
  });

  it('Then only charms in the inventory grid count, not charms in the stash or other items', () => {
    // Arrange
    const charm = inventoryCharm({});
    const stashCharm = item({ locationId: 0, altPositionId: 5, categories: ['Charm'] });
    const inventoryJewel = item({ locationId: 0, altPositionId: 1, categories: ['Jewel'] });
    const beltPotion = item({ locationId: 2 });

    // Act
    const counted = selectCountedItems([charm, stashCharm, inventoryJewel, beltPotion], 0);

    // Assert
    expect(counted).toEqual([charm]);
  });
});

describe('When computeGearTotals sums the counted items', () => {
  it('Then magic and gold find add the per level stats, rounded down', () => {
    // Arrange
    const items = [
      equipped(3, { item_magicbonus: [30, 30], item_find_magic_perlevel: [8] }),
      equipped(10, { item_goldbonus: [80], item_find_gold_perlevel: [12] }),
    ];

    // Act
    const result = totals({ items, level: 85 });

    // Assert
    expect(result.magicFind).toBe(30 + 85);
    expect(result.goldFind).toBe(80 + Math.floor((12 * 85) / 8));
  });

  it('Then speed stats are summed over equipped items and inventory charms', () => {
    // Arrange
    const items = [
      equipped(1, { item_fastercastrate: [20] }),
      equipped(5, { item_fastercastrate: [35], item_fasterblockrate: [15] }),
      equipped(12, { item_fastercastrate: [35] }),
      inventoryCharm({ item_fastergethitrate: [5], item_fasterattackrate: [10] }),
    ];

    // Act
    const result = totals({ items });

    // Assert
    expect(result.fasterCastRate).toEqual({ total: 55, breakpoints: { reached: 37, next: 63 } });
    expect(result.fasterHitRecovery.total).toBe(5);
    expect(result.fasterBlockRate.total).toBe(15);
    expect(result.increasedAttackSpeed).toBe(10);
  });

  it('If the class is unknown, then speed stats have no breakpoints', () => {
    // Arrange
    const items = [equipped(1, { item_fastercastrate: [20] })];

    // Act
    const result = totals({ items, characterClass: undefined });

    // Assert
    expect(result.fasterCastRate).toEqual({ total: 20 });
  });

  it('If the character is an expansion character, then Nightmare and Hell take 40 and 100', () => {
    // Arrange
    const items = [equipped(2, { fireresist: [30] }), inventoryCharm({ fireresist: [20] })];

    // Act
    const fire = totals({ items }).resistances.find((resistance) => resistance.kind === 'fire');

    // Assert
    expect(fire?.fromItems).toBe(50);
    expect(fire?.byDifficulty.map((value) => value.total)).toEqual([50, 10, -50]);
  });

  it('If the character is a classic character, then Nightmare and Hell take 20 and 50', () => {
    // Arrange
    const items = [equipped(2, { coldresist: [30] })];

    // Act
    const cold = totals({ items, expansion: false }).resistances.find(
      (resistance) => resistance.kind === 'cold',
    );

    // Assert
    expect(cold?.byDifficulty.map((value) => value.total)).toEqual([30, 10, -20]);
  });

  it('Then each read Scroll of Resistance adds 10 to every resistance', () => {
    // Arrange
    const anyaScrollsRead = 2;

    // Act
    const result = totals({ anyaScrollsRead });

    // Assert
    expect(result.anyaScrollBonus).toBe(20);
    expect(result.resistances.map((resistance) => resistance.byDifficulty[0].total)).toEqual([
      20, 20, 20, 20,
    ]);
  });

  it('Then the cap is 75 plus the maximum resistance bonus, at most 95', () => {
    // Arrange
    const items = [
      equipped(1, { maxfireresist: [5, 5] }),
      equipped(3, { maxlightresist: [15] }),
      equipped(5, { maxlightresist: [15] }),
    ];

    // Act
    const result = totals({ items });

    // Assert
    const capOf = (kind: string) =>
      result.resistances.find((resistance) => resistance.kind === kind)?.byDifficulty[0].cap;
    expect(capOf('fire')).toBe(80);
    expect(capOf('lightning')).toBe(95);
    expect(capOf('cold')).toBe(75);
  });
});
