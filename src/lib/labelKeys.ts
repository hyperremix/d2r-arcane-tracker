import { GameMode, GameVersion } from 'electron/types/grail';
import { translations } from '@/i18n/translations';

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
