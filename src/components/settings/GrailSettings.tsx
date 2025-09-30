import { Trophy } from 'lucide-react';
import { useCallback, useId } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useGrailStore } from '@/stores/grailStore';

/**
 * GrailSettings component that provides controls for configuring Holy Grail tracking options.
 * Allows users to toggle tracking of normal items, ethereal items, runes, and runewords.
 * @returns {JSX.Element} A settings card with toggle switches for grail configuration
 */
export function GrailSettings() {
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
          Holy Grail Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Item Type Toggles */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor={grailNormalId} className="text-base">
                Include Normal Items
              </Label>
              <p className="text-gray-600 text-sm dark:text-gray-400">
                Track normal (non-ethereal) versions of items in your grail
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
                Include Ethereal Items
              </Label>
              <p className="text-gray-600 text-sm dark:text-gray-400">
                Track ethereal versions of items in your grail
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
                Include Runes
              </Label>
              <p className="text-gray-600 text-sm dark:text-gray-400">
                Track individual runes (El, Eld, Tir, etc.) in your grail
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
                Include Runewords
              </Label>
              <p className="text-gray-600 text-sm dark:text-gray-400">
                Track completed runewords (Spirit, Insight, etc.) in your grail
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
            <strong>Note:</strong> These settings affect which items are tracked in your Holy Grail.
            Changes will apply to new item discoveries and may affect your completion statistics.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
