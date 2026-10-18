import type { Item, ParsedInventoryItem, VaultItem } from 'electron/types/grail';
import { isGrailBookmark } from 'electron/utils/vaultState';
import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ItemSummaryRow } from '@/components/inventory/ItemSummaryRow';
import { formatLocation } from '@/components/inventory/inventoryItemLabels';
import { getRollSortValue } from '@/components/inventory/itemPropertyFilters';
import { useInventorySearch } from '@/components/inventory/useInventorySearch';
import { Badge } from '@/components/ui/badge';
import { translations } from '@/i18n/translations';
import { getItemProperties } from '@/lib/itemProperties';

/** The search of the inventory browser without any filter: every item of the latest scan. */
const ALL_ITEMS_SEARCH = { searchText: '', characterId: 'all', locationContext: 'all' } as const;

type ItemCopy =
  | { kind: 'inventory'; item: ParsedInventoryItem }
  | { kind: 'vault'; item: VaultItem };

function getCopyKey(copy: ItemCopy): string {
  return copy.kind === 'vault'
    ? `vault:${copy.item.id}`
    : `inventory:${copy.item.sourceFilePath}:${copy.item.fingerprint}`;
}

/**
 * The copies of a grail item in the user's characters, stashes and vault, best roll first, with
 * where each one is and how well it rolled. They are reloaded when a save file changes.
 */
export function ItemCopiesSection({ item }: { item: Item }) {
  const { t } = useTranslation();
  const titleId = useId();
  const { isLoading, inventoryResponse } = useInventorySearch(ALL_ITEMS_SEARCH);

  const copies = useMemo((): ItemCopy[] => {
    if (!inventoryResponse) {
      return [];
    }

    const inventoryCopies: ItemCopy[] = inventoryResponse.inventory.snapshots
      .flatMap((snapshot) => snapshot.items)
      .filter((candidate) => candidate.grailItemId === item.id && !candidate.isSocketedItem)
      .map((candidate) => ({ kind: 'inventory', item: candidate }));
    const vaultCopies: ItemCopy[] = inventoryResponse.vault.items
      .filter((candidate) => candidate.grailItemId === item.id && !isGrailBookmark(candidate))
      .map((candidate) => ({ kind: 'vault', item: candidate }));
    return [...inventoryCopies, ...vaultCopies].sort(
      (a, b) => getRollSortValue(b.item) - getRollSortValue(a.item),
    );
  }, [inventoryResponse, item.id]);

  // With several copies, the ones with the highest roll quality are marked as the best
  const bestPercent =
    copies.length > 1 ? getItemProperties(copies[0].item).rollQuality?.percent : undefined;

  const renderCopies = () => {
    if (isLoading && !inventoryResponse) {
      return (
        <output className="block text-muted-foreground text-sm">
          {t(translations.common.loading)}
        </output>
      );
    }
    if (!inventoryResponse) {
      return (
        <p className="text-muted-foreground text-sm">
          {t(translations.grail.itemDetails.copies.loadError)}
        </p>
      );
    }
    if (copies.length === 0) {
      return (
        <p className="text-muted-foreground text-sm">
          {t(translations.grail.itemDetails.copies.empty)}
        </p>
      );
    }
    return (
      <ul className="space-y-1">
        {copies.map((copy) => {
          const rollQuality = getItemProperties(copy.item).rollQuality;
          const isBest = bestPercent !== undefined && rollQuality?.percent === bestPercent;
          return (
            <li
              key={getCopyKey(copy)}
              className="rounded-md border border-border/60 bg-card/40 px-3 py-1.5"
            >
              <ItemSummaryRow
                title={
                  copy.kind === 'vault'
                    ? t(translations.inventoryBrowser.vaulted)
                    : t(translations.inventoryBrowser.itemLocation, {
                        source: copy.item.characterName,
                        location: formatLocation(copy.item, t),
                      })
                }
                ethereal={copy.item.ethereal}
                rollQuality={rollQuality}
                highlight={
                  isBest ? (
                    <Badge variant="secondary" className="shrink-0">
                      {t(translations.grail.itemDetails.copies.bestRoll)}
                    </Badge>
                  ) : undefined
                }
              />
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <section aria-labelledby={titleId} className="space-y-2">
      <div className="space-y-1">
        <h3 id={titleId} className="font-semibold text-sm">
          {t(translations.grail.itemDetails.copies.title)}
        </h3>
        <p className="text-muted-foreground text-xs">
          {t(translations.grail.itemDetails.copies.description)}
        </p>
      </div>
      {renderCopies()}
    </section>
  );
}
