import type { ItemType } from 'electron/types/grail';
import { useTranslation } from 'react-i18next';
import { translations } from '@/i18n/translations';
import type { ProgressCount } from '@/lib/grailStatistics';
import { itemTypeLabelKeys } from '@/lib/labelKeys';
import { cn } from '@/lib/utils';

/**
 * Item type colors for the inline type toggle chips, using the shared `--item-*` theme tokens.
 */
const typeChipStyles: Record<ItemType, { dot: string; pressed: string }> = {
  unique: { dot: 'bg-item-unique', pressed: 'border-item-unique bg-item-unique/15' },
  set: { dot: 'bg-item-set', pressed: 'border-item-set bg-item-set/15' },
  rune: { dot: 'bg-item-rune', pressed: 'border-item-rune bg-item-rune/15' },
  runeword: { dot: 'bg-item-runeword', pressed: 'border-item-runeword bg-item-runeword/15' },
};

/**
 * Props for the TypeToggleChips component.
 */
interface TypeToggleChipsProps {
  typeValues: ItemType[];
  selectedTypes: ItemType[];
  onToggleType: (type: ItemType) => void;
  /** Grail progress per item type, shown as a found/total counter on each chip */
  typeProgress: Partial<Record<ItemType, ProgressCount>>;
}

/**
 * Inline toggle chips for the tracked item types, colored like the item cards. Each chip doubles
 * as a progress counter ("Unique 142/385"), so the per-type breakdown of the grail is visible
 * next to the filter it belongs to.
 */
export function TypeToggleChips({
  typeValues,
  selectedTypes,
  onToggleType,
  typeProgress,
}: TypeToggleChipsProps) {
  const { t } = useTranslation();

  return (
    <fieldset className="inline-flex flex-wrap items-center gap-1.5">
      <legend className="sr-only">{t(translations.grail.advancedSearch.types)}</legend>
      {typeValues.map((type) => {
        const pressed = selectedTypes.includes(type);
        const label = t(itemTypeLabelKeys[type]);
        const progress = typeProgress[type];
        return (
          <button
            key={type}
            type="button"
            aria-pressed={pressed}
            onClick={() => onToggleType(type)}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 font-medium text-muted-foreground text-sm outline-none transition-colors',
              'hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50',
              pressed && ['text-foreground', typeChipStyles[type].pressed],
            )}
          >
            <span
              aria-hidden="true"
              className={cn('size-2 shrink-0 rounded-full', typeChipStyles[type].dot)}
            />
            {label}
            {progress && (
              <>
                {/* Plain space between label and counter keeps the accessible name readable */}{' '}
                <span
                  className={cn(
                    'text-muted-foreground text-xs tabular-nums',
                    pressed && 'text-foreground',
                  )}
                >
                  {progress.found}/{progress.total}
                  {/* Extra word for screen readers; the name still contains the visible counter */}
                  <span className="sr-only"> {t(translations.common.found)}</span>
                </span>
              </>
            )}
          </button>
        );
      })}
    </fieldset>
  );
}
