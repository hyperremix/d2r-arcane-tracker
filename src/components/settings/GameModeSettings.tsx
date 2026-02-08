import { GameMode } from 'electron/types/grail';
import { Shield, Sword, Users, Wrench } from 'lucide-react';
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
 * Available game modes with their icons.
 */
const gameModeValues: { value: GameMode; icon: React.ReactNode }[] = [
  { value: GameMode.Both, icon: <Users className="h-4 w-4" /> },
  { value: GameMode.Softcore, icon: <Shield className="h-4 w-4" /> },
  { value: GameMode.Hardcore, icon: <Sword className="h-4 w-4" /> },
  { value: GameMode.Manual, icon: <Wrench className="h-4 w-4" /> },
];

/**
 * GameModeSettings component that allows users to select the game mode for Holy Grail tracking.
 * Provides options for both softcore/hardcore, softcore only, hardcore only, or manual entry.
 * @returns {JSX.Element} A settings card with game mode selection dropdown
 */
export function GameModeSettings() {
  const { t } = useTranslation();
  const gameModeSelectId = useId();
  const { settings, setSettings } = useGrailStore();

  const gameModes = useMemo(
    () =>
      gameModeValues.map(({ value, icon }) => {
        const keyMap: Record<GameMode, { label: string; description: string }> = {
          [GameMode.Both]: {
            label: t(translations.settings.gameMode.bothLabel),
            description: t(translations.settings.gameMode.bothDescription),
          },
          [GameMode.Softcore]: {
            label: t(translations.settings.gameMode.softcoreLabel),
            description: t(translations.settings.gameMode.softcoreDescription),
          },
          [GameMode.Hardcore]: {
            label: t(translations.settings.gameMode.hardcoreLabel),
            description: t(translations.settings.gameMode.hardcoreDescription),
          },
          [GameMode.Manual]: {
            label: t(translations.settings.gameMode.manualLabel),
            description: t(translations.settings.gameMode.manualDescription),
          },
        };
        return { value, icon, ...keyMap[value] };
      }),
    [t],
  );

  const updateGameMode = useCallback(
    (gameMode: GameMode) => {
      setSettings({ gameMode });
    },
    [setSettings],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          {t(translations.settings.gameMode.title)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={gameModeSelectId}>
            {t(translations.settings.gameMode.selectGameMode)}
          </Label>
          <Select
            value={settings.gameMode}
            onValueChange={(value) => value && updateGameMode(value as GameMode)}
          >
            <SelectTrigger id={gameModeSelectId}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {gameModes.map((mode) => (
                <SelectItem key={mode.value} value={mode.value}>
                  <div className="flex items-center gap-2">
                    {mode.icon}
                    <div className="flex flex-col">
                      <span className="font-medium">{mode.label}</span>
                      <span className="text-gray-500 text-xs dark:text-gray-400">
                        {mode.description}
                      </span>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded bg-blue-50 p-3 dark:bg-blue-950">
          <p className="text-blue-800 text-sm dark:text-blue-200">
            <strong>{t(translations.common.note)}</strong> {t(translations.settings.gameMode.note)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
