import { GameVersion } from 'electron/types/grail';
import { Gamepad2 } from 'lucide-react';
import { useCallback, useId, useMemo } from 'react';
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
 * Available game version values.
 */
const gameVersionValues: GameVersion[] = [GameVersion.Resurrected, GameVersion.Classic];

/**
 * GameVersionSettings component that allows users to select the Diablo II game version.
 * Provides options for Diablo II: Resurrected or Diablo II: Classic.
 * @returns {JSX.Element} A settings card with game version selection dropdown
 */
export function GameVersionSettings() {
  const { t } = useTranslation();
  const gameVersionSelectId = useId();
  const { settings, setSettings } = useGrailStore();

  const gameVersions = useMemo(
    () =>
      gameVersionValues.map((value) => ({
        value,
        label: t(
          value === GameVersion.Resurrected
            ? translations.settings.gameVersion.resurrectedLabel
            : translations.settings.gameVersion.classicLabel,
        ),
        description: t(
          value === GameVersion.Resurrected
            ? translations.settings.gameVersion.resurrectedDescription
            : translations.settings.gameVersion.classicDescription,
        ),
      })),
    [t],
  );

  const updateGameVersion = useCallback(
    (gameVersion: GameVersion) => {
      setSettings({ gameVersion });
    },
    [setSettings],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gamepad2 className="h-5 w-5" />
          {t(translations.settings.gameVersion.title)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={gameVersionSelectId}>Select Game Version</Label>
          <Select
            value={settings.gameVersion}
            onValueChange={(value) => value && updateGameVersion(value as GameVersion)}
          >
            <SelectTrigger id={gameVersionSelectId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {gameVersions.map((version) => (
                <SelectItem key={version.value} value={version.value}>
                  <div className="flex flex-col">
                    <span className="font-medium">{version.label}</span>
                    <span className="text-gray-500 text-xs dark:text-gray-400">
                      {version.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded bg-blue-50 p-3 dark:bg-blue-950">
          <p className="text-blue-800 text-sm dark:text-blue-200">
            <strong>Note:</strong> The game version setting affects item detection compatibility and
            may influence which save file formats are supported. Make sure to select the version
            that matches your Diablo II installation.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
