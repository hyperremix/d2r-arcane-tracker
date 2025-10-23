import type { Item } from 'electron/types/grail';
import { Card, CardContent } from '@/components/ui/card';
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
                className="text-blue-600 text-xs hover:underline dark:text-blue-400"
                onClick={(e) => {
                  e.preventDefault();
                  window.electronAPI?.shell.openExternal(runeword.link);
                }}
              >
                View details
              </a>
            )}
          </div>
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
          <div className="border-gray-200 border-t pt-3 dark:border-gray-700">
            <p className="text-center font-medium text-green-600 text-sm dark:text-green-400">
              ✓ All runes available
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
