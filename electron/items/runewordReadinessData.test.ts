import { constants as constants105 } from '@dschu012/d2s/lib/data/versions/105_constant_data';
import { describe, expect, it } from 'vitest';
import { gems } from './gems';
import { runes } from './runes';
import { runeUpgradeRecipes } from './runeUpgrades';
import { runewordBaseItemTypes } from './runewordBases';
import { runewords } from './runewords';

interface ParserBaseItem {
  c?: string[];
}

describe('When the rune upgrade recipes are checked', () => {
  it('Then there is one recipe per rune from El to Cham, each making the next rune', () => {
    // Arrange
    const runeIds = runes.map((rune) => rune.id);

    // Act
    const chain = runeUpgradeRecipes.map((recipe) => [recipe.runeId, recipe.resultRuneId]);

    // Assert
    expect(chain).toEqual(
      runeIds.slice(0, -1).map((runeId, index) => [runeId, runeIds[index + 1]]),
    );
  });

  it('Then every recipe gem is a known gem and no two recipes take the same gem', () => {
    // Arrange
    const gemCodes = new Set(gems.map((gem) => gem.code));

    // Act
    const recipeGems = runeUpgradeRecipes.flatMap((recipe) =>
      recipe.gemCode ? [recipe.gemCode] : [],
    );

    // Assert
    expect(recipeGems.filter((code) => !gemCodes.has(code))).toEqual([]);
    expect(new Set(recipeGems).size).toBe(recipeGems.length);
  });
});

describe('When the runeword base item types are checked', () => {
  it('Then every catalog runeword has base item types and there are none for unknown runewords', () => {
    // Arrange
    const runewordIds = runewords.map((runeword) => runeword.id).sort();

    // Act
    const typedIds = Object.keys(runewordBaseItemTypes).sort();

    // Assert
    expect(typedIds).toEqual(runewordIds);
  });

  it('Then every base item type is a category the v105 parser gives some item', () => {
    // Arrange
    const parserBaseItems: ParserBaseItem[] = Object.values({
      ...constants105.armor_items,
      ...constants105.weapon_items,
    });
    const parserCategories = new Set(parserBaseItems.flatMap((item) => item?.c ?? []));

    // Act
    const unknownTypes = Object.values(runewordBaseItemTypes)
      .flat()
      .filter((itemType) => !parserCategories.has(itemType));

    // Assert
    expect(unknownTypes).toEqual([]);
  });
});
