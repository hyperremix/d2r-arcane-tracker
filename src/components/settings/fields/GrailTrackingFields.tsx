import type { Settings } from 'electron/types/grail';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { translations } from '@/i18n/translations';

type GrailTrackingKey = 'grailNormal' | 'grailEthereal' | 'grailRunes' | 'grailRunewords';

export type GrailTrackingValues = Pick<Settings, GrailTrackingKey>;

interface GrailTrackingSwitchProps {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

/**
 * A labelled switch with a description, for one grail content type.
 */
function GrailTrackingSwitch({
  label,
  description,
  checked,
  onCheckedChange,
}: GrailTrackingSwitchProps) {
  const switchId = useId();

  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label htmlFor={switchId} className="text-base">
          {label}
        </Label>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <Switch id={switchId} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

interface GrailTrackingFieldsProps {
  values: GrailTrackingValues;
  onChange: (update: Partial<GrailTrackingValues>) => void;
}

/**
 * Switches for the grail contents (normal, ethereal, runes and runewords), shared by the settings
 * page and the setup wizard.
 */
export function GrailTrackingFields({ values, onChange }: GrailTrackingFieldsProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* Item Type Toggles */}
      <div className="space-y-4">
        <GrailTrackingSwitch
          label={t(translations.settings.grail.includeNormal)}
          description={t(translations.settings.grail.includeNormalDescription)}
          checked={values.grailNormal}
          onCheckedChange={(checked) => onChange({ grailNormal: checked })}
        />
        <GrailTrackingSwitch
          label={t(translations.settings.grail.includeEthereal)}
          description={t(translations.settings.grail.includeEtherealDescription)}
          checked={values.grailEthereal}
          onCheckedChange={(checked) => onChange({ grailEthereal: checked })}
        />
      </div>

      {/* Runes and Runewords Toggles */}
      <div className="space-y-4">
        <GrailTrackingSwitch
          label={t(translations.settings.grail.includeRunes)}
          description={t(translations.settings.grail.includeRunesDescription)}
          checked={values.grailRunes}
          onCheckedChange={(checked) => onChange({ grailRunes: checked })}
        />
        <GrailTrackingSwitch
          label={t(translations.settings.grail.includeRunewords)}
          description={t(translations.settings.grail.includeRunewordsDescription)}
          checked={values.grailRunewords}
          onCheckedChange={(checked) => onChange({ grailRunewords: checked })}
        />
      </div>
    </>
  );
}
