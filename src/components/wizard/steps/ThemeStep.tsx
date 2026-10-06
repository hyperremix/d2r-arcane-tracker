import type { LucideIcon } from 'lucide-react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { translations } from '@/i18n/translations';
import { themeLabelKeys } from '@/lib/labelKeys';
import { useGrailStore } from '@/stores/grailStore';

/**
 * A selectable theme with its icon; labels come from the shared theme label keys.
 */
interface ThemeOption {
  value: 'light' | 'dark' | 'system';
  Icon: LucideIcon;
}

const themeOptions: ThemeOption[] = [
  { value: 'light', Icon: Sun },
  { value: 'dark', Icon: Moon },
  { value: 'system', Icon: Monitor },
];

/**
 * ThemeStep component - Theme section of the wizard Preferences step.
 * Allows users to choose between Light, Dark, or System theme.
 * @returns {JSX.Element} Theme selection section content
 */
export function ThemeStep() {
  const { t } = useTranslation();
  const themeId = useId();
  const headingId = useId();
  const { settings, setSettings } = useGrailStore();
  const theme = settings.theme || 'system';

  const handleThemeChange = (value: 'light' | 'dark' | 'system') => {
    setSettings({ theme: value });
  };

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="h-6 w-6" />;
      case 'dark':
        return <Moon className="h-6 w-6" />;
      default:
        return <Monitor className="h-6 w-6" />;
    }
  };

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {getThemeIcon()}
          <h3 id={headingId} className="font-semibold text-lg">
            {t(translations.settings.theme.appearance)}
          </h3>
        </div>
        <p className="text-muted-foreground text-sm">{t(translations.wizard.theme.description)}</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={themeId}>{t(translations.settings.theme.selectTheme)}</Label>
          <Select
            value={theme}
            onValueChange={(value) =>
              value && handleThemeChange(value as 'light' | 'dark' | 'system')
            }
          >
            <SelectTrigger id={themeId}>
              <SelectValue placeholder={t(translations.settings.theme.selectThemePlaceholder)}>
                {t(themeLabelKeys[theme])}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {themeOptions.map(({ value, Icon }) => (
                <SelectItem key={value} value={value}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {t(themeLabelKeys[value])}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Theme Preview */}
        <div className="rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-medium text-sm">{t(translations.wizard.theme.preview)}</p>
              <p className="text-muted-foreground text-xs">
                {theme === 'system'
                  ? t(translations.wizard.theme.previewSystem)
                  : t(translations.wizard.theme.previewSelected, {
                      theme: t(themeLabelKeys[theme]),
                    })}
              </p>
            </div>
            <div className="flex gap-2">
              {theme === 'light' && <Sun className="h-8 w-8 text-warning" />}
              {theme === 'dark' && <Moon className="h-8 w-8 text-info" />}
              {theme === 'system' && <Monitor className="h-8 w-8 text-primary" />}
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-info/10 p-4">
          <p className="text-info text-sm">
            <strong>{t(translations.common.note)}</strong> {t(translations.settings.theme.note)}
          </p>
        </div>
      </div>
    </section>
  );
}
