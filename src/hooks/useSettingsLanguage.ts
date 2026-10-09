import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { resolveSupportedLanguage } from '@/i18n';
import { useGrailStore } from '@/stores/grailStore';

/**
 * Applies the `lang` setting to i18next and the document once the settings are loaded. Languages
 * the app has no translations for fall back to the default language.
 */
export function useSettingsLanguage(): void {
  const { i18n } = useTranslation();
  const lang = useGrailStore((state) => state.settings.lang);
  const settingsHydrated = useGrailStore((state) => state.settingsHydrated);

  useEffect(() => {
    if (!settingsHydrated) {
      return;
    }
    const language = resolveSupportedLanguage(lang);
    document.documentElement.lang = language;
    if (i18n.language !== language) {
      void i18n.changeLanguage(language);
    }
  }, [i18n, lang, settingsHydrated]);
}
