import type { Character, GrailProgress, Item } from 'electron/types/grail';
import type { SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { translations } from '@/i18n/translations';
import placeholderUrl from '/images/placeholder-item.svg';
import { ItemCategoryLabel } from './ItemCategoryLabel';
import { DiscoveryInfo } from './indicators';

/**
 * Swaps a broken item image for the placeholder, once, so a failing placeholder cannot loop.
 */
export function handleArtworkError(event: SyntheticEvent<HTMLImageElement>): void {
  if (event.currentTarget.src !== `${window.location.origin}${placeholderUrl}`) {
    event.currentTarget.src = placeholderUrl;
  }
}

/**
 * Props interface for the ItemTooltipBody component.
 */
interface ItemTooltipBodyProps {
  item: Item;
  allProgress: GrailProgress[];
  characters: Character[];
}

/**
 * ItemTooltipBody component that renders the name tooltip of a card: name and base item,
 * category and, when the item has been found, who found it and when.
 */
export function ItemTooltipBody({ item, allProgress, characters }: ItemTooltipBodyProps) {
  return (
    <div className="space-y-1">
      <p className="font-semibold">
        {item.name}
        {item.itemBase && ` • ${item.itemBase}`}
      </p>
      <p className="text-muted-foreground text-xs">
        <ItemCategoryLabel item={item} />
      </p>

      <DiscoveryInfo allProgress={allProgress} characters={characters} />
    </div>
  );
}

/**
 * Props interface for the CardStatusText component.
 */
interface CardStatusTextProps {
  isFound: boolean;
}

/**
 * CardStatusText component that gives a non-clickable card without version pills a "Found" /
 * "Not Found" text for assistive technology. Clickable cards carry their status in the accessible
 * name, and version pills carry theirs as screen reader text, so neither needs this.
 */
export function CardStatusText({ isFound }: CardStatusTextProps) {
  const { t } = useTranslation();
  return (
    <span className="sr-only">
      {t(isFound ? translations.common.found : translations.common.notFound)}
    </span>
  );
}
