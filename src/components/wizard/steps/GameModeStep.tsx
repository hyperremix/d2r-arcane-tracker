import { GameMode } from 'electron/types/grail';
import { Shield, Sword, Users, Wrench } from 'lucide-react';
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
import { useWizardSettingsSave, WizardSaveError } from '@/components/wizard/wizardSettingsSave';
import { translations } from '@/i18n/translations';
import { gameModeDescriptionKeys, gameModeLabelKeys } from '@/lib/labelKeys';
import { useGrailStore } from '@/stores/grailStore';

/**
 * A selectable game mode with its label/description translation keys and icon.
 */
interface GameModeOption {
  value: GameMode;
  labelKey: string;
  descriptionKey: string;
  icon: React.ReactNode;
}

/**
 * Available game modes with their label/description translation keys and icons.
 */
const gameModes: GameModeOption[] = [
  {
    value: GameMode.Both,
    labelKey: gameModeLabelKeys[GameMode.Both],
    descriptionKey: gameModeDescriptionKeys[GameMode.Both],
    icon: <Users className="h-4 w-4" />,
  },
  {
    value: GameMode.Softcore,
    labelKey: gameModeLabelKeys[GameMode.Softcore],
    descriptionKey: gameModeDescriptionKeys[GameMode.Softcore],
    icon: <Shield className="h-4 w-4" />,
  },
  {
    value: GameMode.Hardcore,
    labelKey: gameModeLabelKeys[GameMode.Hardcore],
    descriptionKey: gameModeDescriptionKeys[GameMode.Hardcore],
    icon: <Sword className="h-4 w-4" />,
  },
  {
    value: GameMode.Manual,
    labelKey: gameModeLabelKeys[GameMode.Manual],
    descriptionKey: gameModeDescriptionKeys[GameMode.Manual],
    icon: <Wrench className="h-4 w-4" />,
  },
];

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
  const selectedMode = gameModes.find((mode) => mode.value === gameMode);

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
          <Select
            value={gameMode}
            onValueChange={(value) => value && handleGameModeChange(value as GameMode)}
          >
            <SelectTrigger id={gameModeId}>
              <SelectValue>{selectedMode ? t(selectedMode.labelKey) : null}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {gameModes.map((mode) => (
                <SelectItem key={mode.value} value={mode.value}>
                  <div className="flex items-center gap-2">
                    {mode.icon}
                    <div className="flex flex-col">
                      <span className="font-medium">{t(mode.labelKey)}</span>
                      <span className="text-muted-foreground text-xs">
                        {t(mode.descriptionKey)}
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
            <strong>{t(translations.common.note)}</strong> {t(translations.settings.gameMode.note)}
          </p>
        </div>
      </div>
    </section>
  );
}
