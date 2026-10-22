/**
 * Translations for text the main process shows outside the app windows, such as the in-game text
 * of the D2RLoader plugin. It uses the renderer's translation files, so every text has one source.
 */
import i18next from 'i18next';
import en from '../../src/i18n/locales/en/common.json';

const translator = i18next.createInstance();
void translator.init({
  resources: { en: { common: en } },
  lng: 'en',
  fallbackLng: 'en',
  ns: ['common'],
  defaultNS: 'common',
  // Bundled resources, so translations are available as soon as this module is loaded
  initAsync: false,
  // The text is drawn by the game, not inserted into HTML
  interpolation: { escapeValue: false },
});

/**
 * Translates a key from the renderer's translation files.
 * @param key - Full key path, from `translations` in src/i18n/translations.ts
 * @param language - Language from the settings; unsupported languages fall back to English
 * @param options - Interpolation values, e.g. `count`
 * @returns The translated text
 */
export function translate(
  key: string,
  language: string | undefined,
  options?: Record<string, unknown>,
): string {
  return translator.t(key, { ...options, lng: language });
}
