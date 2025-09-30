import { Bell, Monitor, Smartphone } from 'lucide-react';
import { useCallback, useId } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useGrailStore } from '@/stores/grailStore';

/**
 * NotificationSettings component that provides controls for configuring notification preferences.
 * Allows users to enable/disable sound notifications, adjust volume, and toggle in-app and native notifications.
 * @returns {JSX.Element} A settings card with notification configuration controls
 */
export function NotificationSettings() {
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
          Notification Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="flex items-center gap-2 font-medium text-sm">
                <Bell className="h-4 w-4" />
                Sound Notifications
              </h4>
              <p className="text-gray-600 text-xs dark:text-gray-400">
                Play sound when items are found
              </p>
            </div>
            <Switch checked={settings.enableSounds} onCheckedChange={toggleSoundNotifications} />
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor={volumeSliderId} className="text-gray-600 text-xs dark:text-gray-400">
              Volume:
            </Label>
            <Slider
              id={volumeSliderId}
              min={0}
              max={1}
              step={0.01}
              value={[settings.enableSounds ? settings.notificationVolume : 0]}
              onValueChange={(values) => updateVolume(values[0])}
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
                In-App Notifications
              </h4>
              <p className="text-gray-600 text-xs dark:text-gray-400">
                Show notification cards in the app
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
                Native Notifications
              </h4>
              <p className="text-gray-600 text-xs dark:text-gray-400">
                Show browser/OS notifications
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
            <strong>Note:</strong> Native notifications require browser permission. You'll be
            prompted to allow notifications when you first enable this setting.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
