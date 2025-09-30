import { Monitor, Moon, Sun } from 'lucide-react';
import { useId } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useGrailStore } from '@/stores/grailStore';

/**
 * ThemeSettings component that provides controls for configuring theme preferences.
 * Allows users to switch between light, dark, and system themes.
 * @returns {JSX.Element} A settings card with theme configuration controls
 */
export function ThemeSettings() {
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
          Theme Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor={themeSelectId} className="font-medium text-sm">
                Appearance
              </Label>
              <p className="text-gray-600 text-xs">Select the app theme</p>
            </div>
            <Select value={settings.theme} onValueChange={updateTheme}>
              <SelectTrigger id={themeSelectId} className="w-[180px]">
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4" />
                    Light
                  </div>
                </SelectItem>
                <SelectItem value="dark">
                  <div className="flex items-center gap-2">
                    <Moon className="h-4 w-4" />
                    Dark
                  </div>
                </SelectItem>
                <SelectItem value="system">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    System
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-950">
          <p className="text-blue-800 text-xs dark:text-blue-200">
            <strong>Note:</strong> System theme will automatically match your operating system's
            appearance preference.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
