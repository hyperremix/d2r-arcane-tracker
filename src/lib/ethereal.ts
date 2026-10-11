import type { EtherealType, GrailProgress, Item, Settings } from 'electron/types/grail';

/**
 * Grail settings that decide which item versions (normal and/or ethereal) are tracked.
 */
export type GrailTrackingSettings = Pick<Settings, 'grailNormal' | 'grailEthereal'>;

/**
 * A version of a grail item.
 */
export type ItemVersion = 'normal' | 'ethereal';

/**
 * Check if an item can be ethereal (either optional or only).
 * @param {Item} item - The Holy Grail item to check
 * @returns {boolean} True if the item can be ethereal, false otherwise
 */
export function canItemBeEthereal(item: Item): boolean {
  return item.etherealType === 'optional' || item.etherealType === 'only';
}

/**
 * Check if an item can only be ethereal.
 * @param {Item} item - The Holy Grail item to check
 * @returns {boolean} True if the item is always ethereal, false otherwise
 */
export function isEtherealOnly(item: Item): boolean {
  return item.etherealType === 'only';
}

/**
 * Check if an item can be normal (not ethereal-only).
 * @param {Item} item - The Holy Grail item to check
 * @returns {boolean} True if the item can be normal, false otherwise
 */
export function canItemBeNormal(item: Item): boolean {
  return item.etherealType === 'none' || item.etherealType === 'optional';
}

/**
 * Get a human-readable description of the item's ethereal type.
 * @param {EtherealType} etherealType - The ethereal type to describe
 * @returns {string} A human-readable description of the ethereal type
 */
export function getEtherealTypeDescription(etherealType: EtherealType): string {
  switch (etherealType) {
    case 'none':
      return 'Cannot be ethereal';
    case 'optional':
      return 'Can be normal or ethereal';
    case 'only':
      return 'Always ethereal';
    default:
      return 'Unknown';
  }
}

/**
 * Check if an item should show ethereal status in UI, i.e. whether its ethereal version is tracked.
 * @param {Item} item - The Holy Grail item to check
 * @param {GrailTrackingSettings} settings - The grail tracking settings
 * @returns {boolean} True if ethereal status should be displayed, false otherwise
 */
export function shouldShowEtherealStatus(item: Item, settings: GrailTrackingSettings): boolean {
  return settings.grailEthereal && canItemBeEthereal(item);
}

/**
 * Check if an item should show normal status in UI, i.e. whether its normal version is tracked.
 * @param {Item} item - The Holy Grail item to check
 * @param {GrailTrackingSettings} settings - The grail tracking settings
 * @returns {boolean} True if normal status should be displayed, false otherwise
 */
export function shouldShowNormalStatus(item: Item, settings: GrailTrackingSettings): boolean {
  return settings.grailNormal && canItemBeNormal(item);
}

/**
 * Keeps only the items that have at least one tracked version. When both normal and ethereal
 * items are tracked every item is kept; when neither is tracked no item is kept.
 * @param {Item[]} items - The items to filter
 * @param {GrailTrackingSettings} settings - The grail tracking settings
 * @returns {Item[]} The items that are part of the tracked grail
 */
export function filterItemsByTrackedVersions(
  items: Item[],
  settings: GrailTrackingSettings,
): Item[] {
  if (settings.grailNormal && settings.grailEthereal) return items;
  if (settings.grailNormal) return items.filter(canItemBeNormal);
  if (settings.grailEthereal) return items.filter(canItemBeEthereal);
  return [];
}

/**
 * Returns the version of an item a progress record is for.
 * @param {GrailProgress} progress - The progress record
 * @returns {ItemVersion} 'ethereal' for ethereal records, otherwise 'normal'
 */
export function getProgressVersion(progress: GrailProgress): ItemVersion {
  return progress.isEthereal ? 'ethereal' : 'normal';
}

/**
 * Checks whether a version of an item is tracked by the grail settings.
 * @param {Item} item - The Holy Grail item
 * @param {ItemVersion} version - The version to check
 * @param {GrailTrackingSettings} settings - The grail tracking settings
 * @returns {boolean} True if the version exists for the item and is tracked
 */
export function isVersionTracked(
  item: Item,
  version: ItemVersion,
  settings: GrailTrackingSettings,
): boolean {
  return version === 'ethereal'
    ? shouldShowEtherealStatus(item, settings)
    : shouldShowNormalStatus(item, settings);
}

/**
 * Checks whether a progress record is a find that counts towards the grail: it has a found date
 * and its version (normal or ethereal) is tracked. Finds of an untracked version, for example an
 * ethereal find while ethereal tracking is off, don't make an item found anywhere in the grail.
 * @param {Item} item - The Holy Grail item the record belongs to
 * @param {GrailProgress} progress - The progress record
 * @param {GrailTrackingSettings} settings - The grail tracking settings
 * @returns {boolean} True if the record is a find of a tracked version
 */
export function isTrackedFind(
  item: Item,
  progress: GrailProgress,
  settings: GrailTrackingSettings,
): boolean {
  return (
    progress.foundDate !== undefined &&
    isVersionTracked(item, getProgressVersion(progress), settings)
  );
}

/**
 * Found state of one version of an item, as shown in the item details.
 */
export interface VersionFindStatus {
  version: ItemVersion;
  /** Whether the grail settings track this version. */
  tracked: boolean;
  /** Whether any character found this version, tracked or not. */
  found: boolean;
}

/**
 * Returns the found state of each version of an item worth showing: every tracked version, plus
 * untracked versions that were found anyway (so a find is never hidden behind "not found").
 * Versions the item can't have are left out.
 * @param {Item} item - The Holy Grail item
 * @param {GrailProgress[]} itemProgress - The progress records of this item
 * @param {GrailTrackingSettings} settings - The grail tracking settings
 * @returns {VersionFindStatus[]} The statuses, normal version first
 */
export function getVersionFindStatuses(
  item: Item,
  itemProgress: GrailProgress[],
  settings: GrailTrackingSettings,
): VersionFindStatus[] {
  const versions: ItemVersion[] = [];
  if (canItemBeNormal(item)) versions.push('normal');
  if (canItemBeEthereal(item)) versions.push('ethereal');

  return versions
    .map((version) => ({
      version,
      tracked: isVersionTracked(item, version, settings),
      found: itemProgress.some(
        (p) => p.foundDate !== undefined && getProgressVersion(p) === version,
      ),
    }))
    .filter((status) => status.tracked || status.found);
}
