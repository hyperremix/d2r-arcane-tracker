import { Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { GrailTrackingFields } from '@/components/settings/fields/GrailTrackingFields';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { translations } from '@/i18n/translations';
import { useGrailStore } from '@/stores/grailStore';

/**
 * GrailSettings component that provides controls for configuring Holy Grail tracking options.
 * Allows users to toggle tracking of normal items, ethereal items, runes, and runewords.
 * @returns {JSX.Element} A settings card with toggle switches for grail configuration
 */
export function GrailSettings() {
  const { t } = useTranslation();
  const { settings, setSettings } = useGrailStore(
    useShallow((state) => ({ settings: state.settings, setSettings: state.setSettings })),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          {t(translations.settings.grail.title)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <GrailTrackingFields
          values={{
            grailNormal: settings.grailNormal,
            grailEthereal: settings.grailEthereal,
            grailRunes: settings.grailRunes,
            grailRunewords: settings.grailRunewords,
          }}
          onChange={setSettings}
        />

        {/* Information Box */}
        <div className="rounded bg-info/10 p-3">
          <p className="text-info text-sm">
            <strong>{t(translations.common.note)}</strong> {t(translations.settings.grail.note)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
