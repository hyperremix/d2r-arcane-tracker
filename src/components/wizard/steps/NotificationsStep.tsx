import { Bell, Monitor, Smartphone } from 'lucide-react';
import { useId } from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { useGrailStore } from '@/stores/grailStore';

/**
 * NotificationsStep component - Step for configuring notification preferences.
 * Allows users to enable/disable sounds, adjust volume, and toggle notification types.
 * @returns {JSX.Element} Notifications configuration step content
 */
export function NotificationsStep() {
  const volumeSliderId = useId();
  const { settings, setSettings } = useGrailStore();

  const enableSounds = settings.enableSounds ?? true;
  const notificationVolume = settings.notificationVolume ?? 0.5;
  const inAppNotifications = settings.inAppNotifications ?? true;
  const nativeNotifications = settings.nativeNotifications ?? true;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Bell className="h-6 w-6" />
          <h2 className="font-bold text-2xl">Notification Settings</h2>
        </div>
        <p className="text-muted-foreground">
          Configure how you want to be notified when new items are found.
        </p>
      </div>

      <div className="space-y-6">
        {/* Sound Notifications */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="flex items-center gap-2 font-medium text-sm">
                <Bell className="h-4 w-4" />
                Sound Notifications
              </h4>
              <p className="text-muted-foreground text-xs">Play sound when items are found</p>
            </div>
            <Switch
              checked={enableSounds}
              onCheckedChange={(checked) => setSettings({ enableSounds: checked })}
            />
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor={volumeSliderId} className="text-muted-foreground text-xs">
              Volume:
            </Label>
            <Slider
              id={volumeSliderId}
              min={0}
              max={1}
              step={0.01}
              value={[enableSounds ? notificationVolume : 0]}
              onValueChange={(values) => setSettings({ notificationVolume: values[0] })}
              className="w-20"
              disabled={!enableSounds}
            />
            <span className="w-8 text-muted-foreground text-xs">
              {Math.round((enableSounds ? notificationVolume : 0) * 100)}%
            </span>
          </div>
        </div>

        {/* In-App Notifications */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="flex items-center gap-2 font-medium text-sm">
                <Monitor className="h-4 w-4" />
                In-App Notifications
              </h4>
              <p className="text-muted-foreground text-xs">Show notification cards in the app</p>
            </div>
            <Switch
              checked={inAppNotifications}
              onCheckedChange={(checked) => setSettings({ inAppNotifications: checked })}
            />
          </div>
        </div>

        {/* Native Notifications */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="flex items-center gap-2 font-medium text-sm">
                <Smartphone className="h-4 w-4" />
                Native Notifications
              </h4>
              <p className="text-muted-foreground text-xs">Show browser/OS notifications</p>
            </div>
            <Switch
              checked={nativeNotifications}
              onCheckedChange={(checked) => setSettings({ nativeNotifications: checked })}
            />
          </div>
        </div>

        <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950">
          <p className="text-blue-800 text-sm dark:text-blue-200">
            <strong>Note:</strong> Native notifications require browser permission. You'll be
            prompted to allow notifications when you first enable this setting.
          </p>
        </div>
      </div>
    </div>
  );
}
