import type { GrailProgress, Item, Settings } from 'electron/types/grail';
import type { TFunction } from 'i18next';
import { translations } from '@/i18n/translations';
import { isRecentFind } from '@/lib/date';
import { shouldShowEtherealStatus, shouldShowNormalStatus } from '@/lib/ethereal';

/**
 * Found state of one tracked version (normal or ethereal) of a grail item.
 */
export interface VersionStatus {
  version: 'normal' | 'ethereal';
  isFound: boolean;
}

/**
 * Returns the found state of every tracked version of an item when ethereal tracking applies to
 * it, so cards can show what is still missing. Returns an empty list when only the normal version
 * is tracked: the card's found / missing state already says everything in that case.
 */
export function getTrackedVersionStatuses(
  item: Item,
  settings: Settings,
  normalProgress: GrailProgress[],
  etherealProgress: GrailProgress[],
): VersionStatus[] {
  if (!shouldShowEtherealStatus(item, settings)) return [];

  const statuses: VersionStatus[] = [];
  if (shouldShowNormalStatus(item, settings)) {
    statuses.push({ version: 'normal', isFound: normalProgress.length > 0 });
  }
  statuses.push({ version: 'ethereal', isFound: etherealProgress.length > 0 });
  return statuses;
}

/**
 * Returns the found date of a discovery made in the last 7 days while the tracker was running,
 * or undefined. Finds from the first scan of the save files are never "recent".
 */
export function getRecentFindDate(
  mostRecentDiscovery: GrailProgress | undefined,
): Date | undefined {
  if (!mostRecentDiscovery?.foundDate || mostRecentDiscovery.fromInitialScan) return undefined;
  return isRecentFind(mostRecentDiscovery.foundDate) ? mostRecentDiscovery.foundDate : undefined;
}

/**
 * Returns the translated name of a version ("Normal" / "Ethereal").
 */
export function getVersionLabel(version: VersionStatus['version'], t: TFunction): string {
  return version === 'normal'
    ? t(translations.grail.itemCard.normal)
    : t(translations.grail.itemDetails.ethereal);
}

/**
 * Returns the translated status of a version, e.g. "Normal found" or "Ethereal missing".
 */
export function getVersionStatusLabel({ version, isFound }: VersionStatus, t: TFunction): string {
  return t(
    isFound ? translations.grail.itemCard.versionFound : translations.grail.itemCard.versionMissing,
    { version: getVersionLabel(version, t) },
  );
}

/**
 * Returns the status part of a card's accessible name. With tracked versions it lists each one
 * ("Normal found, Ethereal missing"), otherwise it is "Found" / "Not Found"; a recent find
 * appends "Recently found".
 */
export function getCardStatusLabel(
  isFound: boolean,
  versionStatuses: VersionStatus[],
  isRecent: boolean,
  t: TFunction,
): string {
  const parts =
    versionStatuses.length > 0
      ? versionStatuses.map((status) => getVersionStatusLabel(status, t))
      : [t(isFound ? translations.common.found : translations.common.notFound)];
  if (isRecent) parts.push(t(translations.grail.statusIcons.recentlyFound));
  return parts.join(', ');
}

/**
 * Returns the muted subtitle of an item card: the base item (e.g. "Shako") of uniques and set
 * items. Runes are skipped because their base ("El Rune") only repeats the name.
 */
export function getItemSubtitle(item: Item): string | undefined {
  return item.type === 'rune' ? undefined : item.itemBase;
}
