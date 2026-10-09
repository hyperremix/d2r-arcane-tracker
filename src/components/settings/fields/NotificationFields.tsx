import type { Settings } from 'electron/types/grail';
import type { LucideIcon } from 'lucide-react';
import { Bell, Monitor, Smartphone } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { translations } from '@/i18n/translations';

export type NotificationValues = Pick<
  Settings,
  'enableSounds' | 'notificationVolume' | 'inAppNotifications' | 'nativeNotifications'
>;

interface NotificationSwitchProps {
  Icon: LucideIcon;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children?: ReactNode;
}

/**
 * A notification type with its switch, labelled by its heading and described by its description.
 * Extra controls for the type (e.g. the volume) are rendered below it.
 */
function NotificationSwitch({
  Icon,
  label,
  description,
  checked,
  onCheckedChange,
  children,
}: NotificationSwitchProps) {
  const labelId = useId();
  const descriptionId = useId();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 id={labelId} className="flex items-center gap-2 font-medium text-sm">
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </h4>
          <p id={descriptionId} className="text-muted-foreground text-xs">
            {description}
          </p>
        </div>
        <Switch
          checked={checked}
          onCheckedChange={onCheckedChange}
          aria-labelledby={labelId}
          aria-describedby={descriptionId}
        />
      </div>
      {children}
    </div>
  );
}

interface NotificationFieldsProps {
  values: NotificationValues;
  onChange: (update: Partial<NotificationValues>) => void;
}

/**
 * Sound (with volume), in-app and native notification controls, shared by the settings page and
 * the setup wizard.
 */
export function NotificationFields({ values, onChange }: NotificationFieldsProps) {
  const { t } = useTranslation();
  const volumeLabelId = useId();
  const volume = values.enableSounds ? values.notificationVolume : 0;

  return (
    <>
      <NotificationSwitch
        Icon={Bell}
        label={t(translations.settings.notifications.soundNotifications)}
        description={t(translations.settings.notifications.soundDescription)}
        checked={values.enableSounds}
        onCheckedChange={(checked) => onChange({ enableSounds: checked })}
      >
        <div className="flex items-center gap-2">
          <Label id={volumeLabelId} className="text-muted-foreground text-xs">
            {t(translations.settings.notifications.volume)}
          </Label>
          <Slider
            aria-labelledby={volumeLabelId}
            min={0}
            max={1}
            step={0.01}
            value={[volume]}
            onValueChange={(value) => {
              const values = Array.isArray(value) ? value : [value];
              onChange({ notificationVolume: values[0] });
            }}
            className="w-20"
            disabled={!values.enableSounds}
          />
          <span className="w-8 text-muted-foreground text-xs">{Math.round(volume * 100)}%</span>
        </div>
      </NotificationSwitch>

      <NotificationSwitch
        Icon={Monitor}
        label={t(translations.settings.notifications.inAppNotifications)}
        description={t(translations.settings.notifications.inAppDescription)}
        checked={values.inAppNotifications}
        onCheckedChange={(checked) => onChange({ inAppNotifications: checked })}
      />

      <NotificationSwitch
        Icon={Smartphone}
        label={t(translations.settings.notifications.nativeNotifications)}
        description={t(translations.settings.notifications.nativeDescription)}
        checked={values.nativeNotifications}
        onCheckedChange={(checked) => onChange({ nativeNotifications: checked })}
      />
    </>
  );
}
