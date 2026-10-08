import type {
  EtherealType,
  ItemCategory,
  ItemSubCategory,
  ItemTreasureClass,
  ItemType,
  SaveFileEvent,
} from 'electron/types/grail';
import { GameMode, GameVersion } from 'electron/types/grail';
import { translations } from '@/i18n/translations';

const filterSubCategoryKeys = translations.grail.advancedSearch.subCategory;

/**
 * Translation keys for the short item sub-category labels used in the search filters
 * (e.g. "Helms", "1H Swords", "Amazon").
 */
export const subCategoryLabelKeys: Record<ItemSubCategory, string> = {
  '1h_swords': filterSubCategoryKeys['1h_swords'],
  '2h_swords': filterSubCategoryKeys['2h_swords'],
  '1h_axes': filterSubCategoryKeys['1h_axes'],
  '2h_axes': filterSubCategoryKeys['2h_axes'],
  '1h_maces': filterSubCategoryKeys['1h_maces'],
  '2h_maces': filterSubCategoryKeys['2h_maces'],
  '1h_clubs': filterSubCategoryKeys['1h_clubs'],
  bows: filterSubCategoryKeys.bows,
  crossbows: filterSubCategoryKeys.crossbows,
  daggers: filterSubCategoryKeys.daggers,
  javelins: filterSubCategoryKeys.javelins,
  polearms: filterSubCategoryKeys.polearms,
  scepters: filterSubCategoryKeys.scepters,
  spears: filterSubCategoryKeys.spears,
  staves: filterSubCategoryKeys.staves,
  throwing: filterSubCategoryKeys.throwing,
  wands: filterSubCategoryKeys.wands,
  hammers: filterSubCategoryKeys.hammers,
  mauls: filterSubCategoryKeys.mauls,
  maces: filterSubCategoryKeys.maces,
  helms: filterSubCategoryKeys.helms,
  body_armor: filterSubCategoryKeys.body_armor,
  shields: filterSubCategoryKeys.shields,
  gloves: filterSubCategoryKeys.gloves,
  boots: filterSubCategoryKeys.boots,
  belts: filterSubCategoryKeys.belts,
  amulets: filterSubCategoryKeys.amulets,
  rings: filterSubCategoryKeys.rings,
  rainbow_facets: filterSubCategoryKeys.rainbow_facets,
  dies: filterSubCategoryKeys.dies,
  small_charms: filterSubCategoryKeys.small_charms,
  large_charms: filterSubCategoryKeys.large_charms,
  grand_charms: filterSubCategoryKeys.grand_charms,
  runes: filterSubCategoryKeys.runes,
  runewords: filterSubCategoryKeys.runewords,
  amazon: filterSubCategoryKeys.amazon,
  assassin: filterSubCategoryKeys.assassin,
  barbarian: filterSubCategoryKeys.barbarian,
  druid: filterSubCategoryKeys.druid,
  necromancer: filterSubCategoryKeys.necromancer,
  paladin: filterSubCategoryKeys.paladin,
  sorceress: filterSubCategoryKeys.sorceress,
  shared_stash: filterSubCategoryKeys.shared_stash,
};

/**
 * Translation keys for the game mode labels, shared by the wizard and settings.
 */
export const gameModeLabelKeys: Record<GameMode, string> = {
  [GameMode.Both]: translations.settings.gameMode.bothLabel,
  [GameMode.Softcore]: translations.settings.gameMode.softcoreLabel,
  [GameMode.Hardcore]: translations.settings.gameMode.hardcoreLabel,
  [GameMode.Manual]: translations.settings.gameMode.manualLabel,
};

/**
 * Translation keys for the game mode descriptions, shared by the wizard and settings.
 */
export const gameModeDescriptionKeys: Record<GameMode, string> = {
  [GameMode.Both]: translations.settings.gameMode.bothDescription,
  [GameMode.Softcore]: translations.settings.gameMode.softcoreDescription,
  [GameMode.Hardcore]: translations.settings.gameMode.hardcoreDescription,
  [GameMode.Manual]: translations.settings.gameMode.manualDescription,
};

/**
 * Translation keys for the game version labels, shared by the wizard and settings.
 */
export const gameVersionLabelKeys: Record<GameVersion, string> = {
  [GameVersion.Resurrected]: translations.settings.gameVersion.resurrectedLabel,
  [GameVersion.Classic]: translations.settings.gameVersion.classicLabel,
};

/**
 * Translation keys for the game version descriptions, shared by the wizard and settings.
 */
export const gameVersionDescriptionKeys: Record<GameVersion, string> = {
  [GameVersion.Resurrected]: translations.settings.gameVersion.resurrectedDescription,
  [GameVersion.Classic]: translations.settings.gameVersion.classicDescription,
};

