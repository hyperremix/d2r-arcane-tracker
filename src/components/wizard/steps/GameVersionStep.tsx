import { GameVersion } from 'electron/types/grail';
import { Gamepad2 } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { translations } from '@/i18n/translations';
import { gameVersionDescriptionKeys, gameVersionLabelKeys } from '@/lib/labelKeys';
import { useGrailStore } from '@/stores/grailStore';
import { useWizardSettingsSave, WizardSaveError } from '../wizardSettingsSave';

/**
 * A selectable game version with its label and description translation keys.
 */
interface GameVersionOption {
  value: GameVersion;
  labelKey: string;
  descriptionKey: string;
}

/**
 * Available game versions with their label and description translation keys.
 */
const gameVersions: GameVersionOption[] = [
  {
    value: GameVersion.Resurrected,
    labelKey: gameVersionLabelKeys[GameVersion.Resurrected],
    descriptionKey: gameVersionDescriptionKeys[GameVersion.Resurrected],
  },
  {
    value: GameVersion.Classic,
    labelKey: gameVersionLabelKeys[GameVersion.Classic],
    descriptionKey: gameVersionDescriptionKeys[GameVersion.Classic],
  },
];

/**
 * GameVersionStep component - Step for selecting the game version.
 * Allows users to choose between Resurrected or Classic.
 * @returns {JSX.Element} Game version selection step content
 */
export function GameVersionStep() {
  const { t } = useTranslation();
  const gameVersionId = useId();
  const { settings } = useGrailStore();
  const { saveSettings, saveFailed } = useWizardSettingsSave();
  const gameVersion = settings.gameVersion || GameVersion.Resurrected;
  const selectedVersion = gameVersions.find((version) => version.value === gameVersion);

  const handleGameVersionChange = (value: GameVersion) => {
    saveSettings({ gameVersion: value });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-bold text-2xl">{t(translations.settings.gameVersion.title)}</h2>
        <p className="text-muted-foreground">{t(translations.wizard.gameVersion.description)}</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={gameVersionId}>
            {t(translations.settings.gameVersion.selectGameVersion)}
          </Label>
          <Select
            value={gameVersion}
            onValueChange={(value) => value && handleGameVersionChange(value as GameVersion)}
          >
            <SelectTrigger id={gameVersionId}>
              <SelectValue>{selectedVersion ? t(selectedVersion.labelKey) : null}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {gameVersions.map((version) => (
                <SelectItem key={version.value} value={version.value}>
                  <div className="flex items-center gap-2">
                    <Gamepad2 className="h-4 w-4" />
                    <div className="flex flex-col">
                      <span className="font-medium">{t(version.labelKey)}</span>
                      <span className="text-muted-foreground text-xs">
                        {t(version.descriptionKey)}
                      </span>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <WizardSaveError visible={saveFailed} />

        <div className="rounded-lg bg-info/10 p-4">
          <p className="text-info text-sm">
            <strong>{t(translations.common.note)}</strong>{' '}
            {t(translations.settings.gameVersion.note)}
          </p>
        </div>
      </div>
    </div>
  );
}
