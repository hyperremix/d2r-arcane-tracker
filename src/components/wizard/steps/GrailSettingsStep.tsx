import { Trophy } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useWizardSettingsSave, WizardSaveError } from '@/components/wizard/wizardSettingsSave';
import { translations } from '@/i18n/translations';
import { useGrailStore } from '@/stores/grailStore';

/**
 * GrailSettingsStep component - Step for configuring Holy Grail tracking options.
 * Allows users to toggle tracking of normal, ethereal, runes, and runewords.
 * @returns {JSX.Element} Grail settings configuration step content
 */
export function GrailSettingsStep() {
  const { t } = useTranslation();
  const grailNormalId = useId();
  const grailEtherealId = useId();
  const grailRunesId = useId();
  const grailRunewordsId = useId();
  const { settings } = useGrailStore();
  const { saveSettings, saveFailed } = useWizardSettingsSave();

  const grailNormal = settings.grailNormal ?? true;
  const grailEthereal = settings.grailEthereal ?? false;
  const grailRunes = settings.grailRunes ?? false;
  const grailRunewords = settings.grailRunewords ?? false;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-6 w-6" />
          <h2 className="font-bold text-2xl">{t(translations.settings.grail.title)}</h2>
        </div>
        <p className="text-muted-foreground">{t(translations.wizard.grail.description)}</p>
      </div>

      <div className="space-y-6">
        {/* Item Type Toggles */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor={grailNormalId} className="text-base">
                {t(translations.settings.grail.includeNormal)}
              </Label>
              <p className="text-muted-foreground text-sm">
                {t(translations.settings.grail.includeNormalDescription)}
              </p>
            </div>
            <Switch
              id={grailNormalId}
              checked={grailNormal}
              onCheckedChange={(checked) => saveSettings({ grailNormal: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor={grailEtherealId} className="text-base">
                {t(translations.settings.grail.includeEthereal)}
              </Label>
              <p className="text-muted-foreground text-sm">
                {t(translations.settings.grail.includeEtherealDescription)}
              </p>
            </div>
            <Switch
              id={grailEtherealId}
              checked={grailEthereal}
              onCheckedChange={(checked) => saveSettings({ grailEthereal: checked })}
            />
          </div>
        </div>

        {/* Runes and Runewords Toggles */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor={grailRunesId} className="text-base">
                {t(translations.settings.grail.includeRunes)}
              </Label>
              <p className="text-muted-foreground text-sm">
                {t(translations.settings.grail.includeRunesDescription)}
              </p>
            </div>
            <Switch
              id={grailRunesId}
              checked={grailRunes}
              onCheckedChange={(checked) => saveSettings({ grailRunes: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor={grailRunewordsId} className="text-base">
                {t(translations.settings.grail.includeRunewords)}
              </Label>
              <p className="text-muted-foreground text-sm">
                {t(translations.settings.grail.includeRunewordsDescription)}
              </p>
            </div>
            <Switch
              id={grailRunewordsId}
              checked={grailRunewords}
              onCheckedChange={(checked) => saveSettings({ grailRunewords: checked })}
            />
          </div>
        </div>

        <WizardSaveError visible={saveFailed} />

        {/* Information Box */}
        <div className="rounded-lg bg-info/10 p-4">
          <p className="text-info text-sm">
            <strong>{t(translations.wizard.tip)}</strong> {t(translations.wizard.grail.tip)}
          </p>
        </div>
      </div>
    </div>
  );
}
