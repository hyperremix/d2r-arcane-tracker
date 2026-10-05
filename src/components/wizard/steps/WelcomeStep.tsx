import { useTranslation } from 'react-i18next';
import { translations } from '@/i18n/translations';
import logoUrl from '/logo.png';

/**
 * WelcomeStep component - First step of the setup wizard.
 * Provides a welcome message and overview of what the wizard will configure.
 * @returns {JSX.Element} Welcome step content
 */
export function WelcomeStep() {
  const { t } = useTranslation();

  const configureItems = [
    translations.wizard.welcome.configureSaveDirectory,
    translations.wizard.welcome.configureGameModeVersion,
    translations.wizard.welcome.configureGrail,
    translations.wizard.welcome.configurePreferences,
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <img src={logoUrl} alt={t(translations.app.title)} className="h-20 w-20" />
        <h2 className="font-bold text-2xl">{t(translations.wizard.welcome.title)}</h2>
        <p className="max-w-lg text-muted-foreground">
          {t(translations.wizard.welcome.description)}
        </p>
      </div>

      <div className="space-y-4 rounded-lg border bg-muted/30 p-6">
        <h3 className="font-semibold text-lg">{t(translations.wizard.welcome.configureHeading)}</h3>
        <ul className="space-y-2 text-sm">
          {configureItems.map((key) => (
            <li key={key} className="flex items-start gap-2">
              <span className="text-primary" aria-hidden="true">
                •
              </span>
              <span>{t(key)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="text-center text-muted-foreground text-sm">
        {t(translations.wizard.welcome.skipHint)}
      </div>
    </div>
  );
}
