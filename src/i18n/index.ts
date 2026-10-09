/**
 * i18n configuration and initialization for the D2R Arcane Tracker application.
 *
 * The translations are bundled, so i18next initialises synchronously and components never have to
 * suspend while translations load. The language comes from the `lang` setting (see
 * `useSettingsLanguage`), not from the browser.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import common from './locales/en/common.json';

/** Languages the app has translations for. */
export const SUPPORTED_LANGUAGES = ['en'] as const;

/** Language used when the configured language is not supported. */
export const DEFAULT_LANGUAGE = 'en';

/**
 * Returns the configured language if the app has translations for it, otherwise the default.
 * @param language - Language from the settings
 * @returns A supported language
 */
export function resolveSupportedLanguage(language: string | undefined): string {
  return SUPPORTED_LANGUAGES.find((supported) => supported === language) ?? DEFAULT_LANGUAGE;
}

void i18n.use(initReactI18next).init({
  debug: import.meta.env.MODE === 'development',
  resources: { en: { common } },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,

  defaultNS: 'common',
  ns: ['common'],

  interpolation: {
    escapeValue: false,
  },

  react: {
    useSuspense: false,
  },
  saveMissing: import.meta.env.MODE === 'development',
  missingKeyHandler: (lng, ns, key) => {
    if (import.meta.env.MODE === 'development') {
      console.warn(`Missing translation key: ${key} in ${lng}/${ns}`);
    }
  },
});

export default i18n;
