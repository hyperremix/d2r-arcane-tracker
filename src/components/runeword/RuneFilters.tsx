import { runes } from 'electron/items/runes';
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { translations } from '@/i18n/translations';
import { cn } from '@/lib/utils';

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
  /** Whether to show partially complete runewords */
  showPartial: boolean;
  /** Callback when show partial toggle changes */
  onShowPartialChange: (showPartial: boolean) => void;
  /** Optional className for styling */
  className?: string;
}

/**
 * RuneFilters component that displays checkboxes for filtering by runes.
 * Shows all 33 runes with their images, available counts, and highlights runes with 0 count.
 * Includes a toggle to show/hide partially complete runewords.
 */
export function RuneFilters({
  selectedRunes,
  onRuneSelectionChange,
  availableRunes,
  showPartial,
  onShowPartialChange,
  className,
}: RuneFiltersProps) {
  const { t } = useTranslation();
  const showPartialId = useId();
  const [runeImages, setRuneImages] = useState<Map<string, string>>(new Map());
  const [imagesLoading, setImagesLoading] = useState(true);

  // Load rune images on mount
  useEffect(() => {
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Image loading with error handling requires iteration
    async function loadRuneImages() {
      const imageMap = new Map<string, string>();

      for (const rune of runes) {
        if (rune.imageFilename) {
          try {
            const iconUrl = await window.electronAPI?.icon.getByFilename(rune.imageFilename);
            if (iconUrl) {
              imageMap.set(rune.id, iconUrl);
            }
          } catch (error) {
            console.error(`Failed to load rune image for ${rune.id}:`, error);
          }
        }
      }

      setRuneImages(imageMap);
      setImagesLoading(false);
    }

    loadRuneImages();
  }, []);

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
    <div className="space-y-4">
      {/* Header with Show Partial toggle */}
      <div className="flex items-center justify-between border-border border-b pb-3">
        <h3 className="font-semibold text-lg">{t(translations.runeword.filters.filterByRunes)}</h3>
        <div className="flex items-center gap-2">
          <Label htmlFor={showPartialId} className="text-sm">
            {t(translations.runeword.filters.showPartial)}
          </Label>
          <Switch id={showPartialId} checked={showPartial} onCheckedChange={onShowPartialChange} />
        </div>
      </div>

      {/* Rune checkboxes in a scrollable grid */}
      <div className={cn('space-y-2 overflow-y-auto pr-2', className)}>
        {runes.map((rune) => {
          const count = getRuneCount(rune.id);
          const isSelected = selectedRunes.includes(rune.id);
          const hasNone = count === 0;
          const imageUrl = runeImages.get(rune.id);

          return (
            <div
              key={rune.id}
              className={cn(
                'flex items-center gap-2 rounded p-2 transition-colors hover:bg-muted',
                isSelected && 'bg-muted',
              )}
            >
              <Checkbox
                id={`rune-${rune.id}`}
                checked={isSelected}
                onCheckedChange={(checked) => handleRuneToggle(rune.id, checked as boolean)}
              />

              {/* Rune image */}
              <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                {imagesLoading ? (
                  <div className="h-full w-full animate-pulse rounded bg-muted" />
                ) : imageUrl ? (
                  <img src={imageUrl} alt={rune.name} className="h-full w-full object-contain" />
                ) : (
                  <div className="text-center text-muted-foreground/60 text-xs">
                    {rune.id.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <Label
                htmlFor={`rune-${rune.id}`}
                className={cn(
                  'flex flex-1 cursor-pointer items-center justify-between',
                  hasNone && 'text-muted-foreground/60',
                )}
              >
                <span className="font-medium">{rune.name}</span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 font-mono text-xs',
                    hasNone ? 'bg-missing/15 text-missing' : 'bg-info/15 text-info',
                  )}
                >
                  {count}
                </span>
              </Label>
            </div>
          );
        })}
      </div>

      {/* Selection summary */}
      {selectedRunes.length > 0 && (
        <div className="border-border border-t pt-3 text-muted-foreground text-sm">
          {t(translations.runeword.filters.runesSelected, {
            count: selectedRunes.length,
            plural: selectedRunes.length !== 1 ? 's' : '',
          })}
        </div>
      )}
    </div>
  );
}
