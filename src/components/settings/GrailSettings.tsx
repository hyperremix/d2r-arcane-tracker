import { Trophy } from 'lucide-react';
import { useCallback, useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { translations } from '@/i18n/translations';
import { useGrailStore } from '@/stores/grailStore';

/**
 * GrailSettings component that provides controls for configuring Holy Grail tracking options.
 * Allows users to toggle tracking of normal items, ethereal items, runes, and runewords.
 * @returns {JSX.Element} A settings card with toggle switches for grail configuration
 */
export function GrailSettings() {
  const { t } = useTranslation();
  const grailNormalId = useId();
  const grailEtherealId = useId();
  const grailRunesId = useId();
  const grailRunewordsId = useId();
  const { settings, setSettings } = useGrailStore();

  const toggleGrailNormal = useCallback(
    (checked: boolean) => {
      setSettings({ grailNormal: checked });
    },
    [setSettings],
  );

  const toggleGrailEthereal = useCallback(
    (checked: boolean) => {
      setSettings({ grailEthereal: checked });
    },
    [setSettings],
  );

  const toggleGrailRunes = useCallback(
    (checked: boolean) => {
      setSettings({ grailRunes: checked });
    },
    [setSettings],
  );

  const toggleGrailRunewords = useCallback(
    (checked: boolean) => {
      setSettings({ grailRunewords: checked });
    },
    [setSettings],
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
        {/* Item Type Toggles */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor={grailNormalId} className="text-base">
                {t(translations.settings.grail.includeNormal)}
              </Label>
              <p className="text-gray-600 text-sm dark:text-gray-400">
                {t(translations.settings.grail.includeNormalDescription)}
              </p>
            </div>
            <Switch
              id={grailNormalId}
              checked={settings.grailNormal}
              onCheckedChange={toggleGrailNormal}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor={grailEtherealId} className="text-base">
                {t(translations.settings.grail.includeEthereal)}
              </Label>
              <p className="text-gray-600 text-sm dark:text-gray-400">
                {t(translations.settings.grail.includeEtherealDescription)}
              </p>
            </div>
            <Switch
              id={grailEtherealId}
              checked={settings.grailEthereal}
              onCheckedChange={toggleGrailEthereal}
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
              <p className="text-gray-600 text-sm dark:text-gray-400">
                {t(translations.settings.grail.includeRunesDescription)}
              </p>
            </div>
            <Switch
              id={grailRunesId}
              checked={settings.grailRunes}
              onCheckedChange={toggleGrailRunes}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor={grailRunewordsId} className="text-base">
                {t(translations.settings.grail.includeRunewords)}
              </Label>
              <p className="text-gray-600 text-sm dark:text-gray-400">
                {t(translations.settings.grail.includeRunewordsDescription)}
              </p>
            </div>
            <Switch
              id={grailRunewordsId}
              checked={settings.grailRunewords}
              onCheckedChange={toggleGrailRunewords}
            />
          </div>
        </div>

        {/* Information Box */}
        <div className="rounded bg-blue-50 p-3 dark:bg-blue-950">
          <p className="text-blue-800 text-sm dark:text-blue-200">
            <strong>{t(translations.common.note)}</strong> {t(translations.settings.grail.note)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
