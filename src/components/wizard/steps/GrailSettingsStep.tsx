import { Trophy } from 'lucide-react';
import { useId } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useGrailStore } from '@/stores/grailStore';

/**
 * GrailSettingsStep component - Step for configuring Holy Grail tracking options.
 * Allows users to toggle tracking of normal, ethereal, runes, and runewords.
 * @returns {JSX.Element} Grail settings configuration step content
 */
export function GrailSettingsStep() {
  const grailNormalId = useId();
  const grailEtherealId = useId();
  const grailRunesId = useId();
  const grailRunewordsId = useId();
  const { settings, setSettings } = useGrailStore();

  const grailNormal = settings.grailNormal ?? true;
  const grailEthereal = settings.grailEthereal ?? false;
  const grailRunes = settings.grailRunes ?? false;
  const grailRunewords = settings.grailRunewords ?? false;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-6 w-6" />
          <h2 className="font-bold text-2xl">Holy Grail Configuration</h2>
        </div>
        <p className="text-muted-foreground">
          Choose what items you want to track in your Holy Grail collection.
        </p>
      </div>

      <div className="space-y-6">
        {/* Item Type Toggles */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor={grailNormalId} className="text-base">
                Include Normal Items
              </Label>
              <p className="text-muted-foreground text-sm">
                Track normal (non-ethereal) versions of items in your grail
              </p>
            </div>
            <Switch
              id={grailNormalId}
              checked={grailNormal}
              onCheckedChange={(checked) => setSettings({ grailNormal: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor={grailEtherealId} className="text-base">
                Include Ethereal Items
              </Label>
              <p className="text-muted-foreground text-sm">
                Track ethereal versions of items in your grail
              </p>
            </div>
            <Switch
              id={grailEtherealId}
              checked={grailEthereal}
              onCheckedChange={(checked) => setSettings({ grailEthereal: checked })}
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
              <p className="text-muted-foreground text-sm">
                Track individual runes (El, Eld, Tir, etc.) in your grail
              </p>
            </div>
            <Switch
              id={grailRunesId}
              checked={grailRunes}
              onCheckedChange={(checked) => setSettings({ grailRunes: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor={grailRunewordsId} className="text-base">
                Include Runewords
              </Label>
              <p className="text-muted-foreground text-sm">
                Track completed runewords (Spirit, Insight, etc.) in your grail
              </p>
            </div>
            <Switch
              id={grailRunewordsId}
              checked={grailRunewords}
              onCheckedChange={(checked) => setSettings({ grailRunewords: checked })}
            />
          </div>
        </div>

        {/* Information Box */}
        <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950">
          <p className="text-blue-800 text-sm dark:text-blue-200">
            <strong>Tip:</strong> Most players start by tracking normal items only. You can always
            enable ethereal items, runes, and runewords later for additional challenge!
          </p>
        </div>
      </div>
    </div>
  );
}
