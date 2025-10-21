import { Monitor, Moon, Sun } from 'lucide-react';
import { useId } from 'react';
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
 * ThemeStep component - Step for selecting the app theme.
 * Allows users to choose between Light, Dark, or System theme.
 * @returns {JSX.Element} Theme selection step content
 */
export function ThemeStep() {
  const themeId = useId();
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
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {getThemeIcon()}
          <h2 className="font-bold text-2xl">Appearance</h2>
        </div>
        <p className="text-muted-foreground">Choose your preferred theme for the application.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={themeId}>Select Theme</Label>
          <Select value={theme} onValueChange={handleThemeChange}>
            <SelectTrigger id={themeId}>
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

        {/* Theme Preview */}
        <div className="rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="font-medium text-sm">Preview</p>
              <p className="text-muted-foreground text-xs">
                {theme === 'system'
                  ? 'Automatically matches your operating system appearance'
                  : `${theme.charAt(0).toUpperCase() + theme.slice(1)} theme selected`}
              </p>
            </div>
            <div className="flex gap-2">
              {theme === 'light' && <Sun className="h-8 w-8 text-yellow-500" />}
              {theme === 'dark' && <Moon className="h-8 w-8 text-blue-500" />}
              {theme === 'system' && <Monitor className="h-8 w-8 text-purple-500" />}
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950">
          <p className="text-blue-800 text-sm dark:text-blue-200">
            <strong>Note:</strong> System theme will automatically match your operating system's
            appearance preference and update when it changes.
          </p>
        </div>
      </div>
    </div>
  );
}
