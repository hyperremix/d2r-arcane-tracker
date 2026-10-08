import type { Item } from 'electron/types/grail';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { translations } from '@/i18n/translations';
import { getRunewordCompletionStatus } from '@/lib/runeword-utils';
import { cn } from '@/lib/utils';
import { RuneImages } from '../grail/RuneImages';

/**
 * Props for the RunewordCard component
 */
interface RunewordCardProps {
  /** The runeword item to display */
  runeword: Item;
  /** Available rune counts from save files */
  availableRunes: Record<string, number>;
  /** Optional className for styling */
  className?: string;
}

/**
 * RunewordCard component that displays a runeword with its required runes and completion status.
 * Shows visual indicators for complete, partial, or missing runes.
 */
export function RunewordCard({ runeword, availableRunes, className }: RunewordCardProps) {
  const { t } = useTranslation();
  const completionStatus = getRunewordCompletionStatus(runeword, availableRunes);

  return (
    <Card className={cn('relative transition-all hover:shadow-md', className)}>
      <CardContent className="flex flex-col gap-4">
        {/* Header with name and status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h3 className="font-semibold text-lg leading-tight">{runeword.name}</h3>
            {runeword.link && (
              <a
                href={runeword.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary text-xs hover:underline"
                onClick={(e) => {
                  e.preventDefault();
                  window.electronAPI?.shell.openExternal(runeword.link);
                }}
              >
                {t(translations.runeword.card.viewDetails)}
              </a>
            )}
          </div>
          <Badge
            variant={completionStatus.complete ? 'default' : 'outline'}
            className={cn(
              'font-mono',
              completionStatus.complete && 'bg-success text-success-foreground',
            )}
          >
            <span aria-hidden="true">
              {t(translations.runeword.card.runesOwned, {
                available: completionStatus.availableCount,
                total: completionStatus.totalCount,
              })}
            </span>
            <span className="sr-only">
              {t(translations.runeword.card.runesOwnedLabel, {
                available: completionStatus.availableCount,
                total: completionStatus.totalCount,
              })}
            </span>
          </Badge>
        </div>

        {/* Required runes */}
        {runeword.runes && runeword.runes.length > 0 && (
          <RuneImages
            runeIds={runeword.runes}
            viewMode="grid"
            showRuneNames
            completionStatus={completionStatus}
          />
        )}

        {/* Complete status message */}
        {completionStatus.complete && (
          <div className="border-border border-t pt-3">
            <p className="text-center font-medium text-sm text-success">
              ✓ {t(translations.runeword.card.allRunesAvailable)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
