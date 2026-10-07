import { GameMode, GameVersion, type ItemSubCategory } from 'electron/types/grail';
import { translations } from '@/i18n/translations';

const subCategoryKeys = translations.grail.advancedSearch.subCategory;

/**
 * Translation keys for the item sub-category labels (e.g. "Helms", "1H Swords", "Amazon").
 */
export const subCategoryLabelKeys: Record<ItemSubCategory, string> = {
  '1h_swords': subCategoryKeys['1h_swords'],
  '2h_swords': subCategoryKeys['2h_swords'],
  '1h_axes': subCategoryKeys['1h_axes'],
  '2h_axes': subCategoryKeys['2h_axes'],
  '1h_maces': subCategoryKeys['1h_maces'],
  '2h_maces': subCategoryKeys['2h_maces'],
  '1h_clubs': subCategoryKeys['1h_clubs'],
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
  body_armor: subCategoryKeys.body_armor,
  shields: subCategoryKeys.shields,
  gloves: subCategoryKeys.gloves,
  boots: subCategoryKeys.boots,
  belts: subCategoryKeys.belts,
  amulets: subCategoryKeys.amulets,
  rings: subCategoryKeys.rings,
  rainbow_facets: subCategoryKeys.rainbow_facets,
  dies: subCategoryKeys.dies,
  small_charms: subCategoryKeys.small_charms,
  large_charms: subCategoryKeys.large_charms,
  grand_charms: subCategoryKeys.grand_charms,
  runes: subCategoryKeys.runes,
  runewords: subCategoryKeys.runewords,
  amazon: subCategoryKeys.amazon,
  assassin: subCategoryKeys.assassin,
  barbarian: subCategoryKeys.barbarian,
  druid: subCategoryKeys.druid,
  necromancer: subCategoryKeys.necromancer,
  paladin: subCategoryKeys.paladin,
  sorceress: subCategoryKeys.sorceress,
  shared_stash: subCategoryKeys.shared_stash,
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
