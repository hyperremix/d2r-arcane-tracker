import type { Item } from 'electron/types/grail';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
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
 * The owned/total badge is the single completion signal; missing runes are crossed out.
 *
 * The card spans three rows of its parent grid (header, runes, footer) and shares them through
 * a subgrid, so headers, rune rows and footers line up across every card in the same grid row
 * even when a long name wraps. The card sets `gap-[normal]`, which makes the subgrid inherit its
 * row gap from the parent grid, so the gap is defined in one place (the grid).
 *
 * The card is `relative` so the badge's absolutely positioned `sr-only` text is contained by the
 * card instead of the page, where it would stretch the document's scrollable height.
 */
export function RunewordCard({ runeword, availableRunes, className }: RunewordCardProps) {
  const { t } = useTranslation();
  const completionStatus = getRunewordCompletionStatus(runeword, availableRunes);
  const runeIds = runeword.runes ?? [];
  // A runeword needs one socket per rune
  const socketCount = runeIds.length;

  return (
    <Card
      className={cn(
        'relative row-span-3 grid grid-rows-subgrid gap-[normal] px-6 transition-all hover:shadow-md',
        className,
      )}
    >
      {/* Header: the name gets the full card width and the completion badge sits on its own line
          below it, so long names never collide with the badge. Most names fit on one line; a
          long one wraps instead of being cut off. */}
      <div className="flex min-w-0 flex-col items-start gap-1.5">
        <h3 className="w-full break-words font-semibold text-lg leading-tight">{runeword.name}</h3>
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

      {/* Required runes; the wrapper keeps the row in place even without runes */}
      <div>
        {runeIds.length > 0 && (
          <RuneImages
            runeIds={runeIds}
            viewMode="grid"
            showRuneNames
            completionStatus={completionStatus}
          />
        )}
      </div>

      {/* Footer: one socket per rune, and a link to the runeword's page on an external site */}
      <div className="flex items-end justify-between gap-2 border-border border-t pt-3 text-xs">
        {socketCount > 0 && (
          <span className="text-muted-foreground">
            {t(translations.runeword.card.sockets, { count: socketCount })}
          </span>
        )}
        {runeword.link && (
          <a
            href={runeword.link}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-primary hover:underline"
            onClick={(e) => {
              e.preventDefault();
              window.electronAPI?.shell.openExternal(runeword.link);
            }}
          >
            {/* Name the external site the link opens, like the item details dialog does */}
            {runeword.link.includes('diablo2.io')
              ? t(translations.grail.itemDetails.viewOnDiablo2io)
              : t(translations.grail.itemDetails.viewOnD2runewizard)}
            <ExternalLink aria-hidden="true" className="size-3" />
          </a>
        )}
      </div>
    </Card>
  );
}
