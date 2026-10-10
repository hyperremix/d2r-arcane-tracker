import { GameMode } from 'electron/types/grail';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { GameModeSelect } from '@/components/settings/fields/GameModeSelect';
import { Label } from '@/components/ui/label';
import { useWizardSettingsSave, WizardSaveError } from '@/components/wizard/wizardSettingsSave';
import { translations } from '@/i18n/translations';
import { useGrailStore } from '@/stores/grailStore';

/**
 * GameModeStep component - Game mode section of the wizard "What to track" step.
 * Allows users to choose between Both, Softcore, Hardcore, or Manual tracking.
 * @returns {JSX.Element} Game mode selection section content
 */
export function GameModeStep() {
  const { t } = useTranslation();
  const gameModeId = useId();
  const headingId = useId();
  const settings = useGrailStore((state) => state.settings);
  const { saveSettings, saveFailed } = useWizardSettingsSave();
  const gameMode = settings.gameMode || GameMode.Both;

  const handleGameModeChange = (value: GameMode) => {
    saveSettings({ gameMode: value });
  };

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="space-y-1">
        <h3 id={headingId} className="font-semibold text-lg">
          {t(translations.settings.gameMode.title)}
        </h3>
        <p className="text-muted-foreground text-sm">
          {t(translations.wizard.gameMode.description)}
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={gameModeId}>{t(translations.settings.gameMode.selectGameMode)}</Label>
          <GameModeSelect id={gameModeId} value={gameMode} onValueChange={handleGameModeChange} />
        </div>

        <WizardSaveError visible={saveFailed} />

        <div className="rounded-lg bg-info/10 p-4">
          <p className="text-info text-sm">
            <strong>{t(translations.common.note)}</strong> {t(translations.settings.gameMode.note)}
          </p>
        </div>
      </div>
    </section>
  );
}
