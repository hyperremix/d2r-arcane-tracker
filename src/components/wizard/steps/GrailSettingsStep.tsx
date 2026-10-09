import { Trophy } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { GrailTrackingFields } from '@/components/settings/fields/GrailTrackingFields';
import { useWizardSettingsSave, WizardSaveError } from '@/components/wizard/wizardSettingsSave';
import { translations } from '@/i18n/translations';
import { useGrailStore } from '@/stores/grailStore';

/**
 * GrailSettingsStep component - Grail contents section of the wizard "What to track" step.
 * Allows users to toggle tracking of normal, ethereal, runes, and runewords.
 * @returns {JSX.Element} Grail settings configuration section content
 */
export function GrailSettingsStep() {
  const { t } = useTranslation();
  const headingId = useId();
  const settings = useGrailStore((state) => state.settings);
  const { saveSettings, saveFailed } = useWizardSettingsSave();

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5" aria-hidden="true" />
          <h3 id={headingId} className="font-semibold text-lg">
            {t(translations.settings.grail.title)}
          </h3>
        </div>
        <p className="text-muted-foreground text-sm">{t(translations.wizard.grail.description)}</p>
      </div>

      <div className="space-y-6">
        <GrailTrackingFields
          values={{
            grailNormal: settings.grailNormal ?? true,
            grailEthereal: settings.grailEthereal ?? false,
            grailRunes: settings.grailRunes ?? false,
            grailRunewords: settings.grailRunewords ?? false,
          }}
          onChange={saveSettings}
        />

        <WizardSaveError visible={saveFailed} />

        {/* Information Box */}
        <div className="rounded-lg bg-info/10 p-4">
          <p className="text-info text-sm">
            <strong>{t(translations.wizard.tip)}</strong> {t(translations.wizard.grail.tip)}
          </p>
        </div>
      </div>
    </section>
  );
}
