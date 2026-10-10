import { GameVersion } from 'electron/types/grail';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { GameVersionSelect } from '@/components/settings/fields/GameVersionSelect';
import { Label } from '@/components/ui/label';
import { useWizardSettingsSave, WizardSaveError } from '@/components/wizard/wizardSettingsSave';
import { translations } from '@/i18n/translations';
import { useGrailStore } from '@/stores/grailStore';

/**
 * GameVersionStep component - Game version section of the wizard "What to track" step.
 * Allows users to choose between Resurrected or Classic.
 * @returns {JSX.Element} Game version selection section content
 */
export function GameVersionStep() {
  const { t } = useTranslation();
  const gameVersionId = useId();
  const headingId = useId();
  const settings = useGrailStore((state) => state.settings);
  const { saveSettings, saveFailed } = useWizardSettingsSave();
  const gameVersion = settings.gameVersion || GameVersion.Resurrected;

  const handleGameVersionChange = (value: GameVersion) => {
    saveSettings({ gameVersion: value });
  };

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="space-y-1">
        <h3 id={headingId} className="font-semibold text-lg">
          {t(translations.settings.gameVersion.title)}
        </h3>
        <p className="text-muted-foreground text-sm">
          {t(translations.wizard.gameVersion.description)}
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={gameVersionId}>
            {t(translations.settings.gameVersion.selectGameVersion)}
          </Label>
          <GameVersionSelect
            id={gameVersionId}
            value={gameVersion}
            onValueChange={handleGameVersionChange}
          />
        </div>

        <WizardSaveError visible={saveFailed} />

        <div className="rounded-lg bg-info/10 p-4">
          <p className="text-info text-sm">
            <strong>{t(translations.common.note)}</strong>{' '}
            {t(translations.settings.gameVersion.note)}
          </p>
        </div>
      </div>
    </section>
  );
}
