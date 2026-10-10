import type { Settings } from 'electron/types/grail';
import type { LucideIcon } from 'lucide-react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { translations } from '@/i18n/translations';
import { themeLabelKeys } from '@/lib/labelKeys';

type Theme = Settings['theme'];

/**
 * Selectable themes with their icons; labels come from the shared theme label keys.
 */
const themeOptions: { value: Theme; Icon: LucideIcon }[] = [
  { value: 'light', Icon: Sun },
  { value: 'dark', Icon: Moon },
  { value: 'system', Icon: Monitor },
];

interface ThemeSelectProps {
  /** Id of the select trigger, for the label rendered by the caller. */
  id: string;
  value: Theme;
  onValueChange: (theme: Theme) => void;
  triggerClassName?: string;
}

/**
 * Theme select shared by the settings page and the setup wizard. The caller renders the label.
 */
export function ThemeSelect({ id, value, onValueChange, triggerClassName }: ThemeSelectProps) {
  const { t } = useTranslation();
  const labelKey = themeLabelKeys[value] as string | undefined;

  return (
    <Select
      value={value}
      onValueChange={(selected) => selected && onValueChange(selected as Theme)}
    >
      <SelectTrigger id={id} className={triggerClassName}>
        <SelectValue placeholder={t(translations.settings.theme.selectThemePlaceholder)}>
          {labelKey ? t(labelKey) : null}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {themeOptions.map(({ value: theme, Icon }) => (
          <SelectItem key={theme} value={theme}>
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              {t(themeLabelKeys[theme])}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