/**
 * Translation keys for the theme labels. Only the wizard (theme step and summary) uses these;
 * the Settings theme card renders its own options.
 */
export const themeLabelKeys: Record<'light' | 'dark' | 'system', string> = {
  light: translations.settings.theme.light,
  dark: translations.settings.theme.dark,
  system: translations.settings.theme.system,
};

/**
 * Translation keys for item types (unique, set, rune, runeword).
 */
export const itemTypeLabelKeys: Record<ItemType, string> = {
  unique: translations.grail.advancedSearch.typeUnique,
  set: translations.grail.advancedSearch.typeSet,
  rune: translations.grail.advancedSearch.typeRune,
  runeword: translations.grail.advancedSearch.typeRuneword,
};

/**
 * Translation keys for the top-level item categories.
 */
export const itemCategoryLabelKeys: Record<ItemCategory, string> = {
  weapons: translations.grail.advancedSearch.categoryWeapons,
  armor: translations.grail.advancedSearch.categoryArmor,
  jewelry: translations.grail.advancedSearch.categoryJewelry,
  charms: translations.grail.advancedSearch.categoryCharms,
  runes: translations.grail.advancedSearch.categoryRunes,
  runewords: translations.grail.advancedSearch.categoryRunewords,
};

const subCategoryKeys = translations.grail.itemLabels.subCategories;

/**
 * Translation keys for item sub-categories, including class-specific item groups.
 */
export const itemSubCategoryLabelKeys: Record<ItemSubCategory, string> = {
  '1h_swords': subCategoryKeys.oneHandedSwords,
  '2h_swords': subCategoryKeys.twoHandedSwords,
  '1h_axes': subCategoryKeys.oneHandedAxes,
  '2h_axes': subCategoryKeys.twoHandedAxes,
  '1h_maces': subCategoryKeys.oneHandedMaces,
  '2h_maces': subCategoryKeys.twoHandedMaces,
  '1h_clubs': subCategoryKeys.oneHandedClubs,
  bows: subCategoryKeys.bows,
  crossbows: subCategoryKeys.crossbows,
  daggers: subCategoryKeys.daggers,
  javelins: subCategoryKeys.javelins,
  polearms: subCategoryKeys.polearms,
  scepters: subCategoryKeys.scepters,
  spears: subCategoryKeys.spears,
  staves: subCategoryKeys.staves,
  throwing: subCategoryKeys.throwing,
  wands: subCategoryKeys.wands,
  hammers: subCategoryKeys.hammers,
  mauls: subCategoryKeys.mauls,
  maces: subCategoryKeys.maces,
  helms: subCategoryKeys.helms,
  body_armor: subCategoryKeys.bodyArmor,
  shields: subCategoryKeys.shields,
  gloves: subCategoryKeys.gloves,
  boots: subCategoryKeys.boots,
  belts: subCategoryKeys.belts,
  amulets: subCategoryKeys.amulets,
  rings: subCategoryKeys.rings,
  rainbow_facets: subCategoryKeys.rainbowFacets,
  dies: subCategoryKeys.dies,
  small_charms: subCategoryKeys.smallCharms,
  large_charms: subCategoryKeys.largeCharms,
  grand_charms: subCategoryKeys.grandCharms,
  runes: subCategoryKeys.runes,
  runewords: subCategoryKeys.runewords,
  amazon: subCategoryKeys.amazon,
  assassin: subCategoryKeys.assassin,
  barbarian: subCategoryKeys.barbarian,
  druid: subCategoryKeys.druid,
  necromancer: subCategoryKeys.necromancer,
  paladin: subCategoryKeys.paladin,
  sorceress: subCategoryKeys.sorceress,
  shared_stash: subCategoryKeys.sharedStash,
};

/**
 * Translation keys for item treasure class tiers.
 */
export const itemTreasureClassLabelKeys: Record<ItemTreasureClass, string> = {
  normal: translations.grail.itemLabels.treasureClasses.normal,
  exceptional: translations.grail.itemLabels.treasureClasses.exceptional,
  elite: translations.grail.itemLabels.treasureClasses.elite,
};

/**
 * Translation keys for an item's ethereal availability.
 */
export const etherealTypeLabelKeys: Record<EtherealType, string> = {
  none: translations.grail.itemLabels.etherealTypes.none,
  optional: translations.grail.itemLabels.etherealTypes.optional,
  only: translations.grail.itemCard.etherealOnly,
};

/**
 * Translation keys for the save file watcher event types shown in Settings.
 */
export const saveFileEventTypeLabelKeys: Record<SaveFileEvent['type'], string> = {
  created: translations.settings.saveFileMonitor.eventCreated,
  modified: translations.settings.saveFileMonitor.eventModified,
  deleted: translations.settings.saveFileMonitor.eventDeleted,
};
