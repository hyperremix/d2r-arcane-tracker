import { SlidersHorizontal } from 'lucide-react';
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
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-6 w-6" />
          <h2 className="font-bold text-2xl">{t(translations.wizard.preferences.title)}</h2>
        </div>
        <p className="text-muted-foreground">{t(translations.wizard.preferences.description)}</p>
      </div>

      <ThemeStep />
      <hr className="border-border" />
      <NotificationsStep />
      <hr className="border-border" />
      <WidgetStep />
    </div>
  );
}
