import type { ItemType } from 'electron/types/grail';
import { useTranslation } from 'react-i18next';
import { translations } from '@/i18n/translations';
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
}

/**
 * Inline toggle chips for the tracked item types, colored like the item cards.
 */
export function TypeToggleChips({ typeValues, selectedTypes, onToggleType }: TypeToggleChipsProps) {
  const { t } = useTranslation();

  return (
    <fieldset className="inline-flex flex-wrap items-center gap-1.5">
      <legend className="sr-only">{t(translations.grail.advancedSearch.types)}</legend>
      {typeValues.map((type) => {
        const pressed = selectedTypes.includes(type);
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
            {t(itemTypeLabelKeys[type])}
          </button>
        );
      })}
    </fieldset>
  );
}
