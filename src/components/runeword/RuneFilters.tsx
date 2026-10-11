import { runes } from 'electron/items/runes';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useIconsByFilename } from '@/hooks/useIconsByFilename';
import { translations } from '@/i18n/translations';
import { cn } from '@/lib/utils';

/** Image filenames of all runes, loaded once for the whole filter list. */
const RUNE_IMAGE_FILENAMES = runes.flatMap((rune) =>
  rune.imageFilename ? [rune.imageFilename] : [],
);

/**
 * Props for the RuneFilters component
 */
interface RuneFiltersProps {
  /** Currently selected rune IDs */
  selectedRunes: string[];
  /** Callback when rune selection changes */
  onRuneSelectionChange: (runeIds: string[]) => void;
  /** Available rune counts from save files */
  availableRunes: Record<string, number>;
  /** Optional className for the root flex column */
  className?: string;
}

/**
 * RuneFilters component that displays checkboxes for filtering by runes.
 * Shows all 33 runes with their images and available counts; runes you don't own are muted.
 * Runewords must contain all selected runes to match; a button clears the selection.
 */
export function RuneFilters({
  selectedRunes,
  onRuneSelectionChange,
  availableRunes,
  className,
}: RuneFiltersProps) {
  const { t } = useTranslation();
  const headingId = useId();
  const { icons: runeImages, isLoading: imagesLoading } = useIconsByFilename(RUNE_IMAGE_FILENAMES);

  /**
   * Handles checkbox state change for a specific rune
   */
  const handleRuneToggle = (runeId: string, checked: boolean) => {
    if (checked) {
      onRuneSelectionChange([...selectedRunes, runeId]);
    } else {
      onRuneSelectionChange(selectedRunes.filter((id) => id !== runeId));
    }
  };

  /**
   * Gets the count for a specific rune
   */
  const getRuneCount = (runeId: string): number => {
    return availableRunes[runeId] || 0;
  };

  return (
    // A bounded, shrinkable flex column: the rune list gets the remaining height and only scrolls
    // when the window is too short to show every rune
    <div className={cn('flex min-h-0 flex-1 flex-col gap-4', className)}>
      {/* Header with match-all hint and Clear selection */}
      <div className="shrink-0 space-y-1 border-border border-b pb-3">
        <div className="flex items-center justify-between gap-2">
          <h3 id={headingId} className="font-semibold text-lg">
            {t(translations.runeword.filters.filterByRunes)}
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={selectedRunes.length === 0}
            onClick={() => onRuneSelectionChange([])}
          >
            {t(translations.runeword.filters.clearSelection)}
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          {t(translations.runeword.filters.matchAllHint)}
        </p>
      </div>

      {/* Two-column rune list. The sidebar card is about 607px tall with every rune shown (about
          656px with the selection summary), so the list only scrolls in windows below ~830px tall */}
      <fieldset
        aria-labelledby={headingId}
        className="grid min-h-32 min-w-0 flex-1 grid-cols-2 content-start gap-1 overflow-y-auto pb-1"
      >
        {runes.map((rune) => {
          const count = getRuneCount(rune.id);
          const isSelected = selectedRunes.includes(rune.id);
          const hasNone = count === 0;
          const imageUrl = rune.imageFilename ? runeImages.get(rune.imageFilename) : undefined;

          return (
            <div
              key={rune.id}
              className={cn(
                'flex min-w-0 items-center gap-1.5 rounded px-2 py-0.5 transition-colors hover:bg-muted',
                isSelected && 'bg-muted',
              )}
            >
              <Checkbox
                id={`rune-${rune.id}`}
                checked={isSelected}
                onCheckedChange={(checked) => handleRuneToggle(rune.id, checked as boolean)}
              />

              {/* Rune image */}
              <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                {imagesLoading ? (
                  <div className="h-full w-full animate-pulse rounded bg-muted" />
                ) : imageUrl ? (
                  <img src={imageUrl} alt={rune.name} className="h-full w-full object-contain" />
                ) : (
                  <div className="text-center text-muted-foreground text-xs">
                    {rune.id.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <Label
                htmlFor={`rune-${rune.id}`}
                className={cn(
                  'flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-1',
                  hasNone && 'text-muted-foreground',
                )}
              >
                {/* Long names are cut with an ellipsis instead of spilling into the next column */}
                <span className="min-w-0 truncate font-medium" title={rune.name}>
                  {rune.name}
                </span>
                {/* Not owning a rune is normal, not an error: zero is plain muted text, while
                    owned counts sit in a filled pill, so the two differ in shape, not only color */}
                <span
                  className={cn(
                    'shrink-0 rounded-full px-1.5 py-0.5 font-mono text-xs',
                    hasNone ? 'text-muted-foreground' : 'bg-info/15 text-info',
                  )}
                >
                  {count}
                </span>
              </Label>
            </div>
          );
        })}
      </fieldset>

      {/* Selection summary */}
      {selectedRunes.length > 0 && (
        <div className="shrink-0 border-border border-t pt-3 text-muted-foreground text-sm">
          {t(translations.runeword.filters.runesSelected, { count: selectedRunes.length })}
        </div>
      )}
    </div>
  );
}
