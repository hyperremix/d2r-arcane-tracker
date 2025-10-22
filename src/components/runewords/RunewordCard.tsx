import type { JSX } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RuneImages } from '@/components/grail/RuneImages';
import type { CraftableRuneword } from '@/lib/runeword-calculator';
import { CheckCircle2Icon, ExternalLinkIcon, XCircleIcon } from 'lucide-react';

interface RunewordCardProps {
  craftable: CraftableRuneword;
}

/**
 * Card component displaying a single runeword with its requirements and craftability status.
 */
export function RunewordCard({ craftable }: RunewordCardProps): JSX.Element {
  const { runeword, canCraft, missingRunes, hasAllRunes } = craftable;

  const openRunewordLink = () => {
    if (runeword.link) {
      window.electronAPI?.shell.openExternal(runeword.link);
    }
  };

  return (
    <Card className={canCraft ? 'border-green-500/50 bg-green-50/5' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              {runeword.name}
              {canCraft && <CheckCircle2Icon className="h-5 w-5 text-green-500" />}
            </CardTitle>
            <CardDescription className="mt-1">
              {runeword.runes?.length || 0} rune{runeword.runes && runeword.runes.length !== 1 ? 's' : ''} required
            </CardDescription>
          </div>

          {/* Link to external reference */}
          {runeword.link && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={openRunewordLink}>
              <ExternalLinkIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status Badge */}
        <div>
          {canCraft ? (
            <Badge variant="default" className="bg-green-600">
              <CheckCircle2Icon className="mr-1 h-3 w-3" />
              Craftable
            </Badge>
          ) : hasAllRunes ? (
            <Badge variant="secondary">
              <CheckCircle2Icon className="mr-1 h-3 w-3" />
              All runes collected
            </Badge>
          ) : (
            <Badge variant="secondary">
              <XCircleIcon className="mr-1 h-3 w-3" />
              {missingRunes.length} rune{missingRunes.length !== 1 ? 's' : ''} missing
            </Badge>
          )}
        </div>

        {/* Required Runes */}
        {runeword.runes && runeword.runes.length > 0 && (
          <div>
            <p className="mb-2 text-muted-foreground text-sm">Required runes:</p>
            <RuneImages runeIds={runeword.runes} viewMode="list" />
          </div>
        )}

        {/* Missing Runes (if any) */}
        {missingRunes.length > 0 && (
          <div className="rounded-md bg-muted p-3">
            <p className="mb-2 font-medium text-sm">Missing:</p>
            <div className="flex flex-wrap gap-2">
              {missingRunes.map((missing) => (
                <Badge key={missing.runeId} variant="outline">
                  {missing.runeName} x{missing.needed}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
