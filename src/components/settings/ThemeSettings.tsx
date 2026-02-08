import { Monitor, Moon, Sun } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { translations } from '@/i18n/translations';
import { useGrailStore } from '@/stores/grailStore';

/**
 * ThemeSettings component that provides controls for configuring theme and display preferences.
 * Allows users to switch between light, dark, and system themes, and toggle item icons.
 * @returns {JSX.Element} A settings card with theme and display configuration controls
 */
export function ThemeSettings() {
  const { t } = useTranslation();
  const themeSelectId = useId();
  const { settings, setSettings } = useGrailStore();

  const updateTheme = async (theme: 'light' | 'dark' | 'system') => {
    await setSettings({ theme });
  };

  const getThemeIcon = () => {
    switch (settings.theme) {
      case 'light':
        return <Sun className="h-5 w-5" />;
      case 'dark':
        return <Moon className="h-5 w-5" />;
      default:
        return <Monitor className="h-5 w-5" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          {getThemeIcon()}
          {t(translations.settings.theme.title)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor={themeSelectId} className="font-medium text-sm">
                {t(translations.settings.theme.appearance)}
              </Label>
              <p className="text-gray-600 text-xs">{t(translations.settings.theme.selectTheme)}</p>
            </div>
            <Select
              value={settings.theme}
              onValueChange={(value) => value && updateTheme(value as 'light' | 'dark' | 'system')}
            >
              <SelectTrigger id={themeSelectId} className="w-[180px]">
                <SelectValue placeholder={t(translations.settings.theme.selectThemePlaceholder)} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4" />
                    {t(translations.settings.theme.light)}
                  </div>
                </SelectItem>
                <SelectItem value="dark">
                  <div className="flex items-center gap-2">
                    <Moon className="h-4 w-4" />
                    {t(translations.settings.theme.dark)}
                  </div>
                </SelectItem>
                <SelectItem value="system">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    {t(translations.settings.theme.system)}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950">
          <p className="text-blue-800 text-xs dark:text-blue-200">
            <strong>{t(translations.common.note)}</strong> {t(translations.settings.theme.note)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
