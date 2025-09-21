import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import resourcesToBackend from 'i18next-resources-to-backend';
import { initReactI18next } from 'react-i18next';

i18n
  .use(
    resourcesToBackend(
      (language: string, namespace: string) => import(`./locales/${language}/${namespace}.json`),
    ),
  )
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    debug: import.meta.env.MODE === 'development',
    fallbackLng: 'en',
    supportedLngs: ['en'],

    defaultNS: 'common',
    ns: ['common'],

    interpolation: {
      escapeValue: false,
    },

    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'd2r-arcane-tracker-language',
    },

    react: {
      useSuspense: true,
    },
    saveMissing: import.meta.env.MODE === 'development',
    missingKeyHandler: (lng, ns, key) => {
      if (import.meta.env.MODE === 'development') {
        console.warn(`Missing translation key: ${key} in ${lng}/${ns}`);
      }
    },
  });

export default i18n;
