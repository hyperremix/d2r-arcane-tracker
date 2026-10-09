import { Monitor, Moon, Sun } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { ThemeSelect } from '@/components/settings/fields/ThemeSelect';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
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
  const { settings, setSettings } = useGrailStore(
    useShallow((state) => ({ settings: state.settings, setSettings: state.setSettings })),
  );

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
              <p className="text-muted-foreground text-xs">
                {t(translations.settings.theme.selectTheme)}
              </p>
            </div>
            <ThemeSelect
              id={themeSelectId}
              value={settings.theme}
              onValueChange={updateTheme}
              triggerClassName="w-[180px]"
            />
          </div>
        </div>

        <div className="rounded-lg bg-info/10 p-3">
          <p className="text-info text-xs">
            <strong>{t(translations.common.note)}</strong> {t(translations.settings.theme.note)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
