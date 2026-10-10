import { Bell } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { NotificationFields } from '@/components/settings/fields/NotificationFields';
import { useWizardSettingsSave, WizardSaveError } from '@/components/wizard/wizardSettingsSave';
import { translations } from '@/i18n/translations';
import { useGrailStore } from '@/stores/grailStore';

/**
 * NotificationsStep component - Notifications section of the wizard Preferences step.
 * Allows users to enable/disable sounds, adjust volume, and toggle notification types.
 * @returns {JSX.Element} Notifications configuration section content
 */
export function NotificationsStep() {
  const { t } = useTranslation();
  const headingId = useId();
  const settings = useGrailStore((state) => state.settings);
  const { saveSettings, saveFailed } = useWizardSettingsSave();

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Bell className="h-6 w-6" />
          <h3 id={headingId} className="font-semibold text-lg">
            {t(translations.settings.notifications.title)}
          </h3>
        </div>
        <p className="text-muted-foreground text-sm">
          {t(translations.wizard.notifications.description)}
        </p>
      </div>

      <div className="space-y-6">
        <NotificationFields
          values={{
            enableSounds: settings.enableSounds ?? true,
            notificationVolume: settings.notificationVolume ?? 0.5,
            inAppNotifications: settings.inAppNotifications ?? true,
            nativeNotifications: settings.nativeNotifications ?? true,
          }}
          onChange={saveSettings}
        />

        <WizardSaveError visible={saveFailed} />

        <div className="rounded-lg bg-info/10 p-4">
          <p className="text-info text-sm">
            <strong>{t(translations.common.note)}</strong>{' '}
            {t(translations.settings.notifications.nativeNote)}
          </p>
        </div>
      </div>
    </section>
  );
}
