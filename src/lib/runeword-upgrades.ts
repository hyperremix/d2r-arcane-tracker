import { type RuneUpgradeRecipe, runeUpgradeRecipes } from 'electron/items/runeUpgrades';

/** One Horadric Cube rune upgrade of a plan, done `times` times in a row. */
export interface RuneUpgradeStep extends RuneUpgradeRecipe {
  /** How often the recipe is cubed; each time takes `runeCount` runes and one gem, if any */
  times: number;
}

/**
 * Works out the Horadric Cube rune upgrades that turn owned runes and gems into the runes a runeword
 * needs.
 *
 * A rune can only be owned or made from the rune below it, so the plan is worked out from Zod down:
 * every rune the runeword or a higher upgrade needs but is not owned has to be cubed from the rune
 * below it. That way no rune or gem is counted twice, and runes the runeword needs are never cubed
 * away. Gems are not upgraded.
 * @param requiredRunes - Rune ids the runeword needs, repeated for runes it needs more than once
 * @param availableRunes - Owned rune counts by rune id
 * @param availableGems - Owned gem counts by gem code
 * @returns The upgrades from the lowest rune up, an empty list when every rune is owned, or
 *   `undefined` when the owned runes and gems are not enough
 */
export function planRuneUpgrades(
  requiredRunes: readonly string[],
  availableRunes: Record<string, number>,
  availableGems: Record<string, number>,
): RuneUpgradeStep[] | undefined {
  const neededRunes: Record<string, number> = {};
  for (const runeId of requiredRunes) {
    neededRunes[runeId] = (neededRunes[runeId] ?? 0) + 1;
  }

  const steps: RuneUpgradeStep[] = [];
  const neededGems: Record<string, number> = {};
  for (let index = runeUpgradeRecipes.length - 1; index >= 0; index--) {
    const recipe = runeUpgradeRecipes[index];
    const missing =
      (neededRunes[recipe.resultRuneId] ?? 0) - (availableRunes[recipe.resultRuneId] ?? 0);
    if (missing <= 0) {
      continue;
    }

    neededRunes[recipe.resultRuneId] -= missing;
    neededRunes[recipe.runeId] = (neededRunes[recipe.runeId] ?? 0) + missing * recipe.runeCount;
    if (recipe.gemCode) {
      neededGems[recipe.gemCode] = (neededGems[recipe.gemCode] ?? 0) + missing;
    }
    steps.unshift({ ...recipe, times: missing });
  }

  const hasEnoughRunes = Object.entries(neededRunes).every(
    ([runeId, count]) => count <= (availableRunes[runeId] ?? 0),
  );
  const hasEnoughGems = Object.entries(neededGems).every(
    ([gemCode, count]) => count <= (availableGems[gemCode] ?? 0),
  );

  return hasEnoughRunes && hasEnoughGems ? steps : undefined;
}
