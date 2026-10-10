import type { GameVersion } from 'electron/types/grail';
import { Gamepad2 } from 'lucide-react';
import { useCallback, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { GameVersionSelect } from '@/components/settings/fields/GameVersionSelect';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { translations } from '@/i18n/translations';
import { useGrailStore } from '@/stores/grailStore';

/**
 * GameVersionSettings component that allows users to select the Diablo II game version.
 * Provides options for Diablo II: Resurrected or Diablo II: Classic.
 * @returns {JSX.Element} A settings card with game version selection dropdown
 */
export function GameVersionSettings() {
  const { t } = useTranslation();
  const gameVersionSelectId = useId();
  const { settings, setSettings } = useGrailStore(
    useShallow((state) => ({ settings: state.settings, setSettings: state.setSettings })),
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
          <Label htmlFor={gameVersionSelectId}>
            {t(translations.settings.gameVersion.selectGameVersion)}
          </Label>
          <GameVersionSelect
            id={gameVersionSelectId}
            value={settings.gameVersion}
            onValueChange={updateGameVersion}
          />
        </div>

        <div className="rounded bg-info/10 p-3">
          <p className="text-info text-sm">
            <strong>{t(translations.common.note)}</strong>{' '}
            {t(translations.settings.gameVersion.note)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
