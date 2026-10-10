import type { Item, Settings } from 'electron/types/grail';
import { translations } from '@/i18n/translations';
import { shouldShowEtherealStatus, shouldShowNormalStatus } from '@/lib/ethereal';
import { getRank } from '@/lib/grailFilters';

/**
 * Translation keys of the ethereal status groups, in the order the groups are shown: items with
 * both versions tracked first (from fully to not found), then items without an ethereal version,
 * then items without a tracked normal version.
 */
export const etherealGroupKeyOrder: readonly string[] = [
  translations.grail.itemGrid.bothFound,
  translations.grail.itemGrid.normalOnly,
  translations.grail.itemGrid.etherealOnly,
  translations.grail.itemGrid.neitherFound,
  translations.grail.itemGrid.normalFound,
  translations.grail.itemGrid.normalNotFound,
  translations.grail.itemGrid.etherealFound,
  translations.grail.itemGrid.etherealNotFound,
  translations.grail.itemGrid.notApplicable,
];

/**
 * Returns the position of an ethereal status group (see {@link etherealGroupKeyOrder}).
 * @param {string} groupKey - The translation key of the ethereal status group
 * @returns {number} The rank; unknown keys rank last
 */
export const getEtherealGroupRank = (groupKey: string): number =>
  getRank(etherealGroupKeyOrder, groupKey);

/**
 * Determines the ethereal grouping key for an item based on its ethereal status and progress.
 * @param {Item} itemData - The Holy Grail item data
 * @param {{ normalFound: boolean; etherealFound: boolean } | undefined} itemProgress - The progress data for the item
 * @param {Settings} settings - The user settings, which decide which versions are tracked
 * @returns {string} The translation key of the item's ethereal status group
 */
export function getEtherealGroupKey(
  itemData: Item,
  itemProgress: { normalFound: boolean; etherealFound: boolean } | undefined,
  settings: Settings,
): string {
  const hasEthereal = itemProgress?.etherealFound;
  const hasNormal = itemProgress?.normalFound;
  const canBeEthereal = shouldShowEtherealStatus(itemData, settings);
  const canBeNormal = shouldShowNormalStatus(itemData, settings);

  if (!canBeEthereal && !canBeNormal) {
    return translations.grail.itemGrid.notApplicable;
  }
  if (!canBeEthereal) {
    return hasNormal
      ? translations.grail.itemGrid.normalFound
      : translations.grail.itemGrid.normalNotFound;
  }
  if (!canBeNormal) {
    return hasEthereal
      ? translations.grail.itemGrid.etherealFound
      : translations.grail.itemGrid.etherealNotFound;
  }
  if (hasEthereal && hasNormal) {
    return translations.grail.itemGrid.bothFound;
  }
  if (hasEthereal) {
    return translations.grail.itemGrid.etherealOnly;
  }
  if (hasNormal) {
    return translations.grail.itemGrid.normalOnly;
  }
  return translations.grail.itemGrid.neitherFound;
}
