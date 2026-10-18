import { runes } from 'electron/items/runes';
import { Check } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useIconsByFilename } from '@/hooks/useIconsByFilename';
import { translations } from '@/i18n/translations';
import { cn } from '@/lib/utils';

/** Image filenames of all runes, loaded once for the whole filter grid. */
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
 * RuneFilters component that shows all 33 runes as a grid of toggle buttons, like the in-game
 * rune tab. Each rune shows its image, name and owned count; runes you don't own are dimmed, and a
 * selected rune is outlined and checked.
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
   * Adds the rune to the selection, or removes it when it is already selected
   */
  const handleRuneToggle = (runeId: string) => {
    if (selectedRunes.includes(runeId)) {
      onRuneSelectionChange(selectedRunes.filter((id) => id !== runeId));
    } else {
      onRuneSelectionChange([...selectedRunes, runeId]);
    }
  };

  return (
    // A bounded, shrinkable flex column: the rune grid gets the remaining height and only scrolls
    // when the window is too short to show every rune
    <div className={cn('flex min-h-0 flex-1 flex-col gap-4', className)}>
      {/* Header with match-all hint */}
      <div className="shrink-0 space-y-1 border-border border-b pb-3">
        <h3 id={headingId} className="font-semibold text-base">
          {t(translations.runeword.filters.filterByRunes)}
        </h3>
        <p className="text-muted-foreground text-xs">
          {t(translations.runeword.filters.matchAllHint)}
        </p>
      </div>

      {/* Rune grid: as many columns as fit the sidebar (four in the narrow sidebar, five in the
          wide one) */}
      <fieldset
        aria-labelledby={headingId}
        className="grid min-h-32 min-w-0 flex-1 grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] content-start gap-1 overflow-y-auto p-0.5"
      >
        {runes.map((rune) => {
          const count = availableRunes[rune.id] || 0;
          const isSelected = selectedRunes.includes(rune.id);
          const hasNone = count === 0;
          const imageUrl = rune.imageFilename ? runeImages.get(rune.imageFilename) : undefined;

          return (
            <button
              key={rune.id}
              type="button"
              aria-pressed={isSelected}
              aria-label={t(translations.runeword.filters.runeToggleLabel, {
                rune: rune.name,
                count,
              })}
              onClick={() => handleRuneToggle(rune.id)}
              className={cn(
                'relative flex min-w-0 flex-col items-center gap-0.5 rounded-md border border-transparent px-0.5 pt-2 pb-1 outline-none transition-colors',
                'hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50',
                isSelected && 'border-primary bg-primary/10 hover:bg-primary/15',
              )}
            >
              {/* Selected runes get a check besides the outline, so the state is not color only */}
              {isSelected && (
                <Check
                  aria-hidden="true"
                  strokeWidth={3}
                  className="absolute top-0.5 left-0.5 size-3 text-primary"
                />
              )}
              {/* Owned count, in the corner like a stack count in the game */}
              <span
                aria-hidden="true"
                className={cn(
                  'absolute top-0.5 right-1 font-mono text-[0.625rem] tabular-nums leading-none',
                  hasNone && 'text-muted-foreground',
                )}
              >
                {count}
              </span>

              {/* Rune image, dimmed when none is owned */}
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center',
                  hasNone && 'opacity-40 grayscale',
                )}
              >
                {imagesLoading ? (
                  <span className="size-full animate-pulse rounded bg-muted motion-reduce:animate-none" />
                ) : imageUrl ? (
                  <img src={imageUrl} alt="" className="size-full object-contain" />
                ) : (
                  <span className="text-muted-foreground text-xs">
                    {rune.id.charAt(0).toUpperCase()}
                  </span>
                )}
              </span>

              <span
                aria-hidden="true"
                className={cn(
                  'max-w-full truncate font-medium text-xs leading-tight',
                  hasNone && 'text-muted-foreground',
                )}
              >
                {rune.name}
              </span>
            </button>
          );
        })}
      </fieldset>

      {/* Selection summary and Clear selection, below the grid so the narrow sidebar's header
          does not have to fit both the heading and the button on one line */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-border border-t pt-3">
        {selectedRunes.length > 0 && (
          <span className="text-muted-foreground text-sm">
            {t(translations.runeword.filters.runesSelected, { count: selectedRunes.length })}
          </span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="ml-auto"
          disabled={selectedRunes.length === 0}
          onClick={() => onRuneSelectionChange([])}
        >
          {t(translations.runeword.filters.clearSelection)}
        </Button>
      </div>
    </div>
  );
}
