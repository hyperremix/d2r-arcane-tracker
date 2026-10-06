import { GameMode, GameVersion } from 'electron/types/grail';
import { translations } from '@/i18n/translations';

/**
 * Translation keys for the game mode values, shared by the wizard steps and summary.
 */
export const gameModeLabelKeys: Record<GameMode, string> = {
  [GameMode.Both]: translations.settings.gameMode.bothLabel,
  [GameMode.Softcore]: translations.settings.gameMode.softcoreLabel,
  [GameMode.Hardcore]: translations.settings.gameMode.hardcoreLabel,
  [GameMode.Manual]: translations.settings.gameMode.manualLabel,
};

/**
 * Translation keys for the game version values, shared by the wizard steps and summary.
 */
export const gameVersionLabelKeys: Record<GameVersion, string> = {
  [GameVersion.Resurrected]: translations.settings.gameVersion.resurrectedLabel,
  [GameVersion.Classic]: translations.settings.gameVersion.classicLabel,
};

/**
 * Translation keys for the theme values, shared by the wizard steps and summary.
 */
export const themeLabelKeys: Record<'light' | 'dark' | 'system', string> = {
  light: translations.settings.theme.light,
  dark: translations.settings.theme.dark,
  system: translations.settings.theme.system,
};
