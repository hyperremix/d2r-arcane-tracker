import { describe, expect, it } from 'vitest';
import {
  getTerrorizedLevel,
  parseTerrorZoneData,
  type TerrorZoneLevelRule,
} from './terrorZoneLevels';

const difficultyConfig = (min: number, max: number) => ({
  defaults: { bound_incl_min: min, bound_incl_max: max, boost_level: 2 },
});

const gameFile = (difficulties: Record<string, unknown>) =>
  `// comment
{
  "desecrated_zones": [
    {
      "seed": 16665365343970128666,
      "game_difficulties": ${JSON.stringify(difficulties)},
      "zones": [
        { "id": "Act1-Tristram", "levels": [{ "level_id": 4 }, { "level_id": 38 }] },
        { "id": "Broken" }
      ]
    }
  ]
}`;

describe('When the terror zone file is read', () => {
  it('If it has Reign of the Warlock rules, Then those rules and the zone areas are used', () => {
    // Arrange
    const text = gameFile({
      expansion: {
        normal: difficultyConfig(1, 40),
        nightmare: difficultyConfig(1, 60),
        hell: difficultyConfig(1, 90),
      },
      rotw: {
        normal: difficultyConfig(3, 45),
        nightmare: difficultyConfig(40, 71),
        hell: difficultyConfig(70, 96),
      },
    });

    // Act
    const data = parseTerrorZoneData(text);

    // Assert
    expect(data).toEqual({
      zones: [{ id: 'Act1-Tristram', areaIds: [4, 38] }],
      rules: [
        { boostLevel: 2, minLevel: 3, maxLevel: 45 },
        { boostLevel: 2, minLevel: 40, maxLevel: 71 },
        { boostLevel: 2, minLevel: 70, maxLevel: 96 },
      ],
    });
  });

  it('If it only has Lord of Destruction rules, Then those are used', () => {
    // Arrange
    const text = gameFile({
      expansion: {
        normal: difficultyConfig(3, 45),
        nightmare: difficultyConfig(40, 71),
        hell: difficultyConfig(70, 96),
      },
    });

    // Act
    const data = parseTerrorZoneData(text);

    // Assert
    expect(data?.rules[2]).toEqual({ boostLevel: 2, minLevel: 70, maxLevel: 96 });
  });

  it('If a difficulty has no level rule, Then the file is not usable', () => {
    // Arrange
    const text = gameFile({ rotw: { normal: difficultyConfig(3, 45) } });

    // Act
    const data = parseTerrorZoneData(text);

    // Assert
    expect(data).toBeUndefined();
  });
});

describe('When the level of a terrorized monster is calculated', () => {
  const hell: TerrorZoneLevelRule = { boostLevel: 2, minLevel: 70, maxLevel: 96 };

  it.each([
    ['a regular monster of a level 90 character', 67, 0, 90, 92],
    ['a regular monster of a level 99 character', 67, 0, 99, 96],
    ['a champion of a level 99 character', 69, 2, 99, 98],
    ['a unique of a level 99 character', 70, 3, 99, 99],
    ['a regular monster of a level 50 character', 67, 0, 50, 70],
    ['a monster whose own level is higher', 85, 0, 60, 85],
  ])('If it is %s, Then its level is the expected one', (_, original, bonus, characterLevel, expected) => {
    // Arrange & Act
    const level = getTerrorizedLevel(original, bonus, characterLevel, hell);

    // Assert
    expect(level).toBe(expected);
  });
});
