import type { GameMode } from 'electron/types/grail';
import { Users } from 'lucide-react';
import { useCallback, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { GameModeSelect } from '@/components/settings/fields/GameModeSelect';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { translations } from '@/i18n/translations';
import { useGrailStore } from '@/stores/grailStore';

/**
 * GameModeSettings component that allows users to select the game mode for Holy Grail tracking.
 * Provides options for both softcore/hardcore, softcore only, hardcore only, or manual entry.
 * @returns {JSX.Element} A settings card with game mode selection dropdown
 */
export function GameModeSettings() {
  const { t } = useTranslation();
  const gameModeSelectId = useId();
  const { settings, setSettings } = useGrailStore(
    useShallow((state) => ({ settings: state.settings, setSettings: state.setSettings })),
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
          <GameModeSelect
            id={gameModeSelectId}
            value={settings.gameMode}
            onValueChange={updateGameMode}
          />
        </div>

        <div className="rounded bg-info/10 p-3">
          <p className="text-info text-sm">
            <strong>{t(translations.common.note)}</strong> {t(translations.settings.gameMode.note)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
