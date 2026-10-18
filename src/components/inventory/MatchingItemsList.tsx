import type { ParsedInventoryItem } from 'electron/types/grail';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { ItemSummaryRow } from '@/components/inventory/ItemSummaryRow';
import { formatLocation } from '@/components/inventory/inventoryItemLabels';
import { translations } from '@/i18n/translations';
import { getItemProperties } from '@/lib/itemProperties';

/** Most matching items listed at once; the rest are counted. */
export const MAX_MATCHING_ITEMS = 100;

interface MatchingItemsListProps {
  /** Matching items of the characters and stashes, in the order to show them. */
  items: ParsedInventoryItem[];
  /** Opens the character or stash window that holds the item. */
  onOpen: (item: ParsedInventoryItem) => void;
}

/**
 * The inventory items that match the filters: name, where it is, ethereal and roll quality.
 * Clicking one opens the window of the character or stash that holds it.
 */
export function MatchingItemsList({ items, onOpen }: MatchingItemsListProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const shownItems = items.slice(0, MAX_MATCHING_ITEMS);

  return (
    <section aria-labelledby={titleId} className="space-y-2 border-t pt-3">
      <div className="space-y-1">
        <h3 id={titleId} className="font-medium text-sm">
          {t(translations.inventoryBrowser.matchingItems.title)}
        </h3>
        <p className="text-muted-foreground text-xs">
          {t(translations.inventoryBrowser.matchingItems.description)}
        </p>
      </div>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {t(translations.inventoryBrowser.matchingItems.empty)}
        </p>
      ) : (
        <ul className="space-y-1">
          {shownItems.map((item) => (
            <li key={`${item.sourceFilePath}:${item.fingerprint}`}>
              <button
                type="button"
                className="w-full rounded-md border border-border/60 bg-card/40 px-3 py-1.5 text-left hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                onClick={() => onOpen(item)}
              >
                <ItemSummaryRow
                  title={item.itemName}
                  subtitle={t(translations.inventoryBrowser.itemLocation, {
                    source: item.characterName,
                    location: formatLocation(item, t),
                  })}
                  ethereal={item.ethereal}
                  rollQuality={getItemProperties(item).rollQuality}
                />
              </button>
            </li>
          ))}
        </ul>
      )}
      {items.length > shownItems.length && (
        <p className="text-muted-foreground text-xs">
          {t(translations.inventoryBrowser.matchingItems.truncated, {
            shown: shownItems.length,
            total: items.length,
          })}
        </p>
      )}
    </section>
  );
}
