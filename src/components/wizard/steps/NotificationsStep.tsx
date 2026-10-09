import { Bell, Monitor, Smartphone } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
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
  const volumeSliderId = useId();
  const headingId = useId();
  const settings = useGrailStore((state) => state.settings);
  const { saveSettings, saveFailed } = useWizardSettingsSave();

  const enableSounds = settings.enableSounds ?? true;
  const notificationVolume = settings.notificationVolume ?? 0.5;
  const inAppNotifications = settings.inAppNotifications ?? true;
  const nativeNotifications = settings.nativeNotifications ?? true;

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
        {/* Sound Notifications */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="flex items-center gap-2 font-medium text-sm">
                <Bell className="h-4 w-4" />
                {t(translations.settings.notifications.soundNotifications)}
              </h4>
              <p className="text-muted-foreground text-xs">
                {t(translations.settings.notifications.soundDescription)}
              </p>
            </div>
            <Switch
              aria-label={t(translations.settings.notifications.soundNotifications)}
              checked={enableSounds}
              onCheckedChange={(checked) => saveSettings({ enableSounds: checked })}
            />
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor={volumeSliderId} className="text-muted-foreground text-xs">
              {t(translations.settings.notifications.volume)}
            </Label>
            <Slider
              id={volumeSliderId}
              min={0}
              max={1}
              step={0.01}
              value={[enableSounds ? notificationVolume : 0]}
              onValueChange={(value) => {
                const values = Array.isArray(value) ? value : [value];
                saveSettings({ notificationVolume: values[0] });
              }}
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
                {t(translations.settings.notifications.inAppNotifications)}
              </h4>
              <p className="text-muted-foreground text-xs">
                {t(translations.settings.notifications.inAppDescription)}
              </p>
            </div>
            <Switch
              aria-label={t(translations.settings.notifications.inAppNotifications)}
              checked={inAppNotifications}
              onCheckedChange={(checked) => saveSettings({ inAppNotifications: checked })}
            />
          </div>
        </div>

        {/* Native Notifications */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="flex items-center gap-2 font-medium text-sm">
                <Smartphone className="h-4 w-4" />
                {t(translations.settings.notifications.nativeNotifications)}
              </h4>
              <p className="text-muted-foreground text-xs">
                {t(translations.settings.notifications.nativeDescription)}
              </p>
            </div>
            <Switch
              aria-label={t(translations.settings.notifications.nativeNotifications)}
              checked={nativeNotifications}
              onCheckedChange={(checked) => saveSettings({ nativeNotifications: checked })}
            />
          </div>
        </div>

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
