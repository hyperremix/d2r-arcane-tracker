import { useTranslation } from 'react-i18next';
import { translations } from '@/i18n/translations';
import { NotificationsStep } from './NotificationsStep';
import { ThemeStep } from './ThemeStep';
import { WidgetStep } from './WidgetStep';

/**
 * PreferencesStep component - Optional wizard step that groups the theme,
 * notification and overlay widget preferences into a single step.
 * @returns {JSX.Element} Preferences step content
 */
export function PreferencesStep() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {/* The step title is shown in the wizard header */}
      <p className="text-muted-foreground">{t(translations.wizard.preferences.description)}</p>

      <ThemeStep />
      <hr className="border-border" />
      <NotificationsStep />
      <hr className="border-border" />
      <WidgetStep />
    </div>
  );
}
