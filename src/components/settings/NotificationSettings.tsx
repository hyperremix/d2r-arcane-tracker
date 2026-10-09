import { Bell } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import {
  NotificationFields,
  type NotificationValues,
} from '@/components/settings/fields/NotificationFields';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { translations } from '@/i18n/translations';
import { useGrailStore } from '@/stores/grailStore';

/**
 * NotificationSettings component that provides controls for configuring notification preferences.
 * Allows users to enable/disable sound notifications, adjust volume, and toggle in-app and native notifications.
 * @returns {JSX.Element} A settings card with notification configuration controls
 */
export function NotificationSettings() {
  const { t } = useTranslation();
  const { settings, setSettings } = useGrailStore(
    useShallow((state) => ({ settings: state.settings, setSettings: state.setSettings })),
  );

  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }, []);

  const updateNotifications = async (update: Partial<NotificationValues>) => {
    if (update.nativeNotifications) {
      // When enabling native notifications, request browser permission
      await requestNotificationPermission();
    }
    await setSettings(update);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-5 w-5" />
          {t(translations.settings.notifications.title)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <NotificationFields
          values={{
            enableSounds: settings.enableSounds,
            notificationVolume: settings.notificationVolume,
            inAppNotifications: settings.inAppNotifications,
            nativeNotifications: settings.nativeNotifications,
          }}
          onChange={updateNotifications}
        />

        <div className="rounded-lg bg-info/10 p-3">
          <p className="text-info text-xs">
            <strong>{t(translations.common.note)}</strong>{' '}
            {t(translations.settings.notifications.nativeNote)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
