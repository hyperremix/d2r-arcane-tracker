import { Bell, Monitor, Smartphone } from 'lucide-react';
import { useCallback, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { translations } from '@/i18n/translations';
import { useGrailStore } from '@/stores/grailStore';

/**
 * NotificationSettings component that provides controls for configuring notification preferences.
 * Allows users to enable/disable sound notifications, adjust volume, and toggle in-app and native notifications.
 * @returns {JSX.Element} A settings card with notification configuration controls
 */
export function NotificationSettings() {
  const { t } = useTranslation();
  const { settings, setSettings } = useGrailStore();
  const volumeSliderId = useId();

  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }, []);

  const toggleSoundNotifications = async (checked: boolean) => {
    await setSettings({ enableSounds: checked });
  };

  const updateVolume = async (volume: number) => {
    await setSettings({ notificationVolume: volume });
  };

  const toggleInAppNotifications = async (checked: boolean) => {
    await setSettings({ inAppNotifications: checked });
  };

  const toggleNativeNotifications = async (checked: boolean) => {
    if (checked) {
      // When enabling, request browser permission
      await requestNotificationPermission();
    }
    await setSettings({ nativeNotifications: checked });
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
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="flex items-center gap-2 font-medium text-sm">
                <Bell className="h-4 w-4" />
                {t(translations.settings.notifications.soundNotifications)}
              </h4>
              <p className="text-gray-600 text-xs dark:text-gray-400">
                {t(translations.settings.notifications.soundDescription)}
              </p>
            </div>
            <Switch checked={settings.enableSounds} onCheckedChange={toggleSoundNotifications} />
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor={volumeSliderId} className="text-gray-600 text-xs dark:text-gray-400">
              {t(translations.settings.notifications.volume)}
            </Label>
            <Slider
              id={volumeSliderId}
              min={0}
              max={1}
              step={0.01}
              value={[settings.enableSounds ? settings.notificationVolume : 0]}
              onValueChange={(value) => {
                const values = Array.isArray(value) ? value : [value];
                updateVolume(values[0]);
              }}
              className="w-20"
              disabled={!settings.enableSounds}
            />
            <span className="w-8 text-gray-600 text-xs dark:text-gray-400">
              {Math.round((settings.enableSounds ? settings.notificationVolume : 0) * 100)}%
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="flex items-center gap-2 font-medium text-sm">
                <Monitor className="h-4 w-4" />
                {t(translations.settings.notifications.inAppNotifications)}
              </h4>
              <p className="text-gray-600 text-xs dark:text-gray-400">
                {t(translations.settings.notifications.inAppDescription)}
              </p>
            </div>
            <Switch
              checked={settings.inAppNotifications}
              onCheckedChange={toggleInAppNotifications}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="flex items-center gap-2 font-medium text-sm">
                <Smartphone className="h-4 w-4" />
                {t(translations.settings.notifications.nativeNotifications)}
              </h4>
              <p className="text-gray-600 text-xs dark:text-gray-400">
                {t(translations.settings.notifications.nativeDescription)}
              </p>
            </div>
            <Switch
              checked={settings.nativeNotifications}
              onCheckedChange={toggleNativeNotifications}
            />
          </div>
        </div>

        <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950">
          <p className="text-blue-800 text-xs dark:text-blue-200">
            <strong>{t(translations.common.note)}</strong>{' '}
            {t(translations.settings.notifications.nativeNote)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
